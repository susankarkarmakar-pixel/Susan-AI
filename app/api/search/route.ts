import { NextResponse } from "next/server";
import { enforceRateLimit, getClientIdentifier, RateLimitUnavailableError, RATE_LIMIT_RETRY_AFTER_SECONDS } from "@/lib/rate-limit";
import type { SearchSource } from "@/lib/search-types";

const MAX_QUERY_LENGTH = 300;
const MAX_RESULTS = 8;

export async function GET(request: Request) {
  try {
    if (!(await enforceRateLimit(getClientIdentifier(request)))) return jsonError("Too many searches. Please wait a moment and try again.", 429, { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) });
    const query = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (!query || query.length > MAX_QUERY_LENGTH) return jsonError("Enter a search query under 300 characters.", 400);
    const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
    const result = braveKey ? await searchBrave(query, braveKey) : await searchDuckDuckGo(query);
    return NextResponse.json({ query, provider: braveKey ? "brave" : "duckduckgo", sources: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return jsonError("Search protection is temporarily unavailable. Try again shortly.", 503, { "Retry-After": "30" });
    return jsonError("Web search could not be completed. You can still ask the selected model without live sources.", 502);
  }
}

async function searchBrave(query: string, apiKey: string): Promise<SearchSource[]> {
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}&safesearch=moderate`, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Brave search failed with ${response.status}`);
  const payload = await response.json() as { web?: { results?: Array<{ title?: unknown; url?: unknown; description?: unknown }> } };
  return (payload.web?.results || []).flatMap((item, index) => normalizeSource(item.title, item.url, item.description, index));
}

async function searchDuckDuckGo(query: string): Promise<SearchSource[]> {
  const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`DuckDuckGo search failed with ${response.status}`);
  const payload = await response.json() as { AbstractText?: unknown; AbstractURL?: unknown; Heading?: unknown; RelatedTopics?: unknown[] };
  const sources: SearchSource[] = [];
  const abstract = normalizeSource(payload.Heading, payload.AbstractURL, payload.AbstractText, 0);
  sources.push(...abstract);
  flattenDuckDuckGoTopics(payload.RelatedTopics, sources);
  return sources.slice(0, MAX_RESULTS);
}

function flattenDuckDuckGoTopics(topics: unknown[] | undefined, sources: SearchSource[]): void {
  if (!Array.isArray(topics)) return;
  for (const topic of topics) {
    if (sources.length >= MAX_RESULTS) return;
    if (!topic || typeof topic !== "object") continue;
    const item = topic as { FirstURL?: unknown; Text?: unknown; Topics?: unknown[] };
    if (item.FirstURL && item.Text) sources.push(...normalizeSource(item.Text, item.FirstURL, item.Text, sources.length));
    flattenDuckDuckGoTopics(item.Topics, sources);
  }
}

function normalizeSource(title: unknown, url: unknown, snippet: unknown, index: number): SearchSource[] {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return [];
  const safeUrl = url.slice(0, 2_000);
  return [{ id: `source-${index + 1}-${encodeURIComponent(safeUrl).slice(0, 24)}`, title: typeof title === "string" && title.trim() ? title.trim().slice(0, 180) : new URL(safeUrl).hostname, url: safeUrl, snippet: typeof snippet === "string" ? snippet.trim().slice(0, 1_000) : "", source: new URL(safeUrl).hostname.replace(/^www\./, "") }];
}

function jsonError(error: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
