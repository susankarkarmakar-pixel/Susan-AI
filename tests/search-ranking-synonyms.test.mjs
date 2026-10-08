import assert from "node:assert/strict";
import test from "node:test";
import { rankSearchResults } from "../lib/search-ranking.mjs";

function result(id, title, snippet = "") {
  return {
    id,
    title,
    url: `https://example.com/${id}`,
    snippet,
    source: "duckduckgo",
  };
}

const idsInRankOrder = (results, query) =>
  rankSearchResults(results, query).map(({ id }) => id);

test("exact title phrase ranks above a synonym match", () => {
  const synonymMatch = result("bengali-synonym", "ভিসা Japan application");
  const exactMatch = result("exact-phrase", "visa Japan");

  assert.deepEqual(
    idsInRankOrder([synonymMatch, exactMatch], "visa Japan"),
    ["exact-phrase", "bengali-synonym"],
  );
});

test("a synonym match ranks above a result with no matching synonym", () => {
  const unrelated = result("unrelated", "Japan travel guide", "Popular places to visit.");
  const synonymMatch = result("synonym", "ভিসা Japan application", "ভিসার আবেদন ও প্রয়োজনীয় কাগজপত্র।");

  assert.deepEqual(
    idsInRankOrder([unrelated, synonymMatch], "visa Japan"),
    ["synonym", "unrelated"],
  );
});

test("an exact title match ranks above terms found only in the snippet", () => {
  const snippetOnly = result(
    "snippet-only",
    "Japan travel guide",
    "Visa requirements for Japan and entry details.",
  );
  const titleMatch = result(
    "title-match",
    "Visa requirements for Japan",
    "Entry documents and other useful information.",
  );

  assert.deepEqual(
    idsInRankOrder([snippetOnly, titleMatch], "visa requirements Japan"),
    ["title-match", "snippet-only"],
  );
});

test("an exact query phrase in the title beats the same terms in a different order", () => {
  const reorderedTerms = result("reordered", "Japan travel visa");
  const exactPhrase = result("phrase", "visa Japan");

  assert.deepEqual(
    idsInRankOrder([reorderedTerms, exactPhrase], "visa Japan"),
    ["phrase", "reordered"],
  );
});

test("equal-scoring results preserve the provider's original order", () => {
  const first = result("first", "General visa information", "Visa guidance for travelers.");
  const second = result("second", "General visa information", "Visa guidance for travelers.");

  assert.deepEqual(
    idsInRankOrder([first, second], "visa"),
    ["first", "second"],
  );
});
