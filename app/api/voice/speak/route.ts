import { NextResponse } from "next/server";

const MAX_TEXT_LENGTH = 8_000;
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const ALLOWED_VOICES = new Set(["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { apiKey?: unknown; text?: unknown; voice?: unknown; speed?: unknown } | null;
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voice = typeof body?.voice === "string" && ALLOWED_VOICES.has(body.voice) ? body.voice : "alloy";
    const speed = typeof body?.speed === "number" && Number.isFinite(body.speed) ? Math.min(2, Math.max(0.5, body.speed)) : 1;
    if (apiKey.length < 8 || apiKey.length > 500) return jsonError("A valid OpenAI API key is required for OpenAI voice output.", 400);
    if (!text || text.length > MAX_TEXT_LENGTH) return jsonError(`Voice text must contain 1–${MAX_TEXT_LENGTH.toLocaleString()} characters.`, 400);

    const response = await fetch(OPENAI_SPEECH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "mp3", speed }),
      cache: "no-store",
    });
    if (!response.ok) return jsonError("OpenAI could not generate voice output. Check the API key, quota, and model access.", response.status === 401 ? 401 : response.status === 429 ? 429 : 502);
    return new Response(response.body, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return jsonError("The voice service could not generate this response.", 502);
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
