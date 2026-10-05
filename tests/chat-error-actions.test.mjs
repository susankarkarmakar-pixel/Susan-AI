import assert from "node:assert/strict";
import test from "node:test";
import { getChatErrorAction, shouldAutomaticallyFallback } from "../lib/chat-error-actions.mjs";

test("invalid keys and denied provider access direct users to key management", () => {
  assert.equal(getChatErrorAction("Kimi rejected this API key."), "settings");
  assert.equal(getChatErrorAction("The provider denied access. Check account permissions."), "settings");
  assert.equal(getChatErrorAction("The provider reports insufficient balance or API quota."), "settings");
});

test("transient service errors and rate limits offer retry", () => {
  assert.equal(getChatErrorAction("Rate limit reached. Wait and try again."), "retry");
  assert.equal(getChatErrorAction("Provider temporarily unavailable."), "retry");
  assert.equal(getChatErrorAction("The request timed out."), "retry");
});

test("model availability offers model selection, while quota errors open account help", () => {
  assert.equal(getChatErrorAction("The selected model is unavailable."), "models");
  assert.equal(getChatErrorAction("The endpoint may be retired or unavailable."), "models");
  assert.equal(getChatErrorAction("Provider reports insufficient balance or quota."), "settings");
});

test("automatic fallback is limited to transient/model failures and never bypasses quota or access errors", () => {
  for (const message of ["Rate limit reached (429). Retry-After: 60", "Quota exceeded", "Credit balance exhausted", "Organization spend limit reached", "Invalid API key (401)", "Permission denied (403)", "Billing error (402)"]) {
    assert.equal(shouldAutomaticallyFallback(message), false, message);
  }
  for (const message of ["Provider temporarily unavailable (503)", "The request timed out", "Network connection reset", "The selected model is unavailable"]) {
    assert.equal(shouldAutomaticallyFallback(message), true, message);
  }
  assert.equal(shouldAutomaticallyFallback("A vague provider error"), false);
});
