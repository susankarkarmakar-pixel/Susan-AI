import assert from "node:assert/strict";
import test from "node:test";
import { estimateConversationTokens, estimateTextTokens, formatEstimatedTokens } from "../lib/usage-estimates.mjs";

test("text token estimate uses a deterministic rough four-character heuristic", () => {
  assert.equal(estimateTextTokens(""), 0);
  assert.equal(estimateTextTokens("Hello"), 2);
  assert.equal(estimateTextTokens("12345678"), 2);
  assert.equal(estimateTextTokens(null), 0);
});

test("conversation estimate totals text and ignores non-text or hidden payload", () => {
  assert.equal(estimateConversationTokens([{ content: "hello" }, { content: "world!" }, { content: null }]), 4);
  assert.equal(estimateConversationTokens(null), 0);
});

test("token estimate formatting stays approximate and bounded", () => {
  assert.equal(formatEstimatedTokens(0), "~0");
  assert.equal(formatEstimatedTokens(1400), "~1.4k");
  assert.equal(formatEstimatedTokens(12000), "~12k");
  assert.equal(formatEstimatedTokens(2_500_000), "~2.5M");
  assert.equal(formatEstimatedTokens(Infinity), "~0");
});
