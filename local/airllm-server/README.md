# Susan AI · AirLLM Local Runtime (Phase 1 POC)

This is an optional Python sidecar for **local-only** AirLLM inference. Susan AI's Next.js/Vercel process does not import AirLLM directly.

## Safety defaults

- The example command binds to `127.0.0.1` only.
- The service does **not** download or load a model at startup.
- Without `AIRLLM_MODEL`, `/health` reports `degraded` and chat returns HTTP 503.
- Use only models whose Hugging Face and model licenses fit your intended use.
- Keep model cache and extracted shards on an encrypted local disk.

## Install on a GPU-capable machine

```bash
cd local/airllm-server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

For a compatible CUDA/PyTorch environment, install the correct PyTorch build before `airllm`. AirLLM's larger models can require substantial model-download and layer-shard disk space.

## Start

Use a small compatible model for the first smoke test:

```bash
export AIRLLM_MODEL=Qwen/Qwen3-4B
export AIRLLM_CACHE_DIR=$HOME/.cache/susan-airllm
uvicorn server:app --host 127.0.0.1 --port 8000
```

The model is loaded lazily on the first chat request. Check readiness:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/v1/models
```

Test the OpenAI-compatible contract:

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"Qwen/Qwen3-4B","messages":[{"role":"user","content":"বাংলায় এক লাইনে নিজের পরিচয় দিন।"}],"max_tokens":64}'
```

`stream: true` uses Transformers `TextIteratorStreamer` when the installed AirLLM/Transformers combination supports the delegated `streamer` argument. If a model/runtime combination rejects it, the sidecar falls back to one buffered SSE chunk so the OpenAI-compatible contract remains usable.

## Current scope

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- Lazy model loading
- Local-only CORS defaults for Susan AI development ports
- Clear 503 response when AirLLM/model/CUDA is unavailable

## Connect to Susan AI

The Susan AI UI can discover this service as **AirLLM (Local)** from **Settings → AI Providers → Local AI servers**. It reads `GET /v1/models` and adds each returned model as a keyless local provider. Select the detected model from the composer model selector.

Use the Bengali user guide at [`docs/AIRLLM-GUIDE.md`](../../docs/AIRLLM-GUIDE.md) for the complete setup flow. Do not expose this endpoint to the public internet or configure it as a cloud custom provider; it is intended for the same computer or a controlled local environment.
