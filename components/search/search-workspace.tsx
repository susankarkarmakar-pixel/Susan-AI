"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark, Check, Clock3, Globe2, Loader2, Search, Settings, SlidersHorizontal } from "lucide-react";
import { getKeys, ApiKeys } from "@/lib/key-storage";
import { SearchProvider, SearchResponse, SearchResult } from "@/lib/web-search";

const PROVIDER_LABELS: Record<Exclude<SearchProvider, "all">, string> = { google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", brave: "Brave" };

export function SearchWorkspace() {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<SearchProvider>("all");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [keys, setKeys] = useState<ApiKeys>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    window.setTimeout(() => setKeys(getKeys()), 0);
    const refresh = () => setKeys(getKeys());
    window.addEventListener("keys-updated", refresh);
    return () => window.removeEventListener("keys-updated", refresh);
  }, []);

  const connected = useMemo(() => ({ google: Boolean(keys.googleSearch && keys.googleSearchCx), bing: Boolean(keys.bingSearch), duckduckgo: true, brave: Boolean(keys.braveSearch) }), [keys]);
  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    setLoading(true); setError("");
    try {
      const result = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: cleanQuery, provider, keys: { googleSearch: keys.googleSearch, bingSearch: keys.bingSearch, braveSearch: keys.braveSearch }, googleCx: keys.googleSearchCx }) });
      const data = await result.json() as SearchResponse & { error?: string };
      if (!result.ok) throw new Error(data.error || "Search failed.");
      setResponse(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search failed. Try again.");
      setResponse(null);
    } finally { setLoading(false); }
  };
  const toggleSaved = (url: string) => setSaved((current) => current.includes(url) ? current.filter((item) => item !== url) : [...current, url]);

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-main">
    <header className="flex shrink-0 items-center justify-between border-b border-border-main/60 bg-surface/80 px-5 py-4 backdrop-blur md:px-8">
      <div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Globe2 className="h-5 w-5" /></span><div><h1 className="text-lg font-semibold text-text-main">Web Search</h1><p className="text-xs text-text-muted">Search across trusted web sources</p></div></div></div>
      <button type="button" onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))} className="rounded-xl border border-border-main/60 p-2 text-text-muted hover:bg-black/5 hover:text-text-main" aria-label="Configure search providers"><Settings className="h-4 w-4" /></button>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8"><div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Explore the web</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-main md:text-4xl">Find answers from the sources you trust.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-muted">Use All Sources for a broader view, or choose a specific search provider when you need more control.</p></div>
      <form onSubmit={search} className="rounded-2xl border border-border-main bg-surface p-2 shadow-[0_12px_40px_rgba(43,27,20,0.08)]"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3 px-3"><Search className="h-5 w-5 shrink-0 text-text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the web..." className="min-w-0 flex-1 bg-transparent py-3 text-base text-text-main outline-none placeholder:text-text-muted/70" /></div><div className="flex items-center gap-2"><div className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" /><select value={provider} onChange={(event) => setProvider(event.target.value as SearchProvider)} className="appearance-none rounded-xl border border-border-main bg-bg-main py-2.5 pl-8 pr-8 text-sm font-medium text-text-main outline-none"><option value="all">All Sources</option>{(Object.keys(PROVIDER_LABELS) as Array<Exclude<SearchProvider, "all">>).map((item) => <option key={item} value={item}>{PROVIDER_LABELS[item]}{connected[item] ? " · Connected" : item === "duckduckgo" ? " · Free" : " · Not connected"}</option>)}</select></div><button type="submit" disabled={loading || !query.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-sidebar-cocoa px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sidebar-cocoa-soft disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</button></div></div></form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-text-muted"><span>{provider === "all" ? "DuckDuckGo is available now; add optional keys in Settings for Google, Bing and Brave." : `${PROVIDER_LABELS[provider as Exclude<SearchProvider, "all">]} selected`}</span>{response && <span>{response.results.length} results · {response.providersUsed.map((item) => PROVIDER_LABELS[item]).join(", ")}</span>}</div>
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!response && !loading && !error && <div className="mt-12 grid gap-3 sm:grid-cols-3">{["Latest AI tools and model updates", "Explain a complex topic in Bengali", "Find reliable sources for my report"].map((prompt) => <button key={prompt} type="button" onClick={() => { setQuery(prompt); }} className="rounded-2xl border border-border-main/70 bg-surface p-4 text-left text-sm text-text-muted transition hover:-translate-y-0.5 hover:border-accent/40 hover:text-text-main"><Search className="mb-4 h-4 w-4 text-accent" />{prompt}</button>)}</div>}
      {loading && <div className="mt-10 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-border-main/60 bg-surface" />)}</div>}
      {response && !loading && <div className="mt-8 space-y-3">{response.unavailable.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{response.unavailable.map((item) => `${PROVIDER_LABELS[item.provider]}: ${item.reason}`).join(" · ")}</div>}{response.results.length === 0 ? <div className="rounded-2xl border border-border-main bg-surface p-10 text-center text-sm text-text-muted">No results found. Try a broader query or connect another provider.</div> : response.results.map((result) => <ResultCard key={result.id} result={result} saved={saved.includes(result.url)} onSave={() => toggleSaved(result.url)} />)}</div>}
    </div></main>
  </div>;
}

function ResultCard({ result, saved, onSave }: { result: SearchResult; saved: boolean; onSave: () => void }) {
  return <article className="group rounded-2xl border border-border-main/70 bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[0_8px_28px_rgba(43,27,20,0.06)]"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-xs font-bold text-accent">{PROVIDER_LABELS[result.source].slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted"><span className="font-semibold text-accent">{PROVIDER_LABELS[result.source]}</span><span>·</span><span className="truncate">{result.displayUrl || result.url}</span>{result.publishedAt && <><span>·</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{result.publishedAt}</span></>}</div><h3 className="mt-1 text-base font-semibold leading-6 text-text-main"><a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">{result.title}</a></h3><p className="mt-1.5 line-clamp-3 text-sm leading-6 text-text-muted">{result.snippet}</p><div className="mt-3 flex items-center gap-2"><a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-cream-highlight px-2.5 py-1.5 text-xs font-semibold text-accent">Open <ArrowUpRight className="h-3 w-3" /></a><button type="button" onClick={onSave} className="inline-flex items-center gap-1 rounded-lg border border-border-main px-2.5 py-1.5 text-xs font-semibold text-text-muted hover:bg-bg-main hover:text-text-main">{saved ? <Check className="h-3 w-3 text-green-600" /> : <Bookmark className="h-3 w-3" />}{saved ? "Saved" : "Save"}</button><button type="button" onClick={() => navigator.clipboard?.writeText(result.url)} className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-text-muted hover:border-border-main">Copy link</button></div></div></div></article>;
}
