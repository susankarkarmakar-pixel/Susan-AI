#!/usr/bin/env python3
"""Offline A/B evaluation framework for Susan AI dynamic hybrid search.

The framework compares:
  control   = fixed semantic/keyword/stability weights
  treatment = query/context-aware weights from dynamic-hybrid-ranking.py

It supports paired offline evaluation on every qrel record, plus deterministic
hash-based control/treatment assignment to simulate production traffic splits.
No network calls or third-party packages are used.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import random
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DYNAMIC_PATH = ROOT / "dynamic-hybrid-ranking.py"
EVALUATOR_PATH = ROOT / "evaluate-search-relevance.py"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def candidate_id(candidate: dict[str, Any], fallback: str) -> str:
    return str(candidate.get("id") or candidate.get("url") or fallback)


def relevance_grade(qrels: dict[str, Any], result_id: str) -> float:
    value = qrels.get(result_id, 0)
    if isinstance(value, dict):
        value = value.get("relevance", value.get("grade", 0))
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return 0.0


def precision_at_k(grades: list[float], k: int, threshold: float) -> float:
    return sum(grade >= threshold for grade in grades[:k]) / max(1, k)


def recall_at_k(grades: list[float], total_relevant: int, k: int, threshold: float) -> float:
    return 0.0 if total_relevant == 0 else sum(grade >= threshold for grade in grades[:k]) / total_relevant


def reciprocal_rank(grades: list[float], threshold: float) -> float:
    for index, grade in enumerate(grades, start=1):
        if grade >= threshold:
            return 1.0 / index
    return 0.0


def average_precision(grades: list[float], total_relevant: int, threshold: float) -> float:
    if total_relevant == 0:
        return 0.0
    hits = 0
    total = 0.0
    for index, grade in enumerate(grades, start=1):
        if grade >= threshold:
            hits += 1
            total += hits / index
    return total / total_relevant


def ndcg_at_k(grades: list[float], qrels_values: list[float], k: int) -> float:
    def dcg(values: list[float]) -> float:
        return sum((2**grade - 1) / math.log2(index + 2) for index, grade in enumerate(values[:k]))

    ideal = sorted((max(0.0, value) for value in qrels_values), reverse=True)
    ideal_dcg = dcg(ideal)
    return 0.0 if ideal_dcg == 0 else dcg(grades) / ideal_dcg


def query_metrics(ranking: list[str], qrels: dict[str, Any], ks: list[int], threshold: float) -> dict[str, float]:
    grades = [relevance_grade(qrels, result_id) for result_id in ranking]
    total_relevant = sum(relevance_grade(qrels, result_id) >= threshold for result_id in qrels)
    metrics: dict[str, float] = {}
    for k in ks:
        precision = precision_at_k(grades, k, threshold)
        recall = recall_at_k(grades, total_relevant, k, threshold)
        metrics[f"precision@{k}"] = precision
        metrics[f"recall@{k}"] = recall
        metrics[f"ndcg@{k}"] = ndcg_at_k(grades, [relevance_grade(qrels, key) for key in qrels], k)
    metrics["mrr"] = reciprocal_rank(grades, threshold)
    metrics["map"] = average_precision(grades, total_relevant, threshold)
    metrics["zeroResult"] = 1.0 if not ranking else 0.0
    return metrics


def stable_assignment(record: dict[str, Any], index: int, seed: str, unit: str, treatment_percent: float) -> str:
    if unit == "user":
        value = record.get("userId") or record.get("user_id") or record.get("id") or index
    elif unit == "session":
        value = record.get("sessionId") or record.get("session_id") or record.get("id") or index
    else:
        value = record.get("id") or record.get("query") or index
    digest = hashlib.sha256(f"{seed}:{value}".encode("utf-8")).digest()
    bucket = int.from_bytes(digest[:8], "big") / 2**64 * 100
    return "treatment" if bucket < treatment_percent else "control"


def rank_control(evaluator: Any, record: dict[str, Any], weights: tuple[float, float, float]) -> list[str]:
    semantic, keyword, stability = weights
    ranked = evaluator.score_candidates(record["query"], record["candidates"], "hybrid", semantic, keyword, stability, False)
    return [candidate_id(item, str(index)) for index, (item, _) in enumerate(ranked)]


def rank_treatment(dynamic: Any, record: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
    weights, ranked = dynamic.rank_candidates(record["query"], record["candidates"], record.get("context"))
    return [candidate_id(item, str(index)) for index, item in enumerate(ranked)], {
        "semantic": weights.semantic,
        "keyword": weights.keyword,
        "stability": weights.stability,
        "profile": weights.profile,
        "confidence": weights.confidence,
        "intents": weights.intents,
    }


def aggregate(rows: list[dict[str, Any]], variant: str) -> dict[str, float]:
    metrics = [key.removeprefix(f"{variant}.") for key in rows[0] if key.startswith(f"{variant}.")] if rows else []
    return {metric: sum(float(row[f"{variant}.{metric}"]) for row in rows) / max(1, len(rows)) for metric in metrics}


def bootstrap_ci(values: list[float], iterations: int, seed: int) -> dict[str, float | None]:
    if not values:
        return {"lower": None, "upper": None, "samples": 0}
    if len(values) == 1:
        return {"lower": values[0], "upper": values[0], "samples": iterations}
    rng = random.Random(seed)
    means = []
    for _ in range(iterations):
        sample = [values[rng.randrange(len(values))] for _ in values]
        means.append(sum(sample) / len(sample))
    means.sort()
    lower_index = max(0, int(iterations * 0.025) - 1)
    upper_index = min(len(means) - 1, int(iterations * 0.975))
    return {"lower": means[lower_index], "upper": means[upper_index], "samples": iterations}


def uplift(control: float, treatment: float) -> dict[str, float | None]:
    absolute = treatment - control
    return {"control": control, "treatment": treatment, "absolute": absolute, "relativePercent": None if control == 0 else absolute / abs(control) * 100}


def run_experiment(payload: Any, args: argparse.Namespace) -> dict[str, Any]:
    dynamic = load_module("dynamic_hybrid_ranking", DYNAMIC_PATH)
    evaluator = load_module("search_evaluator", EVALUATOR_PATH)
    records = evaluator.normalize_records(payload)
    control_weights = (args.control_semantic, args.control_keyword, args.control_stability)
    rows: list[dict[str, Any]] = []
    assignment_counts: Counter[str] = Counter()
    for index, record in enumerate(records):
        assignment = stable_assignment(record, index, args.seed, args.assignment_unit, args.treatment_percent)
        assignment_counts[assignment] += 1
        control_ranking = rank_control(evaluator, record, control_weights)
        treatment_ranking, treatment_weights = rank_treatment(dynamic, record)
        control_metrics = query_metrics(control_ranking, record["qrels"], args.k, args.relevance_threshold)
        treatment_metrics = query_metrics(treatment_ranking, record["qrels"], args.k, args.relevance_threshold)
        row: dict[str, Any] = {"id": record["id"], "query": record["query"], "assignment": assignment, "treatmentProfile": treatment_weights["profile"], "treatmentWeights": treatment_weights}
        row["controlRanking"] = control_ranking[:args.preview_k]
        row["treatmentRanking"] = treatment_ranking[:args.preview_k]
        row.update({f"control.{key}": value for key, value in control_metrics.items()})
        row.update({f"treatment.{key}": value for key, value in treatment_metrics.items()})
        row.update({f"delta.{key}": treatment_metrics[key] - control_metrics[key] for key in control_metrics})
        rows.append(row)

    paired: dict[str, Any] = {}
    metric_names = list(aggregate(rows, "control"))
    for metric in metric_names:
        differences = [float(row[f"delta.{metric}"]) for row in rows]
        paired[metric] = {**uplift(sum(float(row[f"control.{metric}"]) for row in rows) / max(1, len(rows)), sum(float(row[f"treatment.{metric}"]) for row in rows) / max(1, len(rows))), "bootstrap95": bootstrap_ci(differences, args.bootstrap_iterations, args.bootstrap_seed)}

    assigned_summary = {}
    for variant in ("control", "treatment"):
        selected = [row for row in rows if row["assignment"] == variant]
        assigned_summary[variant] = {"queries": len(selected), "metrics": aggregate(selected, variant) if selected else {}}

    guardrails = {
        "minimumQueriesMet": len(rows) >= args.minimum_queries,
        "treatmentAssignmentShare": assignment_counts["treatment"] / max(1, len(rows)),
        "zeroResultDelta": paired.get("zeroResult", {}).get("absolute", 0.0),
        "zeroResultGuardrailMet": abs(paired.get("zeroResult", {}).get("absolute", 0.0)) <= args.max_zero_result_delta,
    }
    return {
        "experiment": {
            "name": args.name, "seed": args.seed, "assignmentUnit": args.assignment_unit,
            "treatmentPercent": args.treatment_percent, "queries": len(records), "k": args.k,
            "relevanceThreshold": args.relevance_threshold, "bootstrapIterations": args.bootstrap_iterations,
            "controlWeights": {"semantic": args.control_semantic, "keyword": args.control_keyword, "stability": args.control_stability},
        },
        "assignmentCounts": dict(assignment_counts),
        "pairedAllQueries": paired,
        "assignedTraffic": assigned_summary,
        "guardrails": guardrails,
        "perQuery": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="A/B test fixed versus dynamic hybrid search weights offline.")
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--name", default="dynamic-hybrid-v1")
    parser.add_argument("--assignment-unit", choices=("query", "user", "session"), default="query")
    parser.add_argument("--treatment-percent", type=float, default=50.0)
    parser.add_argument("--seed", default="susan-ai-dynamic-hybrid-v1")
    parser.add_argument("--control-semantic", type=float, default=0.60)
    parser.add_argument("--control-keyword", type=float, default=0.30)
    parser.add_argument("--control-stability", type=float, default=0.10)
    parser.add_argument("--k", nargs="+", type=int, default=[1, 3, 5, 10])
    parser.add_argument("--relevance-threshold", type=float, default=1.0)
    parser.add_argument("--bootstrap-iterations", type=int, default=2000)
    parser.add_argument("--bootstrap-seed", type=int, default=20261007)
    parser.add_argument("--minimum-queries", type=int, default=30)
    parser.add_argument("--max-zero-result-delta", type=float, default=0.02)
    parser.add_argument("--preview-k", type=int, default=5)
    parser.add_argument("--output-json", type=Path)
    args = parser.parse_args()

    if any(k <= 0 for k in args.k) or args.preview_k <= 0:
        parser.error("All k values and --preview-k must be positive.")
    if not 0 <= args.treatment_percent <= 100:
        parser.error("--treatment-percent must be between 0 and 100.")
    if args.bootstrap_iterations < 100:
        parser.error("--bootstrap-iterations must be at least 100.")
    if not math.isclose(args.control_semantic + args.control_keyword + args.control_stability, 1.0, abs_tol=1e-6):
        parser.error("Control weights must sum to 1.0.")
    try:
        payload = json.loads(args.dataset.read_text(encoding="utf-8"))
        report = run_experiment(payload, args)
    except (OSError, json.JSONDecodeError, ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(rendered + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
