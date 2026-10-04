"use client";

import { useState, useEffect, useRef } from "react";
import { Activity, X, Lock, Trash2, ExternalLink, Settings2, Cpu, KeyRound, Palette, Files, SlidersHorizontal, Database, Bell, Zap, Monitor, CircleHelp, BookOpen, ShieldCheck } from "lucide-react";
import { ApiKeyInput } from "./api-key-input";
import type { ApiKeyConnectionTest } from "./api-key-input";
import { saveKeys, getKeys, clearKeys, forgetThisDevice, getKeyStorageMode, getKeyStorageSecurity, ApiKeys, KeyStorageMode } from "@/lib/key-storage";
import { FREE_TIER_DIRECTORY, INSTANT_CHAT_PROVIDERS } from "@/lib/ai-providers";
import { getProviderDescriptor } from "@/lib/provider-capabilities";
import { AppSettings, getAppSettings, resetAppSettings, updateAppSettings } from "@/lib/app-settings";
import { addCustomProvider, CustomProvider, getCustomProviders, isAllowedBaseUrl, removeCustomProvider } from "@/lib/custom-providers";
import { discoverLocalModels, LOCAL_PROVIDER_PRESETS, LocalProviderPreset, QWEN_LOCAL_MODELS } from "@/lib/local-providers";
import { getProjects, WorkspaceProject } from "@/lib/workspace-storage";
import { ThemeMode, useTheme } from "@/components/theme/theme-provider";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "general" | "providers" | "keys" | "chat";
}

