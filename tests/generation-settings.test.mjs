import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGenerationOptions, normalizeSystemPrompt } from "../lib/generation-settings.mjs";

test("generation options provide defaults and clamp provider-safe bounds", () => {
  assert.deepEqual(normalizeGenerationOptions(), { temperature: 0.7, maxOutputTokens: 2048 });
  assert.deepEqual(normalizeGenerationOptions({ temperature: -1, maxOutputTokens: 1 }), { temperature: 0, maxOutputTokens: 256 });
  assert.deepEqual(normalizeGenerationOptions({ temperature: 4, maxOutputTokens: 20_000 }), { temperature: 2, maxOutputTokens: 8192 });
  assert.deepEqual(normalizeGenerationOptions({ temperature: NaN, maxOutputTokens: Infinity }), { temperature: 0.7, maxOutputTokens: 2048 });
});

test("system prompt accepts optional text but rejects malformed and overlong values", () => {
  assert.deepEqual(normalizeSystemPrompt(undefined), { valid: true, prompt: "" });
  assert.deepEqual(normalizeSystemPrompt("  Be concise.  "), { valid: true, prompt: "Be concise." });
  assert.equal(normalizeSystemPrompt(123).valid, false);
  assert.equal(normalizeSystemPrompt("x".repeat(6001)).valid, false);
});
