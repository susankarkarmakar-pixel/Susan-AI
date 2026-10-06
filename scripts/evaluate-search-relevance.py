#!/usr/bin/env python3
"""Offline relevance evaluation for Susan AI search rankings.

Input JSON can be either:

1) A list of query records, or an object with a ``queries`` list:
   {
     "query": "বাংলায় সরকারি স্কলারশিপ",
     "candidates": [
       {"id": "r1", "title": "...", "snippet": "...",
        "url": "https://...", "lexicalScore": 0.8,
        "semanticScore": 0.72, "hybridScore": 0.77},
       {"id": "r2", "title": "...", "snippet": "..."}
     ],
     "qrels": {"r1": 3, "r2": 0}
   }

2) A TREC-like object with ``topics`` and ``qrels``:
   {
     "topics": [{"id": "q1", "query": "...", "candidates": [...]}],
     "qrels": {"q1": {"r1": 3, "r2": 0}}
   }

Grades are integers; grades >= --relevance-threshold count as relevant.
The evaluator reports macro-averaged Precision@K, Recall@K, F1@K,
MRR, MAP, and NDCG@K for keyword, semantic, and hybrid modes.

Examples:
  python3 scripts/evaluate-search-relevance.py \
    --dataset data/search-relevance.json --k 1 3 5 10 \
    --output-json reports/search-relevance.json

  python3 scripts/evaluate-search-relevance.py \
    --dataset data/search-relevance.json --csv reports/search-relevance.csv

No network calls, model inference, or third-party Python packages are used.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

DEFAULT_K = (1, 3, 5, 10)
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
    "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "what",
    "when", "why", "with", "এবং", "এর", "কী", "কি", "করে", "করুন", "জন্য",
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
        return number if math.isfinite(number) else default
    except (TypeError, ValueError):
        return default


def normalize(value: Any) -> str:
    return str(value or "").normalize("NFKC") if hasattr(str(value or ""), "normalize") else str(value or "").lower().strip()


def normalize_text(value: Any) -> str:
    # Python's standard library has no Unicode NFKC method on str; use casefold
    # plus punctuation normalization while keeping Bengali/Hindi characters.
    return str(value or "").casefold().replace("“", "\"").replace("”", "\"").strip()


def tokenize(value: Any) -> list[str]:
    text = normalize_text(value)
    return list(dict.fromkeys(token for token in re.split(r"[^\w\u0980-\u09ff\u0900-\u097f]+", text, flags=re.UNICODE)
                  if len(token) > 1 and token not in STOP_WORDS))


def lexical_score(query: str, candidate: dict[str, Any]) -> float:
    terms = tokenize(query)
    if not terms:
        return 0.0
    title = normalize_text(candidate.get("title"))
    snippet = normalize_text(candidate.get("snippet"))
    url = normalize_text(candidate.get("displayUrl") or candidate.get("url"))
    title_matches = sum(term in title for term in terms)
    snippet_matches = sum(term in snippet for term in terms)
    url_matches = sum(term in url for term in terms)
    phrase = " ".join(terms)
    phrase_bonus = 0.15 if len(phrase) > 3 and phrase in f"{title} {snippet}" else 0.0
    coverage = (title_matches * 0.6 + snippet_matches * 0.3 + url_matches * 0.1) / len(terms)
    return clamp(coverage + phrase_bonus)


def candidate_id(candidate: dict[str, Any], fallback: str) -> str:
    value = candidate.get("id") or candidate.get("url") or fallback
    return str(value)


def explicit_score(candidate: dict[str, Any], *names: str) -> float | None:
    for name in names:
        if name in candidate and candidate[name] is not None:
            return as_float(candidate[name])
    return None


def normalize_scores(values: list[float]) -> list[float]:
    if not values:
        return []
    low, high = min(values), max(values)
    if math.isclose(low, high):
        return [1.0 if high > 0 else 0.0 for _ in values]
    return [clamp((value - low) / (high - low)) for value in values]


def score_candidates(query: str, candidates: list[dict[str, Any]], mode: str,
                     semantic_weight: float, keyword_weight: float,
                     stability_weight: float) -> list[tuple[dict[str, Any], float]]:
    keyword = [explicit_score(item, "lexicalScore", "keywordScore") for item in candidates]
    keyword = [lexical_score(query, item) if value is None else value for value, item in zip(keyword, candidates)]
    keyword = [clamp(value) for value in keyword]
    normalized_values = [explicit_score(item, "semanticNormalizedScore") for item in candidates]
    raw_values = [explicit_score(item, "semanticScore", "semantic_similarity") for item in candidates]
    semantic = [clamp(value) if value is not None else 0.0 for value in normalized_values]
    raw_semantic = [value for value in raw_values if value is not None]
    if raw_semantic:
        raw_normalized = [clamp((value + 1.0) / 2.0) if min(raw_semantic) < 0 else clamp(value) for value in raw_values]
        semantic = [normalized if normalized_values[index] is not None else raw_normalized[index] for index, normalized in enumerate(semantic)]
    semantic = normalize_scores(semantic)
    stability = [1.0 if len(candidates) <= 1 else 1.0 - index / (len(candidates) - 1) for index in range(len(candidates))]

    scored: list[tuple[dict[str, Any], float]] = []
    for index, item in enumerate(candidates):
        explicit_hybrid = explicit_score(item, "hybridScore", "combinedScore")
        if mode == "keyword":
            score = keyword[index]
        elif mode == "semantic":
            score = semantic[index]
        elif explicit_hybrid is not None:
            score = explicit_hybrid
        else:
            score = (semantic[index] * semantic_weight + keyword[index] * keyword_weight + stability[index] * stability_weight)
        scored.append((item, score))
    return sorted(scored, key=lambda pair: (-pair[1], str(pair[0].get("id") or pair[0].get("url") or "")))


def relevance_grade(qrels: dict[str, Any], result_id: str) -> float:
    value = qrels.get(result_id, 0)
    if isinstance(value, dict):
        value = value.get("relevance", value.get("grade", 0))
    return max(0.0, as_float(value))


def precision_at_k(grades: list[float], k: int, threshold: float) -> float:
    return sum(grade >= threshold for grade in grades[:k]) / max(1, k)


def recall_at_k(grades: list[float], total_relevant: int, k: int, threshold: float) -> float:
    if total_relevant == 0:
        return 0.0
    return sum(grade >= threshold for grade in grades[:k]) / total_relevant


def f1(precision: float, recall: float) -> float:
    return 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)


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


def dcg(grades: list[float], k: int) -> float:
    return sum((2**grade - 1) / math.log2(index + 2) for index, grade in enumerate(grades[:k]))


def ndcg_at_k(grades: list[float], qrels_values: Iterable[float], k: int) -> float:
    ideal = sorted((max(0.0, float(value)) for value in qrels_values), reverse=True)
    ideal_dcg = dcg(ideal, k)
    return 0.0 if ideal_dcg == 0 else dcg(grades, k) / ideal_dcg


def normalize_records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict) and isinstance(payload.get("queries"), list):
        records = payload["queries"]
    elif isinstance(payload, dict) and isinstance(payload.get("topics"), list):
        global_qrels = payload.get("qrels", {})
        records = []
        for topic in payload["topics"]:
            topic = dict(topic)
            topic.setdefault("qrels", global_qrels.get(str(topic.get("id", topic.get("query", ""))), {}))
            records.append(topic)
    else:
        raise ValueError("Dataset must be a list or an object containing 'queries' or 'topics'.")
    normalized = []
    for index, record in enumerate(records):
        if not isinstance(record, dict) or not record.get("query") or not isinstance(record.get("candidates"), list):
            raise ValueError(f"Invalid query record at index {index}: query and candidates are required.")
        qrels = record.get("qrels") or record.get("relevance") or {}
        if not isinstance(qrels, dict):
            raise ValueError(f"Invalid qrels for query {record['query']!r}; expected an object.")
        normalized.append({"id": str(record.get("id", index)), "query": str(record["query"]), "candidates": record["candidates"], "qrels": qrels})
    return normalized


def evaluate(records: list[dict[str, Any]], ks: list[int], threshold: float,
             semantic_weight: float, keyword_weight: float, stability_weight: float) -> dict[str, Any]:
    modes = ("keyword", "semantic", "hybrid")
    per_query: list[dict[str, Any]] = []
    aggregate: dict[str, dict[str, float]] = defaultdict(dict)
    for record in records:
        qrels = {str(key): value for key, value in record["qrels"].items()}
        total_relevant = sum(relevance_grade(qrels, key) >= threshold for key in qrels)
        query_result = {"id": record["id"], "query": record["query"], "candidateCount": len(record["candidates"]), "modes": {}}
        for mode in modes:
            ranked = score_candidates(record["query"], record["candidates"], mode, semantic_weight, keyword_weight, stability_weight)
            grades = [relevance_grade(qrels, candidate_id(item, str(index))) for index, (item, _) in enumerate(ranked)]
            query_result["modes"][mode] = {"ranking": [candidate_id(item, str(index)) for index, (item, _) in enumerate(ranked)], "metrics": {}}
            for k in ks:
                precision = precision_at_k(grades, k, threshold)
                recall = recall_at_k(grades, total_relevant, k, threshold)
                metrics = query_result["modes"][mode]["metrics"]
                metrics[f"precision@{k}"] = precision
                metrics[f"recall@{k}"] = recall
                metrics[f"f1@{k}"] = f1(precision, recall)
                metrics[f"ndcg@{k}"] = ndcg_at_k(grades, [relevance_grade(qrels, key) for key in qrels], k)
            query_result["modes"][mode]["metrics"]["mrr"] = reciprocal_rank(grades, threshold)
            query_result["modes"][mode]["metrics"]["map"] = average_precision(grades, total_relevant, threshold)
        per_query.append(query_result)

    for mode in modes:
        metric_names = list(per_query[0]["modes"][mode]["metrics"].keys()) if per_query else []
        aggregate[mode] = {metric: sum(item["modes"][mode]["metrics"][metric] for item in per_query) / max(1, len(per_query)) for metric in metric_names}
    comparison = {}
    for metric in aggregate.get("hybrid", {}):
        comparison[metric] = {"hybrid_vs_keyword": aggregate["hybrid"][metric] - aggregate["keyword"][metric], "hybrid_vs_semantic": aggregate["hybrid"][metric] - aggregate["semantic"][metric]}
    return {"config": {"queries": len(records), "k": ks, "relevanceThreshold": threshold, "weights": {"semantic": semantic_weight, "keyword": keyword_weight, "stability": stability_weight}}, "aggregate": dict(aggregate), "comparison": comparison, "perQuery": per_query}


def write_csv(path: Path, report: dict[str, Any]) -> None:
    rows = []
    for mode, metrics in report["aggregate"].items():
        for metric, value in metrics.items():
            rows.append({"scope": "aggregate", "query": "", "mode": mode, "metric": metric, "value": f"{value:.8f}"})
    for query in report["perQuery"]:
        for mode, payload in query["modes"].items():
            for metric, value in payload["metrics"].items():
                rows.append({"scope": "query", "query": query["query"], "mode": mode, "metric": metric, "value": f"{value:.8f}"})
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["scope", "query", "mode", "metric", "value"])
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate keyword, semantic, and hybrid search relevance offline.")
    parser.add_argument("--dataset", required=True, type=Path, help="JSON dataset containing queries, candidates, and qrels.")
    parser.add_argument("--k", nargs="+", type=int, default=list(DEFAULT_K), help="Cutoffs to evaluate, e.g. --k 1 3 5 10.")
    parser.add_argument("--relevance-threshold", type=float, default=1.0, help="Minimum qrel grade considered relevant (default: 1).")
    parser.add_argument("--semantic-weight", type=float, default=0.6)
    parser.add_argument("--keyword-weight", type=float, default=0.3)
    parser.add_argument("--stability-weight", type=float, default=0.1)
    parser.add_argument("--output-json", type=Path)
    parser.add_argument("--csv", type=Path, help="Also write a long-form CSV report.")
    args = parser.parse_args()
    if any(k <= 0 for k in args.k):
        parser.error("All --k values must be positive.")
    weight_total = args.semantic_weight + args.keyword_weight + args.stability_weight
    if not math.isclose(weight_total, 1.0, abs_tol=1e-6):
        parser.error("semantic, keyword, and stability weights must sum to 1.0.")
    try:
        payload = json.loads(args.dataset.read_text(encoding="utf-8"))
        records = normalize_records(payload)
        report = evaluate(records, sorted(set(args.k)), args.relevance_threshold, args.semantic_weight, args.keyword_weight, args.stability_weight)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(rendered + "\n", encoding="utf-8")
    if args.csv:
        write_csv(args.csv, report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
