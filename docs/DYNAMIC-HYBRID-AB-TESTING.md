# Dynamic Hybrid Search A/B Testing

`ab-test-dynamic-hybrid.py` compares Susan AI-এর fixed hybrid weights (control) এবং query/context-aware dynamic weights (treatment)। Frameworkটি offline qrels dataset ব্যবহার করে production rollout-এর আগে ranking quality evaluate করে।

## Run

```bash
python3 scripts/ab-test-dynamic-hybrid.py \
  --dataset data/search-relevance.json \
  --name dynamic-hybrid-v1 \
  --assignment-unit user \
  --treatment-percent 50 \
  --output-json reports/dynamic-hybrid-ab.json
```

Dataset-এ সাধারণ relevance-evaluation fields-এর সঙ্গে optional assignment fields রাখা যায়:

```json
{
  "id": "q-001",
  "userId": "user-42",
  "sessionId": "session-9",
  "query": "latest Bengali scholarship eligibility",
  "context": {
    "mode": "research",
    "language": "bn",
    "freshnessRequested": true,
    "previousQueries": ["government scholarships"]
  },
  "candidates": [
    {"id": "r1", "title": "...", "lexicalScore": 0.82, "semanticScore": 0.77},
    {"id": "r2", "title": "...", "lexicalScore": 0.28, "semanticScore": 0.88}
  ],
  "qrels": {"r1": 3, "r2": 0}
}
```

## What the report contains

- **Paired all-query evaluation:** একই query-তে control এবং treatment ranking-এর direct comparison
- **Deterministic assignment:** SHA-256 hash দিয়ে query/user/session stable control বা treatment bucket
- Assignment counts এবং actual treatment share
- `NDCG@K`, `MRR`, `MAP`, precision/recall এবং zero-result guardrail
- Absolute এবং relative uplift
- Paired bootstrap 95% confidence interval
- Per-query treatment profile, weights, ranking preview এবং metric deltas
- Minimum sample এবং zero-result-rate guardrail status

## Important options

```bash
--assignment-unit user          # user-level stickiness
--assignment-unit session       # session-level stickiness
--treatment-percent 50          # traffic split
--seed dynamic-hybrid-v1        # keep fixed during experiment
--bootstrap-iterations 5000     # more stable confidence interval
--minimum-queries 100           # fail guardrail below this sample
--max-zero-result-delta 0.02    # allowed treatment degradation
```

Control default weights:

```text
semantic  = 0.60
keyword   = 0.30
stability = 0.10
```

Override them only when comparing against a different production baseline:

```bash
--control-semantic 0.55 \
--control-keyword 0.35 \
--control-stability 0.10
```

## Rollout interpretation

1. **Do not ship from uplift alone.** Check the bootstrap interval and sample size.
2. Prefer treatment when the primary metric improves and the 95% interval does not materially cross zero.
3. Check `MRR` and `NDCG@5` together; one can improve while the other regresses.
4. Keep zero-result-rate and provider/error-rate guardrails non-regressing.
5. Preserve the same assignment seed during one experiment so users do not move between variants.
6. Use user-level assignment for online experiments unless query-level analysis is specifically required.
7. Keep raw queries and conversation context out of long-term analytics where possible; report hashed IDs and aggregate intent metadata instead.

## Statistical caveat

The bootstrap interval is a paired, deterministic resampling estimate—not a proof of causality. Use a held-out qrels set and run the experiment long enough to cover weekday/weekend and major language/query-intent segments before making a production decision.
