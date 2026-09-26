import assert from "node:assert/strict";
import test from "node:test";
import { getChatErrorAction } from "../lib/chat-error-actions.mjs";

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
