"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileJson, FileText, History, Menu, MessageSquare, Search } from "lucide-react";
import { Conversation, ConversationSummary, exportConversations, getConversations, loadConversation } from "@/lib/chat-storage";
import { conversationToMarkdown, groupConversationHistory } from "@/lib/conversation-history.mjs";

interface HistoryWorkspaceProps {
  onLoadConversation: (id: string) => void;
  onOpenSidebar: () => void;
}

export function HistoryWorkspace({ onLoadConversation, onOpenSidebar }: HistoryWorkspaceProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => setConversations(getConversations());
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("conversations-updated", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("conversations-updated", refresh);
    };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? conversations.filter((conversation) => conversation.title.toLowerCase().includes(normalized)) : conversations;
  }, [conversations, query]);
  const groups = useMemo(() => groupConversationHistory(visible), [visible]);

  const exportAllJson = () => downloadFile(exportConversations(), `susan-ai-history-${dateStamp()}.json`, "application/json;charset=utf-8");
  const exportAllMarkdown = () => {
    const fullConversations = conversations
      .map((conversation) => loadConversation(conversation.id))
      .filter((conversation): conversation is Conversation => conversation !== null);
    const markdown = fullConversations.map((conversation) => conversationToMarkdown(conversation)).join("\n---\n\n");
    downloadFile(`# Susan AI chat history\n\n${markdown}`, `susan-ai-history-${dateStamp()}.md`, "text/markdown;charset=utf-8");
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border-main/50 bg-bg-main/95 px-3 py-3 backdrop-blur-sm sm:px-5 md:px-8" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button type="button" onClick={onOpenSidebar} aria-label="Open sidebar" className="-ml-1 shrink-0 rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main lg:hidden"><Menu className="h-5 w-5" /></button>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent"><History className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Your conversations</p><h1 className="truncate text-lg font-semibold text-text-main">History</h1></div>
        </div>
        <span className="shrink-0 rounded-full bg-cream-highlight px-3 py-1 text-xs font-semibold text-accent">{conversations.length} saved</span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-text-muted">Browse chats by day. History is saved only in this browser; downloads let you keep a separate copy.</p>
          <div className="flex flex-wrap gap-2" aria-label="Export all conversations">
            <button type="button" onClick={exportAllJson} disabled={conversations.length === 0} className={actionButton}><FileJson className="h-4 w-4" />Export all JSON</button>
            <button type="button" onClick={exportAllMarkdown} disabled={conversations.length === 0} className={actionButton}><Download className="h-4 w-4" />Download all Markdown</button>
          </div>
        </div>

        <label className="mb-6 flex max-w-xl items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-3 py-2.5 shadow-sm focus-within:border-accent/50">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversation titles" aria-label="Search conversation history" className="min-w-0 flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted/60" />
        </label>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-main/80 bg-surface/60 px-5 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><MessageSquare className="h-6 w-6" /></span>
            <h2 className="mt-4 font-semibold text-text-main">{query ? "No matching conversations" : "No saved conversations yet"}</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-text-muted">{query ? "Try another title." : "Once a chat is saved, it will appear here under Today, Yesterday, or its calendar date."}</p>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`history-date-${group.key}`}>
                <h2 id={`history-date-${group.key}`} className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted"><CalendarDays className="h-4 w-4 text-accent" />{group.label}<span className="font-normal tracking-normal">· {group.items.length}</span></h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((conversation) => <ConversationCard key={conversation.id} conversation={conversation} onOpen={() => onLoadConversation(conversation.id)} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <footer className="border-t border-border-main/50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] text-text-muted md:px-8">Saved on this device · Susan AI</footer>
    </div>
  );
}

function ConversationCard({ conversation, onOpen }: { conversation: ConversationSummary; onOpen: () => void }) {
  const openConversation = () => onOpen();
  const downloadJson = () => {
    const full = loadConversation(conversation.id);
    if (!full) return;
    downloadFile(JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), conversations: [full] }, null, 2), `${safeFileName(full.title)}.json`, "application/json;charset=utf-8");
  };
  const downloadMarkdown = () => {
    const full = loadConversation(conversation.id);
    if (!full) return;
    downloadFile(conversationToMarkdown(full), `${safeFileName(full.title)}.md`, "text/markdown;charset=utf-8");
  };

  return (
    <article className="min-w-0 rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm">
      <button type="button" onClick={openConversation} className="block w-full min-w-0 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
        <h3 className="truncate font-semibold text-text-main">{conversation.title || "New Conversation"}</h3>
        <p className="mt-1 text-xs text-text-muted">{new Date(conversation.date).toLocaleString()} <span className="mx-1">·</span>{conversation.model}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border-main/50 pt-3">
        <button type="button" onClick={openConversation} className={actionButton}><MessageSquare className="h-3.5 w-3.5" />Open chat</button>
        <button type="button" onClick={downloadMarkdown} className={actionButton}><FileText className="h-3.5 w-3.5" />Markdown</button>
        <button type="button" onClick={downloadJson} className={actionButton}><FileJson className="h-3.5 w-3.5" />JSON</button>
      </div>
    </article>
  );
}

const actionButton = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-main/70 bg-surface px-3 py-2 text-xs font-semibold text-text-main transition-colors hover:border-accent/40 hover:bg-cream-highlight hover:text-accent disabled:cursor-not-allowed disabled:opacity-40";

function downloadFile(contents: string, filename: string, contentType: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: contentType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(title: string) {
  const normalized = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
  return `susan-ai-${normalized || "conversation"}`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
