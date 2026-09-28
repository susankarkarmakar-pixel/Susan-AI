"use client";

import { useState } from "react";
import { Bot, Globe2, Menu, MessageSquare, PanelRightOpen, Settings, Sparkles } from "lucide-react";
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
import { MODELS_METADATA } from "@/lib/ai-providers";
import { getCustomProviders } from "@/lib/custom-providers";
import { getChatErrorAction } from "@/lib/chat-error-actions.mjs";
import type { AssistantProfile } from "@/lib/app-settings";
import type { WorkspaceProject } from "@/lib/workspace-storage";
import { SearchWorkspace } from "@/components/search/search-workspace";

interface ChatAreaProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  activeAgentTask: AgentTask | null;
  agentExecution: Pick<AgentExecutionOutcome, "message" | "output" | "table" | "sheetTables" | "error" | "ok"> | null;
  executionEvents: ExecutionEvent[];
  onCreateAgentTask: (goal: string, attachments: AgentAttachment[]) => void | Promise<void>;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  input: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: (event: React.FormEvent<HTMLFormElement>, files: File[]) => void | Promise<void>;
  isLoading: boolean;
  isPreparingResearch: boolean;
  stop: () => void;
  error: Error | undefined;
  onRetry: (messageId?: string) => void;
  onEditMessage: (id: string, content: string) => void;
  onDeleteMessage: (id: string) => void;
  assistantProfile: AssistantProfile;
  onAssistantProfileChange: (profile: AssistantProfile) => void;
  projects: WorkspaceProject[];
  selectedProjectId: string;
  onSelectedProjectChange: (id: string) => void;
  isEditingMessage: boolean;
  onCancelEdit: () => void;
  estimatedTokens: string;
  conversationTitle: string | null;
  onPrompt: (prompt: string) => void;
}

