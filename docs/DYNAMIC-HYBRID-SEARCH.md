# Dynamic Hybrid Search

`scripts/dynamic-hybrid-ranking.py` query intent এবং optional conversation context দেখে semantic, keyword এবং rank-stability weights dynamically assign করে। এটি offline deterministic implementation; কোনো API call করে না।

## Run

```bash
python3 scripts/dynamic-hybrid-ranking.py \
  --input data/dynamic-search-request.json \
  --output reports/dynamic-search-result.json
```

## Input

```json
{
  "query": "সর্বশেষ সরকারি স্কলারশিপের যোগ্যতা",
  "context": {
    "mode": "research",
    "language": "bn",
    "freshnessRequested": true,
    "previousQueries": ["সরকারি স্কলারশিপ কোথায় পাওয়া যায়"],
    "conversationSummary": "The user is comparing education funding options."
  },
  "candidates": [
    {
      "id": "r1",
      "title": "সরকারি স্কলারশিপের সর্বশেষ গাইড",
      "snippet": "যোগ্যতা এবং আবেদনের সময়সীমা",
      "url": "https://example.gov/scholarship",
      "lexicalScore": 0.86,
      "semanticScore": 0.77
    }
  ]
}
```

Candidate-এ score না থাকলে title, snippet এবং URL থেকে keyword score calculate হবে। Semantic score না থাকলে সেটি `0` হিসেবে ধরা হবে; actual semantic retrieval layer score যোগ করলে dynamic ranking সেটি ব্যবহার করবে।

## Signals

- Exact phrase, URL, `site:`, `filetype:`, HTTP error code বা identifier → keyword-heavy
- `latest`, `current`, `news`, `সর্বশেষ`, `বর্তমান` → freshness-sensitive
- `research`, `compare`, `references`, `তুলনা`, `গবেষণা` → research profile
- `why`, `how`, `explain`, `guide` → semantic-context profile
- Bengali/Hindi query → multilingual semantic boost
- Short follow-up + previous query/summary → contextual semantic boost
- Login, official, docs, download, portal → navigational keyword boost

## Output

```json
{
  "weights": {
    "semantic": 0.62,
    "keyword": 0.29,
    "stability": 0.09,
    "profile": "fresh-research",
    "intents": ["research", "freshness-sensitive", "multilingual"],
    "signals": {},
    "reasons": [],
    "confidence": 0.73
  },
  "results": [
    {
      "id": "r1",
      "keywordScore": 0.86,
      "semanticScoreNormalized": 0.77,
      "stabilityScore": 1.0,
      "dynamicHybridScore": 0.7941
    }
  ]
}
```

## Production guidance

- Context local রাখুন; conversationSummary-তে secret/API key পাঠাবেন না।
- Weights-এর output observability-তে log করার সময় full query না রেখে hashed query বা intent metadata ব্যবহার করুন।
- Offline qrels dataset দিয়ে প্রতি profile আলাদা evaluate করুন।
- Dynamic weights-এর উপর hard bounds রাখা আছে, এবং সব weights normalize হয়ে `1.0` হয়।
- Profile changes deploy করার আগে default hybrid weights-এর সঙ্গে NDCG@5, MRR এবং MAP তুলনা করুন।
