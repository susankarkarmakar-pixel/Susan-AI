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

async function fetchJson(url: string, init?: RequestInit, tolerateEmpty = false): Promise<unknown> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000), headers: { Accept: "application/json", ...(init?.headers || {}) } });
    lastStatus = response.status;
    const body = await response.text();
    if (response.status === 202 || !body.trim()) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      if (tolerateEmpty) return {};
    }
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    try {
      return JSON.parse(body);
    } catch {
      if (tolerateEmpty) return {};
      throw new Error(`Provider returned an invalid response (HTTP ${lastStatus}).`);
    }
  }
  if (tolerateEmpty) return {};
  throw new Error(`Provider returned HTTP ${lastStatus}.`);
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
  let html = "";
  try {
    const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; SusanAI/1.0)" },
    });
    if (response.ok) html = await response.text();
  } catch {
    // Shared server IPs, including some Vercel regions, may be blocked by DuckDuckGo.
  }
  if (!html) return searchDuckDuckGoViaReader(query);
  const links = [...html.matchAll(/<a\b([^>]*\bclass=["']result-link["'][^>]*)>([\s\S]*?)<\/a>/gi)];
  return links.slice(0, 10).flatMap((match, index) => {
    const href = match[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
    const url = href ? resolveDuckDuckGoUrl(href) : null;
    const title = cleanHtml(match[2]);
    if (!url || !title) return [];
    const start = match.index ?? 0;
    const next = html.indexOf("result-link", start + match[0].length);
    const section = html.slice(start, next === -1 ? html.length : next);
    const snippetMatch = section.match(/class=["']result-snippet["'][^>]*>([\s\S]*?)<\//i);
    const timestamp = section.match(/class=["']timestamp["'][^>]*>([^<]+)/i)?.[1]?.trim();
    return [{ id: `duckduckgo-${index}-${url}`, title, url, snippet: snippetMatch ? cleanHtml(snippetMatch[1]) : "DuckDuckGo web result", source: "duckduckgo" as const, publishedAt: timestamp }];
  });
}

async function searchDuckDuckGoViaReader(query: string): Promise<SearchResult[]> {
  const response = await fetch(`https://r.jina.ai/http://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15000), headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`DuckDuckGo returned HTTP ${response.status}.`);
  const markdown = await response.text();
  const matches = [...markdown.matchAll(/^\d+\.\[([^\]]+)\]\(([^)]+)\)\s*\n([\s\S]*?)(?=^\d+\.\[|$)/gmi)];
  return matches.slice(0, 10).flatMap((match, index) => {
    const url = resolveDuckDuckGoUrl(match[2]);
    if (!url) return [];
    const lines = match[3].split("\n").map((line) => line.trim()).filter(Boolean);
    const snippet = lines.find((line) => !/^https?:\/\//i.test(line) && !/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(line)) || "DuckDuckGo web result";
    return [{ id: `duckduckgo-reader-${index}-${url}`, title: cleanHtml(match[1]), url, snippet: cleanHtml(snippet), source: "duckduckgo" as const }];
  });
}

function resolveDuckDuckGoUrl(value: string): string | null {
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    const redirected = url.searchParams.get("uddg");
    const resolved = redirected ? decodeURIComponent(redirected) : url.toString();
    return resolved.startsWith("https://") ? resolved : null;
  } catch {
    return null;
  }
}

function cleanHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    if (named[code.toLowerCase()]) return named[code.toLowerCase()];
    const numeric = code.toLowerCase().startsWith("#x") ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
  });
}
