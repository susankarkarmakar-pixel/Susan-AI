"use client";

import { ArrowDown, ArrowUp, BarChart3, Minus, Sparkles } from "lucide-react";
import type { SearchResponse } from "@/lib/web-search";

type Diagnostics = NonNullable<SearchResponse["diagnostics"]>;

export function SearchDiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostics }) {
  const overlap = Math.round(diagnostics.topKOverlap * 100);
  return (
    <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm" aria-label="Search relevance diagnostics">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><BarChart3 className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-violet-950">Search Diagnostics</h2><p className="mt-0.5 text-[11px] leading-5 text-violet-800/75">Development-only comparison of lexical and semantic ranking.</p></div></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${diagnostics.semanticEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{diagnostics.semanticEnabled ? "Semantic active" : "Lexical fallback"}</span>
      </div>
      {diagnostics.error && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{diagnostics.error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Candidates" value={String(diagnostics.candidateCount)} />
        <Metric label="Top-5 overlap" value={`${overlap}%`} />
        <Metric label="Rank changes" value={String(diagnostics.rerankedCount)} />
        <Metric label="Query" value={diagnostics.query} truncate />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <RankingList title="Lexical top 5" items={diagnostics.lexicalPreview} tone="neutral" />
        <RankingList title="Semantic top 5" items={diagnostics.semanticPreview} tone="violet" />
      </div>
      {diagnostics.rankChanges.length > 0 && <div className="mt-4 rounded-xl border border-violet-200 bg-white/70 p-3"><div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-950"><Sparkles className="h-3.5 w-3.5" />Largest rank movements</div><div className="space-y-2">{diagnostics.rankChanges.slice(0, 5).map((change) => <div key={change.id} className="flex items-center gap-2 text-xs"><Movement delta={change.delta} /><span className="min-w-0 flex-1 truncate text-violet-950">{change.title}</span><span className="shrink-0 font-mono text-[10px] text-violet-700">{change.from + 1} → {change.to + 1}</span></div>)}</div></div>}
    </section>
  );
}

function RankingList({ title, items, tone }: { title: string; items: Array<{ id: string; title: string; score: number }>; tone: "neutral" | "violet" }) {
  return <div className={`rounded-xl border p-3 ${tone === "violet" ? "border-violet-200 bg-white/75" : "border-border-main/60 bg-white/60"}`}><h3 className="mb-2 text-xs font-semibold text-text-main">{title}</h3>{items.length === 0 ? <p className="text-[11px] text-text-muted">No ranking data available.</p> : <div className="space-y-2">{items.map((item, index) => <div key={item.id} className="flex items-center gap-2"><span className="w-4 shrink-0 text-[10px] font-bold text-text-muted">{index + 1}</span><span className="min-w-0 flex-1 truncate text-[11px] text-text-main" title={item.title}>{item.title}</span><span className="w-16 shrink-0"><span className="block h-1.5 overflow-hidden rounded-full bg-black/10"><span className={`block h-full rounded-full ${tone === "violet" ? "bg-violet-500" : "bg-accent"}`} style={{ width: `${Math.max(4, Math.min(100, item.score * 100))}%` }} /></span><span className="mt-0.5 block text-right font-mono text-[9px] text-text-muted">{item.score.toFixed(2)}</span></span></div>)}</div>}</div>;
}

function Metric({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) { return <div className="rounded-lg border border-violet-200 bg-white/65 px-2.5 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-violet-700/70">{label}</p><p className={`mt-1 text-sm font-semibold text-violet-950 ${truncate ? "truncate" : ""}`} title={truncate ? value : undefined}>{value}</p></div>; }
function Movement({ delta }: { delta: number }) { if (delta > 0) return <ArrowUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Moved up" />; if (delta < 0) return <ArrowDown className="h-3.5 w-3.5 shrink-0 text-red-600" aria-label="Moved down" />; return <Minus className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-label="No movement" />; }
