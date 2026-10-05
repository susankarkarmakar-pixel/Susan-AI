export type SearchProvider = "all" | "google" | "bing" | "duckduckgo" | "brave";

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  displayUrl?: string;
  snippet: string;
  source: Exclude<SearchProvider, "all">;
  publishedAt?: string;
  providerRank?: number;
}

export interface SearchResponse {
  query: string;
  provider: SearchProvider;
  results: SearchResult[];
  providersUsed: Array<Exclude<SearchProvider, "all">>;
  unavailable: Array<{ provider: Exclude<SearchProvider, "all">; reason: string }>;
}

export function dedupeSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    try {
      const url = new URL(result.url);
      const key = `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return true;
    }
  });
}

export function sortSearchResults(results: SearchResult[], query = ""): SearchResult[] {
  const terms = tokenize(query);
  return [...results].sort((a, b) => {
    const relevanceDifference = scoreResult(b, terms) - scoreResult(a, terms);
    if (relevanceDifference !== 0) return relevanceDifference;
    const dateDifference = Number(Boolean(b.publishedAt)) - Number(Boolean(a.publishedAt));
    if (dateDifference !== 0) return dateDifference;
    return (a.providerRank ?? Number.MAX_SAFE_INTEGER) - (b.providerRank ?? Number.MAX_SAFE_INTEGER);
  });
}

function scoreResult(result: SearchResult, terms: string[]): number {
  if (terms.length === 0) return 0;
  const title = normalizeSearchText(result.title);
  const snippet = normalizeSearchText(result.snippet);
  const url = normalizeSearchText(result.displayUrl || result.url);
  const titleMatches = terms.reduce((total, term) => total + (title.includes(term) ? 1 : 0), 0);
  const snippetMatches = terms.reduce((total, term) => total + (snippet.includes(term) ? 1 : 0), 0);
  const urlMatches = terms.reduce((total, term) => total + (url.includes(term) ? 1 : 0), 0);
  const phrase = normalizeSearchText(terms.join(" "));
  const exactPhraseBonus = phrase.length > 3 && `${title} ${snippet}`.includes(phrase) ? 8 : 0;
  const coverageBonus = Math.round((titleMatches + snippetMatches > 0 ? (titleMatches + snippetMatches) / (terms.length * 2) : 0) * 10);
  const providerRankBonus = Math.max(0, 3 - Math.min(result.providerRank ?? 3, 3));
  return titleMatches * 12 + snippetMatches * 4 + urlMatches * 2 + exactPhraseBonus + coverageBonus + providerRankBonus;
}

function tokenize(value: string): string[] {
  const stopWords = new Set(["the", "and", "for", "with", "from", "that", "this", "what", "how", "why", "are", "is", "in", "of", "to", "a", "an", "এবং", "এর", "কী", "কি", "করে", "করুন", "জন্য"]);
  return Array.from(new Set(normalizeSearchText(value).split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1 && !stopWords.has(term))));
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[“”‘’]/g, "'").trim();
}
