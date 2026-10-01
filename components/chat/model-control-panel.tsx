"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, CircleAlert, Cloud, Cpu, RefreshCw, Search, ShieldCheck, Zap } from "lucide-react";
import { INSTANT_CHAT_PROVIDERS } from "@/lib/ai-providers";
import { getApiKey, getKeys, ApiKeys } from "@/lib/key-storage";
import { CustomProvider, getCustomProviders } from "@/lib/custom-providers";
import { getProviderDescriptor } from "@/lib/provider-capabilities";
import type { ModelOption } from "@/components/sidebar/model-selector";
import type { AiEffort } from "@/lib/app-settings";

const FALLBACK_STORAGE_KEY = "susan_auto_model_fallback_v1";

interface ModelControlPanelProps {
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  effort: AiEffort;
  onEffortChange: (effort: AiEffort) => void;
  compact?: boolean;
}

interface ModelChoice {
  id: string;
  name: string;
  description: string;
  local: boolean;
  ready: boolean;
}

export function ModelControlPanel({ selectedModel, onSelectModel, effort, onEffortChange, compact = false }: ModelControlPanelProps) {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKeys>({});
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [autoFallback, setAutoFallback] = useState(true);
  const [query, setQuery] = useState("");
  const [connectedOnly, setConnectedOnly] = useState(false);

  const refresh = () => {
    setKeys(getKeys());
    setCustomProviders(getCustomProviders());
    setAutoFallback(window.localStorage.getItem(FALLBACK_STORAGE_KEY) !== "false");
  };

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("keys-updated", refresh);
    window.addEventListener("custom-providers-updated", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keys-updated", refresh);
      window.removeEventListener("custom-providers-updated", refresh);
    };
  }, []);

  const choices: ModelChoice[] = [
    ...INSTANT_CHAT_PROVIDERS.map((provider) => {
      const descriptor = getProviderDescriptor(provider);
      return {
        id: provider,
        name: descriptor?.name || provider,
        description: descriptor?.model || provider,
        local: descriptor?.local || false,
        ready: Boolean(getApiKey(provider, keys)),
      };
    }),
    ...customProviders.map((provider) => ({
      id: provider.id,
      name: provider.name,
      description: provider.model,
      local: provider.requiresApiKey === false,
      ready: provider.requiresApiKey === false || Boolean(getApiKey(provider.id, keys)),
    })),
  ];
  const selected = choices.find((choice) => choice.id === selectedModel) || choices[0];
  const readyChoices = choices.filter((choice) => choice.ready);
  const matchingChoices = choices.filter((choice) => {
    const matchesQuery = `${choice.name} ${choice.description} ${choice.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchesQuery && (!connectedOnly || choice.ready);
  });
  const matchingLocalChoices = matchingChoices.filter((choice) => choice.local);
  const matchingCloudChoices = matchingChoices.filter((choice) => !choice.local);

  const toggleFallback = () => {
    const next = !autoFallback;
    setAutoFallback(next);
    window.localStorage.setItem(FALLBACK_STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent("model-fallback-updated"));
  };

  return <div className="relative min-w-0">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Select model, current model ${selected?.name || "Choose a model"}`} aria-expanded={open} aria-haspopup="dialog" className={`flex min-w-0 items-center gap-2 rounded-xl border border-border-main/70 bg-surface text-left shadow-sm transition-colors hover:border-accent/50 ${compact ? "w-full max-w-full px-1.5 py-1.5 sm:w-auto sm:max-w-[15rem] sm:px-2" : "max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2"}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cream-highlight text-accent">{selected?.local ? <ShieldCheck className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}</span>
      <span className="min-w-0"><span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{compact ? "AI model" : "Model"}</span><span className="block truncate text-xs font-semibold text-text-main">{selected?.name || "Choose a model"}</span></span>
      <span className={`ml-auto h-2 w-2 shrink-0 rounded-full ${selected?.ready ? "bg-emerald-500" : "bg-amber-400"}`} />
      <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <>
      <button type="button" aria-label="Close model panel" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
      <div role="dialog" aria-label="Model control panel" className="absolute bottom-[calc(100%+0.6rem)] left-0 z-40 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border-main/80 bg-surface p-3 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-main/50 pb-3"><div><p className="text-sm font-semibold text-text-main">Choose response model</p><p className="mt-0.5 text-[11px] text-text-muted">{readyChoices.length} of {choices.length} connected · switch without leaving chat.</p></div><button type="button" onClick={refresh} className="rounded-lg p-1.5 text-text-muted hover:bg-black/5 hover:text-accent" aria-label="Refresh connected models" title="Refresh connected models"><RefreshCw className="h-3.5 w-3.5" /></button></div>
        <div className="mt-3 flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-main/70 bg-bg-main px-2.5"><Search className="h-3.5 w-3.5 shrink-0 text-text-muted" /><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a provider or model" aria-label="Search providers and models" className="min-w-0 flex-1 bg-transparent py-2 text-xs text-text-main outline-none placeholder:text-text-muted/70" /></label>
          <button type="button" aria-pressed={connectedOnly} onClick={() => setConnectedOnly((value) => !value)} className={`shrink-0 rounded-xl border px-2.5 text-[10px] font-semibold transition-colors ${connectedOnly ? "border-accent/40 bg-cream-highlight text-accent" : "border-border-main/70 bg-bg-main text-text-muted hover:text-text-main"}`}>Connected only</button>
        </div>
        <div className="mt-3 max-h-[min(22rem,55vh)] space-y-3 overflow-y-auto pr-1">
          {matchingLocalChoices.length > 0 && <ModelGroup title="Local models" icon={<ShieldCheck className="h-3.5 w-3.5" />} choices={matchingLocalChoices} selectedModel={selectedModel} onSelect={(id) => { onSelectModel(id); setOpen(false); }} />}
          {matchingCloudChoices.length > 0 && <ModelGroup title="Cloud & BYOK models" icon={<Cloud className="h-3.5 w-3.5" />} choices={matchingCloudChoices} selectedModel={selectedModel} onSelect={(id) => { onSelectModel(id); setOpen(false); }} />}
          {matchingChoices.length === 0 && (readyChoices.length === 0 ? <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950"><CircleAlert className="mr-1 inline h-3.5 w-3.5" />No connected model found. Add a provider key in Settings, then return here.</div> : <div className="rounded-xl border border-border-main/60 bg-bg-main p-3 text-xs leading-5 text-text-muted">No models match that search. Try another name or turn off “Connected only”.</div>)}
          {connectedOnly && readyChoices.length > 0 && matchingChoices.length > 0 && <p className="px-1 text-[10px] text-text-muted">Showing connected models only. Disable the filter to see providers that still need a key.</p>}
        </div>
        <div className="mt-3 grid gap-3 border-t border-border-main/50 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Response effort</span><select value={effort} onChange={(event) => onEffortChange(event.target.value as AiEffort)} className="min-h-9 w-full rounded-lg border border-border-main/70 bg-bg-main px-2 text-xs font-semibold text-text-main outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="max">Max</option></select></label>
          <div className="flex items-start gap-2"><button type="button" role="switch" aria-checked={autoFallback} onClick={toggleFallback} className={`relative mt-5 h-5 w-9 shrink-0 rounded-full transition-colors ${autoFallback ? "bg-accent" : "bg-black/20"}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${autoFallback ? "translate-x-5" : "translate-x-1"}`} /></button><span><span className="block text-xs font-semibold text-text-main">Automatic fallback</span><span className="block text-[10px] leading-4 text-text-muted">Try the next connected model if this one fails.</span></span></div>
        </div>
      </div>
    </>}
  </div>;
}

function ModelGroup({ title, icon, choices, selectedModel, onSelect }: { title: string; icon: React.ReactNode; choices: ModelChoice[]; selectedModel: ModelOption; onSelect: (id: string) => void }) {
  return <section><h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{icon}{title}</h3><div className="space-y-1">{choices.map((choice) => <button type="button" key={choice.id} onClick={() => onSelect(choice.id)} disabled={!choice.ready} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${selectedModel === choice.id ? "bg-cream-highlight" : "hover:bg-black/5"} ${!choice.ready ? "cursor-not-allowed opacity-45" : ""}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${choice.local ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-text-muted"}`}>{choice.local ? <ShieldCheck className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-text-main">{choice.name}</span><span className="block truncate text-[10px] text-text-muted">{choice.description}</span></span>{choice.ready ? <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">{selectedModel === choice.id && <Check className="h-3.5 w-3.5" />}Ready</span> : <span className="text-[10px] text-text-muted">Needs key</span>}</button>)}</div></section>;
}

export { FALLBACK_STORAGE_KEY };

export function getConnectedModelIds(): string[] {
  const keys = getKeys();
  const customProviders = getCustomProviders();
  return [
    ...INSTANT_CHAT_PROVIDERS.filter((provider) => Boolean(getApiKey(provider, keys))),
    ...customProviders.filter((provider) => provider.requiresApiKey === false || Boolean(getApiKey(provider.id, keys))).map((provider) => provider.id),
  ];
}
