"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, DollarSign, Menu, Plus, Trash2 } from "lucide-react";
import { MODELS_METADATA, PROVIDERS, type ModelProvider } from "@/lib/ai-providers";
import { getCustomProviders } from "@/lib/custom-providers";
import { clearUsageEvents, deleteUsagePricingRate, getCurrentMonthUsageSummary, getUsageBudgetSettings, listUsageEvents, listUsagePricingRates, saveUsageBudgetSettings, saveUsagePricingRate, summarizeUsage, USAGE_ACTIVITY_UPDATED_EVENT } from "@/lib/usage-tracking.mjs";
import { createEncryptedUsageBackup, restoreEncryptedUsageBackup } from "@/lib/usage-backup.mjs";
import type { UsageActivityItem, UsagePricingRate } from "@/lib/usage-types";

interface UsageWorkspaceProps {
  onOpenSidebar: () => void;
}

const inputClass = "w-full rounded-lg border border-border-main/70 bg-bg-main px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted/60 focus:border-accent/50 focus:ring-2 focus:ring-accent/10";

export function UsageWorkspace({ onOpenSidebar }: UsageWorkspaceProps) {
  const [events, setEvents] = useState<UsageActivityItem[]>([]);
  const [rates, setRates] = useState<UsagePricingRate[]>([]);
  const [customProviders, setCustomProviders] = useState<ReturnType<typeof getCustomProviders>>([]);
  const [provider, setProvider] = useState<ModelProvider | string>("openai");
  const [model, setModel] = useState(MODELS_METADATA.openai.model);
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [budgetThreshold, setBudgetThreshold] = useState(80);
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const [budgetNotice, setBudgetNotice] = useState("");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupConfirm, setBackupConfirm] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupNotice, setBackupNotice] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => {
      setEvents(listUsageEvents());
      setRates(listUsagePricingRates());
      const budget = getUsageBudgetSettings();
      setBudgetLimit(budget.monthlyLimitUsd === null ? "" : String(budget.monthlyLimitUsd));
      setBudgetThreshold(budget.alertPercent);
      setBudgetSaved(budget.monthlyLimitUsd !== null);
      setCustomProviders(getCustomProviders());
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener(USAGE_ACTIVITY_UPDATED_EVENT, refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(USAGE_ACTIVITY_UPDATED_EVENT, refresh);
    };
  }, []);

  const availableProviders = useMemo(() => [
    ...PROVIDERS.filter((id) => MODELS_METADATA[id].chatAvailable).map((id) => ({ id, label: MODELS_METADATA[id].name, model: MODELS_METADATA[id].model })),
    ...customProviders.map((item) => ({ id: item.id, label: item.name, model: item.model })),
  ], [customProviders]);
  const summary = useMemo(() => summarizeUsage(events, rates), [events, rates]);
  const budgetSettings = useMemo(() => ({ monthlyLimitUsd: budgetLimit.trim() ? Number(budgetLimit) : null, alertPercent: budgetThreshold }), [budgetLimit, budgetThreshold]);
  const monthSummary = useMemo(() => getCurrentMonthUsageSummary(events, rates, budgetSettings), [events, rates, budgetSettings]);

  const changeProvider = (nextProvider: string) => {
    setProvider(nextProvider);
    const selected = availableProviders.find((item) => item.id === nextProvider);
    setModel(selected?.model || "");
    setNotice("");
    setError("");
  };

  const addPricing = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const saved = saveUsagePricingRate({
      provider,
      model: model.trim(),
      inputUsdPerMillion: Number(inputPrice),
      outputUsdPerMillion: Number(outputPrice),
    });
    if (!saved) {
      setError("Enter a model name and valid non-negative USD rates per million tokens.");
      return;
    }
    setRates(listUsagePricingRates());
    setNotice("Pricing saved on this device. Cost figures are estimates, not provider billing totals.");
  };

  const editPricing = (rate: UsagePricingRate) => {
    setProvider(rate.provider);
    setModel(rate.model);
    setInputPrice(String(rate.inputUsdPerMillion));
    setOutputPrice(String(rate.outputUsdPerMillion));
    setNotice("Adjust the rates and save to update this model's local estimate.");
    setError("");
  };

  const removePricing = (rate: UsagePricingRate) => {
    if (!window.confirm(`Remove the local pricing rate for ${rate.provider} / ${rate.model}?`)) return;
    deleteUsagePricingRate(rate.provider, rate.model);
    setRates(listUsagePricingRates());
  };

  const clearActivity = () => {
    if (!events.length || !window.confirm("Clear this device's saved usage activity? Pricing rates will remain.")) return;
    clearUsageEvents();
    setEvents([]);
  };

  const saveBudget = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBudgetError("");
    setBudgetNotice("");
    if (!budgetLimit.trim()) {
      setBudgetError("Enter a positive monthly USD limit, or use Remove budget to disable alerts.");
      return;
    }
    const saved = saveUsageBudgetSettings({ monthlyLimitUsd: Number(budgetLimit), alertPercent: budgetThreshold });
    if (!saved) {
      setBudgetError("Enter a positive monthly limit and choose an alert threshold from 50% to 99%.");
      return;
    }
    setBudgetSaved(true);
    setBudgetNotice("Monthly budget warning saved on this device. It never blocks or changes provider requests.");
  };

  const removeBudget = () => {
    if (!saveUsageBudgetSettings({ monthlyLimitUsd: null, alertPercent: budgetThreshold })) {
      setBudgetError("Could not update the local budget setting.");
      return;
    }
    setBudgetSaved(false);
    setBudgetLimit("");
    setBudgetNotice("Monthly budget warnings are disabled. Existing usage activity and pricing rates are unchanged.");
    setBudgetError("");
  };

  const exportBackup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBackupError("");
    setBackupNotice("");
    if (backupPassphrase.trim().length < 12) {
      setBackupError("Use a backup password with at least 12 characters.");
      return;
    }
    if (backupPassphrase !== backupConfirm) {
      setBackupError("The backup passwords do not match.");
      return;
    }
    setBackupBusy(true);
    try {
      const encrypted = await createEncryptedUsageBackup(backupPassphrase);
      const url = URL.createObjectURL(new Blob([encrypted], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `susan-ai-usage-${new Date().toISOString().slice(0, 10)}.encrypted.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setBackupPassphrase("");
      setBackupConfirm("");
      setBackupNotice("Encrypted backup downloaded. Keep its password separate: Susan AI cannot recover it.");
    } catch (backupFailure) {
      setBackupError(backupFailure instanceof Error ? backupFailure.message : "Encrypted export failed in this browser.");
    } finally {
      setBackupBusy(false);
    }
  };

  const importBackup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBackupError("");
    setBackupNotice("");
    if (!backupFile) {
      setBackupError("Choose an encrypted Susan AI usage backup file.");
      return;
    }
    if (backupFile.size > 6_000_000) {
      setBackupError("This backup is too large to import (maximum 6 MB).");
      return;
    }
    setBackupBusy(true);
    try {
      const result = await restoreEncryptedUsageBackup(await backupFile.text(), backupPassphrase);
      setEvents(listUsageEvents());
      setRates(listUsagePricingRates());
      const budget = getUsageBudgetSettings();
      setBudgetLimit(budget.monthlyLimitUsd === null ? "" : String(budget.monthlyLimitUsd));
      setBudgetThreshold(budget.alertPercent);
      setBudgetSaved(budget.monthlyLimitUsd !== null);
      setBackupPassphrase("");
      setBackupFile(null);
      if (backupInputRef.current) backupInputRef.current.value = "";
      setBackupNotice(`Restored ${result.importedEvents} usage records and ${result.importedRates} pricing rates. Existing local records were preserved.`);
    } catch (backupFailure) {
      setBackupError(backupFailure instanceof Error ? backupFailure.message : "Could not restore this encrypted backup.");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-border-main/50 bg-bg-main/95 px-3 py-3 backdrop-blur-sm sm:px-5 md:px-8" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onOpenSidebar} aria-label="Open sidebar" className="-ml-1 shrink-0 rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main lg:hidden"><Menu className="h-5 w-5" /></button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Activity className="h-5 w-5" /></span>
        <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Local insights</p><h1 className="truncate text-lg font-semibold text-text-main">Usage & activity</h1></div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8">
        <p className="mb-5 max-w-3xl text-sm leading-6 text-text-muted">See provider-reported token usage, request outcomes, and optional cost estimates. Usage activity is stored in this browser only; prompts, responses, files, API keys, and raw error messages are never recorded here.</p>

        <section aria-label="Usage summary" className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Provider-reported tokens" value={formatCount(summary.totalTokens)} detail={`${formatCount(summary.inputTokens)} in · ${formatCount(summary.outputTokens)} out`} />
          <SummaryCard label="Completed requests" value={formatCount(summary.completed)} detail={`${formatCount(summary.reportedEvents)} returned token counts`} />
          <SummaryCard label="Failed requests" value={formatCount(summary.failed)} detail={`${formatCount(summary.cancelled)} cancelled`} />
          <SummaryCard label="Estimated cost" value={summary.pricedEvents ? formatUsd(summary.costEstimateUsd) : "—"} detail={`${summary.pricedEvents} requests with your saved rates`} />
        </section>

        <section aria-labelledby="usage-budget-title" className="mb-7 rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center gap-2"><DollarSign className="h-4 w-4 text-accent" /><h2 id="usage-budget-title" className="font-semibold text-text-main">Monthly budget warning</h2></div>
          <p className="mb-4 text-xs leading-5 text-text-muted">Set a local USD estimate limit and warning threshold. This does not block, throttle, or route provider requests, and it only counts completed requests with provider-reported tokens and a saved rate.</p>
          {budgetSaved && monthSummary.monthlyLimitUsd !== null && <div className="mb-4 rounded-xl border border-border-main/60 bg-bg-main p-3">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold text-text-main">{new Date().toLocaleString(undefined, { month: "long", year: "numeric" })} estimate: {formatUsd(monthSummary.spentUsd)} of {formatUsd(monthSummary.monthlyLimitUsd)}</span><span className="text-text-muted">{monthSummary.pricedEvents} priced requests</span></div>
            <div role="progressbar" aria-label="Estimated monthly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(monthSummary.percent || 0))} className="h-2 overflow-hidden rounded-full bg-border-main/50"><div className={`h-full rounded-full ${monthSummary.level === "over" ? "bg-red-600" : monthSummary.level === "near" ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${Math.max(0, Math.min(100, monthSummary.percent || 0))}%` }} /></div>
            <p role="status" className={`mt-2 text-xs ${monthSummary.level === "over" ? "font-semibold text-red-700" : monthSummary.level === "near" ? "font-semibold text-amber-700" : "text-text-muted"}`}>{monthSummary.level === "over" ? "Estimated monthly budget exceeded. Provider requests were not blocked." : monthSummary.level === "near" ? `You have reached your ${monthSummary.alertPercent}% warning threshold. This is an estimate, not provider billing.` : monthSummary.pricedEvents ? `${formatUsd(monthSummary.remainingUsd || 0)} estimated budget remaining.` : "No provider-priced usage has been recorded for this month yet."}</p>
          </div>}
          <form onSubmit={saveBudget} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-medium text-text-main">Monthly limit · USD<input type="number" min="0.000001" max="100000000" step="any" value={budgetLimit} onChange={(event) => { setBudgetLimit(event.target.value); setBudgetSaved(false); setBudgetNotice(""); }} className={`${inputClass} mt-1`} placeholder="e.g. 25" /></label>
            <label className="text-xs font-medium text-text-main">Warn at<select value={budgetThreshold} onChange={(event) => { setBudgetThreshold(Number(event.target.value)); setBudgetSaved(false); setBudgetNotice(""); }} className={`${inputClass} mt-1`}><option value={50}>50%</option><option value={75}>75%</option><option value={80}>80%</option><option value={90}>90%</option><option value={95}>95%</option></select></label>
            <button type="submit" className="rounded-lg bg-sidebar-cocoa px-3 py-2 text-xs font-semibold text-white hover:opacity-90">Save budget</button>
            {budgetSaved && <button type="button" onClick={removeBudget} className="rounded-lg border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-bg-main">Remove budget</button>}
          </form>
          {budgetError && <p role="alert" className="mt-3 text-xs text-red-700">{budgetError}</p>}{budgetNotice && <p role="status" className="mt-3 text-xs text-text-muted">{budgetNotice}</p>}
        </section>

        <section aria-labelledby="usage-pricing-title" className="mb-7 rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-accent" /><h2 id="usage-pricing-title" className="font-semibold text-text-main">Optional model pricing</h2></div>
          <p className="mb-4 text-xs leading-5 text-text-muted">Add the current prices from your provider in USD per 1 million tokens. No provider prices are assumed or fetched automatically, so the estimate cannot silently become stale.</p>
          <form onSubmit={addPricing} className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-text-main">Provider<select value={provider} onChange={(event) => changeProvider(event.target.value)} className={`${inputClass} mt-1`} aria-label="Pricing provider">{availableProviders.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="text-xs font-medium text-text-main">Model ID<input value={model} onChange={(event) => setModel(event.target.value)} maxLength={200} required className={`${inputClass} mt-1`} placeholder="Exact provider model ID" /></label>
            <label className="text-xs font-medium text-text-main">Input price · USD / 1M tokens<input type="number" min="0" max="100000" step="any" value={inputPrice} onChange={(event) => setInputPrice(event.target.value)} required className={`${inputClass} mt-1`} placeholder="e.g. 0.15" /></label>
            <label className="text-xs font-medium text-text-main">Output price · USD / 1M tokens<input type="number" min="0" max="100000" step="any" value={outputPrice} onChange={(event) => setOutputPrice(event.target.value)} required className={`${inputClass} mt-1`} placeholder="e.g. 0.60" /></label>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2"><button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-sidebar-cocoa px-3 py-2 text-xs font-semibold text-white hover:opacity-90"><Plus className="h-3.5 w-3.5" />Save pricing</button>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}{notice && <p role="status" className="text-xs text-text-muted">{notice}</p>}</div>
          </form>
          {rates.length > 0 && <div className="mt-4 space-y-2">{rates.map((rate) => <div key={`${rate.provider}:${rate.model}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-main/60 bg-bg-main px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate font-medium text-text-main">{rate.provider} · {rate.model}</span><span className="text-text-muted">In ${rate.inputUsdPerMillion}/1M · Out ${rate.outputUsdPerMillion}/1M</span><button type="button" onClick={() => editPricing(rate)} className="rounded-md px-2 py-1 text-accent hover:bg-cream-highlight">Edit</button><button type="button" onClick={() => removePricing(rate)} aria-label={`Remove pricing for ${rate.provider} ${rate.model}`} className="rounded-md p-1.5 text-text-muted hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}
        </section>

        <section aria-labelledby="usage-backup-title" className="mb-7 rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /><h2 id="usage-backup-title" className="font-semibold text-text-main">Encrypted local backup</h2></div>
          <p className="mb-4 text-xs leading-5 text-text-muted">Export or restore this device’s usage records, your model-price estimates, and budget setting in an AES-GCM encrypted file. Prompts, responses, API keys, and provider credentials are not included. The backup password is never saved; if you lose it, Susan AI cannot recover the file.</p>
          <div className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={exportBackup} className="space-y-3 rounded-xl border border-border-main/60 bg-bg-main p-3">
              <h3 className="text-sm font-semibold text-text-main">Export encrypted backup</h3>
              <label className="block text-xs font-medium text-text-main">Backup password (12+ characters)<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} required className={`${inputClass} mt-1`} /></label>
              <label className="block text-xs font-medium text-text-main">Confirm backup password<input type="password" autoComplete="new-password" maxLength={256} value={backupConfirm} onChange={(event) => setBackupConfirm(event.target.value)} required className={`${inputClass} mt-1`} /></label>
              <button type="submit" disabled={backupBusy} className="rounded-lg bg-sidebar-cocoa px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{backupBusy ? "Encrypting…" : "Download encrypted backup"}</button>
            </form>
            <form onSubmit={importBackup} className="space-y-3 rounded-xl border border-border-main/60 bg-bg-main p-3">
              <h3 className="text-sm font-semibold text-text-main">Restore an encrypted backup</h3>
              <label className="block text-xs font-medium text-text-main">Encrypted Susan AI backup<input ref={backupInputRef} type="file" accept=".json,application/json" onChange={(event) => setBackupFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-cream-highlight file:px-3 file:py-2 file:text-xs file:font-semibold file:text-accent" /></label>
              <label className="block text-xs font-medium text-text-main">Backup password<input type="password" autoComplete="current-password" maxLength={256} value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} required className={`${inputClass} mt-1`} /></label>
              <button type="submit" disabled={backupBusy || !backupFile} className="rounded-lg border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-surface disabled:opacity-50">{backupBusy ? "Decrypting…" : "Restore and merge"}</button>
              <p className="text-[10px] leading-4 text-text-muted">Restore merges records; it does not delete current local activity or replace an existing budget.</p>
            </form>
          </div>
          {backupError && <p role="alert" className="mt-3 text-xs text-red-700">{backupError}</p>}{backupNotice && <p role="status" className="mt-3 text-xs text-text-muted">{backupNotice}</p>}
        </section>

        <section aria-labelledby="usage-activity-title" className="rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="usage-activity-title" className="font-semibold text-text-main">Recent activity</h2><p className="mt-1 text-xs text-text-muted">Up to 500 recent request records on this device.</p></div><button type="button" onClick={clearActivity} disabled={!events.length} className="rounded-lg border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-bg-main disabled:opacity-40">Clear activity</button></div>
          {events.length === 0 ? <div className="rounded-xl border border-dashed border-border-main/80 bg-bg-main px-4 py-9 text-center"><Activity className="mx-auto h-6 w-6 text-accent" /><p className="mt-2 text-sm font-medium text-text-main">No usage activity yet</p><p className="mt-1 text-xs text-text-muted">Completed and failed chat requests will appear here.</p></div> : <ol className="space-y-2">{events.map((event) => <ActivityRow key={event.id} event={event} rates={rates} />)}</ol>}
        </section>
      </main>
      <footer className="border-t border-border-main/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] text-text-muted">Saved on this device · Clear browser/site data may remove this activity</footer>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="min-w-0 rounded-xl border border-border-main/70 bg-surface p-3 shadow-sm sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-2 truncate text-xl font-semibold text-text-main sm:text-2xl">{value}</p><p className="mt-1 truncate text-[10px] text-text-muted">{detail}</p></article>;
}

function ActivityRow({ event, rates }: { event: UsageActivityItem; rates: UsagePricingRate[] }) {
  const cost = estimateCostForDisplay(event, rates);
  const statusColor = event.status === "completed" ? "text-emerald-700 bg-emerald-50" : event.status === "failed" ? "text-red-700 bg-red-50" : "text-text-muted bg-bg-main";
  return <li className="flex flex-col gap-2 rounded-xl border border-border-main/60 bg-bg-main p-3 sm:flex-row sm:items-center sm:gap-3">
    <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${statusColor}`}>{event.status}</span>
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-text-main">{event.provider} · {event.model}</p><p className="mt-0.5 text-[10px] text-text-muted">{new Date(event.timestamp).toLocaleString()} · {event.durationMs === null ? "Duration unavailable" : `${(event.durationMs / 1000).toFixed(1)}s`}</p></div>
    <div className="text-left text-[10px] text-text-muted sm:text-right">{event.source === "provider" ? <><p>{formatCount(event.inputTokens || 0)} input · {formatCount(event.outputTokens || 0)} output tokens</p><p className="mt-0.5">Provider-reported{cost === null ? " · no pricing set" : ` · ${formatUsd(cost)} estimated`}</p></> : <p>Provider did not report token counts</p>}</div>
  </li>;
}

function estimateCostForDisplay(event: UsageActivityItem, rates: UsagePricingRate[]) {
  const rate = rates.find((item) => item.provider === event.provider && item.model === event.model);
  if (!rate || event.source !== "provider" || event.inputTokens === null || event.outputTokens === null) return null;
  return (event.inputTokens * rate.inputUsdPerMillion + event.outputTokens * rate.outputUsdPerMillion) / 1_000_000;
}

function formatCount(count: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(count);
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(amount);
}