export function ChatArea({ mode, onModeChange, activeAgentTask, agentExecution, executionEvents, onCreateAgentTask, onRunAgentTask, onApproveAgentStep, onRejectAgentStep, onRollbackAgentTask, onPauseAgentTask, onResumeAgentTask, onRetryAgentTask, onCancelAgentTask, onClearAgentTask, onOpenSidebar, selectedModel, messages, input, onInputChange, onSend, isLoading, isPreparingResearch, stop, error, onRetry, onEditMessage, onDeleteMessage, assistantProfile, onAssistantProfileChange, projects, selectedProjectId, onSelectedProjectChange, isEditingMessage, onCancelEdit, estimatedTokens, conversationTitle, onPrompt }: ChatAreaProps) {
  const [toastError, setToastError] = useState<string | null>(null);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const customProvider = getCustomProviders().find((provider) => provider.id === selectedModel);
  const modelMetadata = MODELS_METADATA[selectedModel as keyof typeof MODELS_METADATA];
  const modelName = modelMetadata?.name || customProvider?.name || "Selected provider";
  const canAttachFiles = modelMetadata?.capabilities.files ?? false;
  const attachmentSupportMessage = `${modelName} does not support file attachments. Choose a vision/file-capable model such as Claude, Gemini, or OpenAI.`;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>, files: File[]) => {
    if (!getApiKey(selectedModel)) {
      event.preventDefault();
      setToastError(`Please add your ${modelName} API key in Settings first.`);
      window.setTimeout(() => setToastError(null), 5000);
      document.dispatchEvent(new CustomEvent("open-settings"));
      return;
    }
    void onSend(event, files);
  };

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-bg-main">
      <header className="z-20 flex min-h-[72px] shrink-0 items-center gap-2 border-b border-border-main/50 bg-bg-main/90 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:gap-4 sm:px-4 md:px-8">
        <button type="button" onClick={onOpenSidebar} aria-label="Open sidebar" className="-ml-2 rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main lg:hidden">
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border-main/60 bg-surface px-3 py-2 text-sm font-semibold text-text-main shadow-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-highlight text-accent"><Sparkles className="h-3.5 w-3.5" /></span>
            <span className="hidden sm:inline">Susan AI</span>
          </div>
          <div className="hidden items-center gap-1.5 text-xs text-text-muted lg:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Private workspace</div>
          {conversationTitle && <span className="ml-2 hidden max-w-[260px] truncate text-sm text-text-muted md:inline">{conversationTitle}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Workspace mode" className="flex shrink-0 items-center rounded-full border border-border-main/60 bg-surface p-1 shadow-sm">
            <ModeButton mode="chat" activeMode={mode} onSelect={(nextMode) => { setIsAgentPanelOpen(false); onModeChange(nextMode); }} icon={<MessageSquare className="h-3.5 w-3.5" />} label="Chat" />
            <ModeButton mode="search" activeMode={mode} onSelect={(nextMode) => { setIsAgentPanelOpen(false); onModeChange(nextMode); }} icon={<Globe2 className="h-3.5 w-3.5" />} label="Search" />
            <ModeButton mode="agent" activeMode={mode} onSelect={onModeChange} icon={<Bot className="h-3.5 w-3.5" />} label="Agent" />
          </div>
          {mode === "agent" && <button type="button" aria-label="Open agent details" aria-expanded={isAgentPanelOpen} onClick={() => setIsAgentPanelOpen(true)} className="rounded-full border border-border-main/60 bg-surface p-2.5 text-text-muted shadow-sm hover:text-text-main xl:hidden"><PanelRightOpen className="h-4 w-4" /></button>}
          <button type="button" onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))} aria-label="Open settings" className="rounded-full border border-border-main/60 bg-surface p-2.5 text-text-muted shadow-sm hover:text-text-main"><Settings className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {mode === "search" ? <SearchWorkspace /> : <>
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {toastError && <div role="alert" className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">{toastError}</div>}
          {error && !toastError && <ErrorRecovery error={error} onRetry={() => onRetry()} onOpenSettings={() => document.dispatchEvent(new CustomEvent("open-settings"))} onOpenModels={onOpenSidebar} />}
          {mode === "agent" && activeAgentTask?.status === "awaiting_approval" && activeAgentTask.steps.find((step) => step.status === "awaiting_approval") && <ApprovalModal task={activeAgentTask} step={activeAgentTask.steps.find((step) => step.status === "awaiting_approval")!} onApprove={onApproveAgentStep} onReject={onRejectAgentStep} />}
          {mode === "agent" && activeAgentTask && <AgentTaskComposer activeTask={activeAgentTask} execution={agentExecution} onCreateTask={onCreateAgentTask} onRunTask={onRunAgentTask} onRollbackTask={onRollbackAgentTask} onPauseTask={onPauseAgentTask} onResumeTask={onResumeAgentTask} onRetryTask={onRetryAgentTask} onCancelTask={onCancelAgentTask} onClearTask={onClearAgentTask} />}
          {mode === "agent" && activeAgentTask && <InlineAgentTaskCard task={activeAgentTask} execution={agentExecution} />}
          {mode === "agent" && activeAgentTask && <AgentOutputWorkspace task={activeAgentTask} execution={agentExecution} />}
          <ChatMessages messages={messages} isStreaming={isLoading} isPreparingResearch={isPreparingResearch} onRetry={onRetry} onEditMessage={onEditMessage} onDeleteMessage={onDeleteMessage} onPrompt={onPrompt} hideWelcome={mode === "agent" && Boolean(activeAgentTask)} />
          {mode === "agent" && <AgentBottomComposer onCreateTask={onCreateAgentTask} activeTask={Boolean(activeAgentTask)} />}
          {mode === "chat" && <MessageInput key={selectedModel} input={input} onInputChange={onInputChange} onSubmit={handleSubmit} isLoading={isLoading} stop={stop} canAttachFiles={canAttachFiles} attachmentSupportMessage={attachmentSupportMessage} modelName={modelName} assistantProfile={assistantProfile} onAssistantProfileChange={onAssistantProfileChange} projects={projects} selectedProjectId={selectedProjectId} onSelectedProjectChange={onSelectedProjectChange} isEditingMessage={isEditingMessage} onCancelEdit={onCancelEdit} estimatedTokens={estimatedTokens} />}
        </main>
        {mode === "agent" && <AgentSidePanel activeTask={activeAgentTask} execution={agentExecution} events={executionEvents} onRollback={onRollbackAgentTask} mobileOpen={isAgentPanelOpen} onClose={() => setIsAgentPanelOpen(false)} />}
        </>}
      </div>
    </div>
  );
}

function ModeButton({ mode, activeMode, onSelect, icon, label }: { mode: AgentMode; activeMode: AgentMode; onSelect: (mode: AgentMode) => void; icon: React.ReactNode; label: string }) {
  const active = mode === activeMode;
  return (
    <button type="button" aria-pressed={active} onClick={() => onSelect(mode)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${active ? "bg-cream-highlight text-accent" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ErrorRecovery({ error, onRetry, onOpenSettings, onOpenModels }: { error: Error; onRetry: () => void; onOpenSettings: () => void; onOpenModels: () => void }) {
  const message = error.message || "The provider could not complete the request.";
  const actionType = getChatErrorAction(message);
  const action = actionType === "settings"
    ? { label: "Manage API key / access", onClick: onOpenSettings }
    : actionType === "retry"
      ? { label: "Retry", onClick: onRetry }
      : actionType === "models"
        ? { label: "Choose another model", onClick: onOpenModels }
        : null;

  return (
    <div role="alert" className="absolute left-1/2 top-20 z-30 flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 flex-col items-start gap-3 rounded-lg bg-red-500/95 px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
      <span className="min-w-0 max-w-full whitespace-pre-wrap break-words">{message}</span>
      {action && <button type="button" onClick={action.onClick} className="rounded-md bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25">{action.label}</button>}
    </div>
  );
}
