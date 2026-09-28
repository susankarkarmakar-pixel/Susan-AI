"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssistantProfile } from "@/lib/app-settings";
import type { WorkspaceProject } from "@/lib/workspace-storage";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_FILES = 3;
const MAX_TOTAL_FILE_SIZE = 12 * 1024 * 1024;
const ACCEPTED_FILES = "image/*,.pdf,.txt,.md,.csv,.json";
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"]);

interface MessageInputProps {
  input: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>, files: File[]) => void;
  isLoading: boolean;
  stop: () => void;
  canAttachFiles: boolean;
  attachmentSupportMessage?: string;
  modelName: string;
  assistantProfile: AssistantProfile;
  onAssistantProfileChange: (profile: AssistantProfile) => void;
  projects: WorkspaceProject[];
  selectedProjectId: string;
  onSelectedProjectChange: (id: string) => void;
  isEditingMessage: boolean;
  onCancelEdit: () => void;
  estimatedTokens: string;
}

export function MessageInput({ input, onInputChange, onSubmit, isLoading, stop, canAttachFiles, attachmentSupportMessage, modelName, assistantProfile, onAssistantProfileChange, projects, selectedProjectId, onSelectedProjectChange, isEditingMessage, onCancelEdit, estimatedTokens }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [input]);

  const addFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    if (!canAttachFiles) {
      setFileError(attachmentSupportMessage || "Attachments are not supported by this provider.");
      return;
    }
    const nextFiles = [...files];
    let error: string | null = null;
    for (const file of Array.from(selectedFiles)) {
      if (nextFiles.length >= MAX_FILES) {
        error = `You can attach up to ${MAX_FILES} files.`;
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        error = `${file.name} is larger than 4 MB.`;
        continue;
      }
      if (!isAcceptedFile(file)) {
        error = `${file.name} has an unsupported file type.`;
        continue;
      }
      const totalSize = nextFiles.reduce((sum, existing) => sum + existing.size, 0) + file.size;
      if (totalSize > MAX_TOTAL_FILE_SIZE) {
        error = "Attachments must be 12 MB or smaller in total.";
        break;
      }
      if (!nextFiles.some((existing) => existing.name === file.name && existing.size === file.size)) nextFiles.push(file);
    }
    setFiles(nextFiles);
    setFileError(error);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if ((input.trim() || files.length > 0) && !isLoading) formRef.current?.requestSubmit();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    onSubmit(event, files);
    setFiles([]);
    setFileError(null);
  };

  const removeFile = (index: number) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  const isEmpty = input.trim().length === 0 && files.length === 0;

  return (
    <div className="relative z-10 w-full bg-bg-main px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-3 md:px-8">
      <form ref={formRef} onSubmit={handleSubmit} onDragOver={(event) => { if (canAttachFiles) event.preventDefault(); }} onDrop={(event) => { if (!canAttachFiles) return; event.preventDefault(); addFiles(event.dataTransfer.files); }} className="mx-auto max-w-5xl rounded-3xl border border-border-main/60 bg-surface p-3 shadow-sm transition-all focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/5">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-2" aria-label="Selected attachments">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.size}`} className="flex max-w-full items-center gap-1.5 rounded-lg bg-black/5 px-2 py-1 text-xs text-text-main">
                <span className="max-w-[180px] truncate">{file.name}</span>
                <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`} className="rounded p-0.5 text-text-muted hover:bg-black/10 hover:text-text-main">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <span className="self-center text-[10px] text-text-muted">{(totalFileSize / (1024 * 1024)).toFixed(1)} / 12 MB</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILES} disabled={!canAttachFiles} className="sr-only" onChange={(event) => addFiles(event.target.files)} />
          <button type="button" disabled={!canAttachFiles} onClick={() => fileInputRef.current?.click()} aria-label={canAttachFiles ? "Attach files" : "Attachments unavailable for this provider"} title={canAttachFiles ? "Attach files" : "Attachments unavailable for this provider"} className={cn("mb-1 flex shrink-0 items-center justify-center rounded-xl p-2.5 transition-colors", canAttachFiles ? "text-text-muted hover:bg-black/5 hover:text-text-main" : "cursor-not-allowed text-text-muted/40")}>
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea id="message-composer" ref={textareaRef} value={input} onChange={onInputChange} onKeyDown={handleKeyDown} aria-label="Message Susan AI" aria-keyshortcuts="Enter Shift+Enter" placeholder={isEditingMessage ? "Edit your message…" : "How can I help you today?"} className="min-h-[48px] min-w-0 flex-1 resize-none overflow-y-auto break-words bg-transparent px-2 py-3 font-sans text-text-main outline-none placeholder:text-text-muted/60 sm:px-3" rows={1} />
          <div className="mb-1 hidden items-center gap-2 rounded-full bg-cream-highlight/70 px-3 py-2 text-xs font-medium text-text-main sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="max-w-[120px] truncate">{modelName}</span>
          </div>
          {isLoading ? (
            <button type="button" onClick={stop} aria-label="Stop generating response" className="mb-1 flex shrink-0 items-center justify-center rounded-xl bg-text-main p-2.5 text-surface transition-colors hover:opacity-80">
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button type="submit" disabled={isEmpty} aria-label="Send message" className={cn("mb-1 flex shrink-0 items-center justify-center rounded-xl p-2.5 transition-colors", isEmpty ? "cursor-not-allowed bg-black/5 text-text-muted/40" : "bg-accent text-white shadow-sm hover:opacity-90")}>
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-2 px-2">
        <label className="sr-only" htmlFor="assistant-profile">Assistant profile</label>
        <select id="assistant-profile" value={assistantProfile} onChange={(event) => onAssistantProfileChange(event.target.value as AssistantProfile)} className="min-h-8 rounded-lg border border-border-main/70 bg-surface px-2 py-1 text-xs text-text-main focus-visible:outline-2 focus-visible:outline-accent"><option value="general">General</option><option value="coding">Coding</option><option value="research">Research</option></select>
        {projects.length > 0 && <><label className="sr-only" htmlFor="chat-project">Project instructions</label><select id="chat-project" value={selectedProjectId} onChange={(event) => onSelectedProjectChange(event.target.value)} className="min-h-8 max-w-48 rounded-lg border border-border-main/70 bg-surface px-2 py-1 text-xs text-text-main focus-visible:outline-2 focus-visible:outline-accent"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></>}
        {isEditingMessage && <button type="button" onClick={onCancelEdit} className="rounded-md px-2 py-1 text-xs font-medium text-text-muted underline underline-offset-2">Cancel edit</button>}
        <span className="ml-auto text-[10px] text-text-muted" title="Approximate text-only token count; provider counts and attachment tokens may differ">This chat {estimatedTokens} text tokens (estimate)</span>
      </div>
      {fileError && <p role="alert" aria-live="polite" className="mx-auto mt-2 max-w-3xl text-center text-xs text-red-600">{fileError}</p>}
      <div className="mx-auto mt-2 max-w-5xl text-center text-[11px] text-text-muted">Enter to send · Shift+Enter for a new line · Ctrl/Cmd+K new chat · / commands <span className="mx-1">·</span>{canAttachFiles ? "Attach images, PDFs, text, CSV, or JSON files." : (attachmentSupportMessage || "Attachments are unavailable for this provider.")} <span className="mx-1">·</span> AI can make mistakes. Please double-check important information.</div>
    </div>
  );
}

function isAcceptedFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
  return /\.(pdf|txt|md|csv|json)$/i.test(file.name);
}
