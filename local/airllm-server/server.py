"""Small, local-only AirLLM adapter for Susan AI.

This service deliberately loads the model lazily on the first request. It is
safe to start without a GPU or model installed: /health reports unavailable
and chat returns a clear 503 instead of downloading anything automatically.
"""

from __future__ import annotations

import os
import json
import threading
import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Susan AI AirLLM Local Runtime", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

MODEL_ID = os.getenv("AIRLLM_MODEL", "").strip()
MODEL_CACHE = os.getenv("AIRLLM_CACHE_DIR", "~/.cache/huggingface")
MAX_INPUT_TOKENS = int(os.getenv("AIRLLM_MAX_INPUT_TOKENS", "2048"))

_model: Any = None
_tokenizer: Any = None
_load_error: str | None = None
_load_lock = threading.Lock()


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=100_000)


class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    max_tokens: int = Field(default=256, ge=1, le=2048)
    temperature: float = Field(default=0.7, ge=0, le=2)
    stream: bool = False


def _load_model() -> tuple[Any, Any]:
    """Load AirLLM only when a chat request arrives."""
    global _model, _tokenizer, _load_error
    if _model is not None and _tokenizer is not None:
        return _model, _tokenizer
    if not MODEL_ID:
        raise RuntimeError("AIRLLM_MODEL is not configured")
    with _load_lock:
        if _model is not None and _tokenizer is not None:
            return _model, _tokenizer
        try:
            from airllm import AutoModel

            _model = AutoModel.from_pretrained(
                MODEL_ID,
                layer_shards_saving_path=os.path.expanduser(MODEL_CACHE),
            )
            _tokenizer = _model.tokenizer
            _load_error = None
            return _model, _tokenizer
        except Exception as exc:  # pragma: no cover - hardware/model dependent
            _load_error = f"{type(exc).__name__}: {exc}"
            raise RuntimeError("AirLLM model could not be loaded") from exc


def _prompt(messages: list[ChatMessage]) -> str:
    parts = []
    for message in messages:
        parts.append(f"{message.role.upper()}: {message.content.strip()}")
    parts.append("ASSISTANT:")
    return "\n\n".join(parts)


def _generate(request: ChatRequest) -> str:
    model, tokenizer = _load_model()
    prompt = _prompt(request.messages)
    encoded = tokenizer(
        [prompt],
        return_tensors="pt",
        return_attention_mask=False,
        truncation=True,
        max_length=MAX_INPUT_TOKENS,
        padding=False,
    )
    input_ids = encoded["input_ids"]
    if hasattr(input_ids, "cuda"):
        input_ids = input_ids.cuda()
    output = model.generate(
        input_ids,
        max_new_tokens=request.max_tokens,
        temperature=request.temperature,
        do_sample=request.temperature > 0,
        use_cache=True,
        return_dict_in_generate=True,
    )
    generated = tokenizer.decode(output.sequences[0], skip_special_tokens=True)
    if generated.startswith(prompt):
        generated = generated[len(prompt):]
    return generated.strip() or "I could not generate a response."


def _error_detail() -> str:
    if _load_error:
        return "AirLLM could not load the configured model. Check CUDA, model compatibility, and disk space."
    return "Set AIRLLM_MODEL to a Hugging Face model ID and install AirLLM before sending chat requests."


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ready" if _model is not None else ("configured" if MODEL_ID and _load_error is None else "degraded"),
        "provider": "airllm",
        "model": MODEL_ID or None,
        "modelLoaded": _model is not None,
        "error": _load_error,
        "localOnly": True,
    }


@app.get("/v1/models")
def models() -> dict[str, Any]:
    model_id = MODEL_ID or "airllm-local"
    return {
        "object": "list",
        "data": [{"id": model_id, "object": "model", "owned_by": "local", "permission": []}],
    }


@app.post("/v1/chat/completions")
def chat(request: ChatRequest) -> JSONResponse | StreamingResponse:
    if request.model and MODEL_ID and request.model not in {MODEL_ID, "airllm-local"}:
        raise HTTPException(status_code=400, detail="Requested model does not match AIRLLM_MODEL")
    try:
        text = _generate(request)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail()) from exc

    created = int(time.time())
    response_id = f"chatcmpl-local-{uuid.uuid4().hex}"
    if request.stream:
        # Contract-compatible SSE for phase 1. True token-level streaming is a
        # separate phase because AirLLM's high-level generate API returns a
        # completed sequence.
        def events():
            chunk = {"id": response_id, "object": "chat.completion.chunk", "created": created, "model": MODEL_ID or "airllm-local", "choices": [{"index": 0, "delta": {"role": "assistant", "content": text}, "finish_reason": None}]}
            yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(events(), media_type="text/event-stream")

    return JSONResponse({
        "id": response_id,
        "object": "chat.completion",
        "created": created,
        "model": MODEL_ID or "airllm-local",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    })
