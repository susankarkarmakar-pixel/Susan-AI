"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Globe2, LockKeyhole, Menu, MessageSquare, PanelRightOpen, Settings, Sparkles } from "lucide-react";
import { ModelOption } from "@/components/sidebar/model-selector";
import { AgentMode } from "@/lib/agent/mode";
import { AgentAttachment, AgentTask, ExecutionEvent } from "@/lib/agent/types";
import { AgentExecutionOutcome } from "@/lib/agent/executor";
import { AgentTaskComposer } from "@/components/agent/agent-task-composer";
import { AgentSidePanel } from "@/components/agent/agent-side-panel";
import { InlineAgentTaskCard } from "@/components/agent/inline-agent-task-card";
import { AgentOutputWorkspace } from "@/components/agent/agent-output-workspace";
import { AgentBottomComposer } from "@/components/agent/agent-bottom-composer";
import { ApprovalModal } from "@/components/agent/approval-modal";
import { ChatMessages } from "./chat-messages";
import { MessageInput } from "./message-input";
import { getApiKey } from "@/lib/key-storage";
import { getCustomProviders } from "@/lib/custom-providers";
import { getProviderDescriptor, getProviderDisplayName, supportsProviderCapability } from "@/lib/provider-capabilities";
import { getChatErrorAction } from "@/lib/chat-error-actions.mjs";
import { getAppSettings, type AiEffort } from "@/lib/app-settings";
import type { WorkspaceProject } from "@/lib/workspace-storage";
import { SearchWorkspace } from "@/components/search/search-workspace";
import { FALLBACK_STORAGE_KEY, getConnectedModelIds } from "./model-control-panel";
import { canAttemptAutomaticFallback, MAX_AUTOMATIC_FALLBACK_ATTEMPTS, type RequestLifecycle } from "@/lib/request-lifecycle";

interface ChatAreaProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  activeAgentTask: AgentTask | null;
  agentExecution: Pick<AgentExecutionOutcome, "message" | "output" | "table" | "sheetTables" | "error" | "ok"> | null;
  executionEvents: ExecutionEvent[];
  onCreateAgentTask: (goal: string, attachments: AgentAttachment[]) => AgentTask | void | Promise<AgentTask | void>;
  onRunAgentTask: () => void | Promise<void>;
  onApproveAgentStep: () => void;
  onRejectAgentStep: () => void;
  onRollbackAgentTask: () => void;
  onPauseAgentTask: () => void;
  onResumeAgentTask: () => void;
  onRetryAgentTask: () => void;
  onCancelAgentTask: () => void;
  onClearAgentTask: () => void;
  onOpenSidebar: () => void;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  input: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: (event: React.FormEvent<HTMLFormElement>, files: File[], extractedText?: string) => void | Promise<void>;
  isLoading: boolean;
  isPreparingResearch: boolean;
  requestLifecycle: RequestLifecycle;
  stop: () => void;
  error: Error | undefined;
  onRetry: (messageId?: string) => void;
  onEditMessage: (id: string, content: string) => void;
  onDeleteMessage: (id: string) => void;
  projects: WorkspaceProject[];
  selectedProjectId: string;
  onSelectedProjectChange: (id: string) => void;
  isEditingMessage: boolean;
  onCancelEdit: () => void;
  estimatedTokens: string;
  conversationTitle: string | null;
  onPrompt: (prompt: string) => void;
  effort: AiEffort;
  onEffortChange: (effort: AiEffort) => void;
}

