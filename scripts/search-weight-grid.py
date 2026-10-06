#!/usr/bin/env python3
"""Find effective semantic/keyword weights for Susan AI hybrid search.

This script reuses evaluate-search-relevance.py and intentionally recomputes
hybrid scores from the candidate-level semantic and lexical fields. Stored
hybridScore/combinedScore values are ignored during the grid search.

The stability weight is fixed while semantic and keyword weights are searched
as a complementary pair:

    keyword_weight = 1 - stability_weight - semantic_weight

Examples:
  python3 scripts/search-weight-grid.py \
    --dataset data/search-relevance.json \
    --metric ndcg@5 --step 0.05 \
    --output-json reports/weight-grid.json

  python3 scripts/search-weight-grid.py \
    --dataset data/search-relevance.json \
    --metric map --top 10 --semantic-start 0.30 --semantic-end 0.80

No network calls, model inference, or third-party Python packages are used.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import math
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


EVALUATOR_PATH = Path(__file__).with_name("evaluate-search-relevance.py")


def load_evaluator():
    spec = importlib.util.spec_from_file_location("susan_search_evaluator", EVALUATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load evaluator at {EVALUATOR_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def decimal_range(start: Decimal, end: Decimal, step: Decimal) -> list[Decimal]:
    values: list[Decimal] = []
    current = start
    while current <= end + Decimal("0.0000001"):
        values.append(current)
        current += step
    return values


def metric_value(report: dict[str, Any], metric: str) -> float:
    try:
        value = report["aggregate"]["hybrid"][metric]
    except KeyError as error:
        available = ", ".join(report.get("aggregate", {}).get("hybrid", {}).keys())
        raise ValueError(f"Unknown metric {metric!r}. Available metrics: {available}") from error
    return float(value)


def run_grid(evaluator: Any, records: list[dict[str, Any]], ks: list[int], threshold: float,
             stability_weight: Decimal, semantic_start: Decimal, semantic_end: Decimal,
             step: Decimal, metric: str, top: int) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    total = Decimal("1") - stability_weight
    for semantic_decimal in decimal_range(semantic_start, semantic_end, step):
        keyword_decimal = total - semantic_decimal
        if keyword_decimal < Decimal("0"):
            continue
        semantic_weight = float(semantic_decimal)
        keyword_weight = float(keyword_decimal)
        report = evaluator.evaluate(
            records,
            ks,
            threshold,
            semantic_weight,
            keyword_weight,
            float(stability_weight),
            prefer_explicit_hybrid=False,
        )
        row = {
            "semanticWeight": semantic_weight,
            "keywordWeight": keyword_weight,
            "stabilityWeight": float(stability_weight),
            "metric": metric,
            "score": metric_value(report, metric),
        }
        for name in ("ndcg@5", "ndcg@10", "map", "mrr", "precision@5", "recall@5"):
            if name in report["aggregate"]["hybrid"]:
                row[name] = report["aggregate"]["hybrid"][name]
        results.append(row)
    results.sort(key=lambda row: (-row["score"], -row.get("map", 0.0), -row.get("mrr", 0.0), row["semanticWeight"]))
    return {"best": results[0] if results else None, "top": results[:top], "all": results}


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Grid-search semantic and keyword weights for hybrid search.")
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--metric", default="ndcg@5", help="Metric to optimize, e.g. ndcg@5, map, mrr, precision@5.")
    parser.add_argument("--k", nargs="+", type=int, default=[1, 3, 5, 10])
    parser.add_argument("--relevance-threshold", type=float, default=1.0)
    parser.add_argument("--stability-weight", type=Decimal, default=Decimal("0.10"))
    parser.add_argument("--semantic-start", type=Decimal, default=Decimal("0.00"))
    parser.add_argument("--semantic-end", type=Decimal, default=Decimal("0.90"))
    parser.add_argument("--step", type=Decimal, default=Decimal("0.05"))
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--output-json", type=Path)
    parser.add_argument("--csv", type=Path)
    args = parser.parse_args()

    if any(k <= 0 for k in args.k):
        parser.error("All --k values must be positive.")
    if args.step <= 0:
        parser.error("--step must be positive.")
    if args.top <= 0:
        parser.error("--top must be positive.")
    if not (Decimal("0") <= args.stability_weight <= Decimal("1")):
        parser.error("--stability-weight must be between 0 and 1.")
    if not (Decimal("0") <= args.semantic_start <= args.semantic_end <= Decimal("1") - args.stability_weight):
        parser.error("semantic range must be within 0 and 1-stability-weight.")

    try:
        evaluator = load_evaluator()
        payload = json.loads(args.dataset.read_text(encoding="utf-8"))
        records = evaluator.normalize_records(payload)
        ks = sorted(set(args.k))
        grid = run_grid(evaluator, records, ks, args.relevance_threshold, args.stability_weight,
                        args.semantic_start, args.semantic_end, args.step, args.metric, args.top)
        baseline_report = evaluator.evaluate(records, ks, args.relevance_threshold, 0.60, 0.30, 0.10, prefer_explicit_hybrid=False)
        baseline_score = metric_value(baseline_report, args.metric)
        for row in grid["all"]:
            row["deltaVsDefault060030010"] = row["score"] - baseline_score
        if grid["best"]:
            grid["best"]["deltaVsDefault060030010"] = grid["best"]["score"] - baseline_score
        report = {
            "config": {
                "dataset": str(args.dataset),
                "queries": len(records),
                "metric": args.metric,
                "k": ks,
                "relevanceThreshold": args.relevance_threshold,
                "stabilityWeight": float(args.stability_weight),
                "semanticRange": [float(args.semantic_start), float(args.semantic_end)],
                "step": float(args.step),
                "evaluatedConfigurations": len(grid["all"]),
                "storedHybridScoresIgnored": True,
            },
            "default": {"semanticWeight": 0.60, "keywordWeight": 0.30, "stabilityWeight": 0.10, "score": baseline_score},
            "best": grid["best"],
            "top": grid["top"],
            "all": grid["all"],
        }
    except (OSError, json.JSONDecodeError, InvalidOperation, ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(rendered + "\n", encoding="utf-8")
    if args.csv:
        write_csv(args.csv, report["all"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
