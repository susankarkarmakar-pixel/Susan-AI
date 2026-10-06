import type { SearchResult } from "./web-search";

export interface RankedSearchResult extends SearchResult {
  lexicalScore: number;
  semanticScore?: number;
  semanticNormalizedScore?: number;
  lexicalRankScore?: number;
  hybridScore?: number;
  combinedScore?: number;
}

export interface SearchDiagnostics {
  query: string;
  semanticEnabled: boolean;
  candidateCount: number;
  lexicalOrder: string[];
  semanticOrder: string[];
  lexicalPreview: Array<{ id: string; title: string; score: number }>;
  semanticPreview: Array<{ id: string; title: string; score: number }>;
  topKOverlap: number;
  rerankedCount: number;
  rankChanges: Array<{ id: string; title: string; from: number; to: number; delta: number; lexicalScore: number; semanticScore: number | undefined; combinedScore: number | undefined }>;
}

type RankChange = SearchDiagnostics["rankChanges"][number];

export function buildSearchDiagnostics(query: string, lexical: RankedSearchResult[], finalResults: RankedSearchResult[], semanticEnabled: boolean, topK = 5): SearchDiagnostics {
  const lexicalPositions = new Map(lexical.map((item, index) => [item.id, index]));
  const finalPositions = new Map(finalResults.map((item, index) => [item.id, index]));
  const lexicalTop = new Set(lexical.slice(0, topK).map((item) => item.id));
  const finalTop = new Set(finalResults.slice(0, topK).map((item) => item.id));
  const rankChanges: RankChange[] = finalResults
    .map((item) => {
      const from = lexicalPositions.get(item.id);
      const to = finalPositions.get(item.id);
      if (from === undefined || to === undefined || from === to) return null;
      return { id: item.id, title: item.title, from, to, delta: from - to, lexicalScore: item.lexicalScore, semanticScore: item.semanticScore, combinedScore: item.combinedScore };
    })
    .filter((item): item is RankChange => item !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    query,
    semanticEnabled,
    candidateCount: lexical.length,
    lexicalOrder: lexical.map((item) => item.id),
    semanticOrder: finalResults.map((item) => item.id),
    lexicalPreview: lexical.slice(0, topK).map((item) => ({ id: item.id, title: item.title, score: item.lexicalScore })),
    semanticPreview: finalResults.slice(0, topK).map((item) => ({ id: item.id, title: item.title, score: item.combinedScore ?? item.lexicalScore })),
    topKOverlap: intersectionSize(lexicalTop, finalTop) / Math.max(1, Math.min(topK, lexical.length, finalResults.length)),
    rerankedCount: rankChanges.length,
    rankChanges: rankChanges.slice(0, 20),
  };
}

function intersectionSize(first: Set<string>, second: Set<string>): number {
  let count = 0;
  for (const value of first) if (second.has(value)) count += 1;
  return count;
}
