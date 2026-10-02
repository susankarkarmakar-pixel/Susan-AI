"use client";

import { AlertTriangle, Check, ClipboardList, Code2, Paperclip, Pause, Play, Plus, Rocket, RotateCcw, ShieldCheck, Undo2, X } from "lucide-react";
import { useRef, useState } from "react";
import { AgentAttachment, AgentTask } from "@/lib/agent/types";
import { CsvTableSummary, SheetTableSummary } from "@/lib/agent/tools/file-analysis";
import { DataPreviewTable } from "@/components/agent/data-preview-table";

interface AgentTaskComposerProps {
  activeTask: AgentTask | null;
  execution: { message: string; output?: string; table?: CsvTableSummary; sheetTables?: SheetTableSummary[]; error?: { code: string; recoveryHint: string; retryable: boolean }; ok: boolean } | null;
  onCreateTask: (goal: string, attachments: AgentAttachment[]) => AgentTask | void | Promise<AgentTask | void>;
  onRunTask: () => void | Promise<void>;
  onRollbackTask: () => void;
  onPauseTask: () => void;
  onResumeTask: () => void;
  onRetryTask: () => void;
  onCancelTask: () => void;
  onClearTask: () => void;
}

const MAX_GOAL_LENGTH = 2_000;
const MAX_FILES = 3;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const QUICK_ACTIONS = [
  { label: "Analyze file", prompt: "Analyze the attached file and summarize its key findings." },
  { label: "Create chart", prompt: "Analyze the attached data and recommend useful charts for its most important trends." },
  { label: "Generate report", prompt: "Analyze the attached data and prepare a concise report with key findings and limitations." },
  { label: "Write document", prompt: "Help me draft a document. Use the attached files and my instructions as the source material." },
  { label: "More tools", prompt: "I want to use a supported Agent tool. Help me with a safe calculation or analysis of an attached file." },
];