type SettingsTab = "general" | "providers" | "keys" | "appearance" | "chat" | "advanced" | "account" | "help";

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; description: string; group: string; icon: typeof Settings2 }> = [
  { id: "general", label: "General", description: "App preferences", group: "Workspace", icon: Settings2 },
  { id: "account", label: "Privacy & Workspace", description: "Local data ownership", group: "Workspace", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", description: "Theme and display", group: "Workspace", icon: Palette },
  { id: "providers", label: "AI Providers", description: "Model selection", group: "AI & Chat", icon: Cpu },
  { id: "keys", label: "API Keys", description: "Manage your keys", group: "AI & Chat", icon: KeyRound },
  { id: "chat", label: "Chat & Files", description: "Conversation settings", group: "AI & Chat", icon: Files },
  { id: "advanced", label: "Advanced", description: "Developer options", group: "System", icon: SlidersHorizontal },
  { id: "help", label: "Get Help", description: "Guides and support", group: "System", icon: CircleHelp },
];

export function SettingsModal({ isOpen, onClose, initialTab = "general" }: SettingsModalProps) {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [savedKeys, setSavedKeys] = useState<ApiKeys>({});
  const [toast, setToast] = useState(false);
  const [storageMode, setStorageMode] = useState<KeyStorageMode>("session");
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [autoSave, setAutoSave] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [customName, setCustomName] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [localProviderState, setLocalProviderState] = useState<Record<string, "idle" | "detecting">>({});
  const [localProviderError, setLocalProviderError] = useState<string | null>(null);
  const [connectionTests, setConnectionTests] = useState<Record<string, ApiKeyConnectionTest>>({});
  const [temperature, setTemperature] = useState(0.7);
  const [maxOutputTokens, setMaxOutputTokens] = useState(2048);
  const [assistantProfile, setAssistantProfile] = useState<AppSettings["assistantProfile"]>("general");
  const [voiceOutput, setVoiceOutput] = useState<AppSettings["voiceOutput"]>("browser");
  const [voiceAutoRead, setVoiceAutoRead] = useState(true);
  const [voiceRate, setVoiceRate] = useState(1);
  const [voiceLanguage, setVoiceLanguage] = useState<AppSettings["voiceLanguage"]>("auto");
  const [systemPrompts, setSystemPrompts] = useState<AppSettings["systemPrompts"]>({ general: "", coding: "", research: "" });
  const [projectInstructions, setProjectInstructions] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [promptProjectId, setPromptProjectId] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Only update keys when opening the modal, to avoid state lag
  // Since this component might be mounted but hidden, we load keys when it opens
  useEffect(() => {
    if (isOpen) {
      const storedKeys = getKeys();
      const storedMode = getKeyStorageMode();
      // Use setTimeout to avoid synchronous setState inside effect
      setTimeout(() => {
        setActiveTab(initialTab);
        setKeys(storedKeys);
        setSavedKeys(storedKeys);
        setStorageMode(storedMode);
        const appSettings = getAppSettings();
        setAutoSave(appSettings?.autoSave ?? true);
        setStreaming(appSettings?.streaming ?? true);
        setNotifications(appSettings?.notifications ?? false);
        setTemperature(appSettings.temperature);
        setMaxOutputTokens(appSettings.maxOutputTokens);
        setAssistantProfile(appSettings.assistantProfile);
        setVoiceOutput(appSettings.voiceOutput);
        setVoiceAutoRead(appSettings.voiceAutoRead);
        setVoiceRate(appSettings.voiceRate);
        setVoiceLanguage(appSettings.voiceLanguage);
        setSystemPrompts(appSettings.systemPrompts);
        setProjectInstructions(appSettings.projectInstructions);
        const availableProjects = getProjects();
        setProjects(availableProjects);
        setPromptProjectId((current) => availableProjects.some((project) => project.id === current) ? current : availableProjects[0]?.id || "");
        setCustomProviders(getCustomProviders());
      }, 0);
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])"
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await saveKeys(keys, storageMode);
    setSavedKeys(keys);

    // Show toast
    setToast(true);
    setTimeout(() => {
      setToast(false);
      onClose();
    }, 1500);
  };

  const handleKeyChange = (provider: keyof ApiKeys, value: string) => {
    setKeys(prev => ({ ...prev, [provider]: value }));
    setConnectionTests((current) => { const next = { ...current }; delete next[provider]; return next; });
  };

  const testConnection = async (provider: string, customProvider?: CustomProvider) => {
    const apiKey = keys[provider]?.trim();
    const isLocal = customProvider?.requiresApiKey === false;
    const testKey = isLocal ? "local" : apiKey;
    if (!testKey || connectionTests[provider]?.state === "testing") return;
    setConnectionTests((current) => ({ ...current, [provider]: { state: "testing", message: "" } }));
    try {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          provider,
          apiKey: testKey,
          ...(provider === "cloudflare" ? { cloudflareAccountId: keys.cloudflareAccountId } : {}),
          ...(customProvider ? { customProvider } : {}),
        }),
      });
      const result: unknown = await response.json().catch(() => ({}));
      const message = result && typeof result === "object" && typeof (result as { error?: unknown; message?: unknown }).error === "string"
        ? (result as { error: string }).error
        : response.ok ? "Connection verified with a small test request." : `Connection test failed (HTTP ${response.status}).`;
      setConnectionTests((current) => ({ ...current, [provider]: { state: response.ok ? "connected" : "failed", message } }));
    } catch {
      setConnectionTests((current) => ({ ...current, [provider]: { state: "failed", message: "Could not reach the provider test route. Check your connection and try again." } }));
    }
  };

  const handleAddCustomProvider = () => {
    const name = customName.trim();
    const model = customModel.trim();
    const baseUrl = customBaseUrl.trim().replace(/\/$/, "");
    if (!name || !model || !isAllowedBaseUrl(baseUrl)) {
      setCustomError("Enter a provider name, model name, and an HTTPS OpenAI-compatible base URL. Localhost HTTP is allowed for desktop Ollama/local servers.");
      return;
    }
    const provider = addCustomProvider({ name, model, baseUrl });
    setCustomProviders((current) => [...current, provider]);
    setCustomName(""); setCustomModel(""); setCustomBaseUrl(""); setCustomError(null);
  };

  const handleAddLocalProvider = async (preset: LocalProviderPreset) => {
    setLocalProviderError(null);
    setLocalProviderState((current) => ({ ...current, [preset.kind]: "detecting" }));
    try {
      const models = await discoverLocalModels(preset);
      if (models.length === 0) throw new Error(`${preset.name} is reachable, but no models were found. Pull or load a model first.`);
      const existing = customProviders.filter((provider) => provider.localKind === preset.kind).map((provider) => provider.model);
      const added = models.filter((model) => !existing.includes(model));
      if (added.length === 0) throw new Error("All detected local models are already added.");
      const addedProviders = added.map((model) => addCustomProvider({ name: `${preset.name} · ${model}`, model, baseUrl: preset.baseUrl, local: true, requiresApiKey: false, localKind: preset.kind }));
      setCustomProviders((current) => [...current, ...addedProviders]);
      setLocalProviderError(`Added ${addedProviders.length} local model${addedProviders.length === 1 ? "" : "s"}. Select any of them from the model selector to switch instantly.`);
    } catch (error) {
      setLocalProviderError(error instanceof Error ? error.message : `Could not connect to ${preset.name}.`);
    } finally {
      setLocalProviderState((current) => ({ ...current, [preset.kind]: "idle" }));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center px-0 pb-[env(safe-area-inset-bottom)] pt-0 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="susan-settings-title" className="relative flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-border-main/70 bg-bg-main shadow-2xl sm:h-[min(860px,calc(100dvh-2rem))] sm:rounded-[26px]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-main/50 px-4 py-4 sm:px-6 sm:py-5 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><Settings2 className="h-6 w-6" /></span>
            <div><h2 id="susan-settings-title" className="text-xl font-semibold text-text-main sm:text-2xl">Settings</h2><p className="text-xs text-text-muted sm:text-sm">Customize your experience with Susan AI</p></div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close Settings"
            className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="hidden w-[260px] shrink-0 border-r border-border-main/60 bg-bg-sidebar p-5 md:block"><nav className="space-y-4" aria-label="Settings sections">{Array.from(new Set(SETTINGS_TABS.map((tab) => tab.group))).map((group) => <div key={group}><p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted/70">{group}</p><div className="space-y-1">{SETTINGS_TABS.filter((tab) => tab.group === group).map((tab) => { const Icon = tab.icon; const selected = activeTab === tab.id; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={selected ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${selected ? "bg-cream-highlight text-text-main shadow-sm" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`}><Icon className="h-5 w-5" /><span><span className="block text-sm font-semibold">{tab.label}</span><span className="block text-xs opacity-70">{tab.description}</span></span></button>; })}</div></div>)}</nav></aside>
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-main/50 bg-bg-sidebar px-2 py-2 md:hidden" aria-label="Settings sections">{SETTINGS_TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? "bg-cream-highlight text-text-main" : "text-text-muted hover:bg-black/5"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</nav>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
            {activeTab === "keys" ? <>
        <section className="mb-4 rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm" aria-labelledby="key-manager-heading">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent"><KeyRound className="h-5 w-5" /></span><div><h3 id="key-manager-heading" className="font-semibold text-text-main">Add / Manage API Keys</h3><p className="mt-1 text-xs leading-5 text-text-muted">Add a provider key, run a small connection test, then save. Keys stay in this browser and are never shown back in full.</p></div></div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/20 bg-cream-highlight/60 px-3 py-2 text-[11px] leading-5 text-text-main"><Activity className="h-4 w-4 shrink-0" />Testing sends a tiny request that can use provider quota or incur a small charge.</div>
        </section>

        <div role="status" className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3 text-sm text-emerald-950">
          <p className="font-semibold">Encrypted browser-local BYOK storage</p>
          <p className="mt-1 text-xs leading-relaxed">Keys are encrypted with AES-GCM using a randomly generated per-device key. The key never leaves this browser profile. Existing legacy Base64 keys are migrated automatically when this screen loads.</p>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-main/60 bg-black/[.02] p-3">
          <div><p className="text-sm font-semibold text-text-main">This device</p><p className="mt-1 text-xs text-text-muted">Storage status: <span className="font-semibold capitalize text-accent">{getKeyStorageSecurity()}</span></p></div>
          <button type="button" onClick={() => { if (window.confirm("Forget this device and remove all encrypted API keys? You will need to enter them again.")) { forgetThisDevice(); setKeys({}); setSavedKeys({}); setStorageMode("session"); } }} className="flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent hover:bg-cream-highlight"><Trash2 className="h-3.5 w-3.5" />Forget this device</button>
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border-main/50 bg-black/[.02] p-3">
          <input type="checkbox" checked={storageMode === "browser"} onChange={(event) => setStorageMode(event.target.checked ? "browser" : "session")} className="mt-0.5 h-4 w-4 accent-accent" />
          <span className="text-sm text-text-main">
            <span className="block font-semibold">Remember keys in this browser</span>
            <span className="mt-1 block text-xs leading-relaxed text-text-muted">Off by default: session-only keys are removed when this browser session ends. Turn this on only on a trusted personal device.</span>
          </span>
        </label>

        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-cream-highlight/50 p-3">
          <h3 className="mb-2 text-sm font-semibold text-text-main">Free-tier options</h3>
          <div className="space-y-2">
            {FREE_TIER_DIRECTORY.map((item) => (
              <div key={item.provider} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium text-text-main">{item.title} <span className="font-normal text-accent">· {item.model}</span></p>
                  <p className="text-text-muted">{item.note}</p>
                </div>
                <a href={getProviderDescriptor(item.provider)?.setupUrl || "#"} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent hover:underline" aria-label={`Get ${item.title} API key`}>Get key <ExternalLink className="inline h-3 w-3" /></a>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">“Free-tier” means the provider may offer free quota; it is not a guarantee of unlimited or permanent free access.</p>
        </div>

        <div className="mb-5 rounded-xl border border-accent/20 bg-cream-highlight/40 p-3">
          <h3 className="text-sm font-semibold text-text-main">Local AI servers</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">Use models already installed on this computer. No API key or cloud upload is required. Start Ollama, LM Studio, or the AirLLM sidecar first, then detect its models.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {LOCAL_PROVIDER_PRESETS.map((preset) => <div key={preset.kind} className="rounded-lg border border-accent/30 bg-surface p-3"><p className="text-xs font-semibold text-text-main">{preset.name}</p><p className="mt-1 text-[11px] leading-5 text-text-muted">{preset.description}</p><p className="mt-1 break-all font-mono text-[10px] text-accent">{preset.baseUrl}</p><button type="button" onClick={() => void handleAddLocalProvider(preset)} disabled={localProviderState[preset.kind] === "detecting"} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:cursor-wait disabled:opacity-50">{localProviderState[preset.kind] === "detecting" ? "Detecting…" : "Detect & add all models"}</button></div>)}
          </div>
          <div className="mt-3 rounded-lg border border-accent/30 bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-xs font-semibold text-text-main">Recommended local Qwen models</h4><a href="https://qwenlm.github.io/blog/qwen3/" target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-accent hover:underline">Official Qwen overview <ExternalLink className="inline h-3 w-3" /></a></div>
            <p className="mt-1 text-[11px] leading-5 text-text-muted">Choose a size that fits your RAM/VRAM. Download from an official catalog, then start the local server and click Detect.</p>
            <div className="mt-2 space-y-2">{QWEN_LOCAL_MODELS.map((model) => <div key={model.ollamaModel} className="rounded-md border border-border-main/50 bg-surface p-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-text-main">{model.label} <span className="font-normal text-text-muted">· {model.size}</span></span><div className="flex gap-2 text-[11px]"><a href={model.ollamaUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Ollama <ExternalLink className="inline h-3 w-3" /></a><a href={model.lmStudioUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">LM Studio <ExternalLink className="inline h-3 w-3" /></a></div></div><p className="mt-1 break-all font-mono text-[10px] text-text-muted">Ollama: ollama pull {model.ollamaModel}</p><p className="break-all font-mono text-[10px] text-text-muted">LM Studio: {model.lmStudioModel}</p></div>)}</div>
          </div>
          {localProviderError && <p role="alert" className="mt-2 text-xs font-medium text-accent">{localProviderError}</p>}
          <p className="mt-2 text-[11px] text-text-muted">Hosted Susan AI cannot access your computer’s localhost. Use the desktop app or a secure LAN/HTTPS endpoint for local models. AirLLM setup guide: <code className="rounded bg-black/5 px-1">local/airllm-server/README.md</code>.</p>
        </div>

        <div className="mb-5 rounded-xl border border-border-main/60 bg-black/[0.02] p-3">
          <h3 className="text-sm font-semibold text-text-main">Add a custom provider</h3>
          <p className="mt-1 text-xs text-text-muted">Connect any OpenAI-compatible free or paid API, including local Ollama-compatible servers.</p>
          <div className="mt-3 space-y-2">
            <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Provider name (e.g. Together AI)" className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
            <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="Model name (e.g. meta-llama/Llama-3.3-70B)" className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
            <input value={customBaseUrl} onChange={(event) => setCustomBaseUrl(event.target.value)} placeholder="Base URL (https://api.example.com/v1)" className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
            {customError && <p role="alert" className="text-xs text-accent">{customError}</p>}
            <button type="button" onClick={handleAddCustomProvider} className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm font-medium hover:bg-black/5">Add provider</button>
          </div>
          {customProviders.length > 0 && <div className="mt-3 space-y-2">{customProviders.map((provider) => <div key={provider.id} className="flex items-center gap-2 rounded-lg border border-border-main/50 bg-surface p-2 text-xs"><div className="min-w-0 flex-1"><p className="truncate font-medium">{provider.name} · {provider.model}</p><p className="truncate text-text-muted">{provider.baseUrl}</p></div><button type="button" onClick={() => { removeCustomProvider(provider.id, keys, storageMode); setCustomProviders((current) => current.filter((item) => item.id !== provider.id)); const nextKeys = { ...keys }; delete nextKeys[provider.id]; setKeys(nextKeys); setSavedKeys(nextKeys); }} className="shrink-0 text-accent hover:underline">Remove</button></div>)}</div>}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
          <div className="mb-2 rounded-xl border border-accent/20 bg-cream-highlight/50 p-3 text-xs text-text-main">
            <p className="font-semibold">Web Search providers</p>
            <p className="mt-1 leading-relaxed">DuckDuckGo quick search works without a key. Add optional Google, Bing or Brave credentials below to enable those sources and All Sources mode.</p>
          </div>
          <ApiKeyInput label="Google Custom Search API Key" provider="googleSearch" placeholder="Google Search API key" helpUrl="https://developers.google.com/custom-search/v1/overview" value={keys.googleSearch || ""} onChange={(val) => handleKeyChange("googleSearch", val)} isSaved={!!savedKeys.googleSearch} />
          <label className="-mt-3 block text-sm font-medium text-text-main">Google Search Engine ID (CX)<input value={keys.googleSearchCx || ""} onChange={(event) => handleKeyChange("googleSearchCx", event.target.value)} placeholder="Search Engine ID" className="mt-1.5 w-full rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm text-text-main outline-none focus:border-text-main focus:ring-1 focus:ring-text-main/20" /></label>
          <ApiKeyInput label="Bing Web Search API Key" provider="bingSearch" placeholder="Bing Search key" helpUrl="https://www.microsoft.com/en-us/bing/apis/bing-web-search-api" value={keys.bingSearch || ""} onChange={(val) => handleKeyChange("bingSearch", val)} isSaved={!!savedKeys.bingSearch} />
          <ApiKeyInput label="Brave Search API Key" provider="braveSearch" placeholder="Brave Search key" helpUrl="https://brave.com/search/api/" value={keys.braveSearch || ""} onChange={(val) => handleKeyChange("braveSearch", val)} isSaved={!!savedKeys.braveSearch} />
          <ApiKeyInput
            label="DeepSeek API Key"
            provider="deepseek"
            placeholder="sk-..."
            helpUrl="https://platform.deepseek.com"
            value={keys.deepseek || ""}
            onChange={(val) => handleKeyChange("deepseek", val)}
            isSaved={!!savedKeys.deepseek}
            onTest={() => void testConnection("deepseek")}
            connectionTest={connectionTests.deepseek}
          />
          <ApiKeyInput
            label="Anthropic (Claude) API Key"
            provider="anthropic"
            placeholder="sk-ant-..."
            helpUrl="https://console.anthropic.com"
            value={keys.anthropic || ""}
            onChange={(val) => handleKeyChange("anthropic", val)}
            isSaved={!!savedKeys.anthropic}
            onTest={() => void testConnection("anthropic")}
            connectionTest={connectionTests.anthropic}
          />
          <ApiKeyInput
            label="Hugging Face API Token"
            provider="huggingface"
            placeholder="hf_..."
            helpUrl="https://huggingface.co/settings/tokens"
            value={keys.huggingface || ""}
            onChange={(val) => handleKeyChange("huggingface", val)}
            isSaved={!!savedKeys.huggingface}
            onTest={() => void testConnection("huggingface")}
            connectionTest={connectionTests.huggingface}
          />
          <ApiKeyInput
            label="Google API Key (Gemini)"
            provider="google"
            placeholder="AIza..."
            helpUrl="https://aistudio.google.com/apikey"
            value={keys.google || ""}
            onChange={(val) => handleKeyChange("google", val)}
            isSaved={!!savedKeys.google}
            onTest={() => void testConnection("google")}
            connectionTest={connectionTests.google}
          />
          <ApiKeyInput
            label="Google Jules Coding Agent API Key"
            provider="jules"
            placeholder="Jules API key"
            helpUrl="https://jules.google.com/settings"
            helpText="Use the key from Jules Settings (not a Gemini/AI Studio key). Connect the GitHub repository to Jules under the same account before testing."
            value={keys.jules || ""}
            onChange={(val) => handleKeyChange("jules", val)}
            isSaved={!!savedKeys.jules}
          />
          <ApiKeyInput
            label="OpenAI API Key (ChatGPT)"
            provider="openai"
            placeholder="sk-..."
            helpUrl="https://platform.openai.com/api-keys"
            value={keys.openai || ""}
            onChange={(val) => handleKeyChange("openai", val)}
            isSaved={!!savedKeys.openai}
            onTest={() => void testConnection("openai")}
            connectionTest={connectionTests.openai}
          />
          <ApiKeyInput
            label="Qwen API Key"
            provider="qwen"
            placeholder="sk-..."
            helpUrl="https://dashscope.console.aliyun.com/apiKey"
            value={keys.qwen || ""}
            onChange={(val) => handleKeyChange("qwen", val)}
            isSaved={!!savedKeys.qwen}
            onTest={() => void testConnection("qwen")}
            connectionTest={connectionTests.qwen}
          />
          <ApiKeyInput
            label="Kimi API Key"
            provider="kimi"
            placeholder="sk-..."
            helpUrl="https://platform.kimi.ai/console/api-keys"
            value={keys.kimi || ""}
            onChange={(val) => handleKeyChange("kimi", val)}
            isSaved={!!savedKeys.kimi}
            onTest={() => void testConnection("kimi")}
            connectionTest={connectionTests.kimi}
          />
          <ApiKeyInput
            label="Sarvam API Key"
            provider="sarvam"
            placeholder="sk-..."
            helpUrl="https://dashboard.sarvam.ai/"
            value={keys.sarvam || ""}
            onChange={(val) => handleKeyChange("sarvam", val)}
            isSaved={!!savedKeys.sarvam}
            onTest={() => void testConnection("sarvam")}
            connectionTest={connectionTests.sarvam}
          />
          <ApiKeyInput
            label="OpenRouter API Key (free router)"
            provider="openrouter"
            placeholder="sk-or-v1-..."
            helpUrl="https://openrouter.ai/settings/keys"
            value={keys.openrouter || ""}
            onChange={(val) => handleKeyChange("openrouter", val)}
            isSaved={!!savedKeys.openrouter}
            onTest={() => void testConnection("openrouter")}
            connectionTest={connectionTests.openrouter}
          />
          <ApiKeyInput label="Groq API Key" provider="groq" placeholder="gsk_..." helpUrl="https://console.groq.com/keys" helpText="Free-plan limits apply (currently up to 1,000 requests/day for the selected GPT-OSS model; account limits may vary)." value={keys.groq || ""} onChange={(val) => handleKeyChange("groq", val)} isSaved={!!savedKeys.groq} onTest={() => void testConnection("groq")} connectionTest={connectionTests.groq} />
          <ApiKeyInput label="Cerebras API Key" provider="cerebras" placeholder="Cerebras API key" helpUrl="https://cloud.cerebras.ai/" helpText="The current $5 free trial requires a verified payment method and expires after 30 days. No permanent free tier is documented." value={keys.cerebras || ""} onChange={(val) => handleKeyChange("cerebras", val)} isSaved={!!savedKeys.cerebras} onTest={() => void testConnection("cerebras")} connectionTest={connectionTests.cerebras} />
          <ApiKeyInput label="Mistral API Key" provider="mistral" placeholder="Mistral API key" helpUrl="https://console.mistral.ai/api-keys" helpText="Mistral Free mode needs no card and includes limited monthly API credits for evaluation/prototyping." value={keys.mistral || ""} onChange={(val) => handleKeyChange("mistral", val)} isSaved={!!savedKeys.mistral} onTest={() => void testConnection("mistral")} connectionTest={connectionTests.mistral} />
          <ApiKeyInput label="NVIDIA NIM API Key" provider="nvidia" placeholder="NVIDIA API key" helpUrl="https://build.nvidia.com/settings/api-keys" helpText="Uses Nemotron 3.5 Lightning. Use a build.nvidia.com API key, not an NGC registry key. Hosted inference is free to prototype (typically up to 40 RPM for most models) and is evaluation-only, not production; exact limits vary by account/model." value={keys.nvidia || ""} onChange={(val) => handleKeyChange("nvidia", val)} isSaved={!!savedKeys.nvidia} onTest={() => void testConnection("nvidia")} connectionTest={connectionTests.nvidia} />
          <div className="rounded-xl border border-border-main/60 bg-bg-main/60 p-3">
            <ApiKeyInput label="Cloudflare Workers AI API Token" provider="cloudflare" placeholder="Cloudflare API token" helpUrl="https://dash.cloudflare.com/profile/api-tokens" helpText="Use a token with Workers AI Read and Edit permissions. Free allocation is 10,000 Neurons/day; usage above it may require a paid plan." value={keys.cloudflare || ""} onChange={(val) => handleKeyChange("cloudflare", val)} isSaved={!!savedKeys.cloudflare} onTest={() => void testConnection("cloudflare")} connectionTest={connectionTests.cloudflare} />
            <label className="block text-sm font-medium text-text-main" htmlFor="cloudflare-account-id">Cloudflare Account ID</label>
            <input id="cloudflare-account-id" type="text" autoComplete="off" inputMode="text" maxLength={32} value={keys.cloudflareAccountId || ""} onChange={(event) => handleKeyChange("cloudflareAccountId", event.target.value)} placeholder="32-character account ID" className="mt-1.5 w-full rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm text-text-main outline-none focus:border-text-main focus:ring-1 focus:ring-text-main/20" />
            <p className="mt-1.5 text-xs leading-5 text-text-muted">Find this in your Cloudflare dashboard. Both the token and account ID stay in browser-local key storage.</p>
          </div>
          <ApiKeyInput label="SambaNova SambaCloud API Key" provider="sambanova" placeholder="SambaNova API key" helpUrl="https://cloud.sambanova.ai/apis" helpText="The free tier applies when no payment method is linked. DeepSeek V3.1 currently allows 20 requests/day and 200,000 tokens/day." value={keys.sambanova || ""} onChange={(val) => handleKeyChange("sambanova", val)} isSaved={!!savedKeys.sambanova} onTest={() => void testConnection("sambanova")} connectionTest={connectionTests.sambanova} />
          <ApiKeyInput label="xAI Grok API Key" provider="xai" placeholder="xai-..." helpUrl="https://console.x.ai/team/default/api-keys" helpText="Uses Grok 4.7 for chat, coding, and reasoning." value={keys.xai || ""} onChange={(val) => handleKeyChange("xai", val)} isSaved={!!savedKeys.xai} onTest={() => void testConnection("xai")} connectionTest={connectionTests.xai} />
          <ApiKeyInput label="Perplexity API Key" provider="perplexity" placeholder="pplx-..." helpUrl="https://www.perplexity.ai/settings/api" helpText="Sonar provides web-grounded answers with current sources." value={keys.perplexity || ""} onChange={(val) => handleKeyChange("perplexity", val)} isSaved={!!savedKeys.perplexity} onTest={() => void testConnection("perplexity")} connectionTest={connectionTests.perplexity} />
          <ApiKeyInput label="Together AI API Key" provider="together" placeholder="Together API key" helpUrl="https://api.together.ai/settings/api-keys" helpText="Uses Llama through Together's OpenAI-compatible API." value={keys.together || ""} onChange={(val) => handleKeyChange("together", val)} isSaved={!!savedKeys.together} onTest={() => void testConnection("together")} connectionTest={connectionTests.together} />
          {customProviders.map((provider) => <ApiKeyInput key={provider.id} label={provider.requiresApiKey === false ? `${provider.name} (local)` : `${provider.name} API Key`} provider={provider.id} placeholder={provider.requiresApiKey === false ? "No API key required" : "Provider API key"} value={keys[provider.id] || ""} onChange={(val) => handleKeyChange(provider.id, val)} isSaved={provider.requiresApiKey === false ? true : !!savedKeys[provider.id]} onTest={() => void testConnection(provider.id, provider)} connectionTest={connectionTests[provider.id]} testWithoutKey={provider.requiresApiKey === false} helpUrl={provider.baseUrl} />)}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border-main/50">
          <div className="flex items-center justify-end gap-3 mb-4">
            <button
              onClick={() => {
                if (window.confirm("Remove all saved API keys from this browser?")) {
                  clearKeys();
                  setKeys({});
                  setSavedKeys({});
                }
              }}
              className="mr-auto flex items-center gap-1.5 px-2 py-2 text-sm font-medium text-accent hover:text-accent transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear keys
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-colors shadow-sm"
            >
              Save Keys
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted/70 text-center">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Your key values stay in this browser and are masked by default. AES-GCM protects stored values against casual storage inspection, but a compromised browser profile or running site script can still access keys while the app is open.</span>
          </div>
        </div>

        </> : <SettingsTabContent activeTab={activeTab} onOpenKeys={() => setActiveTab("keys")} autoSave={autoSave} setAutoSave={(value) => { setAutoSave(value); updateAppSettings({ autoSave: value }); }} streaming={streaming} setStreaming={(value) => { setStreaming(value); updateAppSettings({ streaming: value }); }} notifications={notifications} setNotifications={(value) => { setNotifications(value); updateAppSettings({ notifications: value }); }} temperature={temperature} setTemperature={(value) => { setTemperature(value); updateAppSettings({ temperature: value }); }} maxOutputTokens={maxOutputTokens} setMaxOutputTokens={(value) => { setMaxOutputTokens(value); updateAppSettings({ maxOutputTokens: value }); }} assistantProfile={assistantProfile} setAssistantProfile={(value) => { setAssistantProfile(value); updateAppSettings({ assistantProfile: value }); }} voiceOutput={voiceOutput} setVoiceOutput={(value) => { setVoiceOutput(value); updateAppSettings({ voiceOutput: value }); }} voiceAutoRead={voiceAutoRead} setVoiceAutoRead={(value) => { setVoiceAutoRead(value); updateAppSettings({ voiceAutoRead: value }); }} voiceRate={voiceRate} setVoiceRate={(value) => { setVoiceRate(value); updateAppSettings({ voiceRate: value }); }} voiceLanguage={voiceLanguage} setVoiceLanguage={(value) => { setVoiceLanguage(value); updateAppSettings({ voiceLanguage: value }); }} systemPrompts={systemPrompts} setSystemPrompts={(value) => { setSystemPrompts(value); updateAppSettings({ systemPrompts: value }); }} projects={projects} projectInstructions={projectInstructions} promptProjectId={promptProjectId} setPromptProjectId={setPromptProjectId} setProjectInstructions={(value) => { setProjectInstructions(value); updateAppSettings({ projectInstructions: value }); }} />}
          </main>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4">
            Keys saved successfully!
          </div>
        )}

      </div>
    </div>
  );
}


interface SettingsTabContentProps {
  activeTab: SettingsTab;
  onOpenKeys: () => void;
  autoSave: boolean;
  setAutoSave: (value: boolean) => void;
  streaming: boolean;
  setStreaming: (value: boolean) => void;
  notifications: boolean;
  setNotifications: (value: boolean) => void;
  temperature: number;
  setTemperature: (value: number) => void;
  maxOutputTokens: number;
  setMaxOutputTokens: (value: number) => void;
  assistantProfile: AppSettings["assistantProfile"];
  setAssistantProfile: (value: AppSettings["assistantProfile"]) => void;
  voiceOutput: AppSettings["voiceOutput"];
  setVoiceOutput: (value: AppSettings["voiceOutput"]) => void;
  voiceAutoRead: boolean;
  setVoiceAutoRead: (value: boolean) => void;
  voiceRate: number;
  setVoiceRate: (value: number) => void;
  voiceLanguage: AppSettings["voiceLanguage"];
  setVoiceLanguage: (value: AppSettings["voiceLanguage"]) => void;
  systemPrompts: AppSettings["systemPrompts"];
  setSystemPrompts: (value: AppSettings["systemPrompts"]) => void;
  projects: WorkspaceProject[];
  projectInstructions: Record<string, string>;
  promptProjectId: string;
  setPromptProjectId: (id: string) => void;
  setProjectInstructions: (value: Record<string, string>) => void;
}

function SettingsTabContent({ activeTab, onOpenKeys, autoSave, setAutoSave, streaming, setStreaming, notifications, setNotifications, temperature, setTemperature, maxOutputTokens, setMaxOutputTokens, assistantProfile, setAssistantProfile, voiceOutput, setVoiceOutput, voiceAutoRead, setVoiceAutoRead, voiceRate, setVoiceRate, voiceLanguage, setVoiceLanguage, systemPrompts, setSystemPrompts, projects, projectInstructions, promptProjectId, setPromptProjectId, setProjectInstructions }: SettingsTabContentProps) {
  const { theme, setTheme } = useTheme();
  if (activeTab === "account") return <SettingsPanel title="Privacy & Workspace" subtitle="Understand what stays in this browser and what leaves it"><section className="rounded-2xl border border-border-main/60 bg-surface p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold text-text-main">Local-first workspace</h2><p className="mt-1 text-xs leading-5 text-text-muted">Susan AI works without an account. Your conversations, projects, local models, and BYOK settings are managed in this browser.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><StatusTile label="Workspace" value="Browser-local" /><StatusTile label="Projects" value={String(projects.length)} /><StatusTile label="Key storage" value={getKeyStorageSecurity()} /></div></section><section className="rounded-2xl border border-border-main/60 bg-surface p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold text-text-main">Where your data goes</h2><p className="mt-1 text-xs leading-5 text-text-muted">Conversations, projects, knowledge notes, and provider configuration stay in this browser. A chat request sends only the message and selected files to the provider you choose.</p></div></div></section><section className="rounded-2xl border border-dashed border-border-main/70 bg-black/[0.02] p-5"><h2 className="text-sm font-semibold text-text-main">Accounts and sync are planned for later</h2><p className="mt-1 text-xs leading-5 text-text-muted">Sign-in, cloud backup, and multi-device sync are intentionally not part of the current Susan AI workspace. This keeps the present product simple and privacy-first.</p><span className="mt-3 inline-flex rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold text-text-muted">No sign-in required</span></section></SettingsPanel>;
  if (activeTab === "help") return <SettingsPanel title="Get Help" subtitle="Quick-start guides, provider documentation, and ways to report a problem"><section className="rounded-2xl border border-border-main/60 bg-cream-highlight/40 p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-accent"><BookOpen className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold text-text-main">Quick start</h2><p className="mt-1 text-xs leading-5 text-text-muted">Choose a model, add a BYOK key or connect Ollama/LM Studio, then start a chat. Use Agent Mode when the task needs planning, files, tools, or a generated report.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><HelpLink href="https://github.com/susankarkarmakar-pixel/Susan-AI#readme" label="Read the project guide" /><HelpLink href="https://github.com/susankarkarmakar-pixel/Susan-AI/issues" label="Report a problem" /></div></section><section className="rounded-2xl border border-border-main/60 bg-surface p-5"><h2 className="text-sm font-semibold text-text-main">Provider setup guides</h2><div className="mt-3 grid gap-2 sm:grid-cols-2"><HelpLink href="https://aistudio.google.com/apikey" label="Google Gemini API key" /><HelpLink href="https://platform.openai.com/api-keys" label="OpenAI API key" /><HelpLink href="https://console.anthropic.com/settings/keys" label="Anthropic / Claude key" /><HelpLink href="https://ollama.com/download" label="Install Ollama" /><HelpLink href="https://lmstudio.ai/download" label="Install LM Studio" /><HelpLink href="https://lmstudio.ai/docs/developer/core/server" label="LM Studio server guide" /></div></section><section className="rounded-2xl border border-border-main/60 bg-surface p-5"><h2 className="text-sm font-semibold text-text-main">Need more help?</h2><p className="mt-1 text-xs leading-5 text-text-muted">Include the provider name, browser/desktop environment, and the non-sensitive error message. Never include API keys in an issue or support request.</p><div className="mt-3 flex flex-wrap gap-2"><a href="mailto:susankarkarmakar@gmail.com?subject=Susan%20AI%20Help" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90">Contact developer <ExternalLink className="h-3 w-3" /></a><a href="https://github.com/susankarkarmakar-pixel/Susan-AI" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border-main/70 px-4 py-2.5 text-xs font-semibold text-text-main hover:border-accent/50">GitHub repository <ExternalLink className="h-3 w-3" /></a></div></section></SettingsPanel>;
  if (activeTab === "providers") return <SettingsPanel title="AI Providers" subtitle="View available providers and model capabilities"><ProviderHealthCenter onOpenKeys={onOpenKeys} /><div className="grid gap-3 md:grid-cols-2">{INSTANT_CHAT_PROVIDERS.map((provider) => { const descriptor = getProviderDescriptor(provider); const saved = getKeys(); const configured = Boolean(saved[provider] && (provider !== "cloudflare" || saved.cloudflareAccountId)); return <div key={provider} className="rounded-2xl border border-border-main/60 bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-text-main">{descriptor?.name || provider}</p><p className="text-xs text-text-muted">{descriptor?.model || provider}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${configured ? "bg-cream-highlight text-accent" : "bg-black/5 text-text-muted"}`}>{configured ? "Ready" : "Needs key"}</span></div><div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-text-muted"><span className="rounded bg-black/5 px-2 py-1">Streaming</span>{descriptor?.capabilities.files && <span className="rounded bg-black/5 px-2 py-1">Files</span>}{descriptor?.capabilities.vision && <span className="rounded bg-black/5 px-2 py-1">Vision</span>}</div></div>; })}</div><div role="note" className="rounded-xl border border-accent/30 bg-cream-highlight/50 p-4 text-sm leading-6 text-text-main"><strong>GitHub Models is not available:</strong> GitHub retired its inference API, model catalog, and playground on July 30, 2026. See the <a className="underline" href="https://github.blog/changelog/2026-07-30-github-models-is-now-retired/" target="_blank" rel="noopener noreferrer">official notice</a>. OpenRouter is already supported above.</div></SettingsPanel>;
  if (activeTab === "appearance") return <SettingsPanel title="Appearance" subtitle="Theme and display preferences"><InfoCard icon={Palette} title="Choose your theme" text="Susan AI follows your preference across the workspace. System mode automatically matches your device setting." /><div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme preference">{([ ["light", "Light", "Bright surfaces for daytime work", "☼"], ["dark", "Dark", "Low-glare cocoa workspace", "◐"], ["system", "System", "Follow your device setting", "⌘"] ] as Array<[ThemeMode, string, string, string]>).map(([mode, label, description, icon]) => <button key={mode} type="button" role="radio" aria-checked={theme === mode} onClick={() => setTheme(mode)} className={`rounded-2xl border p-4 text-left transition ${theme === mode ? "border-accent bg-cream-highlight shadow-sm" : "border-border-main/60 bg-surface hover:border-accent/50"}`}><span className="flex items-center justify-between"><span className="text-xl text-accent">{icon}</span>{theme === mode && <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-white">Active</span>}</span><b className="mt-4 block text-sm text-text-main">{label}</b><small className="mt-1 block text-xs leading-5 text-text-muted">{description}</small></button>)}</div><label className="flex items-center justify-between rounded-2xl border border-border-main/60 bg-surface p-5"><span><b className="block text-sm text-text-main">Compact interface</b><small className="text-xs text-text-muted">Use tighter spacing in the workspace</small></span><input defaultChecked={getAppSettings().compactMode} type="checkbox" className="h-5 w-5 accent-accent" onChange={(event) => updateAppSettings({ compactMode: event.target.checked })} /></label></SettingsPanel>;
  if (activeTab === "chat") return <SettingsPanel title="Chat & Files" subtitle="Tune generation, assistant behavior, and conversation preferences">
    <ToggleRow icon={Database} title="Auto-save conversations" text="Automatically save conversations to browser storage" value={autoSave} onChange={setAutoSave} />
    <ToggleRow icon={Zap} title="Enable streaming responses" text="Show AI responses as they are generated" value={streaming} onChange={setStreaming} />
    <section className="rounded-2xl border border-border-main/60 bg-surface p-4 sm:p-5" aria-labelledby="voice-accessibility-heading">
      <h2 id="voice-accessibility-heading" className="text-sm font-semibold text-text-main">Voice & Accessibility</h2>
      <p className="mt-1 text-xs leading-5 text-text-muted">Voice mode uses browser speech by default. OpenAI TTS is an optional fallback and uses your saved OpenAI key.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-text-main" htmlFor="voice-output-setting">Voice output
          <select id="voice-output-setting" value={voiceOutput} onChange={(event) => setVoiceOutput(event.target.value as AppSettings["voiceOutput"])} className="mt-1.5 w-full rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm font-normal text-text-main focus-visible:outline-2 focus-visible:outline-accent"><option value="browser">Browser voice</option><option value="openai">OpenAI TTS fallback</option></select>
        </label>
        <label className="block text-xs font-semibold text-text-main" htmlFor="voice-language-setting">Voice language
          <select id="voice-language-setting" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value as AppSettings["voiceLanguage"])} className="mt-1.5 w-full rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm font-normal text-text-main focus-visible:outline-2 focus-visible:outline-accent"><option value="auto">Auto-detect</option><option value="en">English</option><option value="bn">বাংলা</option></select>
        </label>
      </div>
      <label className="mt-4 flex items-center justify-between gap-3 text-sm text-text-main"><span><b className="block text-xs">Auto-read AI responses</b><small className="text-[11px] text-text-muted">Read new assistant messages while Voice Mode is enabled</small></span><input type="checkbox" checked={voiceAutoRead} onChange={(event) => setVoiceAutoRead(event.target.checked)} className="h-5 w-5 accent-accent" /></label>
      <label className="mt-4 block text-xs font-semibold text-text-main" htmlFor="voice-rate-setting">Speaking speed <output className="ml-2 font-normal text-text-muted">{voiceRate.toFixed(1)}×</output><input id="voice-rate-setting" type="range" min="0.5" max="2" step="0.1" value={voiceRate} onChange={(event) => setVoiceRate(Number(event.target.value))} className="mt-3 w-full accent-accent" /><span className="flex justify-between text-[10px] font-normal text-text-muted"><span>Slower</span><span>Faster</span></span></label>
    </section>
    <section className="rounded-2xl border border-border-main/60 bg-surface p-4 sm:p-5" aria-labelledby="generation-settings-heading">
      <h2 id="generation-settings-heading" className="text-sm font-semibold text-text-main">Generation controls</h2>
      <p className="mt-1 text-xs leading-5 text-text-muted">Applied to providers that support these settings. Their effect can vary by model.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-text-main" htmlFor="temperature-setting">Temperature <output className="ml-2 font-normal text-text-muted">{temperature.toFixed(1)}</output>
          <input id="temperature-setting" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} className="mt-3 w-full accent-accent" />
          <span className="flex justify-between text-[10px] text-text-muted"><span>More focused</span><span>More varied</span></span>
        </label>
        <label className="block text-sm font-medium text-text-main" htmlFor="max-output-tokens">Maximum response tokens
          <input id="max-output-tokens" type="number" inputMode="numeric" min="256" max="8192" step="256" value={maxOutputTokens} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) setMaxOutputTokens(Math.max(256, Math.min(8192, Math.round(value / 256) * 256))); }} className="mt-2 w-full rounded-xl border border-border-main bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent" />
          <span className="mt-1 block text-[10px] font-normal text-text-muted">256–8,192 · per response</span>
        </label>
      </div>
    </section>
    <section className="rounded-2xl border border-border-main/60 bg-surface p-4 sm:p-5" aria-labelledby="system-prompts-heading">
      <h2 id="system-prompts-heading" className="text-sm font-semibold text-text-main">Assistant and project instructions</h2>
      <p className="mt-1 text-xs leading-5 text-text-muted">Choose General, Coding, or Research in the composer. Custom instructions are sent with each chat request to the selected provider.</p>
      <label className="mt-4 block text-xs font-semibold text-text-main" htmlFor="assistant-profile-setting">Profile to edit</label>
      <select id="assistant-profile-setting" value={assistantProfile} onChange={(event) => setAssistantProfile(event.target.value as AppSettings["assistantProfile"])} className="mt-1.5 w-full rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm text-text-main focus-visible:outline-2 focus-visible:outline-accent"><option value="general">General</option><option value="coding">Coding</option><option value="research">Research</option></select>
      <label className="mt-4 block text-xs font-semibold text-text-main" htmlFor="profile-prompt-setting">{assistantProfile === "general" ? "General" : assistantProfile === "coding" ? "Coding" : "Research"} profile system prompt</label>
      <textarea id="profile-prompt-setting" maxLength={6000} rows={4} value={systemPrompts[assistantProfile]} onChange={(event) => setSystemPrompts({ ...systemPrompts, [assistantProfile]: event.target.value })} placeholder="Optional instructions for this assistant profile…" className="mt-1.5 w-full resize-y rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm text-text-main focus-visible:outline-2 focus-visible:outline-accent" />
      <p className="mt-1 text-right text-[10px] text-text-muted">{systemPrompts[assistantProfile].length} / 6,000</p>
      {projects.length > 0 ? <><label className="mt-4 block text-xs font-semibold text-text-main" htmlFor="project-prompt-select">Project-specific instructions</label><select id="project-prompt-select" value={promptProjectId} onChange={(event) => setPromptProjectId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm text-text-main focus-visible:outline-2 focus-visible:outline-accent">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><textarea maxLength={6000} rows={3} aria-label="Project-specific system instructions" value={projectInstructions[promptProjectId] || ""} onChange={(event) => setProjectInstructions({ ...projectInstructions, [promptProjectId]: event.target.value.slice(0, 6000) })} placeholder="Optional instructions applied when this project is selected in the chat composer…" className="mt-2 w-full resize-y rounded-xl border border-border-main bg-surface px-3 py-2.5 text-sm text-text-main focus-visible:outline-2 focus-visible:outline-accent" /></> : <p className="mt-4 rounded-xl bg-bg-main p-3 text-xs leading-5 text-text-muted">Create a project first to set project-specific system instructions.</p>}
    </section>
    <InfoCard icon={Files} title="File limits" text="Up to 3 files, 4 MB each and 12 MB total. Provider support may vary." />
  </SettingsPanel>;
  if (activeTab === "advanced") return <SettingsPanel title="Advanced" subtitle="Developer options and diagnostics"><InfoCard icon={SlidersHorizontal} title="Runtime diagnostics" text="Use the production health endpoint and release smoke tests to verify deployment health." /><InfoCard icon={Bell} title="Browser notifications" text="Notifications are currently opt-in and remain disabled by default." /><button type="button" onClick={() => { if (window.confirm("Reset Susan AI preferences?")) resetAppSettings(); }} className="rounded-xl border border-accent/40 bg-cream-highlight/40 px-4 py-3 text-sm font-semibold text-accent">Reset local preferences</button></SettingsPanel>;
  return <SettingsPanel title="General" subtitle="Basic preferences for your Susan AI experience"><div className="grid gap-4 md:grid-cols-2"><label className="rounded-2xl border border-border-main/60 bg-surface p-4"><span className="mb-2 block text-sm font-semibold">Default AI Provider</span><select defaultValue={getAppSettings().defaultProvider} onChange={(event) => updateAppSettings({ defaultProvider: event.target.value })} className="w-full rounded-xl border border-border-main bg-surface px-3 py-2 text-sm"><option value="deepseek">DeepSeek Chat</option><option value="openai">OpenAI</option><option value="anthropic">Claude</option><option value="google">Gemini</option></select><small className="mt-2 block text-xs text-text-muted">Model to use when starting a new chat</small></label><label className="rounded-2xl border border-border-main/60 bg-surface p-4"><span className="mb-2 block text-sm font-semibold">Conversation Language</span><select defaultValue={getAppSettings().language} onChange={(event) => updateAppSettings({ language: event.target.value as AppSettings["language"] })} className="w-full rounded-xl border border-border-main bg-surface px-3 py-2 text-sm"><option value="auto">Auto Detect</option><option value="en">English</option><option value="bn">বাংলা</option></select><small className="mt-2 block text-xs text-text-muted">Language for AI responses</small></label></div><ToggleRow icon={Monitor} title="Startup behavior" text="Show the welcome screen when Susan AI opens" value={true} onChange={() => updateAppSettings({ startupBehavior: "welcome" })} /><ToggleRow icon={Bell} title="Browser notifications" text="Show notifications when responses are ready" value={notifications} onChange={setNotifications} /><DataManagement /></SettingsPanel>;
}
function ProviderHealthCenter({ onOpenKeys }: { onOpenKeys: () => void }) {
  const keys = getKeys();
  const customProviders = getCustomProviders();
  const providers = [...INSTANT_CHAT_PROVIDERS.map((id) => ({ id, label: getProviderDescriptor(id)?.name || id, local: false, configured: Boolean(keys[id] && (id !== "cloudflare" || keys.cloudflareAccountId)) })), ...customProviders.map((provider) => ({ id: provider.id, label: provider.name, local: provider.requiresApiKey === false || provider.local === true, configured: provider.requiresApiKey === false || Boolean(keys[provider.id]) }))];
  const readyCount = providers.filter((provider) => provider.configured).length;
  return <section className="rounded-2xl border border-border-main/60 bg-surface p-5" aria-labelledby="provider-health-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Activity className="h-5 w-5" /></span><div><h2 id="provider-health-heading" className="text-sm font-semibold text-text-main">Provider Health Center</h2><p className="mt-1 text-xs leading-5 text-text-muted">See which models are ready before you start a chat. A ready provider still needs a quick connection test for full verification.</p></div></div>
      <button type="button" onClick={onOpenKeys} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90">Open API Keys</button>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{readyCount} ready</span><span className="rounded-full bg-black/5 px-2.5 py-1 text-text-muted">{providers.length - readyCount} need setup</span><span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">Local providers need no key</span></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{providers.map((provider) => <div key={provider.id} className="flex items-center gap-2.5 rounded-xl border border-border-main/60 bg-bg-main px-3 py-2.5"><span className={`h-2 w-2 shrink-0 rounded-full ${provider.configured ? "bg-emerald-500" : "bg-amber-400"}`} /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-main">{provider.label}</span><span className={`shrink-0 text-[10px] font-semibold ${provider.configured ? "text-emerald-700" : "text-amber-700"}`}>{provider.local ? "Local" : provider.configured ? "Ready" : "Needs key"}</span></div>)}</div>
  </section>;
}
function SettingsPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <div className="mx-auto max-w-3xl"><h1 className="text-2xl font-semibold text-text-main">{title}</h1><p className="mt-1 text-sm text-text-muted">{subtitle}</p><div className="mt-7 space-y-3">{children}</div></div>; }
function InfoCard({ icon: Icon, title, text }: { icon: typeof Settings2; title: string; text: string }) { return <div className="rounded-2xl border border-border-main/60 bg-surface p-5"><Icon className="mb-4 h-6 w-6 text-accent" /><h2 className="text-sm font-semibold text-text-main">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{text}</p></div>; }
function StatusTile({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-black/[0.035] p-3"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted/70">{label}</span><span className="mt-1 block truncate text-sm font-semibold capitalize text-text-main">{value}</span></div>; }
function HelpLink({ href, label }: { href: string; label: string }) { return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className="flex items-center justify-between rounded-xl border border-border-main/60 bg-surface px-3 py-2.5 text-xs font-semibold text-text-main transition-colors hover:border-accent/50 hover:bg-cream-highlight/50"><span>{label}</span><ExternalLink className="h-3 w-3 shrink-0 text-accent" /></a>; }
function ToggleRow({ icon: Icon, title, text, value, onChange }: { icon: typeof Settings2; title: string; text: string; value: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between rounded-2xl border border-border-main/60 bg-surface p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Icon className="h-5 w-5" /></span><span><b className="block text-sm text-text-main">{title}</b><small className="text-xs text-text-muted">{text}</small></span></div><button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-7 w-12 rounded-full transition-colors ${value ? "bg-sidebar-cocoa" : "bg-border-main"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} /></button></div>; }
function DataManagement() { return <div className="border-t border-border-main/50 pt-6"><div className="mb-3 flex items-center gap-3"><Database className="h-5 w-5 text-accent" /><div><b className="block text-sm">Data Management</b><small className="text-xs text-text-muted">Manage your conversation data</small></div></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl border border-border-main bg-surface px-4 py-2 text-xs font-semibold">Export All Conversations</button><button type="button" className="rounded-xl border border-border-main bg-surface px-4 py-2 text-xs font-semibold">Import Conversations</button><button type="button" className="rounded-xl border border-accent/40 bg-surface px-4 py-2 text-xs font-semibold text-accent">Clear All Conversations</button></div></div>; }