export function ChatArea({ mode, onModeChange, activeAgentTask, agentExecution, executionEvents, onCreateAgentTask, onRunAgentTask, onApproveAgentStep, onRejectAgentStep, onRollbackAgentTask, onPauseAgentTask, onResumeAgentTask, onRetryAgentTask, onCancelAgentTask, onClearAgentTask, onOpenSidebar, selectedModel, onSelectModel, messages, input, onInputChange, onSend, isLoading, isPreparingResearch, requestLifecycle, stop, error, onRetry, onEditMessage, onDeleteMessage, projects, selectedProjectId, onSelectedProjectChange, isEditingMessage, onCancelEdit, estimatedTokens, conversationTitle, onPrompt, effort, onEffortChange }: ChatAreaProps) {
  const [toastError, setToastError] = useState<string | null>(null);
  const [missingKeyPrompt, setMissingKeyPrompt] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState(() => getAppSettings());
  const spokenMessageRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const handledErrorRef = useRef<string | null>(null);
  const fallbackAttemptRef = useRef<{ attempts: number; errorKey: string | null }>({ attempts: 0, errorKey: null });
  const customProvider = getCustomProviders().find((provider) => provider.id === selectedModel);
  const providerDescriptor = getProviderDescriptor(selectedModel, customProvider);
  const modelName = providerDescriptor?.name || "Selected provider";
  const canAttachFiles = supportsProviderCapability(selectedModel, "files", customProvider);
  const attachmentSupportMessage = `${modelName} does not support file attachments. Choose a vision/file-capable model such as Claude, Gemini, or OpenAI.`;
  const lifecycleMessage = requestLifecycle === "preparing" ? "Preparing your research context…" : requestLifecycle === "sending" ? "Sending securely to your selected model…" : requestLifecycle === "streaming" ? "Susan AI is responding…" : requestLifecycle === "completed" ? "Response complete" : requestLifecycle === "failed" ? "Request failed — review the recovery options below." : null;

  useEffect(() => {
    if (!error) {
      fallbackAttemptRef.current = { attempts: 0, errorKey: null };
      handledErrorRef.current = null;
      return;
    }
    if (mode !== "chat" || typeof window === "undefined") return;
    const errorMessage = error.message || "The provider could not complete the request.";
    const errorKey = `${selectedModel}:${errorMessage}`;
    if (handledErrorRef.current === errorKey || fallbackAttemptRef.current.errorKey === errorKey) return;
    handledErrorRef.current = errorKey;
    if (window.localStorage.getItem(FALLBACK_STORAGE_KEY) === "false") return;
    const action = getChatErrorAction(errorMessage);
    if (action !== "models" && action !== "retry") return;
    if (!canAttemptAutomaticFallback(fallbackAttemptRef.current.attempts)) {
      window.setTimeout(() => setFallbackNotice(`Automatic fallback stopped after ${MAX_AUTOMATIC_FALLBACK_ATTEMPTS} attempts. Review the error and choose a model manually.`), 0);
      return;
    }
    const nextModel = getConnectedModelIds().find((model) => model !== selectedModel);
    if (!nextModel) return;
    fallbackAttemptRef.current = { attempts: fallbackAttemptRef.current.attempts + 1, errorKey };
    const nextProvider = getCustomProviders().find((provider) => provider.id === nextModel);
    const nextName = getProviderDisplayName(nextModel, nextProvider);
    onSelectModel(nextModel);
    window.setTimeout(() => setFallbackNotice(`${modelName} could not complete that request. Susan AI switched to ${nextName} and is retrying it.`), 0);
    const retryTimer = window.setTimeout(() => onRetry(), 0);
    const timer = window.setTimeout(() => setFallbackNotice(null), 7000);
    return () => { window.clearTimeout(retryTimer); window.clearTimeout(timer); };
  }, [error, mode, modelName, onRetry, onSelectModel, selectedModel]);

  useEffect(() => {
    const refreshVoiceSettings = () => setVoiceSettings(getAppSettings());
    window.addEventListener("app-settings-updated", refreshVoiceSettings);
    return () => window.removeEventListener("app-settings-updated", refreshVoiceSettings);
  }, []);

  useEffect(() => {
    if (!voiceMode || !voiceSettings.voiceAutoRead || isLoading || typeof window === "undefined") return;
    const latest = [...messages].reverse().find((message) => message.role === "assistant");
    if (!latest || latest.id === spokenMessageRef.current) return;
    const text = typeof latest.content === "string" ? latest.content : messageText(latest);
    if (!text) return;
    spokenMessageRef.current = latest.id;
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioRef.current = null;
    audioUrlRef.current = null;
    const openAiKey = getApiKey("openai");
    if (voiceSettings.voiceOutput === "openai" && openAiKey) {
      const controller = new AbortController();
      void fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openAiKey, text: text.slice(0, 8_000), speed: voiceSettings.voiceRate }),
        signal: controller.signal,
        cache: "no-store",
      }).then(async (response) => {
        if (!response.ok) throw new Error("OpenAI voice output failed.");
        const audio = new Audio(URL.createObjectURL(await response.blob()));
        audioUrlRef.current = audio.src;
        audioRef.current = audio;
        await audio.play();
      }).catch(() => {
        if (voiceSettings.voiceOutput === "openai" && !("speechSynthesis" in window)) setToastError("OpenAI voice output failed. Check your OpenAI key and quota.");
      });
      return () => controller.abort();
    }
    if (!("speechSynthesis" in window)) {
      if (!openAiKey) globalThis.setTimeout(() => setToastError("Voice output needs browser speech support or an OpenAI API key."), 0);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 8_000));
    utterance.rate = voiceSettings.voiceRate;
    utterance.lang = voiceSettings.voiceLanguage === "bn" ? "bn-BD" : voiceSettings.voiceLanguage === "en" ? "en-US" : navigator.language;
    window.speechSynthesis.speak(utterance);
  }, [messages, isLoading, voiceMode, voiceSettings]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>, files: File[], extractedText?: string) => {
    const localProviderReady = customProvider?.requiresApiKey === false;
    if (!getApiKey(selectedModel) && !localProviderReady) {
      event.preventDefault();
      setMissingKeyPrompt(true);
      return;
    }
    setMissingKeyPrompt(false);
    void onSend(event, files, extractedText);
  };

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-bg-main">
      <header className="z-20 flex min-h-[64px] shrink-0 items-center gap-1 border-b border-border-main/50 bg-bg-main/90 px-2 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:min-h-[72px] sm:gap-4 sm:px-4 sm:pb-2 sm:pt-[max(0.75rem,env(safe-area-inset-top))] md:px-8">
        <button type="button" onClick={onOpenSidebar} aria-label="Open sidebar" className="-ml-2 rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main lg:hidden">
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border-main/60 bg-surface px-2 py-1.5 text-sm font-semibold text-text-main shadow-sm sm:px-3 sm:py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-highlight text-accent"><Sparkles className="h-3.5 w-3.5" /></span>
            <span className="hidden sm:inline">Susan AI</span>
          </div>
          <div className="hidden items-center gap-1.5 text-xs text-text-muted lg:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Private workspace</div>
          {conversationTitle && <span className="ml-2 hidden max-w-[260px] truncate text-sm text-text-muted md:inline">{conversationTitle}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div role="group" aria-label="Workspace mode" className="flex shrink-0 items-center rounded-full border border-border-main/60 bg-surface p-0.5 shadow-sm sm:p-1">
            <ModeButton mode="chat" activeMode={mode} onSelect={(nextMode) => { setIsAgentPanelOpen(false); onModeChange(nextMode); }} icon={<MessageSquare className="h-3.5 w-3.5" />} label="Chat" />
            <ModeButton mode="search" activeMode={mode} onSelect={(nextMode) => { setIsAgentPanelOpen(false); onModeChange(nextMode); }} icon={<Globe2 className="h-3.5 w-3.5" />} label="Search" />
            <ModeButton mode="agent" activeMode={mode} onSelect={onModeChange} icon={<Bot className="h-3.5 w-3.5" />} label="Agent" />
          </div>
          {mode === "agent" && <button type="button" aria-label="Open agent details" aria-expanded={isAgentPanelOpen} onClick={() => setIsAgentPanelOpen(true)} className="rounded-full border border-border-main/60 bg-surface p-2.5 text-text-muted shadow-sm hover:text-text-main xl:hidden"><PanelRightOpen className="h-4 w-4" /></button>}
          <button type="button" onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))} aria-label="Open settings" className="rounded-full border border-border-main/60 bg-surface p-2.5 text-text-muted shadow-sm hover:text-text-main"><Settings className="h-4 w-4" /></button>
          <div className="hidden items-center gap-1.5 rounded-full border border-border-main/60 bg-surface px-2.5 py-2 text-[11px] font-semibold text-text-muted sm:flex" title="No sign-in required. Conversations and settings stay in this browser.">
            <LockKeyhole className="h-3.5 w-3.5 text-emerald-700" />
            <span>Local workspace</span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {mode === "search" ? <SearchWorkspace /> : <>
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {toastError && <div role="alert" className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">{toastError}</div>}
          {missingKeyPrompt && <div role="status" aria-live="polite" className="absolute left-1/2 top-4 z-30 flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 flex-col gap-3 rounded-2xl border border-accent/25 bg-surface/95 px-4 py-4 text-sm text-text-main shadow-xl backdrop-blur-sm sm:px-5"><div><p className="font-semibold">Connect a provider to continue</p><p className="mt-1 text-xs leading-5 text-text-muted">To send your message, please add a {modelName} API key in Settings. Susan AI uses your own provider key and does not provide shared credentials. You can also choose a free-tier provider such as Google AI Studio or OpenRouter.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setMissingKeyPrompt(false); document.dispatchEvent(new CustomEvent("open-settings")); }} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover">Add API key</button><button type="button" onClick={() => setMissingKeyPrompt(false)} className="rounded-lg border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-black/5">Not now</button></div></div>}
          {lifecycleMessage && <div role={requestLifecycle === "failed" ? "alert" : "status"} aria-live="polite" className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm ${requestLifecycle === "failed" ? "border-red-200 bg-red-50 text-red-800" : requestLifecycle === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border-main/70 bg-surface/95 text-text-muted"}`}>{lifecycleMessage}</div>}
          {fallbackNotice && <div role="status" aria-live="polite" className="absolute left-1/2 top-4 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 shadow-lg"><span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px]">↗</span>{fallbackNotice}<button type="button" onClick={() => setFallbackNotice(null)} className="ml-1 rounded px-1 text-amber-800 hover:bg-amber-100" aria-label="Dismiss model fallback notice">×</button></div>}
          {error && !toastError && <ErrorRecovery error={error} onRetry={() => onRetry()} onOpenSettings={() => document.dispatchEvent(new CustomEvent("open-settings"))} onOpenModels={onOpenSidebar} />}
          {mode === "agent" && activeAgentTask?.status === "awaiting_approval" && activeAgentTask.steps.find((step) => step.status === "awaiting_approval") && <ApprovalModal task={activeAgentTask} step={activeAgentTask.steps.find((step) => step.status === "awaiting_approval")!} onApprove={onApproveAgentStep} onReject={onRejectAgentStep} />}
          {mode === "agent" && activeAgentTask && <AgentTaskComposer activeTask={activeAgentTask} execution={agentExecution} onCreateTask={onCreateAgentTask} onRunTask={onRunAgentTask} onRollbackTask={onRollbackAgentTask} onPauseTask={onPauseAgentTask} onResumeTask={onResumeAgentTask} onRetryTask={onRetryAgentTask} onCancelTask={onCancelAgentTask} onClearTask={onClearAgentTask} />}
          {mode === "agent" && activeAgentTask && <InlineAgentTaskCard task={activeAgentTask} execution={agentExecution} />}
          {mode === "agent" && activeAgentTask && <AgentOutputWorkspace task={activeAgentTask} execution={agentExecution} />}
          <ChatMessages messages={messages} isStreaming={isLoading} isPreparingResearch={isPreparingResearch} onRetry={onRetry} onEditMessage={onEditMessage} onDeleteMessage={onDeleteMessage} onPrompt={onPrompt} hideWelcome={mode === "agent" && Boolean(activeAgentTask)} />
          {mode === "agent" && <AgentBottomComposer onCreateTask={onCreateAgentTask} activeTask={Boolean(activeAgentTask)} />}
          {mode === "chat" && <div className="border-t border-border-main/50 bg-bg-main/95 pt-2 backdrop-blur-md"><MessageInput key={selectedModel} input={input} onInputChange={onInputChange} onSubmit={handleSubmit} isLoading={isLoading} stop={stop} canAttachFiles={canAttachFiles} attachmentSupportMessage={attachmentSupportMessage} selectedModel={selectedModel} onSelectModel={onSelectModel} projects={projects} selectedProjectId={selectedProjectId} onSelectedProjectChange={onSelectedProjectChange} isEditingMessage={isEditingMessage} onCancelEdit={onCancelEdit} estimatedTokens={estimatedTokens} effort={effort} onEffortChange={onEffortChange} voiceMode={voiceMode} onVoiceModeChange={(enabled) => { if (enabled) { const latest = [...messages].reverse().find((message) => message.role === "assistant"); spokenMessageRef.current = latest?.id || null; } else { window.speechSynthesis?.cancel(); audioRef.current?.pause(); } setVoiceMode(enabled); }} /></div>}
        </main>
        {mode === "agent" && <AgentSidePanel activeTask={activeAgentTask} execution={agentExecution} events={executionEvents} onRollback={onRollbackAgentTask} mobileOpen={isAgentPanelOpen} onClose={() => setIsAgentPanelOpen(false)} />}
        </>}
      </div>
    </div>
  );
}

