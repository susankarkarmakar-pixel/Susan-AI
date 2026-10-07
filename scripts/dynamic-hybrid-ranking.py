#!/usr/bin/env python3
"""Dynamic hybrid search ranking for Susan AI.

The implementation is intentionally offline and deterministic. It assigns
semantic, keyword, and rank-stability weights from query/context signals, then
ranks candidate results using those weights.

Input JSON:
  {
    "query": "latest Bengali scholarship eligibility",
    "context": {
      "previousQueries": ["government scholarships in West Bengal"],
      "conversationSummary": "The user is comparing education funding options.",
      "mode": "research"
    },
    "candidates": [
      {"id": "r1", "title": "...", "snippet": "...",
       "lexicalScore": 0.8, "semanticScore": 0.7}
    ]
  }

Output contains:
  - detected intents and signals
  - selected weights and human-readable reasons
  - ranked results with keyword, semantic, stability, and dynamic scores

No network calls, model inference, or third-party Python packages are used.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
    "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "what",
    "when", "why", "with", "এবং", "এর", "কী", "কি", "করে", "করুন", "জন্য",
}
RESEARCH_TERMS = re.compile(r"\b(research|investigat(?:e|ing|ion)|deep dive|web search|search|latest|recent|current|up[- ]to[- ]date|news|citations?|references?|fact[- ]?check|verify|compare|versus|vs)\b", re.I)
RESEARCH_TERMS_BN = re.compile(r"(সার্চ|খুঁজে|অনুসন্ধান|রিসার্চ|গবেষণা|সাম্প্রতিক|সর্বশেষ|বর্তমান|তথ্যসূত্র|উৎসসহ|তথ্যসহ|তুলনা|যাচাই|খবর|নিউজ)", re.U)
RESEARCH_TERMS_HI = re.compile(r"(खोज|सर्च|अनुसंधान|रिसर्च|शोध|हालिया|नवीनतम|वर्तमान|स्रोत|संदर्भ|तुलना|सत्यापित|खबर|समाचार)", re.U)
EXACT_TERMS = re.compile(r"(\"[^\"]+\"|'[^']+'|\bhttps?://|\bsite:|\bfiletype:|\bHTTP\s*\d{3}\b|\b[A-Z]{2,}[-_]\d+\b|\b\d+\.\d+(?:\.\d+)?\b)", re.I)
NAVIGATION_TERMS = re.compile(r"\b(login|sign[ -]?in|official|homepage|documentation|docs|download|portal|website|address|contact)\b", re.I)
NAVIGATION_TERMS_BN = re.compile(r"(অফিসিয়াল|সরকারি|ওয়েবসাইট|প্রবেশ|লগইন|ডাউনলোড|পোর্টাল|ঠিকানা)", re.U)
NAVIGATION_TERMS_HI = re.compile(r"(आधिकारिक|सरकारी|वेबसाइट|लॉग[ -]?इन|डाउनलोड|पोर्टल|पता)", re.U)
EXPLANATORY_TERMS = re.compile(r"\b(why|how does|explain|meaning|difference|overview|guide|tutorial|what is)\b", re.I)
EXPLANATORY_TERMS_BN = re.compile(r"(কেন|কীভাবে|ব্যাখ্যা|অর্থ|পার্থক্য|গাইড|নির্দেশিকা|কি)", re.U)
EXPLANATORY_TERMS_HI = re.compile(r"(क्यों|कैसे|समझाइए|अर्थ|अंतर|गाइड|मार्गदर्शिका|क्या)", re.U)
FRESHNESS_TERMS = re.compile(r"\b(today|tonight|yesterday|latest|recent|current|now|this week|this month|202[4-9]|20[3-9]\d)\b", re.I)
FRESHNESS_TERMS_BN = re.compile(r"(আজ|গতকাল|সর্বশেষ|সাম্প্রতিক|বর্তমান|এখন|এই সপ্তাহ|এই মাস|20[2-9]\d)", re.U)
FRESHNESS_TERMS_HI = re.compile(r"(आज|कल|नवीनतम|हालिया|वर्तमान|अभी|इस सप्ताह|इस महीने|20[2-9]\d)", re.U)
ROMANIZED_HI_TERMS = re.compile(r"\b(sarkari|yojana|haal|haal hi|navinatam|vartaman|khoj|samachar|tulna|srot|adhikarik|kaise|kyon)\b", re.I)
ROMANIZED_BN_TERMS = re.compile(r"\b(sorkar|sarkari|shorbosesh|sorbosesh|samprotik|bortoman|khujun|gobeshona|tulona|utso|adhikarik|kivabe|keno)\b", re.I)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def normalize_text(value: Any) -> str:
    return unicodedata.normalize("NFKC", str(value or "")).casefold().strip()


def tokenize(value: Any) -> list[str]:
    return list(dict.fromkeys(term for term in re.split(r"[^\w\u0980-\u09ff\u0900-\u097f]+", normalize_text(value), flags=re.UNICODE)
                  if len(term) > 1 and term not in STOP_WORDS))


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
        return number if math.isfinite(number) else default
    except (TypeError, ValueError):
        return default


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
    coverage = (title_matches * 0.6 + snippet_matches * 0.3 + url_matches * 0.1) / len(terms)
    phrase_bonus = 0.15 if len(terms) > 1 and " ".join(terms) in f"{title} {snippet}" else 0.0
    return clamp(coverage + phrase_bonus)


def candidate_id(candidate: dict[str, Any], fallback: str) -> str:
    return str(candidate.get("id") or candidate.get("url") or fallback)


def score_field(candidate: dict[str, Any], names: tuple[str, ...]) -> float | None:
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


def detect_language(query: str, explicit_language: str = "") -> tuple[str, float, list[str]]:
    """Return a language profile, confidence, and evidence labels.

    Explicit request context wins; otherwise script and conservative lexical
    evidence are used. Mixed Latin text remains ``unknown`` unless context
    identifies it, avoiding overconfident Bengali/Hindi guesses.
    """
    explicit = normalize_text(explicit_language)
    aliases = {"bn": "bengali", "bengali": "bengali", "বাংলা": "bengali", "hi": "hindi", "hindi": "hindi", "हिंदी": "hindi"}
    if explicit in aliases:
        return aliases[explicit], 1.0, ["explicit-context"]
    bn_count = len(re.findall(r"[\u0980-\u09ff]", query))
    hi_count = len(re.findall(r"[\u0900-\u097f]", query))
    if bn_count and bn_count >= hi_count:
        return "bengali", clamp(0.65 + min(0.3, bn_count / max(1, len(query)))), ["bengali-script"]
    if hi_count:
        return "hindi", clamp(0.65 + min(0.3, hi_count / max(1, len(query)))), ["devanagari-script"]
    bn_roman = bool(ROMANIZED_BN_TERMS.search(query))
    hi_roman = bool(ROMANIZED_HI_TERMS.search(query))
    if bn_roman and not hi_roman:
        return "bengali", 0.58, ["romanized-bengali-lexicon"]
    if hi_roman and not bn_roman:
        return "hindi", 0.58, ["romanized-hindi-lexicon"]
    return "unknown", 0.0, []


@dataclass(frozen=True)
class DynamicWeights:
    semantic: float
    keyword: float
    stability: float
    profile: str
    intents: list[str]
    signals: dict[str, Any]
    reasons: list[str]
    confidence: float


def assign_dynamic_weights(query: str, context: dict[str, Any] | None = None) -> DynamicWeights:
    context = context or {}
    text = f"{query} {context.get('conversationSummary', '')}"
    terms = tokenize(query)
    language, language_confidence, language_evidence = detect_language(query, str(context.get("language") or ""))
    mode = normalize_text(context.get("mode"))
    previous_queries = context.get("previousQueries") or []
    has_context = bool(context.get("conversationSummary") or previous_queries)
    research = bool(RESEARCH_TERMS.search(text) or RESEARCH_TERMS_BN.search(text) or RESEARCH_TERMS_HI.search(text) or mode in {"research", "search"})
    exact = bool(EXACT_TERMS.search(query))
    navigation = bool(NAVIGATION_TERMS.search(query) or (language == "bengali" and NAVIGATION_TERMS_BN.search(query)) or (language == "hindi" and NAVIGATION_TERMS_HI.search(query)))
    explanatory = bool(EXPLANATORY_TERMS.search(query) or (language == "bengali" and EXPLANATORY_TERMS_BN.search(query)) or (language == "hindi" and EXPLANATORY_TERMS_HI.search(query)))
    freshness = bool(FRESHNESS_TERMS.search(query) or (language == "bengali" and FRESHNESS_TERMS_BN.search(query)) or (language == "hindi" and FRESHNESS_TERMS_HI.search(query)) or context.get("freshnessRequested"))
    multilingual = language in {"bengali", "hindi"}
    short_follow_up = has_context and len(terms) <= 6

    semantic = 0.60
    keyword = 0.30
    stability = 0.10
    intents: list[str] = []
    reasons: list[str] = []

    if exact:
        semantic -= 0.22
        keyword += 0.20
        stability += 0.02
        intents.append("exact-match")
        reasons.append("Exact phrases, URLs, codes, or identifiers favor keyword precision.")
    if navigation:
        semantic -= 0.12
        keyword += 0.10
        stability += 0.02
        intents.append("navigational")
        reasons.append("Navigational queries benefit from title, URL, and official-domain matches.")
    if research:
        semantic += 0.08
        keyword -= 0.04
        intents.append("research")
        reasons.append("Research language benefits from semantic matching across paraphrased sources.")
    if explanatory:
        semantic += 0.10
        keyword -= 0.06
        intents.append("explanatory")
        reasons.append("Why/how/explanation queries need contextual semantic matching.")
    if freshness:
        keyword += 0.06
        stability += 0.04
        semantic -= 0.10
        intents.append("freshness-sensitive")
        reasons.append("Current/latest intent favors explicit terms and provider ordering that often carries recency.")
    if multilingual:
        intents.append(language)
        if language == "bengali":
            semantic += 0.10
            keyword -= 0.06
            reasons.append("Bengali calibration increases semantic coverage for inflection and spelling variation.")
        elif language == "hindi":
            semantic += 0.07
            keyword -= 0.03
            reasons.append("Hindi calibration favors semantic matching while retaining stronger keyword evidence for named entities.")
        if language_confidence < 0.7:
            stability += 0.03
            reasons.append("Language evidence is uncertain, so rank stability is slightly increased.")
    if short_follow_up:
        semantic += 0.10
        keyword -= 0.06
        intents.append("contextual-follow-up")
        reasons.append("A short follow-up with conversation context is weighted toward semantic continuity.")
    if not intents:
        intents.append("general")
        reasons.append("General queries use balanced semantic and keyword evidence.")

    semantic = max(0.05, semantic)
    keyword = max(0.05, keyword)
    stability = max(0.05, stability)
    total = semantic + keyword + stability
    semantic, keyword, stability = semantic / total, keyword / total, stability / total

    matched_signal_count = sum([exact, navigation, research, explanatory, freshness, multilingual, short_follow_up])
    confidence = clamp(0.52 + matched_signal_count * 0.07 + (0.08 if context.get("mode") else 0.0))
    language_prefix = {"bengali": "bn", "hindi": "hi"}.get(language, "")
    base_profile = "exact" if exact or navigation else "fresh-research" if freshness and research else "semantic-context" if explanatory or short_follow_up or multilingual else "research" if research else "general"
    profile = f"{language_prefix}-{base_profile}" if language_prefix else base_profile
    return DynamicWeights(
        semantic=round(semantic, 6),
        keyword=round(keyword, 6),
        stability=round(stability, 6),
        profile=profile,
        intents=intents,
        signals={
            "termCount": len(terms), "language": language, "languageConfidence": round(language_confidence, 3), "languageEvidence": language_evidence,
            "research": research, "exact": exact, "navigation": navigation, "explanatory": explanatory,
            "freshness": freshness, "multilingual": multilingual, "shortFollowUp": short_follow_up,
        },
        reasons=reasons,
        confidence=round(confidence, 3),
    )


def rank_candidates(query: str, candidates: list[dict[str, Any]], context: dict[str, Any] | None = None) -> tuple[DynamicWeights, list[dict[str, Any]]]:
    weights = assign_dynamic_weights(query, context)
    keyword_values = [score_field(item, ("lexicalScore", "keywordScore")) for item in candidates]
    keyword = [lexical_score(query, item) if value is None else clamp(value) for value, item in zip(keyword_values, candidates)]
    normalized_values = [score_field(item, ("semanticNormalizedScore",)) for item in candidates]
    raw_values = [score_field(item, ("semanticScore", "semantic_similarity")) for item in candidates]
    raw_present = [value for value in raw_values if value is not None]
    semantic = [clamp(value) if value is not None else 0.0 for value in normalized_values]
    if raw_present:
        raw_semantic = [clamp((value + 1) / 2) if min(raw_present) < 0 and value is not None else clamp(value) if value is not None else 0.0 for value in raw_values]
        semantic = [semantic[index] if normalized_values[index] is not None else raw_semantic[index] for index in range(len(candidates))]
    semantic = normalize_scores(semantic)
    stability = [1.0 if len(candidates) <= 1 else 1.0 - index / (len(candidates) - 1) for index in range(len(candidates))]

    ranked = []
    for index, candidate in enumerate(candidates):
        dynamic_score = semantic[index] * weights.semantic + keyword[index] * weights.keyword + stability[index] * weights.stability
        item = dict(candidate)
        item.update({
            "keywordScore": round(keyword[index], 6),
            "semanticScoreNormalized": round(semantic[index], 6),
            "stabilityScore": round(stability[index], 6),
            "dynamicHybridScore": round(dynamic_score, 6),
        })
        ranked.append(item)
    ranked.sort(key=lambda item: (-item["dynamicHybridScore"], candidate_id(item, "")))
    return weights, ranked


def load_request(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not payload.get("query") or not isinstance(payload.get("candidates"), list):
        raise ValueError("Input must contain a query and a candidates array.")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Assign dynamic hybrid-search weights and rank candidates offline.")
    parser.add_argument("--input", required=True, type=Path, help="JSON file containing query, optional context, and candidates.")
    parser.add_argument("--output", type=Path, help="Optional JSON output path.")
    args = parser.parse_args()
    try:
        request = load_request(args.input)
        weights, ranked = rank_candidates(str(request["query"]), request["candidates"], request.get("context"))
        output = {"query": request["query"], "context": request.get("context", {}), "weights": asdict(weights), "results": ranked}
        rendered = json.dumps(output, ensure_ascii=False, indent=2)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
