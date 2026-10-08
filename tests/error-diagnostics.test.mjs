import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyRequestError,
  createCorrelationId,
  createErrorDiagnostic,
  formatDiagnosticMessage,
} from "../lib/error-diagnostics.mjs";

const testId = "req_1234567890abcdef12345678";

test("correlation IDs use cryptographically secure random UUIDs when available", () => {
  const id = createCorrelationId({ randomUUID: () => "12345678-1234-4234-8234-123456789abc" });
  assert.equal(id, "req_12345678-1234-4234-8234-123456789abc");
});

test("correlation IDs have a secure random-bytes fallback", () => {
  const id = createCorrelationId({ getRandomValues: (bytes) => { bytes.fill(15); return bytes; } });
  assert.equal(id, `req_${"0f".repeat(16)}`);
});

test("error classification distinguishes provider authentication, quota, billing and transient errors", () => {
  assert.equal(classifyRequestError(401), "PROVIDER_AUTH");
  assert.equal(classifyRequestError(403), "PROVIDER_PERMISSION");
  assert.equal(classifyRequestError(402), "PROVIDER_BILLING");
  assert.equal(classifyRequestError(429, "Account quota reached"), "PROVIDER_QUOTA");
  assert.equal(classifyRequestError(429, "Too many requests"), "PROVIDER_RATE_LIMIT");
  assert.equal(classifyRequestError(413), "REQUEST_TOO_LARGE");
  assert.equal(classifyRequestError(503, "temporarily unavailable"), "PROVIDER_UNAVAILABLE");
  assert.equal(classifyRequestError(504), "PROVIDER_TIMEOUT");
  assert.equal(classifyRequestError(400, "File attachment unsupported"), "ATTACHMENT_UNSUPPORTED");
});

test("diagnostic response includes only a safe message, a known code, and a validated correlation ID", () => {
  const diagnostic = createErrorDiagnostic("The provider rejected this API key.", 401, testId, "PROVIDER_AUTH");
  assert.deepEqual(diagnostic, {
    error: "The provider rejected this API key.",
    code: "PROVIDER_AUTH",
    correlationId: testId,
  });
  assert.doesNotMatch(JSON.stringify(diagnostic), /sk-secret|prompt|response body/i);
});

test("untrusted code and reference values are replaced with safe defaults", () => {
  const diagnostic = createErrorDiagnostic("Invalid request.", 400, "../../private", "PROMPT_LEAK");
  assert.equal(diagnostic.code, "REQUEST_INVALID");
  assert.match(diagnostic.correlationId, /^req_[a-zA-Z0-9_-]{16,80}$/);
});

test("streamed diagnostic text remains actionable without revealing an upstream body", () => {
  const text = formatDiagnosticMessage("The provider could not complete the request.", "PROVIDER_ERROR", testId);
  assert.match(text, /Error code: PROVIDER_ERROR/);
  assert.match(text, new RegExp(testId));
  assert.doesNotMatch(text, /sk-secret|upstream response/i);
});
