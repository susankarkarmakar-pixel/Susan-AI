"use client";
/* eslint-disable @next/next/no-img-element -- previews use short-lived local object URLs. */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, FileText, Image as ImageIcon, Mic, Paperclip, Square, Upload, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiEffort } from "@/lib/app-settings";
import type { WorkspaceProject } from "@/lib/workspace-storage";
import type { ModelOption } from "@/components/sidebar/model-selector";
import { ModelControlPanel } from "./model-control-panel";
import { extractAttachmentText, type AttachmentExtractionResult, type OcrLanguage } from "@/lib/attachment-extraction";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_FILES = 3;
const MAX_TOTAL_FILE_SIZE = 12 * 1024 * 1024;
const ACCEPTED_FILES = "image/*,.pdf,.txt,.md,.csv,.json";
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"]);
const OCR_LANGUAGE_OPTIONS: Array<{ value: OcrLanguage; label: string }> = [{ value: "eng", label: "English" }, { value: "ben", label: "বাংলা" }, { value: "hin", label: "हिन्दी" }, { value: "eng+ben", label: "English + বাংলা" }, { value: "eng+hin", label: "English + हिन्दी" }];

interface MessageInputProps {
  input: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>, files: File[], extractedText?: string) => void;
  isLoading: boolean;
  stop: () => void;
  canAttachFiles: boolean;
  attachmentSupportMessage?: string;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  projects: WorkspaceProject[];
  selectedProjectId: string;
  onSelectedProjectChange: (id: string) => void;
  isEditingMessage: boolean;
  onCancelEdit: () => void;
  estimatedTokens: string;
  effort: AiEffort;
  onEffortChange: (effort: AiEffort) => void;
  voiceMode: boolean;
  onVoiceModeChange: (enabled: boolean) => void;
}