function messageText(message: { parts?: unknown[] }): string {
  if (!Array.isArray(message.parts)) return "";
  return message.parts.filter((part): part is { text: string } => Boolean(part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string")).map((part) => part.text).join("\n");
}

function ModeButton({ mode, activeMode, onSelect, icon, label }: { mode: AgentMode; activeMode: AgentMode; onSelect: (mode: AgentMode) => void; icon: React.ReactNode; label: string }) {
  const active = mode === activeMode;
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={() => onSelect(mode)} className={`flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-2.5 ${active ? "bg-cream-highlight text-accent" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ErrorRecovery({ error, onRetry, onOpenSettings, onOpenModels }: { error: Error; onRetry: () => void; onOpenSettings: () => void; onOpenModels: () => void }) {
  const message = error.message || "The provider could not complete the request.";
  const actionType = getChatErrorAction(message);
  const isSettingsIssue = actionType === "settings";
  const isModelIssue = actionType === "models";
  const title = isSettingsIssue ? "Connect this provider to continue" : isModelIssue ? "This model is unavailable" : actionType === "retry" ? "The provider could not complete that request" : "We could not complete that request";
  const description = isSettingsIssue ? "Your API key may be missing, invalid, expired, or out of quota. Your key stays in this browser." : isModelIssue ? "The selected model may be unavailable to your account or temporarily offline. Try another connected model." : actionType === "retry" ? "The provider may be busy or the request may have timed out. You can safely try again." : "Check the provider message below, then retry or choose another model.";

  return (
    <div role="alert" aria-live="assertive" className="absolute left-1/2 top-20 z-30 flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 flex-col gap-3 rounded-2xl border border-red-200 bg-surface px-4 py-4 text-text-main shadow-xl sm:px-5">
      <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-text-muted">{description}</p></div>
      <details className="w-full rounded-xl border border-border-main/60 bg-bg-main px-3 py-2"><summary className="cursor-pointer text-[11px] font-semibold text-text-muted">View provider details</summary><p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-text-muted">{message}</p></details>
      <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={isSettingsIssue ? onOpenSettings : isModelIssue ? onOpenModels : onRetry} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90">{isSettingsIssue ? "Open API Keys" : isModelIssue ? "Choose another model" : "Retry"}</button>{actionType !== "retry" && <button type="button" onClick={onRetry} className="rounded-xl border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-black/5">Retry</button>}{!isSettingsIssue && <button type="button" onClick={onOpenModels} className="rounded-xl border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-black/5">Try another model</button>}</div>
    </div>
  );
}
