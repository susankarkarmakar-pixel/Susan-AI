"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronRight, Code2, Database, ExternalLink, FileText, GitBranch, Heart, Info, Laptop, LockKeyhole, Mail, Shield, Sparkles, Star, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AboutSection = "about" | "features" | "providers" | "stack" | "privacy" | "license" | "thanks";

const sections: Array<{ id: AboutSection; label: string; description: string; icon: LucideIcon }> = [
  { id: "about", label: "About Susan AI", description: "Product overview and release", icon: Info },
  { id: "features", label: "What you can do", description: "Chat, files, agents and more", icon: Star },
  { id: "providers", label: "AI Providers", description: "Models, keys and capabilities", icon: Database },
  { id: "stack", label: "How it is built", description: "Architecture and safeguards", icon: Code2 },
  { id: "privacy", label: "Privacy & Security", description: "Storage, keys and requests", icon: Shield },
  { id: "license", label: "License & Use", description: "Repository and redistribution", icon: FileText },
  { id: "thanks", label: "Acknowledgements", description: "Open technologies and people", icon: Heart },
];

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const [activeSection, setActiveSection] = useState<AboutSection>("about");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && modalRef.current) {
        const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>("button, a[href]"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const active = sections.find((section) => section.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 md:p-8">
      <div className="absolute inset-0 bg-sidebar-cocoa/45 backdrop-blur-sm" onClick={onClose} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="about-susan-title" className="relative flex h-[100dvh] w-full max-w-6xl overflow-hidden rounded-t-3xl border border-border-main/70 bg-bg-main shadow-2xl sm:h-[min(860px,92vh)] sm:rounded-[26px]">
        <aside className="hidden w-[285px] shrink-0 border-r border-border-main/60 bg-bg-sidebar p-5 md:block">
          <div className="mb-5 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Susan AI</div>
          <nav className="space-y-1" aria-label="About sections">
            {sections.map((section) => {
              const Icon = section.icon;
              const selected = activeSection === section.id;
              return (
                <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${selected ? "bg-cream-highlight text-text-main" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`} aria-current={selected ? "page" : undefined}>
                  <Icon className={`h-5 w-5 shrink-0 ${selected ? "text-accent" : "text-sidebar-cocoa"}`} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{section.label}</span><span className="mt-0.5 block truncate text-xs opacity-70">{section.description}</span></span>
                  {selected && <ChevronRight className="h-4 w-4 text-accent" />}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close About Susan AI" className="absolute right-3 top-3 rounded-full p-2 text-text-muted hover:bg-black/5 hover:text-text-main sm:right-5 sm:top-5"><X className="h-5 w-5" /></button>
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex items-center gap-3 border-b border-border-main/50 pb-3 md:hidden"><Info className="h-5 w-5 shrink-0 text-accent" /><span className="truncate font-semibold text-text-main">{active.label}</span></div>
            <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border-main/50 pb-2 md:hidden" aria-label="About sections"><div className="flex shrink-0 gap-1">{sections.map((section) => { const Icon = section.icon; const selected = activeSection === section.id; return <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} aria-current={selected ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold ${selected ? "bg-cream-highlight text-text-main" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`}><Icon className="h-3.5 w-3.5" />{section.label}</button>; })}</div></nav>
            {activeSection === "about" && <AboutOverview />}
            {activeSection === "features" && <FeatureSection />}
            {activeSection === "providers" && <ProviderSection />}
            {activeSection === "stack" && <StackSection />}
            {activeSection === "privacy" && <PrivacySection />}
            {activeSection === "license" && <LicenseSection />}
            {activeSection === "thanks" && <ThanksSection />}
          </div>
        </main>
      </div>
    </div>
  );
}

function AboutOverview() {
  return <>
    <div className="flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/susan-ai-logo-sidebar.png" alt="Susan AI — Your Personal AI Assistant" className="mb-5 h-auto w-[280px] max-w-full object-contain" />
      <p className="max-w-2xl text-base leading-7 text-text-muted">Susan AI is a modern, flexible and privacy-focused AI assistant designed to help you learn, create, explore and be more productive.</p>
    </div>
    <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
      {[[Sparkles, "Model choice", "Inline controls"], [FileText, "File workflows", "Attach & analyze"], [Zap, "Automatic", "Fallback"], [LockKeyhole, "Local-first", "Preferences"], [Laptop, "Agent-ready", "Workspace"]].map(([Icon, title, sub]) => { const FeatureIcon = Icon as typeof Sparkles; return <div key={title as string} className="text-center"><span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><FeatureIcon className="h-6 w-6" /></span><span className="block text-xs font-medium text-text-main">{title as string}</span><span className="block text-xs text-text-muted">{sub as string}</span></div>; })}
    </div>
    <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border-main/50 bg-border-main/50 md:grid-cols-5">
      {["Release\nv0.1.0 · Active development", "Updated\nSeptember 2026", "Created by\nSusankar Karmakar", "Product studio\nSanket Pixel Technologies", "Source\nSusan-AI on GitHub"].map((item) => { const [label, value] = item.split("\n"); return <div key={label} className="bg-cream-highlight/40 p-4"><span className="block text-xs font-semibold text-text-main">{label}</span><span className="mt-1 block text-xs leading-5 text-text-muted">{value}</span></div>; })}
    </div>
    <div className="mt-8"><h2 id="about-susan-title" className="font-serif text-2xl font-semibold text-text-main">A calmer way to work with AI</h2><p className="mt-3 text-sm leading-7 text-text-muted">Susan AI brings model selection, response effort, automatic fallback, file attachments, research and agent workflows into one focused workspace. It is designed for learning, creating and exploring ideas while keeping provider choices and local preferences understandable.</p></div>
    <ActionLinks />
  </>;
}

function FeatureSection() { return <Section title="What you can do" intro="The current workspace is organized around clear choices and focused actions."><InfoGrid items={[[Sparkles, "Inline model control", "Choose a connected model and response effort directly from the chat composer."], [Zap, "Automatic fallback", "Let Susan AI try the next connected model when a provider fails."], [FileText, "Attachment workflows", "Choose an attachment type before adding images, PDFs, text or data files."], [Database, "Conversation management", "Save, load, search, export and manage conversations locally in your browser."], [Bot, "Agent and research modes", "Move from everyday chat to web research and structured agent tasks when needed."], [Laptop, "Responsive workspace", "Use the same focused interface across desktop, tablet and mobile layouts."]]}/></Section>; }
function ProviderSection() { return <Section title="AI Providers" intro="Connect the providers you trust, then switch models without leaving the chat composer."><InfoGrid items={[[Sparkles, "Cloud providers", "Anthropic, Google Gemini and OpenAI models cover writing, reasoning and multimodal assistance."], [Database, "Specialized models", "DeepSeek, Qwen, Kimi, Sarvam and Hugging Face offer additional model choices."], [Code2, "Model gateways", "OpenRouter and other compatible routes can expose more providers through one connection."], [Shield, "Connection status", "The selector shows which models are ready and which require a key or connection."], [FileText, "Capability-aware files", "Attachment support is checked per model so unsupported file requests fail clearly."], [Zap, "Bring your own key", "Provider credentials stay under your control and are managed from Settings."]]}/></Section>; }
function StackSection() { return <Section title="How it is built" intro="Susan AI combines a responsive client with provider-safe server routes and local-first browser modules."><InfoGrid items={[[Code2, "Next.js and React", "App Router architecture powers the web interface and responsive workspaces."], [Sparkles, "Streaming transport", "The chat route streams responses while preserving model and effort choices."], [Database, "Browser modules", "Conversation history, preferences, projects and encrypted key storage are handled locally."], [Laptop, "Desktop-ready", "The application can also be packaged as an Electron desktop experience."], [Shield, "Guardrails", "Capability checks, request bounds, rate limiting and automated release tests protect the workflow."]]}/></Section>; }
function PrivacySection() { return <Section title="Privacy & Security" intro="Susan AI keeps the browser, provider and request boundaries visible so you can make informed choices."><InfoGrid items={[[LockKeyhole, "Encrypted browser-local keys", "Provider credentials are stored through the app's encrypted browser-local key storage."], [Shield, "No provider-key persistence", "The chat route validates requests without turning provider credentials into application data."], [Database, "Local conversations", "Saved conversations and workspace data remain in the current browser unless you export them."], [Check, "Request validation", "Chat requests enforce size, provider, file and content boundaries before a provider call."], [Zap, "Rate limiting", "Deployments can use rate limiting to reduce abuse and protect shared resources."]]}/></Section>; }
function LicenseSection() { return <Section title="License & Use" intro="Susan AI is maintained as a practical, extensible project for personal and professional experimentation."><div className="rounded-2xl border border-border-main/60 bg-surface p-6 text-sm leading-7 text-text-muted"><p className="font-semibold text-text-main">Repository and redistribution</p><p className="mt-2">Review the repository license and notices before redistributing, deploying or modifying this project. Provider names, models and trademarks belong to their respective owners; your provider usage remains subject to their terms.</p></div><ActionLinks /></Section>; }
function ThanksSection() { return <Section title="Acknowledgements" intro="Thanks to the people and projects that make this workspace possible."><div className="rounded-2xl border border-border-main/60 bg-cream-highlight/40 p-6 text-sm leading-7 text-text-muted"><Heart className="mb-3 h-7 w-7 text-accent" /><p className="font-semibold text-text-main">Built with care for curious people.</p><p className="mt-2">Susan AI stands on the work of Next.js, React, the AI SDK, Lucide, Electron and the provider ecosystems behind the connected models. Thanks also to users whose feedback keeps the workspace practical and calm.</p></div></Section>; }

function Section({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) { return <><h1 className="font-serif text-3xl font-semibold text-text-main">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{intro}</p><div className="mt-8">{children}</div></>; }
function InfoGrid({ items }: { items: Array<[LucideIcon, string, string]> }) { return <div className="grid gap-3 md:grid-cols-2">{items.map(([Icon, title, description]) => <div key={title} className="rounded-2xl border border-border-main/60 bg-surface p-5"><Icon className="mb-4 h-6 w-6 text-accent" /><h2 className="text-sm font-semibold text-text-main">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{description}</p></div>)}</div>; }
function ActionLinks() { return <div className="mt-8 flex flex-wrap gap-2 border-t border-border-main/50 pt-6"><a href="https://github.com/susankarkarmakar-pixel/Susan-AI" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-4 py-2.5 text-xs font-semibold text-text-main hover:border-accent/50"><GitBranch className="h-4 w-4" /> Visit GitHub <ExternalLink className="h-3 w-3" /></a><a href="mailto:susankarkarmakar@gmail.com" className="inline-flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-4 py-2.5 text-xs font-semibold text-text-main hover:border-accent/50"><Mail className="h-4 w-4" /> Contact Author</a><a href="mailto:susankarkarmakar@gmail.com?subject=Susan%20AI%20Feedback" className="inline-flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-4 py-2.5 text-xs font-semibold text-text-main hover:border-accent/50"><Heart className="h-4 w-4" /> Give Feedback</a></div>; }