export function MessageInput({ input, onInputChange, onSubmit, isLoading, stop, canAttachFiles, attachmentSupportMessage, selectedModel, onSelectModel, projects, selectedProjectId, onSelectedProjectChange, isEditingMessage, onCancelEdit, estimatedTokens, effort, onEffortChange, voiceMode, onVoiceModeChange }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [extractions, setExtractions] = useState<Record<string, AttachmentExtractionState>>({});
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>("eng");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentFilter, setAttachmentFilter] = useState<"all" | "images" | "documents" | "data">("all");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [dictating, setDictating] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null; onerror: (() => void) | null } | null>(null);
  const dragDepthRef = useRef(0);
  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
  const attachmentAccept = attachmentFilter === "images" ? "image/*" : attachmentFilter === "documents" ? ".pdf,.txt,.md" : attachmentFilter === "data" ? ".txt,.md,.csv,.json" : ACCEPTED_FILES;
  const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

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
    const notices: string[] = [];
    const acceptedFiles: File[] = [];
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
      if (nextFiles.some((existing) => existing.name === file.name && existing.size === file.size)) notices.push(`${file.name} is already attached.`);
      else { nextFiles.push(file); acceptedFiles.push(file); }
    }
    setFiles(nextFiles);
    setFileError(error);
    setFileNotice(notices.length > 0 ? notices.join(" ") : acceptedFiles.length > 1 ? `${acceptedFiles.length} files added. Extraction is running for each attachment.` : null);
    acceptedFiles.forEach((file) => { void queueExtraction(file, ocrLanguage); });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const queueExtraction = async (file: File, language: OcrLanguage = ocrLanguage) => {
    const key = fileKey(file);
    setExtractions((current) => ({ ...current, [key]: { status: "reading", source: "none", text: "", characterCount: 0, language, progress: 0 } }));
    const result = await extractAttachmentText(file, (progress) => setExtractions((current) => ({ ...current, [key]: { ...(current[key] || { status: "reading", source: "none", text: "", characterCount: 0 }), status: file.type.startsWith("image/") ? "ocr" : "reading", language, progress } })), language);
    setExtractions((current) => ({ ...current, [key]: { ...result, progress: 100 } }));
  };

  const toggleDictation = () => {
    if (dictating) { recognitionRef.current?.stop(); setDictating(false); return; }
    const Recognition = (window as WindowWithSpeech).SpeechRecognition || (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!Recognition) { setFileError("Dictation is not supported in this browser. Try Chrome or Edge."); return; }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).slice(event.resultIndex).map((result) => result[0]?.transcript || "").join("");
      if (transcript) onInputChange({ target: { value: `${input}${input && !input.endsWith(" ") ? " " : ""}${transcript}` } } as React.ChangeEvent<HTMLTextAreaElement>);
    };
    recognition.onend = () => { setDictating(false); recognitionRef.current = null; };
    recognition.onerror = () => { setDictating(false); recognitionRef.current = null; setFileError("Microphone dictation stopped. Check browser microphone permission and try again."); };
    recognitionRef.current = recognition;
    setFileError(null);
    setDictating(true);
    recognition.start();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if ((input.trim() || files.length > 0) && !isLoading) formRef.current?.requestSubmit();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const extractedText = files.map((file) => extractions[fileKey(file)]?.text || "").filter(Boolean).join("\n\n");
    onSubmit(event, files, extractedText || undefined);
    setFiles([]);
    setExtractions({});
    setFileError(null);
    setFileNotice(null);
  };

  const chooseAttachmentType = (filter: typeof attachmentFilter) => {
    if (!canAttachFiles) {
      setFileError(attachmentSupportMessage || "Attachments are not supported for this provider.");
      setFileNotice(null);
      return;
    }
    setAttachmentFilter(filter);
    setAttachmentMenuOpen(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const removeFile = (index: number) => { const file = files[index]; setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); if (file) setExtractions((current) => { const next = { ...current }; delete next[fileKey(file)]; return next; }); setFileNotice(null); };
  const replaceFile = (index: number) => {
    const file = files[index];
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    if (file) setExtractions((current) => { const next = { ...current }; delete next[fileKey(file)]; return next; });
    setFileNotice("Choose a replacement file.");
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };
  const handleDragEnter = (event: React.DragEvent<HTMLFormElement>) => {
    if (!canAttachFiles || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };
  const handleDragLeave = (event: React.DragEvent<HTMLFormElement>) => {
    if (!canAttachFiles) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  };
  const handleDrop = (event: React.DragEvent<HTMLFormElement>) => {
    if (!canAttachFiles) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    addFiles(event.dataTransfer.files);
  };
  const isEmpty = input.trim().length === 0 && files.length === 0;

  return (
    <div className="relative z-10 w-full bg-bg-main px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-3 md:px-8">
      <form ref={formRef} onSubmit={handleSubmit} onDragEnter={handleDragEnter} onDragOver={(event) => { if (canAttachFiles && event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDragLeave={handleDragLeave} onDrop={handleDrop} className={cn("relative mx-auto max-w-5xl rounded-3xl border bg-surface p-3 shadow-sm transition-all focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/5", isDraggingFiles ? "border-accent bg-cream-highlight/30 ring-4 ring-accent/10" : "border-border-main/60")}>
        {isDraggingFiles && <div className="pointer-events-none absolute inset-1 z-20 flex items-center justify-center rounded-[1.35rem] border-2 border-dashed border-accent bg-surface/90 backdrop-blur-sm"><div className="text-center"><Upload className="mx-auto mb-1 h-6 w-6 text-accent" /><p className="text-sm font-semibold text-text-main">Drop files to attach</p><p className="mt-0.5 text-[10px] text-text-muted">Up to {MAX_FILES} files · {formatFileSize(MAX_TOTAL_FILE_SIZE)} total</p></div></div>}
        {files.length > 0 && (
          <div className="grid gap-2 px-2 pb-2 sm:grid-cols-2" aria-label="Selected attachments">
            {files.map((file, index) => <AttachmentPreview key={`${file.name}-${file.size}`} file={file} extraction={extractions[fileKey(file)]} onRetry={() => { void queueExtraction(file); }} onRemove={() => removeFile(index)} onReplace={() => replaceFile(index)} />)}
            <div className="flex items-center justify-between px-1 text-[10px] text-text-muted sm:col-span-2"><span>{files.length} of {MAX_FILES} files attached</span><span>{formatFileSize(totalFileSize)} / 12 MB</span></div>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" multiple accept={attachmentAccept} disabled={!canAttachFiles} className="sr-only" onChange={(event) => addFiles(event.target.files)} />
          <div className="relative mb-1 shrink-0"><button type="button" onClick={() => setAttachmentMenuOpen((open) => !open)} aria-expanded={attachmentMenuOpen} aria-haspopup="menu" aria-label={canAttachFiles ? "Choose attachment type" : "Attachments unavailable for this provider"} title={canAttachFiles ? "Choose attachment type" : "Attachments unavailable for this provider"} className={cn("flex items-center justify-center rounded-xl p-2.5 transition-colors", canAttachFiles ? "text-text-muted hover:bg-black/5 hover:text-text-main" : "text-text-muted/40")}><Paperclip className="h-4 w-4" /></button>{attachmentMenuOpen && <div role="menu" aria-label="Attachment type" className="absolute bottom-[calc(100%+0.6rem)] left-0 z-40 w-64 overflow-hidden rounded-2xl border border-border-main/80 bg-surface p-2 shadow-2xl"><p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Add attachment</p><AttachmentOption icon={<Upload className="h-4 w-4" />} label="Batch upload (up to 3)" onClick={() => chooseAttachmentType("all")} disabled={!canAttachFiles} /><AttachmentOption icon={<ImageIcon className="h-4 w-4" />} label="Images" onClick={() => chooseAttachmentType("images")} disabled={!canAttachFiles} /><AttachmentOption icon={<FileText className="h-4 w-4" />} label="PDF or documents" onClick={() => chooseAttachmentType("documents")} disabled={!canAttachFiles} /><AttachmentOption icon={<FileText className="h-4 w-4" />} label="Text or data files" onClick={() => chooseAttachmentType("data")} disabled={!canAttachFiles} /><label className="mt-1 flex items-center justify-between gap-2 border-t border-border-main/50 px-2 pt-2 text-[10px] font-semibold text-text-muted" htmlFor="ocr-language">OCR language<select id="ocr-language" value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value as OcrLanguage)} className="rounded-md border border-border-main/70 bg-surface px-1.5 py-1 text-[10px] font-medium text-text-main">{OCR_LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{!canAttachFiles && <p className="px-2 pt-2 text-[10px] leading-4 text-red-700">{attachmentSupportMessage || "Attachments are unavailable for this model."}</p>}</div>}</div>
          <textarea id="message-composer" ref={textareaRef} value={input} onChange={onInputChange} onKeyDown={handleKeyDown} aria-label="Message Susan AI" aria-keyshortcuts="Enter Shift+Enter" placeholder={isEditingMessage ? "Edit your message…" : "How can I help you today?"} className="min-h-[48px] min-w-0 flex-1 resize-none overflow-y-auto break-words bg-transparent px-2 py-3 font-sans text-text-main outline-none placeholder:text-text-muted/60 sm:px-3" rows={1} />
          <ModelControlPanel selectedModel={selectedModel} onSelectModel={onSelectModel} effort={effort} onEffortChange={onEffortChange} compact />
          {isLoading ? (
            <button type="button" onClick={stop} aria-label="Stop generating response" className="mb-1 flex shrink-0 items-center justify-center rounded-xl bg-text-main p-2.5 text-surface transition-colors hover:opacity-80">
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <>
            <button type="button" onClick={toggleDictation} aria-label={dictating ? "Stop dictation" : "Start dictation"} title={dictating ? "Stop dictation" : "Start dictation"} className={cn("mb-1 flex shrink-0 items-center justify-center rounded-xl p-2.5 transition-colors", dictating ? "bg-red-100 text-red-700" : "text-text-muted hover:bg-black/5 hover:text-text-main")}><Mic className="h-4 w-4" /></button>
          <button type="button" onClick={() => onVoiceModeChange(!voiceMode)} aria-pressed={voiceMode} aria-label={voiceMode ? "Disable voice mode" : "Enable voice mode"} title={voiceMode ? "Disable voice mode" : "Enable voice mode"} className={cn("mb-1 flex shrink-0 items-center justify-center rounded-xl p-2.5 transition-colors", voiceMode ? "bg-cream-highlight text-accent" : "text-text-muted hover:bg-black/5 hover:text-text-main")}><span className="sr-only">Voice mode</span>{voiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          <button type="submit" disabled={isEmpty} aria-label="Send message" className={cn("mb-1 flex shrink-0 items-center justify-center rounded-xl p-2.5 transition-colors", isEmpty ? "cursor-not-allowed bg-black/5 text-text-muted/40" : "bg-accent text-white shadow-sm hover:opacity-90")}>
              <ArrowUp className="h-4 w-4" />
            </button>
            </>
          )}
        </div>
      </form>
      <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-2 px-2">
        {projects.length > 0 && <><label className="sr-only" htmlFor="chat-project">Project instructions</label><select id="chat-project" value={selectedProjectId} onChange={(event) => onSelectedProjectChange(event.target.value)} className="min-h-8 max-w-48 rounded-lg border border-border-main/70 bg-surface px-2 py-1 text-xs text-text-main focus-visible:outline-2 focus-visible:outline-accent"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></>}
        {isEditingMessage && <button type="button" onClick={onCancelEdit} className="rounded-md px-2 py-1 text-xs font-medium text-text-muted underline underline-offset-2">Cancel edit</button>}
        <span className="ml-auto text-[10px] text-text-muted" title="Approximate text-only token count; provider counts and attachment tokens may differ">This chat {estimatedTokens} text tokens (estimate)</span>
      </div>
      {fileError && <p role="alert" aria-live="polite" className="mx-auto mt-2 max-w-3xl text-center text-xs text-red-600">{fileError}</p>}
      {fileNotice && <p role="status" aria-live="polite" className="mx-auto mt-2 max-w-3xl text-center text-xs text-text-muted">{fileNotice}</p>}
      <div className="mx-auto mt-2 max-w-5xl text-center text-[11px] text-text-muted">Enter to send · Shift+Enter for a new line · Ctrl/Cmd+K new chat · / commands <span className="mx-1">·</span>{canAttachFiles ? "Attach images, PDFs, text, CSV, or JSON files." : (attachmentSupportMessage || "Attachments are unavailable for this provider.")} <span className="mx-1">·</span> AI can make mistakes. Please double-check important information.</div>
    </div>
  );
}

function AttachmentPreview({ file, extraction, onRetry, onRemove, onReplace }: { file: File; extraction?: AttachmentExtractionState; onRetry: () => void; onRemove: () => void; onReplace: () => void }) {
  const previewUrl = useMemo(() => file.type.startsWith("image/") ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const extractionLabel = extraction?.status === "reading" ? `Reading file · ${extraction.progress}%` : extraction?.status === "ocr" ? `OCR in progress · ${extraction.progress}%` : extraction?.status === "ready" ? `${extraction.source === "ocr" ? `OCR (${getOcrLanguageLabel(extraction.language)})` : "Text"} extracted · ${extraction.characterCount.toLocaleString()} characters` : extraction?.status === "empty" ? (extraction.message || "No readable text found") : extraction?.status === "failed" ? (extraction.message || "Extraction failed") : "Preparing extraction…";
  const extractionReady = extraction?.status === "ready";
  return <div className="min-w-0 rounded-xl border border-border-main/60 bg-bg-main/60 p-2" data-attachment-status={extraction?.status || "reading"}><div className="flex items-center gap-2"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream-highlight text-accent">{previewUrl ? <><span className="sr-only">Image preview</span><img src={previewUrl} alt={`Preview of ${file.name}`} className="h-full w-full object-cover" /></> : <FileText className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-text-main" title={file.name}>{file.name}</p><p className="mt-0.5 text-[10px] text-text-muted">{getFileKindLabel(file)} · {formatFileSize(file.size)}</p><p className={cn("mt-0.5 text-[10px] font-medium", extractionReady ? "text-emerald-700" : extraction?.status === "failed" ? "text-red-600" : "text-text-muted")}>{extractionReady ? "✓ " : ""}{extractionLabel}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><button type="button" onClick={onReplace} className="text-[10px] font-semibold text-text-muted underline underline-offset-2 hover:text-text-main">Replace</button><button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="rounded-md p-1 text-text-muted hover:bg-black/10 hover:text-text-main"><X className="h-3.5 w-3.5" /></button></div></div>{extractionReady && extraction.text && <details className="mt-2 rounded-lg border border-border-main/50 bg-surface px-2 py-1.5"><summary className="cursor-pointer text-[10px] font-semibold text-text-muted">View extracted text</summary><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-text-muted">{extraction.text.slice(0, 2000)}</pre></details>}{(extraction?.status === "failed" || extraction?.status === "empty") && <button type="button" onClick={onRetry} className="mt-2 text-[10px] font-semibold text-accent underline underline-offset-2">Retry extraction</button>}</div>;
}

function AttachmentOption({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={cn("flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-medium transition-colors", disabled ? "cursor-not-allowed text-text-muted/50" : "text-text-main hover:bg-black/5")}>{icon}<span>{label}</span></button>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileKindLabel(file: File): string {
  if (file.type.startsWith("image/")) return "Image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "PDF";
  if (/\.(csv|json)$/i.test(file.name)) return "Data";
  return "Text";
}

type AttachmentExtractionState = AttachmentExtractionResult & { progress: number };

function getOcrLanguageLabel(language?: OcrLanguage): string {
  return OCR_LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || "English";
}

type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { start: () => void; stop: () => void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type WindowWithSpeech = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
function isAcceptedFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
  return /\.(pdf|txt|md|csv|json)$/i.test(file.name);
}
