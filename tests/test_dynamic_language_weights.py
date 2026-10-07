#!/usr/bin/env python3
"""Regression checks for language-specific dynamic hybrid weights."""

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "scripts" / "dynamic-hybrid-ranking.py"
spec = importlib.util.spec_from_file_location("dynamic_language_test_module", PATH)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def test_bengali_profile() -> None:
    weights = module.assign_dynamic_weights(
        "সর্বশেষ সরকারি স্কলারশিপের যোগ্যতা",
        {"language": "bn", "mode": "research", "freshnessRequested": True},
    )
    assert weights.signals["language"] == "bengali"
    assert "bengali" in weights.intents
    assert weights.profile == "bn-exact"
    assert weights.signals["navigation"] is True
    assert abs(weights.semantic + weights.keyword + weights.stability - 1.0) < 1e-6


def test_hindi_profile_and_hindi_intents() -> None:
    weights = module.assign_dynamic_weights(
        "नवीनतम सरकारी योजना की पात्रता",
        {"language": "hi", "mode": "research", "freshnessRequested": True},
    )
    assert weights.signals["language"] == "hindi"
    assert "hindi" in weights.intents
    assert "research" in weights.intents
    assert "freshness-sensitive" in weights.intents
    assert weights.profile == "hi-exact"
    assert weights.signals["navigation"] is True
    assert abs(weights.semantic + weights.keyword + weights.stability - 1.0) < 1e-6


def test_script_detection_without_language_context() -> None:
    bengali, bn_confidence, bn_evidence = module.detect_language("সরকারি চাকরির খবর")
    hindi, hi_confidence, hi_evidence = module.detect_language("सरकारी नौकरी की खबर")
    assert bengali == "bengali" and bn_confidence > 0.65 and "bengali-script" in bn_evidence
    assert hindi == "hindi" and hi_confidence > 0.65 and "devanagari-script" in hi_evidence


def test_explicit_context_resolves_romanized_queries() -> None:
    weights = module.assign_dynamic_weights("sarkari yojana ka latest update", {"language": "hi"})
    assert weights.signals["language"] == "hindi"
    assert weights.signals["languageConfidence"] == 1.0
    assert weights.signals["languageEvidence"] == ["explicit-context"]


if __name__ == "__main__":
    for test in (test_bengali_profile, test_hindi_profile_and_hindi_intents, test_script_detection_without_language_context, test_explicit_context_resolves_romanized_queries):
        test()
    print("dynamic language weight tests passed")
