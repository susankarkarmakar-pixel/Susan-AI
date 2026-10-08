import { rankSearchResults } from "./search-ranking.mjs";

export type SearchProvider = "all" | "google" | "bing" | "duckduckgo" | "brave";

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  displayUrl?: string;
  snippet: string;
  source: Exclude<SearchProvider, "all">;
  publishedAt?: string;
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

export function sortSearchResults(results: SearchResult[], query: string): SearchResult[] {
  return rankSearchResults(results, query);
}
