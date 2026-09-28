import { NextResponse } from "next/server";
import { dedupeSearchResults, SearchProvider, SearchResponse, SearchResult, sortSearchResults } from "@/lib/web-search";

export const runtime = "nodejs";

const MAX_RESULTS = 30;
const PROVIDERS: Array<Exclude<SearchProvider, "all">> = ["google", "bing", "duckduckgo", "brave"];

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown; provider?: unknown; keys?: Record<string, string | undefined>; googleCx?: unknown };
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 300) : "";
    const provider = isProvider(body.provider) ? body.provider : "all";
    const keys = body.keys || {};
    const googleCx = typeof body.googleCx === "string" ? body.googleCx.trim() : "";
    if (!query) return NextResponse.json({ error: "Enter a search query." }, { status: 400 });

    const selected = provider === "all" ? PROVIDERS : [provider];
    const results: SearchResult[] = [];
    const unavailable: SearchResponse["unavailable"] = [];
    const providersUsed: SearchResponse["providersUsed"] = [];

    for (const source of selected) {
      if ((source === "google" && (!keys.googleSearch || !googleCx)) || (source === "bing" && !keys.bingSearch) || (source === "brave" && !keys.braveSearch)) {
        if (provider !== "all") unavailable.push({ provider: source, reason: source === "google" ? "Google API key and Search Engine ID are required." : "This provider is not connected." });
        continue;
      }
      try {
        const providerResults = source === "google"
          ? await searchGoogle(query, keys.googleSearch!, googleCx)
          : source === "bing"
            ? await searchBing(query, keys.bingSearch!)
            : source === "brave"
              ? await searchBrave(query, keys.braveSearch!)
              : await searchDuckDuckGo(query);
        results.push(...providerResults);
        if (providerResults.length > 0) providersUsed.push(source);
      } catch (error) {
        unavailable.push({ provider: source, reason: error instanceof Error ? error.message : "Provider request failed." });
      }
    }

    const response: SearchResponse = { query, provider, results: sortSearchResults(dedupeSearchResults(results)).slice(0, MAX_RESULTS), providersUsed, unavailable };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search request could not be processed." }, { status: 400 });
  }
}

function isProvider(value: unknown): value is SearchProvider {
  return value === "all" || value === "google" || value === "bing" || value === "duckduckgo" || value === "brave";
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000), headers: { Accept: "application/json", ...(init?.headers || {}) } });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  return response.json();
}

async function searchGoogle(query: string, apiKey: string, cx: string): Promise<SearchResult[]> {
  const data = await fetchJson(`https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=10`) as { items?: Array<{ title?: string; link?: string; displayLink?: string; snippet?: string; pagemap?: { metatags?: Array<{ date?: string }> } }> };
  return (data.items || []).filter((item) => item.title && item.link).map((item, index) => ({ id: `google-${index}-${item.link}`, title: item.title!, url: item.link!, displayUrl: item.displayLink, snippet: item.snippet || "", source: "google" as const, publishedAt: item.pagemap?.metatags?.[0]?.date }));
}

async function searchBing(query: string, apiKey: string): Promise<SearchResult[]> {
  const data = await fetchJson(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10&responseFilter=Webpages`, { headers: { "Ocp-Apim-Subscription-Key": apiKey } }) as { webPages?: { value?: Array<{ name?: string; url?: string; displayUrl?: string; snippet?: string; dateLastCrawled?: string }> } };
  return (data.webPages?.value || []).filter((item) => item.name && item.url).map((item, index) => ({ id: `bing-${index}-${item.url}`, title: item.name!, url: item.url!, displayUrl: item.displayUrl, snippet: item.snippet || "", source: "bing" as const, publishedAt: item.dateLastCrawled }));
}

async function searchBrave(query: string, apiKey: string): Promise<SearchResult[]> {
  const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, { headers: { "X-Subscription-Token": apiKey, Accept: "application/json" } }) as { web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> } };
  return (data.web?.results || []).filter((item) => item.title && item.url).map((item, index) => ({ id: `brave-${index}-${item.url}`, title: item.title!, url: item.url!, snippet: item.description || "", source: "brave" as const, publishedAt: item.age }));
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const data = await fetchJson(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`) as { AbstractText?: string; AbstractURL?: string; Heading?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }> };
  const results: SearchResult[] = [];
  if (data.AbstractURL && (data.AbstractText || data.Heading)) results.push({ id: `duckduckgo-abstract-${data.AbstractURL}`, title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText || "", source: "duckduckgo" });
  const topics = (data.RelatedTopics || []).flatMap((topic) => topic.Topics || [topic]).filter((topic) => topic.FirstURL && topic.Text).slice(0, 10);
  topics.forEach((topic, index) => results.push({ id: `duckduckgo-${index}-${topic.FirstURL}`, title: topic.Text!.split(" - ")[0], url: topic.FirstURL!, snippet: topic.Text!, source: "duckduckgo" }));
  return results;
}
