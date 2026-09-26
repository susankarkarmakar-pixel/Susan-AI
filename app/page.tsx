"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { ModelOption } from "@/components/sidebar/model-selector";
import { SettingsModal } from "@/components/settings/settings-modal";
import { AboutModal } from "@/components/about/about-modal";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useConversation } from "@/hooks/use-conversation";
import { useAppSettings } from "@/hooks/use-app-settings";
import { getApiKey } from "@/lib/key-storage";
import { fileToUIPart } from "@/lib/file-attachments";
import { Message } from "@/components/chat/chat-messages";
import { getCustomProviders } from "@/lib/custom-providers";
import { useAgentMode } from "@/hooks/use-agent-mode";
import { AgentAttachment, AgentTask, ExecutionEvent } from "@/lib/agent/types";
import { createAgentTask, transitionTask, updateStepStatus } from "@/lib/agent/agent-state";
import { planAgentTask } from "@/lib/agent/planner";
import { AgentExecutionOutcome, executeFirstToolStep } from "@/lib/agent/executor";
import { useAgentTasks } from "@/hooks/use-agent-tasks";
import { WorkspaceHub, WorkspaceSection } from "@/components/workspace/workspace-hub";
import { HistoryWorkspace } from "@/components/workspace/history-workspace";
import { JulesWorkspace } from "@/components/agent/jules-workspace";

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("home");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "providers" | "keys">("general");
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>("google");
  const [input, setInput] = useState("");
  const { keys, keyVersion } = useApiKeys();
  const { settings } = useAppSettings();
  const { mode, setMode } = useAgentMode();
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | null>(null);
  const [agentExecution, setAgentExecution] = useState<Pick<AgentExecutionOutcome, "message" | "output" | "table" | "sheetTables" | "error" | "ok"> | null>(null);
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const safeTaskSnapshot = useRef<AgentTask | null>(null);
  const { records, ready: tasksReady, save: saveAgentTask, remove: removeAgentTask } = useAgentTasks();
  const restoredTask = useRef(false);

  useEffect(() => {
    // Prefer Gemini by default, then fall back to the first provider whose key
    // is actually configured. This also fixes the common BYOK flow where a
    // newly saved key should immediately become the active model.
    if (getApiKey(selectedModel, keys)) return;
    const preferred = getApiKey("google", keys)
      ? "google"
      : ["openai", "anthropic", "deepseek", "qwen", "kimi", "sarvam", "openrouter", "huggingface", "groq", "cerebras", "mistral", "nvidia", "cloudflare", "sambanova", "jules"].find((provider) => getApiKey(provider, keys));
    if (preferred && preferred !== selectedModel) {
      // This effect synchronizes the selected model with externally stored BYOK keys.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedModel(preferred);
      if (preferred === "jules") { setMode("agent"); setActiveSection("agent"); }
    }
  }, [keyVersion, keys, selectedModel, setMode]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
      provider: selectedModel,
      apiKey: keys[selectedModel] || "",
      cloudflareAccountId: keys.cloudflareAccountId || "",
      customProvider: typeof window !== "undefined" ? getCustomProviders().find((provider) => provider.id === selectedModel) || null : null,
      keyVersion,
      language: settings.language,
      streaming: settings.streaming,
    }),
  }), [selectedModel, keyVersion, keys, settings.language, settings.streaming]);

  const useChatProps = useChat({ transport });
  const messages = useMemo(() => useChatProps.messages || [], [useChatProps.messages]);
  const setMessages = useChatProps.setMessages;
  const sendMessage = useChatProps.sendMessage;
  const regenerate = useChatProps.regenerate;
  const isLoading = useChatProps.status === "submitted" || useChatProps.status === "streaming";
  const stop = useChatProps.stop;
  const error = useChatProps.error;
  const displayMessages: Message[] = messages.map((message) => ({
    id: message.id,
    role: message.role === "system" ? "system" : message.role === "assistant" ? "assistant" : "user",
    content: getMessageText(message),
  }));

  const { currentConversationId, conversationTitle, startNewConversation, loadSavedConversation } = useConversation({
    messages: displayMessages,
    isLoading,
    autoSave: settings.autoSave,
    selectedModel,
    setMessages,
    setInput,
  });

  useEffect(() => {
    const handleOpenSettings = () => { setSettingsTab("general"); setIsSettingsOpen(true); };
    document.addEventListener("open-settings", handleOpenSettings);
    return () => {
      document.removeEventListener("open-settings", handleOpenSettings);
    };
  }, []);

  const handleLoadConversation = (id: string) => {
    const conversation = loadSavedConversation(id);
    if (conversation) {
      if (conversation.model === "manus" || conversation.model === "jules") {
        const fallback = ["google", "openrouter", "openai", "anthropic", "deepseek", "qwen", "kimi", "sarvam", "huggingface", "groq", "cerebras", "mistral", "nvidia", "cloudflare", "sambanova"].find((provider) => getApiKey(provider, keys)) || "google";
        setSelectedModel(fallback);
      } else setSelectedModel(conversation.model as ModelOption);
      setMode("chat");
      setActiveSection("chat");
    }
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>, files: File[]) => {
    event.preventDefault();
    const text = input.trim();
    if (!text && files.length === 0) return;
    const fileParts = await Promise.all(files.map(fileToUIPart));
    setInput("");
    await sendMessage({ text, files: fileParts });
  };
  const handleCreateAgentTask = (goal: string, attachments: AgentAttachment[]) => {
    const task = planAgentTask(createAgentTask(goal, undefined, undefined, attachments));
    setActiveAgentTask(task);
    safeTaskSnapshot.current = null;
    setAgentExecution(null);
    setExecutionEvents([
      createExecutionEvent(task.id, "task-created", "Task created"),
      createExecutionEvent(task.id, "plan-created", `Plan created with ${task.steps.length} steps`),
    ]);
  };
  const ensureInstantChatModel = () => {
    if (selectedModel !== "jules") return;
    const fallback = ["google", "openrouter", "openai", "anthropic", "deepseek", "qwen", "kimi", "sarvam", "huggingface", "groq", "cerebras", "mistral", "nvidia", "cloudflare", "sambanova"].find((provider) => getApiKey(provider, keys)) || "google";
    setSelectedModel(fallback);
  };
  const handleNewChat = () => {
    ensureInstantChatModel();
    setActiveSection("chat");
    setMode("chat");
    startNewConversation();
  };

  const handleSidebarNavigate = (section: WorkspaceSection) => {
    setActiveSection(section);
    if (section === "home") {
      ensureInstantChatModel();
      setMode("chat");
      startNewConversation();
    } else if (section === "chat") {
      ensureInstantChatModel();
      setMode("chat");
    } else if (section === "agent") {
      setMode("agent");
    }
  };
  const handleStartWorkspaceAgent = (goal: string, attachments: AgentAttachment[] = []) => {
    ensureInstantChatModel();
    setActiveSection("agent");
    setMode("agent");
    handleCreateAgentTask(goal, attachments);
    setIsSidebarOpen(false);
  };
  const handleOpenWorkspaceChat = (prompt: string) => {
    ensureInstantChatModel();
    setActiveSection("chat");
    setMode("chat");
    startNewConversation();
    setInput(prompt);
    setIsSidebarOpen(false);
  };
  const handleSelectPinnedAgent = (agent: "General Assistant" | "Data & Report Agent" | "Study & Research Agent") => {
    if (agent === "Data & Report Agent") {
      setActiveSection("documents");
      setIsSidebarOpen(false);
      return;
    }
    ensureInstantChatModel();
    setActiveSection("chat");
    setMode("chat");
    startNewConversation();
    setInput(agent === "Study & Research Agent" ? "Help me study and research a topic. Ask me what topic I want to explore, then organize the work into a clear study plan." : "");
    setIsSidebarOpen(false);
  };
  const handleRunAgentTask = async (startingTask?: AgentTask) => {
    const taskToRun = startingTask || activeAgentTask;
    if (!taskToRun) return;
    let currentTask = taskToRun;
    if (!safeTaskSnapshot.current || safeTaskSnapshot.current.id !== currentTask.id) safeTaskSnapshot.current = structuredClone(currentTask);
    while (true) {
      const step = currentTask.steps.find((candidate) => candidate.status === "pending" && (candidate.toolId || candidate.requiresApproval));
      if (!step) break;
      if (step.requiresApproval) {
        const awaitingTask = updateStepStatus(transitionTask(currentTask, "awaiting_approval"), step.id, "awaiting_approval");
        setActiveAgentTask(awaitingTask);
        setAgentExecution({ message: `Approval required before: ${step.title}`, ok: true });
        setExecutionEvents((events) => [...events, createExecutionEvent(currentTask.id, "approval-requested", `Approval required before ${step.title}`, step.id, step.toolId)]);
        break;
      }
      if (!step.toolId) {
        currentTask = updateStepStatus(currentTask, step.id, "completed");
        setActiveAgentTask(currentTask);
        setExecutionEvents((events) => [...events, createExecutionEvent(currentTask.id, "tool-completed", `Completed ${step.title}`, step.id)]);
        continue;
      }
      setExecutionEvents((events) => [...events, createExecutionEvent(currentTask.id, "tool-started", `Started ${step.title}`, step.id, step.toolId)]);
      const outcome = await executeFirstToolStep(currentTask);
      currentTask = outcome.task;
      setActiveAgentTask(outcome.task);
      setAgentExecution({ message: outcome.message, output: outcome.output, table: outcome.table, sheetTables: outcome.sheetTables, error: outcome.error, ok: outcome.ok });
      if (outcome.ok) safeTaskSnapshot.current = structuredClone(outcome.task);
      const hasNextTool = outcome.task.steps.some((candidate) => candidate.status === "pending" && candidate.toolId);
      setExecutionEvents((events) => {
        const nextEvents = [...events, createExecutionEvent(currentTask.id, outcome.ok ? "tool-completed" : "tool-failed", outcome.message, step.id, step.toolId)];
        if (outcome.ok && !hasNextTool) nextEvents.push(createExecutionEvent(currentTask.id, "task-completed", "Task completed"));
        if (!outcome.ok) nextEvents.push(createExecutionEvent(currentTask.id, "task-failed", "Task failed"));
        return nextEvents;
      });
      if (!outcome.ok || !hasNextTool) break;
    }
  };
  const handleApproveAgentStep = () => {
    if (!activeAgentTask || activeAgentTask.status !== "awaiting_approval") return;
    const approvalStep = activeAgentTask.steps.find((step) => step.status === "awaiting_approval");
    if (!approvalStep) return;
    const pendingTask = updateStepStatus(transitionTask(activeAgentTask, "running"), approvalStep.id, "pending");
    const task = { ...pendingTask, steps: pendingTask.steps.map((step) => step.id === approvalStep.id ? { ...step, requiresApproval: false } : step) };
    setActiveAgentTask(task);
    setAgentExecution({ message: "Approval granted. Continuing the task automatically.", ok: true });
    setExecutionEvents((events) => [...events, createExecutionEvent(task.id, "approval-granted", `Approved ${approvalStep.title}`, approvalStep.id, approvalStep.toolId)]);
    void handleRunAgentTask(task);
  };
  const handleRejectAgentStep = () => {
    if (!activeAgentTask || activeAgentTask.status !== "awaiting_approval") return;
    const approvalStep = activeAgentTask.steps.find((step) => step.status === "awaiting_approval");
    if (!approvalStep) return;
    const task = transitionTask(updateStepStatus(activeAgentTask, approvalStep.id, "skipped"), "cancelled");
    setActiveAgentTask(task);
    setAgentExecution({ message: "Approval rejected. Task cancelled without executing the protected step.", ok: false });
    setExecutionEvents((events) => [...events, createExecutionEvent(task.id, "approval-rejected", `Rejected ${approvalStep.title}`, approvalStep.id, approvalStep.toolId), createExecutionEvent(task.id, "task-cancelled", "Task cancelled after approval rejection")]);
  };
  const handleRollbackAgentTask = () => {
    if (!activeAgentTask || activeAgentTask.status !== "failed" || !safeTaskSnapshot.current) return;
    const restoredTask = { ...structuredClone(safeTaskSnapshot.current), updatedAt: new Date().toISOString() };
    setActiveAgentTask(restoredTask);
    setAgentExecution({ message: "Task rolled back to the last safe snapshot.", ok: true });
    setExecutionEvents((events) => [...events, createExecutionEvent(restoredTask.id, "task-rolled-back", "Task rolled back to the last safe snapshot")]);
  };
  const handlePauseAgentTask = () => {
    if (!activeAgentTask || activeAgentTask.status !== "running") return;
    const task = transitionTask(activeAgentTask, "paused");
    setActiveAgentTask(task);
    setAgentExecution({ message: "Task paused. Resume when you are ready to continue.", ok: true });
    setExecutionEvents((events) => [...events, createExecutionEvent(task.id, "task-paused", "Task paused")]);
  };
  const handleResumeAgentTask = () => {
    if (!activeAgentTask || activeAgentTask.status !== "paused") return;
    const task = transitionTask(activeAgentTask, "running");
    setActiveAgentTask(task);
    setAgentExecution({ message: "Task resumed. Run the next pending step to continue.", ok: true });
    setExecutionEvents((events) => [...events, createExecutionEvent(task.id, "task-resumed", "Task resumed")]);
  };
  const handleRetryAgentTask = () => {
    if (!activeAgentTask || activeAgentTask.status !== "failed") return;
    const failedStep = activeAgentTask.steps.find((step) => step.status === "failed");
    if (!failedStep) return;
    const task = transitionTask(updateStepStatus(activeAgentTask, failedStep.id, "pending"), "planning");
    setActiveAgentTask(task);
    setAgentExecution({ message: `Retrying: ${failedStep.title}`, ok: true });
    setExecutionEvents((events) => [...events, createExecutionEvent(task.id, "task-retried", `Retrying ${failedStep.title}`, failedStep.id, failedStep.toolId)]);
  };
  const handleCancelAgentTask = () => {
    if (!activeAgentTask || ["completed", "cancelled"].includes(activeAgentTask.status)) return;
    const task = transitionTask(activeAgentTask, "cancelled");
    setActiveAgentTask(task);
    setAgentExecution({ message: "Task cancelled.", ok: false });
    setExecutionEvents((events) => [...events, createExecutionEvent(task.id, "task-cancelled", "Task cancelled")]);
  };
  const handleClearAgentTask = () => {
    if (activeAgentTask) removeAgentTask(activeAgentTask.id);
    setActiveAgentTask(null);
    setAgentExecution(null);
    setExecutionEvents([]);
  };

  useEffect(() => {
    if (!tasksReady || restoredTask.current) return;
    restoredTask.current = true;
    const latest = records[0];
    if (latest) {
      // Restoring the persisted external snapshot is the purpose of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAgentTask(latest.task);
      setExecutionEvents(latest.events);
    }
  }, [records, tasksReady]);

  useEffect(() => {
    if (!tasksReady || !activeAgentTask) return;
    saveAgentTask({ task: activeAgentTask, events: executionEvents, savedAt: new Date().toISOString() });
  }, [activeAgentTask, executionEvents, saveAgentTask, tasksReady]);

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-brand-blue">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeSection={activeSection}
        onNavigate={handleSidebarNavigate}
        onSelectPinnedAgent={handleSelectPinnedAgent}
        onOpenSettings={() => { setSettingsTab("general"); setIsSettingsOpen(true); }}
        collapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        selectedModel={selectedModel}
        onSelectModel={(model) => {
          setSelectedModel(model);
          if (model === "jules") { setMode("agent"); setActiveSection("agent"); }
          else if (selectedModel === "jules") { setMode("chat"); setActiveSection("chat"); }
        }}
        onNewChat={handleNewChat}
        onLoadConversation={handleLoadConversation}
        currentConversationId={currentConversationId}
        onOpenAbout={() => { setIsSettingsOpen(false); setIsAboutOpen(true); }}
      />
      {activeSection === "history" ? (
        <HistoryWorkspace onLoadConversation={handleLoadConversation} onOpenSidebar={() => setIsSidebarOpen(true)} />
      ) : activeSection === "projects" || activeSection === "workflows" || activeSection === "knowledge" || activeSection === "plugins" || activeSection === "documents" ? (
        <WorkspaceHub
          section={activeSection}
          onStartAgent={handleStartWorkspaceAgent}
          onOpenChat={handleOpenWorkspaceChat}
          onOpenSettings={() => { setSettingsTab("providers"); setIsSettingsOpen(true); }}
          onOpenSection={(section) => setActiveSection(section)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      ) : activeSection === "agent" && selectedModel === "jules" ? (
        <JulesWorkspace apiKey={keys.jules || ""} onOpenSettings={() => { setSettingsTab("keys"); setIsSettingsOpen(true); }} onOpenSidebar={() => setIsSidebarOpen(true)} />
      ) : (
        <ChatArea
          mode={mode}
          onModeChange={(nextMode) => {
            if (nextMode === "chat") ensureInstantChatModel();
            setMode(nextMode);
            setActiveSection(nextMode);
          }}
          activeAgentTask={activeAgentTask}
          agentExecution={agentExecution}
          executionEvents={executionEvents}
          onCreateAgentTask={handleCreateAgentTask}
          onRunAgentTask={handleRunAgentTask}
          onApproveAgentStep={handleApproveAgentStep}
          onRejectAgentStep={handleRejectAgentStep}
          onRollbackAgentTask={handleRollbackAgentTask}
          onPauseAgentTask={handlePauseAgentTask}
          onResumeAgentTask={handleResumeAgentTask}
          onRetryAgentTask={handleRetryAgentTask}
          onCancelAgentTask={handleCancelAgentTask}
          onClearAgentTask={handleClearAgentTask}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          selectedModel={selectedModel}
          messages={displayMessages}
          input={input}
          onInputChange={(event) => setInput(event.target.value)}
          onSend={handleSend}
          isLoading={isLoading}
          stop={stop}
          error={error}
          onRetry={regenerate}
          conversationTitle={conversationTitle}
          onPrompt={setInput}
        />
      )}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} initialTab={settingsTab} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}

function getMessageText(message: { parts?: Array<{ type?: string; text?: string; filename?: string }>; content?: unknown }): string {
  const text = message.parts?.filter((part) => part.type === "text").map((part) => part.text || "").join("\n") || (typeof message.content === "string" ? message.content : "");
  const files = message.parts?.filter((part) => part.type === "file").map((part) => part.filename || "Attached file") || [];
  return files.length > 0 ? `${text}${text ? "\n\n" : ""}Attachments: ${files.join(", ")}` : text;
}

function createExecutionEvent(taskId: string, type: ExecutionEvent["type"], message: string, stepId?: string, toolId?: string): ExecutionEvent {
  return { id: crypto.randomUUID(), taskId, type, message, stepId, toolId, timestamp: new Date().toISOString() };
}
