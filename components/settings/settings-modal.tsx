"use client";

import { useState, useEffect, useRef } from "react";
import { X, Lock, Trash2, ExternalLink, Settings2, Cpu, KeyRound, Palette, Files, SlidersHorizontal, Database, Bell, Zap, Monitor } from "lucide-react";
import { ApiKeyInput } from "./api-key-input";
import { saveKeys, getKeys, clearKeys, getKeyStorageMode, ApiKeys, KeyStorageMode } from "@/lib/key-storage";
import { FREE_TIER_DIRECTORY, INSTANT_CHAT_PROVIDERS, MODELS_METADATA } from "@/lib/ai-providers";
import { AppSettings, getAppSettings, resetAppSettings, updateAppSettings } from "@/lib/app-settings";
import { addCustomProvider, CustomProvider, getCustomProviders, isAllowedBaseUrl, removeCustomProvider } from "@/lib/custom-providers";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "general" | "providers" | "keys";
}

type SettingsTab = "general" | "providers" | "keys" | "appearance" | "chat" | "advanced";

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; description: string; icon: typeof Settings2 }> = [
  { id: "general", label: "General", description: "App preferences", icon: Settings2 },
  { id: "providers", label: "AI Providers", description: "Model selection", icon: Cpu },
  { id: "keys", label: "API Keys", description: "Manage your keys", icon: KeyRound },
  { id: "appearance", label: "Appearance", description: "Theme and display", icon: Palette },
  { id: "chat", label: "Chat & Files", description: "Conversation settings", icon: Files },
  { id: "advanced", label: "Advanced", description: "Developer options", icon: SlidersHorizontal },
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
        const appSettings = JSON.parse(localStorage.getItem("susan_app_settings_v1") || "null") as Partial<AppSettings> | null;
        setAutoSave(appSettings?.autoSave ?? true);
        setStreaming(appSettings?.streaming ?? true);
        setNotifications(appSettings?.notifications ?? false);
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

  const handleSave = () => {
    saveKeys(keys, storageMode);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="susan-settings-title" className="relative flex h-[min(860px,calc(100dvh-1rem))] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#FCFAF5] shadow-2xl sm:rounded-[26px]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-main/50 px-6 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><Settings2 className="h-6 w-6" /></span>
            <div><h2 id="susan-settings-title" className="text-2xl font-semibold text-text-main">Settings</h2><p className="text-sm text-text-muted">Customize your experience with Susan AI</p></div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="hidden w-[260px] shrink-0 border-r border-border-main/60 bg-[#FAF5EC] p-5 md:block"><nav className="space-y-1" aria-label="Settings sections">{SETTINGS_TABS.map((tab) => { const Icon = tab.icon; const selected = activeTab === tab.id; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={selected ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${selected ? "bg-cream-highlight text-text-main" : "text-text-muted hover:bg-black/5"}`}><Icon className="h-5 w-5" /><span><span className="block text-sm font-semibold">{tab.label}</span><span className="block text-xs opacity-70">{tab.description}</span></span></button>; })}</nav></aside>
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-main/50 bg-[#FAF5EC] px-2 py-2 md:hidden" aria-label="Settings sections">{SETTINGS_TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? "bg-cream-highlight text-text-main" : "text-text-muted hover:bg-black/5"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</nav>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            {activeTab === "keys" ? <>
        <div role="alert" className="mb-5 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Important: browser-local BYOK storage</p>
          <p className="mt-1 text-xs leading-relaxed">
            Session-only keys are removed when the browser session ends. If you enable browser persistence, keys are stored using Base64 encoding; Base64 is <strong>not encryption</strong>. Use provider-restricted keys with minimal permissions, avoid shared devices, and clear your keys before handing this device to someone else.
          </p>
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border-main/50 bg-black/[.02] p-3">
          <input type="checkbox" checked={storageMode === "browser"} onChange={(event) => setStorageMode(event.target.checked ? "browser" : "session")} className="mt-0.5 h-4 w-4 accent-accent" />
          <span className="text-sm text-text-main">
            <span className="block font-semibold">Remember keys in this browser</span>
            <span className="mt-1 block text-xs leading-relaxed text-text-muted">Off by default: session-only keys are removed when this browser session ends. Turn this on only on a trusted personal device.</span>
          </span>
        </label>

        <div className="mb-5 rounded-xl border border-green-600/20 bg-green-50/60 p-3">
          <h3 className="mb-2 text-sm font-semibold text-text-main">Free-tier options</h3>
          <div className="space-y-2">
            {FREE_TIER_DIRECTORY.map((item) => (
              <div key={item.provider} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium text-text-main">{item.title} <span className="font-normal text-green-700">· {item.model}</span></p>
                  <p className="text-text-muted">{item.note}</p>
                </div>
                <a href={MODELS_METADATA[item.provider].setupUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent hover:underline" aria-label={`Get ${item.title} API key`}>Get key <ExternalLink className="inline h-3 w-3" /></a>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">“Free-tier” means the provider may offer free quota; it is not a guarantee of unlimited or permanent free access.</p>
        </div>

        <div className="mb-5 rounded-xl border border-border-main/60 bg-black/[0.02] p-3">
          <h3 className="text-sm font-semibold text-text-main">Add a custom provider</h3>
          <p className="mt-1 text-xs text-text-muted">Connect any OpenAI-compatible free or paid API, including local Ollama-compatible servers.</p>
          <div className="mt-3 space-y-2">
            <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Provider name (e.g. Together AI)" className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
            <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="Model name (e.g. meta-llama/Llama-3.3-70B)" className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
            <input value={customBaseUrl} onChange={(event) => setCustomBaseUrl(event.target.value)} placeholder="Base URL (https://api.example.com/v1)" className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
            {customError && <p role="alert" className="text-xs text-red-600">{customError}</p>}
            <button type="button" onClick={handleAddCustomProvider} className="w-full rounded-lg border border-border-main bg-surface px-3 py-2 text-sm font-medium hover:bg-black/5">Add provider</button>
          </div>
          {customProviders.length > 0 && <div className="mt-3 space-y-2">{customProviders.map((provider) => <div key={provider.id} className="flex items-center gap-2 rounded-lg border border-border-main/50 bg-surface p-2 text-xs"><div className="min-w-0 flex-1"><p className="truncate font-medium">{provider.name} · {provider.model}</p><p className="truncate text-text-muted">{provider.baseUrl}</p></div><button type="button" onClick={() => { removeCustomProvider(provider.id, keys, storageMode); setCustomProviders((current) => current.filter((item) => item.id !== provider.id)); const nextKeys = { ...keys }; delete nextKeys[provider.id]; setKeys(nextKeys); setSavedKeys(nextKeys); }} className="shrink-0 text-red-600 hover:underline">Remove</button></div>)}</div>}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
          <ApiKeyInput
            label="DeepSeek API Key"
            provider="deepseek"
            placeholder="sk-..."
            helpUrl="https://platform.deepseek.com"
            value={keys.deepseek || ""}
            onChange={(val) => handleKeyChange("deepseek", val)}
            isSaved={!!savedKeys.deepseek}
          />
          <ApiKeyInput
            label="Anthropic (Claude) API Key"
            provider="anthropic"
            placeholder="sk-ant-..."
            helpUrl="https://console.anthropic.com"
            value={keys.anthropic || ""}
            onChange={(val) => handleKeyChange("anthropic", val)}
            isSaved={!!savedKeys.anthropic}
          />
          <ApiKeyInput
            label="Hugging Face API Token"
            provider="huggingface"
            placeholder="hf_..."
            helpUrl="https://huggingface.co/settings/tokens"
            value={keys.huggingface || ""}
            onChange={(val) => handleKeyChange("huggingface", val)}
            isSaved={!!savedKeys.huggingface}
          />
          <ApiKeyInput
            label="Google API Key (Gemini)"
            provider="google"
            placeholder="AIza..."
            helpUrl="https://aistudio.google.com/apikey"
            value={keys.google || ""}
            onChange={(val) => handleKeyChange("google", val)}
            isSaved={!!savedKeys.google}
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
          />
          <ApiKeyInput
            label="Qwen API Key"
            provider="qwen"
            placeholder="sk-..."
            helpUrl="https://dashscope.console.aliyun.com/apiKey"
            value={keys.qwen || ""}
            onChange={(val) => handleKeyChange("qwen", val)}
            isSaved={!!savedKeys.qwen}
          />
          <ApiKeyInput
            label="Kimi API Key"
            provider="kimi"
            placeholder="sk-..."
            helpUrl="https://platform.moonshot.cn/console/api-keys"
            value={keys.kimi || ""}
            onChange={(val) => handleKeyChange("kimi", val)}
            isSaved={!!savedKeys.kimi}
          />
          <ApiKeyInput
            label="Sarvam API Key"
            provider="sarvam"
            placeholder="sk-..."
            helpUrl="https://sarvam.ai"
            value={keys.sarvam || ""}
            onChange={(val) => handleKeyChange("sarvam", val)}
            isSaved={!!savedKeys.sarvam}
          />
          <ApiKeyInput
            label="OpenRouter API Key (free router)"
            provider="openrouter"
            placeholder="sk-or-v1-..."
            helpUrl="https://openrouter.ai/settings/keys"
            value={keys.openrouter || ""}
            onChange={(val) => handleKeyChange("openrouter", val)}
            isSaved={!!savedKeys.openrouter}
          />
          {customProviders.map((provider) => <ApiKeyInput key={provider.id} label={`${provider.name} API Key`} provider={provider.id} placeholder="Provider API key" helpUrl={provider.baseUrl} value={keys[provider.id] || ""} onChange={(val) => handleKeyChange(provider.id, val)} isSaved={!!savedKeys[provider.id]} />)}
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
              className="mr-auto flex items-center gap-1.5 px-2 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
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
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-colors shadow-sm"
            >
              Save Keys
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted/70 text-center">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Your keys are stored locally and used only to route requests to the selected provider. Review provider terms before entering production credentials.</span>
          </div>
        </div>

        </> : <SettingsTabContent activeTab={activeTab} autoSave={autoSave} setAutoSave={(value) => { setAutoSave(value); updateAppSettings({ autoSave: value }); }} streaming={streaming} setStreaming={(value) => { setStreaming(value); updateAppSettings({ streaming: value }); }} notifications={notifications} setNotifications={(value) => { setNotifications(value); updateAppSettings({ notifications: value }); }} />}
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


function SettingsTabContent({ activeTab, autoSave, setAutoSave, streaming, setStreaming, notifications, setNotifications }: { activeTab: SettingsTab; autoSave: boolean; setAutoSave: (value: boolean) => void; streaming: boolean; setStreaming: (value: boolean) => void; notifications: boolean; setNotifications: (value: boolean) => void }) {
  if (activeTab === "providers") return <SettingsPanel title="AI Providers" subtitle="View available providers and model capabilities"><InfoCard icon={Cpu} title="Provider selection" text="Choose your preferred model from the model selector in the workspace. Provider capabilities and file support are shown before you send a request." /><div className="grid gap-3 md:grid-cols-2">{INSTANT_CHAT_PROVIDERS.map((provider) => { const meta = MODELS_METADATA[provider]; const configured = Boolean(getKeys()[provider]); return <div key={provider} className="rounded-2xl border border-border-main/60 bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-text-main">{meta.name}</p><p className="text-xs text-text-muted">{meta.model}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${configured ? "bg-green-100 text-green-700" : "bg-black/5 text-text-muted"}`}>{configured ? "Ready" : "Needs key"}</span></div><div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-text-muted"><span className="rounded bg-black/5 px-2 py-1">Streaming</span>{meta.capabilities.files && <span className="rounded bg-black/5 px-2 py-1">Files</span>}{meta.capabilities.vision && <span className="rounded bg-black/5 px-2 py-1">Vision</span>}</div></div>; })}</div></SettingsPanel>;
  if (activeTab === "appearance") return <SettingsPanel title="Appearance" subtitle="Theme and display preferences"><InfoCard icon={Palette} title="Warm cream theme" text="Susan AI uses a calm cream and cocoa palette designed for focused, comfortable sessions." /><label className="flex items-center justify-between rounded-2xl border border-border-main/60 bg-surface p-5"><span><b className="block text-sm">Compact interface</b><small className="text-xs text-text-muted">Use tighter spacing in the workspace</small></span><input defaultChecked={getAppSettings().compactMode} type="checkbox" className="h-5 w-5 accent-accent" onChange={(event) => updateAppSettings({ compactMode: event.target.checked })} /></label></SettingsPanel>;
  if (activeTab === "chat") return <SettingsPanel title="Chat & Files" subtitle="Conversation and attachment preferences"><ToggleRow icon={Database} title="Auto-save conversations" text="Automatically save conversations to browser storage" value={autoSave} onChange={setAutoSave} /><ToggleRow icon={Zap} title="Enable streaming responses" text="Show AI responses as they are generated" value={streaming} onChange={setStreaming} /><InfoCard icon={Files} title="File limits" text="Up to 3 files, 4 MB each and 12 MB total. Provider support may vary." /></SettingsPanel>;
  if (activeTab === "advanced") return <SettingsPanel title="Advanced" subtitle="Developer options and diagnostics"><InfoCard icon={SlidersHorizontal} title="Runtime diagnostics" text="Use the production health endpoint and release smoke tests to verify deployment health." /><InfoCard icon={Bell} title="Browser notifications" text="Notifications are currently opt-in and remain disabled by default." /><button type="button" onClick={() => { if (window.confirm("Reset Susan AI preferences?")) resetAppSettings(); }} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Reset local preferences</button></SettingsPanel>;
  return <SettingsPanel title="General" subtitle="Basic preferences for your Susan AI experience"><div className="grid gap-4 md:grid-cols-2"><label className="rounded-2xl border border-border-main/60 bg-surface p-4"><span className="mb-2 block text-sm font-semibold">Default AI Provider</span><select defaultValue={getAppSettings().defaultProvider} onChange={(event) => updateAppSettings({ defaultProvider: event.target.value })} className="w-full rounded-xl border border-border-main bg-white px-3 py-2 text-sm"><option value="deepseek">DeepSeek Chat</option><option value="openai">OpenAI</option><option value="anthropic">Claude</option><option value="google">Gemini</option></select><small className="mt-2 block text-xs text-text-muted">Model to use when starting a new chat</small></label><label className="rounded-2xl border border-border-main/60 bg-surface p-4"><span className="mb-2 block text-sm font-semibold">Conversation Language</span><select defaultValue={getAppSettings().language} onChange={(event) => updateAppSettings({ language: event.target.value as AppSettings["language"] })} className="w-full rounded-xl border border-border-main bg-white px-3 py-2 text-sm"><option value="auto">Auto Detect</option><option value="en">English</option><option value="bn">বাংলা</option></select><small className="mt-2 block text-xs text-text-muted">Language for AI responses</small></label></div><ToggleRow icon={Monitor} title="Startup behavior" text="Show the welcome screen when Susan AI opens" value={true} onChange={() => updateAppSettings({ startupBehavior: "welcome" })} /><ToggleRow icon={Bell} title="Browser notifications" text="Show notifications when responses are ready" value={notifications} onChange={setNotifications} /><DataManagement /></SettingsPanel>;
}
function SettingsPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <div className="mx-auto max-w-3xl"><h1 className="text-2xl font-semibold text-text-main">{title}</h1><p className="mt-1 text-sm text-text-muted">{subtitle}</p><div className="mt-7 space-y-3">{children}</div></div>; }
function InfoCard({ icon: Icon, title, text }: { icon: typeof Settings2; title: string; text: string }) { return <div className="rounded-2xl border border-border-main/60 bg-surface p-5"><Icon className="mb-4 h-6 w-6 text-accent" /><h2 className="text-sm font-semibold text-text-main">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{text}</p></div>; }
function ToggleRow({ icon: Icon, title, text, value, onChange }: { icon: typeof Settings2; title: string; text: string; value: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between rounded-2xl border border-border-main/60 bg-surface p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Icon className="h-5 w-5" /></span><span><b className="block text-sm text-text-main">{title}</b><small className="text-xs text-text-muted">{text}</small></span></div><button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-7 w-12 rounded-full transition-colors ${value ? "bg-sidebar-cocoa" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} /></button></div>; }
function DataManagement() { return <div className="border-t border-border-main/50 pt-6"><div className="mb-3 flex items-center gap-3"><Database className="h-5 w-5 text-accent" /><div><b className="block text-sm">Data Management</b><small className="text-xs text-text-muted">Manage your conversation data</small></div></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl border border-border-main bg-surface px-4 py-2 text-xs font-semibold">Export All Conversations</button><button type="button" className="rounded-xl border border-border-main bg-surface px-4 py-2 text-xs font-semibold">Import Conversations</button><button type="button" className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-600">Clear All Conversations</button></div></div>; }
