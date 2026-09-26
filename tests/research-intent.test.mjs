import assert from "node:assert/strict";
import { test } from "node:test";
import { isResearchIntent } from "../lib/research-intent.mjs";

test("recognizes explicit English research and recency requests", () => {
  assert.equal(isResearchIntent("Research the latest changes to passkeys"), true);
  assert.equal(isResearchIntent("Compare current electric vehicle incentives and cite sources"), true);
  assert.equal(isResearchIntent("Search online for today's headlines"), true);
});

test("recognizes Bengali research and search requests", () => {
  assert.equal(isResearchIntent("বাংলাদেশের সর্বশেষ খবর খুঁজে বলুন"), true);
  assert.equal(isResearchIntent("এই দুই প্রযুক্তির তুলনা করে তথ্যসূত্র দিন"), true);
  assert.equal(isResearchIntent("বিষয়টি নিয়ে একটু রিসার্চ করুন"), true);
});

test("does not label routine chat and coding requests as research", () => {
  assert.equal(isResearchIntent("Explain recursion in simple terms"), false);
  assert.equal(isResearchIntent("Write a friendly birthday message"), false);
  assert.equal(isResearchIntent("Fix this source code function"), false);
});
