export interface SearchSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface ResearchContext {
  query: string;
  sources: SearchSource[];
  provider: "brave" | "duckduckgo";
  searchedAt: string;
}
