import type { SearchResult } from "./web-search";
import { buildSearchDiagnostics, type RankedSearchResult, type SearchDiagnostics } from "./search-diagnostics";
import { getCachedEmbeddings } from "./embedding-cache";

const EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_EMBEDDING_TEXT = 2_000;
const SEMANTIC_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.3;
const RANK_STABILITY_WEIGHT = 0.1;

export async function semanticRerank(query: string, results: SearchResult[], apiKey: string): Promise<{ results: RankedSearchResult[]; diagnostics: SearchDiagnostics }> {
  const lexical = results.map((result) => ({ ...result, lexicalScore: lexicalScore(query, result) }));
  if (!query.trim() || lexical.length === 0) return { results: lexical, diagnostics: buildSearchDiagnostics(query, lexical, lexical, false) };

  const inputs = [query, ...lexical.map((result) => `${result.title}\n${result.snippet}\n${result.displayUrl || result.url}`.slice(0, MAX_EMBEDDING_TEXT))];
  const vectors = await createEmbeddings(inputs, apiKey);
  const queryVector = vectors[0];
  const reranked = lexical.map((result, index) => {
    const semanticScore = cosineSimilarity(queryVector, vectors[index + 1]);
    const semanticNormalizedScore = normalizeSemanticScore(semanticScore);
    const lexicalRankScore = lexical.length === 1 ? 1 : 1 - index / (lexical.length - 1);
    const hybridScore = semanticNormalizedScore * SEMANTIC_WEIGHT + result.lexicalScore * KEYWORD_WEIGHT + lexicalRankScore * RANK_STABILITY_WEIGHT;
    return { ...result, semanticScore, semanticNormalizedScore, lexicalRankScore, hybridScore, combinedScore: hybridScore };
  }).sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0));

  return { results: reranked, diagnostics: buildSearchDiagnostics(query, lexical, reranked, true) };
}

function normalizeSemanticScore(value: number): number {
  return Math.max(0, Math.min(1, (value + 1) / 2));
}

async function createEmbeddings(input: string[], apiKey: string): Promise<number[][]> {
  return getCachedEmbeddings(input, apiKey, async (missingInputs) => {
    const response = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: missingInputs, encoding_format: "float", dimensions: 512 }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Embedding provider request failed.");
    const payload = await response.json() as { data?: Array<{ index?: number; embedding?: number[] }> };
    return (payload.data || []).sort((a, b) => (a.index || 0) - (b.index || 0)).map((item) => item.embedding).filter((item): item is number[] => Array.isArray(item));
  });
}

function cosineSimilarity(first: number[], second: number[]): number {
  if (!first.length || first.length !== second.length) return 0;
  let dot = 0; let firstMagnitude = 0; let secondMagnitude = 0;
  for (let index = 0; index < first.length; index += 1) { dot += first[index] * second[index]; firstMagnitude += first[index] ** 2; secondMagnitude += second[index] ** 2; }
  const denominator = Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude);
  return denominator === 0 ? 0 : dot / denominator;
}

function lexicalScore(query: string, result: SearchResult): number {
  const terms = tokenize(query);
  if (terms.length === 0) return 0;
  const title = normalize(result.title); const snippet = normalize(result.snippet); const url = normalize(result.displayUrl || result.url);
  const titleMatches = terms.filter((term) => title.includes(term)).length;
  const snippetMatches = terms.filter((term) => snippet.includes(term)).length;
  const urlMatches = terms.filter((term) => url.includes(term)).length;
  return Math.min(1, titleMatches / terms.length * 0.6 + snippetMatches / terms.length * 0.3 + urlMatches / terms.length * 0.1);
}

function tokenize(value: string): string[] { return Array.from(new Set(normalize(value).split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1))); }
function normalize(value: string): string { return value.normalize("NFKC").toLocaleLowerCase().trim(); }
