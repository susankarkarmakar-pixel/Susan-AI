import { NextResponse } from "next/server";
import { enforceRateLimit, getClientIdentifier, RateLimitUnavailableError, RATE_LIMIT_RETRY_AFTER_SECONDS } from "@/lib/rate-limit";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
      return jsonError("Audio must be uploaded as multipart/form-data.", 415);
    }
    if (!(await enforceRateLimit(getClientIdentifier(request)))) {
      return jsonError("Too many dictation requests. Please wait a moment and try again.", 429, { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) });
    }

    const form = await request.formData();
    const apiKey = typeof form.get("apiKey") === "string" ? String(form.get("apiKey")).trim() : "";
    const audio = form.get("audio");
    const language = typeof form.get("language") === "string" ? String(form.get("language")).trim() : "";

    if (apiKey.length < 8 || apiKey.length > 500) return jsonError("A valid OpenAI API key is required for Whisper dictation.", 400);
    if (!(audio instanceof File)) return jsonError("An audio recording is required.", 400);
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) return jsonError("Audio must be between 1 byte and 15 MB.", 413);

    const upstream = new FormData();
    upstream.append("file", audio, audio.name || "susan-dictation.webm");
    upstream.append("model", "whisper-1");
    if (/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)) upstream.append("language", language.split("-")[0]);
    upstream.append("response_format", "json");

    const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError("OpenAI could not transcribe this recording. Check the API key, quota, and audio format.", response.status === 401 ? 401 : response.status === 429 ? 429 : 502);

    const text = payload && typeof payload === "object" && typeof (payload as { text?: unknown }).text === "string" ? (payload as { text: string }).text.trim() : "";
    if (!text) return jsonError("No speech was detected in the recording.", 422);
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return jsonError("Security rate limiting is temporarily unavailable. Try again shortly.", 503, { "Retry-After": "30" });
    return jsonError("The transcription service could not process this recording.", 502);
  }
}

function jsonError(error: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
