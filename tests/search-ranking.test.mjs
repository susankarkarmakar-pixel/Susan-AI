import assert from "node:assert/strict";
import test from "node:test";
import { rankSearchResults } from "../lib/search-ranking.mjs";

const result = (id, title, snippet, publishedAt) => ({
  id,
  title,
  url: `https://example.com/${id}`,
  snippet,
  source: "duckduckgo",
  publishedAt,
});

test("query-aware ranking puts title and full-topic matches ahead of fresher generic results", () => {
  const genericFresh = result("fresh", "Japan travel news and 2026 updates", "Latest travel headlines for visitors.", "1 hour ago");
  const relevant = result("relevant", "Japan visa requirements for Indian citizens in 2026", "Entry documents and eligibility for Indian passport holders visiting Japan.");
  const partial = result("partial", "India travel guide", "A broad guide with a short note about visa applications.", "today");

  assert.equal(rankSearchResults([genericFresh, partial, relevant], "the India visa requirements for Japan 2026")[0].id, "relevant");
});

test("Unicode Bengali search terms can rank a matching result above unrelated content", () => {
  const unrelated = result("unrelated", "Delhi metro schedule", "Train timings and route information.");
  const relevant = result("bengali", "কলকাতার আবহাওয়া আজ", "কলকাতায় আজ বৃষ্টি ও তাপমাত্রার পূর্বাভাস।");

  assert.equal(rankSearchResults([unrelated, relevant], "কলকাতা আবহাওয়া আজ")[0].id, "bengali");
});

test("ranking preserves provider order for unusable or equally matching queries", () => {
  const first = result("first", "Current overview", "General information.");
  const second = result("second", "Current overview", "General information.");

  assert.deepEqual(rankSearchResults([first, second], "the and of").map(({ id }) => id), ["first", "second"]);
  assert.deepEqual(rankSearchResults([first, second], "current overview").map(({ id }) => id), ["first", "second"]);
});
