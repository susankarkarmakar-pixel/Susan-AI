"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, BookOpen, KeyRound, LockKeyhole, MessageSquare, Workflow, X } from "lucide-react";
import type { WorkspaceSection } from "@/components/workspace/workspace-hub";

const TOUR_SEEN_KEY = "susan_first_use_tour_seen_v1";
const STEPS: Array<{ title: string; description: string; section: WorkspaceSection; icon: typeof Bot; action: string; openSettings?: boolean }> = [
  { title: "Private by design", description: "Susan AI works without an account. Conversations, preferences, and provider settings stay in this browser unless you send a request to a provider you choose.", section: "home", icon: LockKeyhole, action: "Start chatting" },
  { title: "Connect a model", description: "Add your own API key in API Keys, choose a free-tier provider, or connect a local OpenAI-compatible model. Your credentials remain browser-local.", section: "home", icon: KeyRound, action: "Open API Keys", openSettings: true },
  { title: "Start your first chat", description: "Use a starter card or write your own request. You can attach files, switch models, and retry safely when a provider is unavailable.", section: "chat", icon: MessageSquare, action: "Open Chat" },
  { title: "Agent Mode", description: "Describe a goal in everyday language. Susan breaks it into steps, shows what it plans to do, and asks before any step that needs your approval.", section: "agent", icon: Bot, action: "Open Agent Mode" },
  { title: "Workflows", description: "Pick a ready-made guided task. Try a calculation, or choose a document to analyze—no workflow runs an external action without your input.", section: "workflows", icon: Workflow, action: "Explore Workflows" },
  { title: "Knowledge Base", description: "Save notes and tags that help you organize project context. These notes stay in this browser, so export important material before clearing site data.", section: "knowledge", icon: BookOpen, action: "Open Knowledge Base" },
];

export function FirstUseTour({ onNavigate, onOpenSettings }: { onNavigate: (section: WorkspaceSection) => void; onOpenSettings?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const open = () => { setStepIndex(0); setIsOpen(true); };
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(TOUR_SEEN_KEY) !== "1") setIsOpen(true);
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

  if (!isOpen) return null;
  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const dismiss = () => {
    setIsOpen(false);
    try { window.localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* Best-effort first-visit memory. */ }
  };
  const goToStepSection = () => {
    if (step.openSettings && onOpenSettings) onOpenSettings();
    else onNavigate(step.section);
    dismiss();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="first-use-tour-title" aria-describedby="first-use-tour-description" className="w-full max-w-md rounded-3xl border border-white/70 bg-[#FCFAF5] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><Icon className="h-6 w-6" /></span><button type="button" onClick={dismiss} aria-label="Close quick tour" className="rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main"><X className="h-4 w-4" /></button></div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Quick tour · {stepIndex + 1} of {STEPS.length}</p>
        <h2 id="first-use-tour-title" className="mt-1 text-xl font-semibold text-text-main">{step.title}</h2>
        <p id="first-use-tour-description" className="mt-2 text-sm leading-6 text-text-muted">{step.description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-black/5 disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" />Back</button><button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-black/5">Skip tour</button>{stepIndex < STEPS.length - 1 ? <button type="button" onClick={() => setStepIndex((index) => index + 1)} className="inline-flex items-center gap-1 rounded-lg bg-sidebar-cocoa px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90">Next<ArrowRight className="h-3.5 w-3.5" /></button> : <button type="button" onClick={goToStepSection} className="inline-flex items-center gap-1 rounded-lg bg-sidebar-cocoa px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90">{step.action}<ArrowRight className="h-3.5 w-3.5" /></button>}</div>
      </section>
    </div>
  );
}
