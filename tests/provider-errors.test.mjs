import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { mapProviderError } from "../lib/provider-errors.mjs";

const providerSource = await readFile(new URL("../lib/ai-providers.ts", import.meta.url), "utf8");

test("NVIDIA uses a currently listed hosted model ID", () => {
  assert.match(providerSource, /nvidia:\s*\{[^\n]*model:\s*"nvidia\/nemotron-3\.5-lightning-30b-a3b"/);
  assert.doesNotMatch(providerSource, /model:\s*"meta\/llama-3\.3-70b-instruct"/);
});

test("Kimi metadata uses the current K3 model and matching international API platform", () => {
  assert.match(providerSource, /kimi:\s*\{[^\n]*model:\s*"kimi-k3"/);
  assert.match(providerSource, /setupUrl:\s*"https:\/\/platform\.kimi\.ai\/console\/api-keys"/);
  assert.match(providerSource, /baseURL:\s*"https:\/\/api\.moonshot\.ai\/v1"/);
  assert.doesNotMatch(providerSource, /moonshot-v1-8k/);
});

test("AI SDK statusCode and structured Kimi authentication errors get region-specific guidance", () => {
  const result = mapProviderError({
    statusCode: 401,
    responseBody: JSON.stringify({ error: { type: "incorrect_api_key_error", message: "Incorrect API key provided" } }),
  }, "kimi");
  assert.equal(result.status, 401);
  assert.equal(result.code, "PROVIDER_AUTH");
  assert.match(result.message, /platform\.kimi\.ai/);
  assert.match(result.message, /keys from other regional platforms.*not interchangeable/);
});

test("Kimi 403 permission failures remain distinct from authentication failures", () => {
  const result = mapProviderError({ statusCode: 403, data: { error: { type: "permission_denied_error", message: "API not open" } } }, "kimi");
  assert.equal(result.status, 403);
  assert.equal(result.code, "PROVIDER_PERMISSION");
  assert.match(result.message, /denied access/);
  assert.doesNotMatch(result.message, /API key.*rejected/i);
});

test("Kimi 404 model availability errors identify the discontinued model and K3 replacement", () => {
  const result = mapProviderError({ statusCode: 404, responseBody: JSON.stringify({ error: { type: "resource_not_found_error", message: "Model not found" } }) }, "kimi");
  assert.equal(result.status, 404);
  assert.equal(result.code, "PROVIDER_MODEL_UNAVAILABLE");
  assert.match(result.message, /kimi-k3/);
  assert.match(result.message, /moonshot-v1-8k.*discontinued/);
});

test("Kimi insufficient balance is distinguished from rate limiting while preserving documented HTTP 429", () => {
  const result = mapProviderError({
    statusCode: 429,
    responseBody: JSON.stringify({ error: { type: "exceeded_current_quota_error", message: "Account balance is insufficient" } }),
  }, "kimi");
  assert.equal(result.status, 429);
  assert.equal(result.code, "PROVIDER_QUOTA");
  assert.match(result.message, /insufficient balance or API quota/);
  assert.equal(result.retryAfterSeconds, 60);
});

test("ordinary Kimi rate limiting is not mislabeled as insufficient balance", () => {
  const result = mapProviderError({ statusCode: 429, data: { error: { type: "rate_limit_reached_error", message: "RPM limit reached" } } }, "kimi");
  assert.equal(result.status, 429);
  assert.equal(result.code, "PROVIDER_RATE_LIMIT");
  assert.match(result.message, /rate or token quota was reached/);
  assert.doesNotMatch(result.message, /insufficient balance/);
});

test("SDK errors never expose upstream bodies or credentials in public diagnostics", () => {
  const result = mapProviderError({
    statusCode: 500,
    message: "upstream error",
    responseBody: JSON.stringify({ error: { message: "api key sk-secret-value rejected" } }),
  }, "kimi");
  assert.equal(result.status, 502);
  assert.equal(result.code, "PROVIDER_ERROR");
  assert.doesNotMatch(result.message, /sk-secret-value/);
});

test("other providers keep actionable generic authentication/model diagnostics", () => {
  assert.equal(mapProviderError({ status: 401 }, "openai").code, "PROVIDER_AUTH");
  assert.equal(mapProviderError({ statusCode: 404 }, "openai").code, "PROVIDER_MODEL_UNAVAILABLE");
  assert.equal(mapProviderError({ statusCode: 429 }, "openai").code, "PROVIDER_RATE_LIMIT");
});

test("NVIDIA HTTP 410 identifies endpoint/model availability without leaking upstream details", () => {
  const result = mapProviderError({ statusCode: 410, responseBody: JSON.stringify({ message: "private upstream response" }) }, "nvidia");
  assert.equal(result.status, 410);
  assert.equal(result.code, "PROVIDER_MODEL_UNAVAILABLE");
  assert.match(result.message, /endpoint or model may be retired or unavailable/);
  assert.match(result.message, /build\.nvidia\.com/);
  assert.doesNotMatch(result.message, /private upstream response/);
});
