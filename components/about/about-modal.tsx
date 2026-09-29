"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Code2, Database, ExternalLink, FileText, GitBranch, Heart, Info, Laptop, LockKeyhole, Mail, Shield, Sparkles, Star, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import packageJson from "../../package.json";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AboutSection = "about" | "features" | "providers" | "stack" | "privacy" | "license" | "thanks";

const sections: Array<{ id: AboutSection; label: string; description: string; icon: LucideIcon }> = [
  { id: "about", label: "About Susan AI", description: "Version, overview and credits", icon: Info },
  { id: "features", label: "Features", description: "Key capabilities", icon: Star },
  { id: "providers", label: "Supported Providers", description: "AI models and services", icon: Database },
  { id: "stack", label: "Tech Stack", description: "Built with modern tools", icon: Code2 },
  { id: "privacy", label: "Privacy & Security", description: "Your data and API keys", icon: Shield },
  { id: "license", label: "License", description: "Open source information", icon: FileText },
  { id: "thanks", label: "Acknowledgements", description: "Thanks to the community", icon: Heart },
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-8">
      <div className="absolute inset-0 bg-sidebar-cocoa/45 backdrop-blur-sm" onClick={onClose} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="about-susan-title" className="relative flex h-[min(860px,92vh)] w-full max-w-6xl overflow-hidden rounded-[26px] border border-white/70 bg-[#FCFAF5] shadow-2xl">
        <aside className="hidden w-[285px] shrink-0 border-r border-border-main/60 bg-[#FAF5EC] p-5 md:block">
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

        <main className="min-w-0 flex-1 overflow-y-auto p-6 md:p-10">
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close About Susan AI" className="absolute right-5 top-5 rounded-full p-2 text-text-muted hover:bg-black/5 hover:text-text-main"><X className="h-5 w-5" /></button>
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-center gap-3 border-b border-border-main/50 pb-5 md:hidden"><Info className="h-5 w-5 text-accent" /><span className="font-semibold">{active.label}</span></div>
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
  const [lastUpdated, setLastUpdated] = useState("September 2026");

  useEffect(() => {
    setLastUpdated(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  }, []);

  return <>
    <div className="flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/susan-ai-logo-sidebar.png" alt="Susan AI — Your Personal AI Assistant" className="mb-5 h-auto w-[280px] max-w-full object-contain" />
      <p className="max-w-2xl text-base leading-7 text-text-muted">Susan AI is a modern, flexible and privacy-focused AI assistant designed to help you learn, create, explore and be more productive.</p>
    </div>
    <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
      {[[Sparkles, "Multi-Provider", "Support"], [FileText, "File Upload", "& Analysis"], [Zap, "Fast &", "Responsive"], [LockKeyhole, "Privacy", "Focused"], [Laptop, "Desktop", "Application"]].map(([Icon, title, sub]) => { const FeatureIcon = Icon as typeof Sparkles; return <div key={title as string} className="text-center"><span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><FeatureIcon className="h-6 w-6" /></span><span className="block text-xs font-medium text-text-main">{title as string}</span><span className="block text-xs text-text-muted">{sub as string}</span></div>; })}
    </div>
    <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border-main/50 bg-border-main/50 md:grid-cols-5">
      {[
        { label: "Version", value: `v${packageJson.version} · Latest` },
        { label: "Last Updated", value: lastUpdated },
        { label: "Author", value: "Susankar Karmakar" },
        { label: "Company", value: "Sanket Pixel Technologies", link: "https://github.com/susankarkarmakar-pixel" },
        { label: "Repository", value: "Susan-AI on GitHub", link: "https://github.com/susankarkarmakar-pixel/Susan-AI" }
      ].map(({ label, value, link }) => (
        <div key={label} className="bg-cream-highlight/40 p-4">
          <span className="block text-xs font-semibold text-text-main">{label}</span>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs leading-5 text-accent hover:underline flex items-center gap-1">
              {value} <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="mt-1 block text-xs leading-5 text-text-muted">{value}</span>
          )}
        </div>
      ))}
    </div>
    <div className="mt-8"><h2 id="about-susan-title" className="font-serif text-2xl font-semibold text-text-main">About the Project</h2><p className="mt-3 text-sm leading-7 text-text-muted">Susan AI provides a unified and user-friendly interface for multiple AI providers, with support for text chat, file analysis, rich formatting, conversation management and more. It is designed for personal, educational and professional use, with a focus on simplicity, privacy and extensibility.</p></div>
    <ActionLinks />
  </>;
}

