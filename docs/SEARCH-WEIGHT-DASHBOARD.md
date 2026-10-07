# Search Weight Grid Dashboard

Susan AI-এর offline hybrid-search weight grid results দেখার জন্য একটি standalone Streamlit dashboard। এটি কোনো embedding API call করে না; আগে তৈরি করা JSON বা CSV report visualise করে।

## 1. Dependencies install

Repository root থেকে:

```bash
python3 -m venv .venv-search-dashboard
. .venv-search-dashboard/bin/activate
pip install -r scripts/requirements-search-dashboard.txt
```

## 2. Grid report তৈরি

একটি labeled relevance dataset থেকে report তৈরি করুন:

```bash
python3 scripts/search-weight-grid.py \
  --dataset data/search-relevance.json \
  --metric ndcg@5 \
  --step 0.05 \
  --output-json reports/weight-grid.json \
  --csv reports/weight-grid.csv
```

## 3. Dashboard চালু করুন

```bash
streamlit run scripts/weight-grid-dashboard.py
```

তারপর browser-এ Streamlit-এর দেখানো local URL খুলে `reports/weight-grid.json` অথবা `reports/weight-grid.csv` upload করুন।

Headless/server environment-এ:

```bash
streamlit run scripts/weight-grid-dashboard.py \
  --server.address 0.0.0.0 \
  --server.port 8501
```

## Dashboard features

- Best semantic, keyword এবং stability weights
- Default `0.60 / 0.30 / 0.10` configuration-এর সঙ্গে score comparison
- Semantic বনাম keyword weight heatmap
- Semantic weight অনুযায়ী metric curve
- Top configurations table
- Selected semantic weight-এর configuration explorer
- Filtered JSON/CSV download
- Optimized metric, query count এবং evaluated configuration count

## Interpretation guidance

- সাধারণত `NDCG@5` primary metric হিসেবে ব্যবহার করুন।
- `MRR` প্রথম relevant result কত দ্রুত আসছে তা দেখায়।
- `MAP` পুরো ranking-এর consistency দেখায়।
- ছোট বা biased query set-এর উপর পাওয়া best weight production-এ সরাসরি ব্যবহার করবেন না। Held-out queries দিয়ে validate করুন।
- Heatmap-এ কাছাকাছি অনেক configuration-এর score একই হলে single exact weight-এর বদলে stable plateau-এর মাঝামাঝি weight বেছে নিন।

## Input compatibility

Dashboard `search-weight-grid.py`-এর JSON report এবং CSV দুটোই পড়ে। JSON report-এ `all`, `best`, `top`, `default` এবং `config` fields ব্যবহার করা হয়।
