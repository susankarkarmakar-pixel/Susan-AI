"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, BookOpen, CheckCircle2, KeyRound, Workflow, X } from "lucide-react";
import type { WorkspaceSection } from "@/components/workspace/workspace-hub";
import { getConnectedModelIds } from "@/components/chat/model-control-panel";
import { hydrateKeys } from "@/lib/key-storage";

const TOUR_SEEN_KEY = "susan_first_use_tour_seen_v1";
const SAMPLE_PROMPT = "Give me a concise overview of what Susan AI can help me do.";
const STEPS: Array<{ title: string; description: string; section: WorkspaceSection; icon: typeof Bot; action: string }> = [
  { title: "Agent Mode", description: "Describe a goal in everyday language. Susan breaks it into steps, shows what it plans to do, and asks before any step that needs your approval.", section: "agent", icon: Bot, action: "Open Agent Mode" },
  { title: "Workflows", description: "Pick a ready-made guided task. Try a calculation, or choose a document to analyze—no workflow runs an external action without your input.", section: "workflows", icon: Workflow, action: "Explore Workflows" },
  { title: "Knowledge Base", description: "Save notes and tags that help you organize project context. These notes stay in this browser, so export important material before clearing site data.", section: "knowledge", icon: BookOpen, action: "Open Knowledge Base" },
];

export function FirstUseTour({ onNavigate, onStartSampleChat }: { onNavigate: (section: WorkspaceSection) => void; onStartSampleChat: (prompt: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [connectedModelCount, setConnectedModelCount] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dismiss = useCallback(() => {
    setIsOpen(false);
    try { window.localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* Best-effort first-visit memory. */ }
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    const open = () => {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setStepIndex(0);
      setIsOpen(true);
    };
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(TOUR_SEEN_KEY) !== "1") {
          previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setIsOpen(true);
        }
      } catch {
        // Keep the tour available manually if browser storage is disabled.
      }
    }, 600);
    document.addEventListener("open-first-use-tour", open);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("open-first-use-tour", open);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const refreshConnections = () => { if (active) setConnectedModelCount(getConnectedModelIds().length); };
    const refreshTimer = window.setTimeout(refreshConnections, 0);
    void hydrateKeys().then(refreshConnections);
    window.addEventListener("keys-updated", refreshConnections);
    window.addEventListener("custom-providers-updated", refreshConnections);
    const focusTimer = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>("[data-first-use-tour] button:not([disabled])"));
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
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keys-updated", refreshConnections);
      window.removeEventListener("custom-providers-updated", refreshConnections);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismiss, isOpen]);

  if (!isOpen) return null;
  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const goToStepSection = () => {
    onNavigate(step.section);
    dismiss();
  };
  const openProviderSettings = () => {
    document.dispatchEvent(new CustomEvent("open-settings"));
    dismiss();
  };
  const startSampleChat = () => {
    onStartSampleChat(SAMPLE_PROMPT);
    dismiss();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <section data-first-use-tour role="dialog" aria-modal="true" aria-labelledby="first-use-tour-title" aria-describedby="first-use-tour-description" className="w-full max-w-md rounded-3xl border border-white/70 bg-[#FCFAF5] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><Icon className="h-6 w-6" /></span><button ref={closeButtonRef} type="button" onClick={dismiss} aria-label="Close quick tour" className="rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main"><X className="h-4 w-4" /></button></div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Quick tour · {stepIndex + 1} of {STEPS.length + 1}</p>
        <h2 id="first-use-tour-title" className="mt-1 text-xl font-semibold text-text-main">{stepIndex === 0 ? "Set up your first AI model" : step.title}</h2>
        <p id="first-use-tour-description" className="mt-2 text-sm leading-6 text-text-muted">{stepIndex === 0 ? "Connect a provider to start chatting. Add your own API key in Settings, then save it. Connection tests may use provider quota or incur a small charge, so run them only when you choose." : step.description}</p>
        {stepIndex === 0 ? <>
          <ol className="mt-4 space-y-2 text-xs leading-5 text-text-main">
            <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-highlight text-[10px] font-bold text-accent">1</span><span>Choose a provider in API Keys and add its key.</span></li>
            <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-highlight text-[10px] font-bold text-accent">2</span><span>Save it. Keys are encrypted and kept in this browser profile.</span></li>
            <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-highlight text-[10px] font-bold text-accent">3</span><span>Pick the connected model in the composer and send your first prompt.</span></li>
          </ol>
          <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-border-main/60 bg-white px-3 py-2 text-xs text-text-main">{connectedModelCount > 0 ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" /> : <KeyRound className="h-4 w-4 shrink-0 text-accent" />}{connectedModelCount > 0 ? `${connectedModelCount} connected model${connectedModelCount === 1 ? "" : "s"} ready` : "No connected model detected yet"}</div>
        </> : <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Explore the workspace · {stepIndex} of {STEPS.length}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-black/5 disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" />Back</button><button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-black/5">Skip tour</button>{stepIndex === 0 ? <button type="button" onClick={connectedModelCount > 0 ? startSampleChat : openProviderSettings} className="inline-flex items-center gap-1 rounded-lg bg-sidebar-cocoa px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90">{connectedModelCount > 0 ? "Try a sample prompt" : "Open API key settings"}<ArrowRight className="h-3.5 w-3.5" /></button> : stepIndex < STEPS.length ? <button type="button" onClick={() => setStepIndex((index) => Math.min(STEPS.length, index + 1))} className="inline-flex items-center gap-1 rounded-lg bg-sidebar-cocoa px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90">Next<ArrowRight className="h-3.5 w-3.5" /></button> : <button type="button" onClick={goToStepSection} className="inline-flex items-center gap-1 rounded-lg bg-sidebar-cocoa px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90">{step.action}<ArrowRight className="h-3.5 w-3.5" /></button>}</div>
        {stepIndex === 0 && connectedModelCount > 0 && <p className="mt-3 text-right text-[10px] leading-4 text-text-muted">The sample is placed in the composer; review it and press Send when ready.</p>}
      </section>
    </div>
  );
}
