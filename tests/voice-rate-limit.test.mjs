import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Regression test: /api/voice/transcribe and /api/voice/speak both proxy
// paid OpenAI calls (Whisper and TTS) but, unlike every other route that
// calls an upstream provider (chat, providers/test, search, jules), they
// never called enforceRateLimit — a valid-looking API key string is a
// format check, not authentication, so this left two cost-bearing routes
// completely unthrottled.

const costBearingRoutes = [
  ["app/api/chat/route.ts", "chat"],
  ["app/api/providers/test/route.ts", "provider test"],
  ["app/api/search/route.ts", "search"],
  ["app/api/jules/route.ts", "Jules"],
  ["app/api/voice/transcribe/route.ts", "voice transcription"],
  ["app/api/voice/speak/route.ts", "voice synthesis"],
];

test("every route that calls a paid upstream provider enforces the shared rate limit", async () => {
  for (const [path, label] of costBearingRoutes) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /import \{[^}]*enforceRateLimit[^}]*\} from "@\/lib\/rate-limit"/, `${label} route must import enforceRateLimit`);
    assert.match(source, /await enforceRateLimit\(/, `${label} route must call enforceRateLimit before contacting the upstream provider`);
  }
});

test("voice routes handle a rate-limiter outage the same way as other routes (fail closed, 503)", async () => {
  for (const [path, label] of [["app/api/voice/transcribe/route.ts", "voice transcription"], ["app/api/voice/speak/route.ts", "voice synthesis"]]) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /RateLimitUnavailableError/, `${label} route must handle RateLimitUnavailableError`);
    assert.match(source, /503/, `${label} route must return 503 when the rate limiter is unavailable`);
  }
});
