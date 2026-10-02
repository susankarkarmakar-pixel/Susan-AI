"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, ChevronRight, FileCheck2, Landmark, MapPin, Search, ShieldCheck, X } from "lucide-react";
import { CATEGORY_LABELS, CIVIC_CATEGORIES, WEST_BENGAL_SCHEMES, CivicApplicationMode, CivicScheme, CivicSchemeCategory } from "@/lib/civic-schemes";

interface CivicServicesWorkspaceProps {
  onOpenSidebar: () => void;
}

const APPLICATION_LABELS: Record<CivicApplicationMode, string> = { online: "Online", office: "Office", camp: "Camp" };

export function CivicServicesWorkspace({ onOpenSidebar }: CivicServicesWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CivicSchemeCategory>("all");
  const [selected, setSelected] = useState<CivicScheme | null>(null);

  const visibleSchemes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return WEST_BENGAL_SCHEMES.filter((scheme) => {
      const matchesCategory = category === "all" || scheme.categories.includes(category);
      const searchable = `${scheme.name} ${scheme.department} ${scheme.benefit} ${scheme.categories.map((item) => CATEGORY_LABELS[item]).join(" ")}`.toLocaleLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query]);

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-main">
    <header className="flex shrink-0 items-center gap-3 border-b border-border-main/50 bg-bg-main/90 px-4 py-4 backdrop-blur-sm sm:px-8">
      <button type="button" onClick={onOpenSidebar} aria-label="Open sidebar" className="rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main lg:hidden"><Landmark className="h-5 w-5" /></button>
      <div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><Landmark className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Civic Services</p><h1 className="truncate text-xl font-semibold text-text-main sm:text-2xl">Find government schemes</h1></div></div>
      <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" />Official-source guidance</span>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[1.75rem] border border-accent/15 bg-gradient-to-br from-cream-highlight/60 via-surface to-bg-main p-5 shadow-sm sm:p-7">
          <div className="max-w-3xl"><p className="text-sm font-semibold text-accent">West Bengal starter catalogue</p><h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-text-main sm:text-4xl">Understand your options before you apply.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted sm:text-base">Search state schemes by need, then open a clear plan with likely eligibility, documents, official links, and where to submit. This is guidance—not a government approval.</p></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-3 py-3 shadow-sm focus-within:border-accent/50"><Search className="h-4 w-4 shrink-0 text-text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schemes, needs, or departments" aria-label="Search government schemes" className="min-w-0 flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted/60" /></label><div className="flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-3 py-2 text-sm text-text-muted"><MapPin className="h-4 w-4 text-accent" /><span className="font-semibold text-text-main">West Bengal</span><span className="text-xs">· 10 schemes</span></div></div>
        </section>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Scheme categories"><CategoryButton active={category === "all"} onClick={() => setCategory("all")}>All schemes</CategoryButton>{CIVIC_CATEGORIES.map((item) => <CategoryButton key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</CategoryButton>)}</div>

        <section className="mt-5" aria-labelledby="scheme-results-heading"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 id="scheme-results-heading" className="font-semibold text-text-main">Possible matches</h2><p className="mt-1 text-xs text-text-muted">{visibleSchemes.length} scheme{visibleSchemes.length === 1 ? "" : "s"} in the starter catalogue</p></div><span className="hidden items-center gap-1 text-[11px] text-text-muted sm:flex"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Last reviewed 2 Oct 2026</span></div>
          {visibleSchemes.length ? <div className="grid gap-4 lg:grid-cols-2">{visibleSchemes.map((scheme) => <SchemeCard key={scheme.id} scheme={scheme} onOpen={() => setSelected(scheme)} />)}</div> : <div className="rounded-2xl border border-dashed border-border-main/80 bg-surface px-5 py-12 text-center"><Search className="mx-auto h-6 w-6 text-text-muted" /><h3 className="mt-3 font-semibold text-text-main">No matching schemes</h3><p className="mt-1 text-sm text-text-muted">Try a broader search or choose All schemes.</p></div>}
        </section>

        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Use official channels.</strong> Susan AI does not collect Aadhaar, OTPs, bank passwords, or submit forms. Always confirm the latest eligibility, dates, and document list with the linked government department.</p></div>
      </div>
    </main>
    {selected && <SchemeDetails scheme={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function CategoryButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${active ? "border-sidebar-cocoa bg-sidebar-cocoa text-white" : "border-border-main/70 bg-surface text-text-muted hover:border-accent/40 hover:text-text-main"}`}>{children}</button>;
}

function SchemeCard({ scheme, onOpen }: { scheme: CivicScheme; onOpen: () => void }) {
  return <article className="group flex flex-col rounded-2xl border border-border-main/70 bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-md"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Landmark className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-text-main">{scheme.name}</h3><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Possible match</span></div><p className="mt-1 text-xs text-text-muted">{scheme.department}</p></div></div><p className="mt-4 line-clamp-3 text-sm leading-6 text-text-muted">{scheme.benefit}</p><div className="mt-4 flex flex-wrap gap-1.5">{scheme.categories.slice(0, 3).map((item) => <span key={item} className="rounded-full bg-bg-main px-2 py-1 text-[10px] font-medium text-text-muted">{CATEGORY_LABELS[item]}</span>)}{scheme.applicationModes.map((mode) => <span key={mode} className="rounded-full border border-border-main/60 px-2 py-1 text-[10px] font-medium text-text-muted">{APPLICATION_LABELS[mode]}</span>)}</div><div className="mt-5 flex items-center justify-between border-t border-border-main/50 pt-3"><span className="text-[10px] text-text-muted">Verified source · {scheme.lastVerifiedAt}</span><button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">View plan <ChevronRight className="h-3.5 w-3.5" /></button></div></article>;
}

function SchemeDetails({ scheme, onClose }: { scheme: CivicScheme; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="civic-scheme-title" className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-border-main/70 bg-bg-main shadow-2xl sm:rounded-3xl"><header className="flex shrink-0 items-start gap-3 border-b border-border-main/60 bg-surface px-5 py-4 sm:px-7"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Landmark className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">West Bengal scheme</p><h2 id="civic-scheme-title" className="mt-1 text-xl font-semibold text-text-main">{scheme.name}</h2><p className="mt-1 text-xs text-text-muted">{scheme.department}</p></div><button type="button" onClick={onClose} aria-label="Close scheme details" className="rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main"><X className="h-5 w-5" /></button></header><div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">What this may help with</p><p className="mt-2 text-sm leading-6 text-emerald-950">{scheme.benefit}</p></div><DetailSection title="Who may qualify"><ul className="space-y-2">{scheme.eligibility.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-text-muted"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></DetailSection><DetailSection title="Documents to prepare"><ul className="grid gap-2 sm:grid-cols-2">{scheme.documents.map((item) => <li key={item.label} className="flex gap-2 rounded-xl border border-border-main/60 bg-surface px-3 py-2.5 text-sm text-text-muted"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>{item.label}<span className={`ml-1 text-[10px] font-semibold ${item.required ? "text-text-main" : "text-text-muted"}`}>{item.required ? "· required" : "· if applicable"}</span>{item.note && <span className="mt-0.5 block text-xs text-text-muted">{item.note}</span>}</span></li>)}</ul></DetailSection><DetailSection title="How to apply"><ol className="space-y-3">{scheme.applicationSteps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6 text-text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream-highlight text-xs font-bold text-accent">{index + 1}</span>{step}</li>)}</ol></DetailSection><DetailSection title="Where to submit"><ul className="space-y-2">{scheme.submissionPoints.map((point) => <li key={point} className="flex gap-2 text-sm text-text-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{point}</li>)}</ul></DetailSection><div className="mt-6 rounded-2xl border border-border-main/60 bg-surface p-4"><p className="text-xs font-semibold text-text-main">Official information</p><p className="mt-1 text-xs leading-5 text-text-muted">{scheme.sourceNote} Last reviewed {scheme.lastVerifiedAt}.</p><div className="mt-3 flex flex-wrap gap-2"><a href={scheme.officialInfoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-bg-main">Open official source <ArrowUpRight className="h-3.5 w-3.5" /></a>{scheme.officialApplyUrl && <a href={scheme.officialApplyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sidebar-cocoa px-3 py-2 text-xs font-semibold text-white hover:bg-sidebar-cocoa/90">Go to application portal <ArrowUpRight className="h-3.5 w-3.5" /></a>}</div></div></div></section></div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h3 className="mb-3 text-sm font-semibold text-text-main">{title}</h3>{children}</section>;
}
