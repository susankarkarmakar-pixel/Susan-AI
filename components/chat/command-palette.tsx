"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock3, FolderKanban, MessageSquarePlus, Settings2, Sparkles, Workflow, X } from "lucide-react";
import type { WorkspaceSection } from "@/components/workspace/workspace-hub";

interface CommandPaletteProps {
  onNewChat: () => void;
  onNavigate: (section: WorkspaceSection) => void;
  onOpenSettings: () => void;
}

type Command = { label: string; hint: string; section?: WorkspaceSection; action?: () => void; icon: typeof MessageSquarePlus };

export function CommandPalette({ onNewChat, onNavigate, onOpenSettings }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const commands: Command[] = useMemo(() => [
    { label: "New chat", hint: "Start a fresh conversation", action: onNewChat, icon: MessageSquarePlus },
    { label: "Chat", hint: "Return to the assistant", section: "chat", icon: MessageSquarePlus },
    { label: "History", hint: "Find or export past chats", section: "history", icon: Clock3 },
    { label: "Projects", hint: "Organize project work", section: "projects", icon: FolderKanban },
    { label: "Workflows", hint: "Open guided tasks", section: "workflows", icon: Workflow },
    { label: "Agent mode", hint: "Run an asynchronous task", section: "agent", icon: Sparkles },
    { label: "Settings and API keys", hint: "Manage providers and preferences", action: onOpenSettings, icon: Settings2 },
  ], [onNewChat, onOpenSettings]);
  const visibleCommands = useMemo(() => commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(query.trim().toLowerCase())), [commands, query]);
  const runCommand = useCallback((command: Command) => {
    command.action?.();
    if (command.section) onNavigate(command.section);
    setOpen(false);
  }, [onNavigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onNewChat();
        setOpen(false);
        return;
      }
      if (event.key === "/" && !editable && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setQuery("");
        setActiveIndex(0);
        setOpen(true);
      }
      if (open && event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (open && event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])');
        if (focusable?.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }
      if (open && event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(0, visibleCommands.length - 1))); }
      if (open && event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
      if (open && event.key === "Enter" && visibleCommands[activeIndex]) { event.preventDefault(); runCommand(visibleCommands[activeIndex]); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, onNewChat, open, runCommand, visibleCommands]);

  useEffect(() => { if (open) requestAnimationFrame(() => searchRef.current?.focus()); }, [open]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 px-3 pt-[15vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="command-palette-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-main bg-surface shadow-2xl">
      <h2 id="command-palette-title" className="sr-only">Command palette</h2>
      <div className="flex items-center gap-3 border-b border-border-main/70 px-4 py-3"><Sparkles className="h-4 w-4 text-accent" /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} aria-label="Filter commands" placeholder="What would you like to do?" className="min-w-0 flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted" /><kbd className="hidden rounded border border-border-main px-1.5 py-0.5 text-[10px] text-text-muted sm:inline">ESC</kbd><button type="button" aria-label="Close command palette" onClick={() => setOpen(false)} className="rounded p-1 text-text-muted hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent"><X className="h-4 w-4" /></button></div>
      <ul aria-label="Available commands" className="max-h-[55vh] overflow-y-auto p-2">
        {visibleCommands.map((command, index) => { const Icon = command.icon; return <li key={command.label}><button type="button" aria-current={index === activeIndex ? "true" : undefined} onClick={() => runCommand(command)} onMouseEnter={() => setActiveIndex(index)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent ${index === activeIndex ? "bg-cream-highlight/70" : "hover:bg-black/[.03]"}`}><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-main text-accent"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-main">{command.label}</span><span className="block text-xs text-text-muted">{command.hint}</span></span><ArrowRight className="h-4 w-4 text-text-muted" /></button></li>; })}
        {visibleCommands.length === 0 && <li className="p-6 text-center text-sm text-text-muted">No matching commands.</li>}
      </ul>
      <div className="border-t border-border-main/60 px-4 py-2 text-[10px] text-text-muted">Press <kbd className="rounded border border-border-main px-1">↑</kbd> <kbd className="rounded border border-border-main px-1">↓</kbd> to navigate · <kbd className="rounded border border-border-main px-1">Enter</kbd> to choose · <kbd className="rounded border border-border-main px-1">/</kbd> to open</div>
    </section>
  </div>;
}