export function AgentTaskComposer({ activeTask, execution, onCreateTask, onRunTask, onRollbackTask, onPauseTask, onResumeTask, onRetryTask, onCancelTask, onClearTask }: AgentTaskComposerProps) {
  const [goal, setGoal] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanGoal = goal.trim();
    if (!cleanGoal) return setError("Describe what you want the Agent to do first.");
    if (cleanGoal.length > MAX_GOAL_LENGTH) return setError(`Keep the task description under ${MAX_GOAL_LENGTH.toLocaleString()} characters.`);
    try {
      const attachments = await Promise.all(files.map(toAgentAttachment));
      setError(null);
      await onCreateTask(cleanGoal, attachments);
      setGoal("");
      setFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read the selected file.");
    }
  };

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...files];
    for (const file of Array.from(selected)) {
      if (next.length >= MAX_FILES) { setError(`You can attach up to ${MAX_FILES} files.`); break; }
      if (file.size > MAX_FILE_SIZE) { setError(`${file.name} is larger than 4 MB.`); continue; }
      if (!ACCEPTED_TYPES.has(file.type) && !/\.(txt|md|csv|json|pdf|docx|xlsx)$/i.test(file.name)) { setError(`${file.name} is not supported. Use TXT, Markdown, CSV, JSON, PDF, DOCX, or XLSX.`); continue; }
      if (!next.some((existing) => existing.name === file.name && existing.size === file.size)) next.push(file);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section aria-label="Agent task workspace" className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-3 pt-5 md:px-8">
      <div className="rounded-2xl border border-accent/20 bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent"><ClipboardList className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><h1 className="text-base font-semibold text-text-main">What should Susan AI do?</h1><p className="mt-1 text-sm text-text-muted">Start with a clear goal. Susan AI will create a safe first plan before execution.</p></div>
          {activeTask && <button type="button" onClick={onClearTask} aria-label="Clear active task" className="rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main"><X className="h-4 w-4" /></button>}
        </div>
        <AgentCapabilityDisclosure />
        {activeTask ? (
          <div className="rounded-xl border border-border-main/70 bg-bg-main px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent"><span className="h-2 w-2 rounded-full bg-accent" />Active task</div>
            <p className="mt-2 text-sm leading-6 text-text-main">{activeTask.goal}</p>
            {activeTask.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{activeTask.attachments.map((file) => <span key={file.id} className="flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-xs text-text-main"><Paperclip className="h-3 w-3 text-accent" />{file.filename}</span>)}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted"><span className="rounded-full bg-cream-highlight px-2.5 py-1 font-medium text-accent">Status: {formatStatus(activeTask.status)}</span><span>Task ID: {activeTask.id.slice(0, 8)}</span></div>
            {execution && <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${execution.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}><p className="font-semibold">{execution.message}</p>{execution.error && <div className="mt-2 flex gap-2 rounded-md bg-red-100/70 p-2 text-red-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div><p className="font-semibold">{execution.error.code}</p><p>{execution.error.recoveryHint}</p></div></div>}{execution.output && <code className="mt-1 block whitespace-pre-wrap font-mono">{execution.output}</code>}{execution.table && <DataPreviewTable table={execution.table} sheetTables={execution.sheetTables} />}</div>}
            <div className="mt-4 flex flex-wrap gap-2">
              {activeTask.steps.some((step) => step.status === "pending") && activeTask.status !== "paused" && <button type="button" onClick={() => void onRunTask()} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"><Rocket className="h-4 w-4" />Run next step</button>}
              {activeTask.status === "paused" && <button type="button" onClick={onResumeTask} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"><Play className="h-4 w-4" />Resume</button>}
              {activeTask.status === "running" && <button type="button" onClick={onPauseTask} className="flex items-center gap-2 rounded-xl border border-border-main/70 px-4 py-2.5 text-sm font-semibold text-text-main hover:bg-black/5"><Pause className="h-4 w-4" />Pause</button>}
              {activeTask.status === "failed" && <button type="button" onClick={onRetryTask} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"><RotateCcw className="h-4 w-4" />Retry failed step</button>}
              {activeTask.status === "failed" && execution?.error && <button type="button" onClick={onRollbackTask} className="flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50"><Undo2 className="h-4 w-4" />Rollback safe state</button>}
              {!['completed', 'cancelled'].includes(activeTask.status) && <button type="button" onClick={onCancelTask} className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"><X className="h-4 w-4" />Cancel</button>}
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
            <textarea value={goal} onChange={(event) => { setGoal(event.target.value); if (error) setError(null); }} placeholder="Example: Analyze the attached CSV or PDF and prepare a concise summary." aria-label="Agent task goal" maxLength={MAX_GOAL_LENGTH} rows={3} className="w-full resize-none rounded-xl border border-border-main/70 bg-bg-main px-4 py-3 text-sm leading-6 text-text-main outline-none placeholder:text-text-muted/60 focus:border-accent/50 focus:ring-4 focus:ring-accent/10" />
            {files.length > 0 && <div className="flex flex-wrap gap-2">{files.map((file, index) => <span key={`${file.name}-${file.size}`} className="flex items-center gap-1.5 rounded-lg bg-cream-highlight px-2.5 py-1.5 text-xs text-text-main"><Paperclip className="h-3 w-3 text-accent" /><span className="max-w-[180px] truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`} className="text-text-muted hover:text-text-main"><X className="h-3 w-3" /></button></span>)}</div>}
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => handleFiles(event.target.files)} /><button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach files" className="flex items-center gap-1.5 rounded-lg border border-border-main/70 px-2.5 py-2 text-xs font-medium text-text-muted hover:bg-black/5 hover:text-text-main"><Paperclip className="h-3.5 w-3.5" />Attach</button><span className="hidden text-xs text-text-muted sm:inline">TXT, MD, CSV, JSON, PDF, DOCX, XLSX · max 4 MB each</span></div><button type="submit" disabled={!goal.trim()} className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"><Rocket className="h-4 w-4" />Create task</button></div>
            {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
          </form>
        )}
        {!activeTask && <div className="mt-3 flex flex-wrap gap-2 border-t border-border-main/50 pt-3">{QUICK_ACTIONS.map((action) => <QuickAction key={action.label} label={action.label} onClick={() => { setGoal(action.prompt); setError(null); }} />)}</div>}
      </div>
      {!activeTask && <div className="flex items-center gap-2 px-1 text-xs text-text-muted"><Plus className="h-3.5 w-3.5 text-accent" />Try a specific goal; the Agent will turn it into a safe first plan.</div>}
    </section>
  );
}

function AgentCapabilityDisclosure() {
  return <details className="mb-4 rounded-xl border border-border-main/70 bg-bg-main/70 group">
    <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 text-xs font-semibold text-text-main [&::-webkit-details-marker]:hidden">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cream-highlight text-accent"><ShieldCheck className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1"><span className="block">Susan Safe Agent</span><span className="mt-0.5 block truncate text-[10px] font-normal text-text-muted">Local tools for planning, calculation and file analysis</span></span>
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800 group-open:hidden">View capabilities</span>
      <span className="hidden rounded-full bg-cream-highlight px-2 py-1 text-[10px] font-semibold text-accent group-open:inline">Hide</span>
    </summary>
    <div className="border-t border-border-main/60 px-3 pb-3 pt-2.5">
      <div className="flex flex-wrap gap-1.5" aria-label="Available Agent capabilities">
        {["Safe task planning", "Calculator", "CSV / JSON", "PDF / DOCX / XLSX"].map((capability) => <span key={capability} className="inline-flex items-center gap-1 rounded-full border border-border-main/70 bg-surface px-2 py-1 text-[10px] font-medium text-text-muted"><Check className="h-3 w-3 text-emerald-600" />{capability}</span>)}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-text-muted">Chat models such as Gemini, OpenAI, Claude and DeepSeek power Chat Mode. They are not presented as Agent engines here unless their Agent integration is explicitly enabled.</p>
      <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] leading-5 text-blue-900"><Code2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong>Need a coding agent?</strong> Google Jules is available separately for repository and coding tasks.</span></div>
    </div>
  </details>;
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-lg border border-border-main/70 bg-bg-main px-3 py-1.5 text-[10px] font-semibold text-text-muted hover:bg-cream-highlight hover:text-accent">{label}</button>; }

async function toAgentAttachment(file: File): Promise<AgentAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`)); reader.readAsDataURL(file); });
  return { id: crypto.randomUUID(), filename: file.name, mediaType: file.type || inferMediaType(file.name), sizeBytes: file.size, dataUrl };
}

function inferMediaType(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === "json") return "application/json";
  if (extension === "csv") return "text/csv";
  if (extension === "md") return "text/markdown";
  return "text/plain";
}

function formatStatus(status: AgentTask["status"]): string { return status.replaceAll("_", " "); }
