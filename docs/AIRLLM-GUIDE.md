# Susan AI-তে AirLLM ব্যবহার: ছোট গাইড

AirLLM হলো একটি optional local runtime, যার মাধ্যমে Hugging Face-এর supported open models নিজের computer-এ চালানো যায়। Susan AI-এর সঙ্গে ব্যবহার করলে chat prompt এবং response আপনার local machine-এই রাখা যায়; কোনো cloud API key দরকার হয় না।

> **গুরুত্বপূর্ণ:** AirLLM-এর বড় model চালাতে compatible NVIDIA GPU, CUDA/PyTorch setup এবং অনেক disk space লাগতে পারে। বর্তমান Susan AI sandbox-এ GPU নেই, তাই বড় model এখানে চালানো হয়নি।

## কী কী লাগবে

- Susan AI local browser বা desktop app
- Python 3.10+
- একটি compatible NVIDIA GPU/CUDA environment, অথবা AirLLM-supported CPU/Apple Silicon setup
- Model download ও layer-shard cache রাখার জন্য পর্যাপ্ত disk space
- Hugging Face model-এর নিজস্ব license মেনে চলা

Hosted Vercel deployment user's `localhost` access করতে পারে না। AirLLM ব্যবহার করতে Susan AI একই computer-এ local development বা desktop environment-এ চালান।

## ১. AirLLM runtime install করুন

Repository root থেকে:

```bash
cd local/airllm-server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

CUDA/PyTorch version আপনার GPU অনুযায়ী ঠিক আছে কি না আগে নিশ্চিত করুন। AirLLM install করার আগে compatible PyTorch build লাগতে পারে।

## ২. একটি model নির্বাচন করুন

প্রথম test-এর জন্য তুলনামূলক ছোট model ব্যবহার করুন। উদাহরণ:

```text
Qwen/Qwen3-4B
```

বড় model যেমন 32B, 70B বা তার বেশি ব্যবহার করার আগে GPU memory, RAM এবং disk requirement যাচাই করুন। AirLLM model প্রথমবার layer-wise shard তৈরি করতে পারে, তাই original model-এর পাশাপাশি অতিরিক্ত cache space দরকার হতে পারে।

## ৩. AirLLM service চালু করুন

```bash
cd local/airllm-server
source .venv/bin/activate

export AIRLLM_MODEL=Qwen/Qwen3-4B
export AIRLLM_CACHE_DIR=$HOME/.cache/susan-airllm

uvicorn server:app --host 127.0.0.1 --port 8000
```

`127.0.0.1` binding রাখুন। Public internet-এ unauthenticated AirLLM server expose করবেন না।

## ৪. Service health check করুন

অন্য terminal-এ চালান:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/v1/models
```

প্রথম response-এ model lazy-load হওয়ার আগ পর্যন্ত সাধারণত `configured` status দেখা যাবে। Chat request-এর সময় model load হবে। Model ঠিকমতো load হলে health response-এ `modelLoaded: true` এবং `status: "ready"` দেখা যাবে।

## ৫. Susan AI-তে AirLLM detect করুন

1. Susan AI local app বা `http://localhost:3000` খুলুন
2. **Settings → AI Providers** অথবা **Settings → API Keys** খুলুন
3. **Local AI servers** section-এ যান
4. **AirLLM (Local)** card খুঁজুন
5. **Detect & add all models** চাপুন
6. `Qwen/Qwen3-4B` model list-এ যোগ হলে Settings বন্ধ করুন
7. Composer-এর model selector থেকে `AirLLM (Local) · Qwen/Qwen3-4B` নির্বাচন করুন
8. ছোট Bengali বা English prompt পাঠিয়ে পরীক্ষা করুন

AirLLM local provider-এর default endpoint:

```text
http://localhost:8000/v1
```

এখানে API key দরকার নেই। Susan AI internally local provider-এর জন্য keyless authentication marker ব্যবহার করে।

## ৬. সরাসরি API test

Susan AI UI ব্যবহার করার আগে AirLLM endpoint পরীক্ষা করতে পারেন:

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Qwen/Qwen3-4B",
    "messages": [
      {"role": "user", "content": "বাংলায় এক লাইনে নিজের পরিচয় দিন।"}
    ],
    "max_tokens": 64
  }'
```

## Privacy model

AirLLM local provider ব্যবহার করলে:

- API key প্রয়োজন হয় না
- Prompt AirLLM local service-এ যায়
- Cloud provider-এ prompt পাঠানো হয় না
- Model এবং layer shards আপনার local cache-এ থাকে
- Browser-local conversation storage Susan AI-এর existing behavior অনুযায়ী কাজ করে

তবুও মনে রাখবেন, local machine-এর disk, logs, backups এবং operating-system access-এর নিরাপত্তা আপনার দায়িত্ব।

## Troubleshooting

### AirLLM detect হচ্ছে না

- AirLLM service চলছে কি না দেখুন
- `curl http://127.0.0.1:8000/v1/models` চালিয়ে দেখুন
- Susan AI একই computer-এ খুলেছেন কি না নিশ্চিত করুন
- Port `8000` অন্য process ব্যবহার করছে কি না পরীক্ষা করুন
- Service restart করে আবার Detect চাপুন

### `/health`-এ `degraded` দেখা যাচ্ছে

সাধারণত `AIRLLM_MODEL` set করা হয়নি বা model package/environment প্রস্তুত নয়:

```bash
export AIRLLM_MODEL=Qwen/Qwen3-4B
```

তারপর service restart করুন।

### Chat request-এ HTTP 503

এর কারণ হতে পারে:

- AirLLM package install হয়নি
- CUDA/PyTorch mismatch
- GPU memory অপর্যাপ্ত
- Model ID ভুল বা gated
- Disk space শেষ
- Hugging Face model download ব্যর্থ

Terminal log-এ বিস্তারিত error দেখুন। গোপন token বা credential log/share করবেন না।

### Model খুব ধীরে response দিচ্ছে

- ছোট model ব্যবহার করুন
- SSD cache ব্যবহার করুন
- context length এবং `max_tokens` কমান
- অন্য GPU-heavy application বন্ধ করুন
- বড় model-এর জন্য যথেষ্ট RAM/VRAM আছে কি না যাচাই করুন

### Hosted Susan AI থেকে localhost কাজ করছে না

এটি expected behavior। Hosted Vercel app user's computer-এর `localhost` দেখতে পারে না। একই computer-এ local Susan AI বা Electron desktop app ব্যবহার করুন। AirLLM server-কে public internet-এ expose করা নিরাপদ নয়।

## বর্তমান সীমাবদ্ধতা

- AirLLM provider এখন optional local provider হিসেবে detect এবং select করা যায়
- Current sidecar OpenAI-compatible chat contract দেয়
- `stream: true` compatible AirLLM/Transformers setup-এ token-by-token SSE দেয়; unsupported runtime হলে এক buffered SSE chunk-এ fallback করে
- Vision, file upload এবং tool execution AirLLM local provider-এ এখনো enabled নয়
- AirLLM model support এবং speed model, hardware, CUDA, PyTorch ও transformers compatibility-এর উপর নির্ভর করে

## সম্পর্কিত ফাইল

- [AirLLM local server](../local/airllm-server/server.py)
- [AirLLM runtime README](../local/airllm-server/README.md)
- [Susan AI local provider registry](../lib/local-providers.ts)
- [AirLLM service contract tests](../tests/airllm-service.test.mjs)