function FeatureSection() { return <Section title="Features" intro="Everything Susan AI provides in one calm, focused workspace."><InfoGrid items={[[Sparkles, "Multi-provider chat", "Switch between supported AI providers without changing your workflow."], [FileText, "File analysis", "Attach supported images, documents and structured files for analysis."], [Database, "Conversation management", "Save, load, export and import conversations locally in your browser."], [Zap, "Responsive workspace", "Keyboard-friendly controls and a layout that adapts to different screens."], [LockKeyhole, "Bring Your Own Key", "Use your own provider credentials with session-only storage by default."], [Laptop, "Desktop-ready", "The same application can be packaged as a local Electron desktop app."]]}/></Section>; }
function ProviderSection() { return <Section title="Supported Providers" intro="Susan AI uses a single interface while letting you choose the provider that fits your task."><InfoGrid items={[[Sparkles, "Anthropic", "Claude models for thoughtful writing and analysis."], [Sparkles, "Google Gemini", "Gemini models for fast multimodal workflows."], [Zap, "OpenAI", "ChatGPT models for general-purpose assistance."], [Database, "DeepSeek", "Efficient chat models for everyday tasks."], [Code2, "OpenRouter", "A flexible gateway to available models."], [Shield, "More providers", "Qwen, Kimi, Sarvam and Hugging Face integrations."]]}/></Section>; }
function StackSection() { return <Section title="Tech Stack" intro="Built with modern, maintainable web technologies."><InfoGrid items={[[Code2, "Next.js and React", "App Router architecture with a responsive client interface."], [Sparkles, "AI SDK", "Streaming chat transport and provider model integration."], [Database, "Browser storage", "Local conversation and key-storage modules with versioned exports."], [Laptop, "Electron", "Optional desktop packaging with a bundled standalone server."], [Shield, "Validation", "Request guards, capability checks, rate limiting and release tests."]]}/></Section>; }
function PrivacySection() { return <Section title="Privacy & Security" intro="Susan AI is designed to keep personal data and provider credentials under your control."><InfoGrid items={[[LockKeyhole, "Session-only keys", "API keys are removed when the browser session ends by default."], [Shield, "No server persistence", "The application does not persist provider keys on the server."], [Database, "Local conversations", "Saved conversations remain in the current browser unless exported."], [Check, "Request validation", "Chat requests enforce size, provider, file and content boundaries."], [Zap, "Rate limiting", "Deployments can use a shared Upstash-backed limiter."]]}/></Section>; }
function LicenseSection() { return <Section title="License" intro="Susan AI is maintained as a practical, extensible project for personal and professional experimentation."><div className="rounded-2xl border border-border-main/60 bg-surface p-6 text-sm leading-7 text-text-muted"><p className="font-semibold text-text-main">Open source information</p><p className="mt-2">Review the repository license and notices before redistributing or deploying a modified version. Provider names, models and trademarks belong to their respective owners.</p></div><ActionLinks /></Section>; }
function ThanksSection() { return <Section title="Acknowledgements" intro="Thanks to the people and projects that make this workspace possible."><div className="rounded-2xl border border-border-main/60 bg-cream-highlight/40 p-6 text-sm leading-7 text-text-muted"><Heart className="mb-3 h-7 w-7 text-accent" /><p className="font-semibold text-text-main">Built with care for curious people.</p><p className="mt-2">Susan AI brings together open web technologies, AI provider ecosystems and the feedback of users who want a calmer, more private way to work with AI.</p></div></Section>; }

function Section({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) { return <><h1 className="font-serif text-3xl font-semibold text-text-main">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{intro}</p><div className="mt-8">{children}</div></>; }
function InfoGrid({ items }: { items: Array<[LucideIcon, string, string]> }) { return <div className="grid gap-3 md:grid-cols-2">{items.map(([Icon, title, description]) => <div key={title} className="rounded-2xl border border-border-main/60 bg-surface p-5"><Icon className="mb-4 h-6 w-6 text-accent" /><h2 className="text-sm font-semibold text-text-main">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{description}</p></div>)}</div>; }
function ActionLinks() { return <div className="mt-8 flex flex-wrap gap-2 border-t border-border-main/50 pt-6"><a href="https://github.com/susankarkarmakar-pixel/Susan-AI" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-4 py-2.5 text-xs font-semibold text-text-main hover:border-accent/50"><GitBranch className="h-4 w-4" /> Visit GitHub <ExternalLink className="h-3 w-3" /></a><a href="mailto:susankarkarmakar@gmail.com" className="inline-flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-4 py-2.5 text-xs font-semibold text-text-main hover:border-accent/50"><Mail className="h-4 w-4" /> Contact Author</a><a href="mailto:susankarkarmakar@gmail.com?subject=Susan%20AI%20Feedback" className="inline-flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-4 py-2.5 text-xs font-semibold text-text-main hover:border-accent/50"><Heart className="h-4 w-4" /> Give Feedback</a></div>; }
