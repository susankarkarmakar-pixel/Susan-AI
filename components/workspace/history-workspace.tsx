"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileJson, FileText, Folder, FolderPlus, History, Menu, MessageSquare, Pin, PinOff, Search } from "lucide-react";
import { Conversation, ConversationSummary, exportConversations, getConversations, loadConversation } from "@/lib/chat-storage";
import { conversationToMarkdown, createConversationFolder, groupConversationHistory, normalizeConversationOrganization, updateConversationOrganization, type ConversationOrganization } from "@/lib/conversation-history.mjs";

interface HistoryWorkspaceProps {
  onLoadConversation: (id: string) => void;
  onOpenSidebar: () => void;
}

const ORGANIZATION_STORAGE_KEY = "susan_history_organization_v1";
const FILTER_ALL = "all";
const FILTER_PINNED = "pinned";

export function HistoryWorkspace({ onLoadConversation, onOpenSidebar }: HistoryWorkspaceProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [organization, setOrganization] = useState<ConversationOrganization>({ folders: [], items: {} });
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState(FILTER_ALL);
  const [newFolderName, setNewFolderName] = useState("");
  const [organizationError, setOrganizationError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setConversations(getConversations());
      try { setOrganization(normalizeConversationOrganization(JSON.parse(window.localStorage.getItem(ORGANIZATION_STORAGE_KEY) || "null"))); }
      catch { setOrganization({ folders: [], items: {} }); }
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("conversations-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("history-organization-updated", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("conversations-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("history-organization-updated", refresh);
    };
  }, []);

  const saveOrganization = (next: ConversationOrganization) => {
    try {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, JSON.stringify(next));
      setOrganization(next);
      setOrganizationError(null);
      window.dispatchEvent(new Event("history-organization-updated"));
    } catch {
      setOrganizationError("Could not save your folders in this browser. Free some browser storage and try again.");
    }
  };

  const createFolder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const folders = createConversationFolder(organization.folders, newFolderName);
      saveOrganization({ ...organization, folders });
      setFolderFilter(`folder:${newFolderName.trim().replace(/\s+/g, " ").slice(0, 40)}`);
      setNewFolderName("");
    } catch (error) {
      setOrganizationError(error instanceof Error ? error.message : "Could not create this folder.");
    }
  };

  const togglePinned = (id: string) => {
    saveOrganization(updateConversationOrganization(organization, id, { pinned: !organization.items[id]?.pinned }));
  };

  const setConversationFolder = (id: string, folder: string) => {
    try { saveOrganization(updateConversationOrganization(organization, id, { folder })); }
    catch (error) { setOrganizationError(error instanceof Error ? error.message : "Could not update this folder."); }
  };

  const matchingConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return conversations.filter((conversation) => {
      if (folderFilter === FILTER_PINNED && !organization.items[conversation.id]?.pinned) return false;
      if (folderFilter.startsWith("folder:") && organization.items[conversation.id]?.folder !== folderFilter.slice(7)) return false;
      if (!normalized) return true;
      if (conversation.title.toLocaleLowerCase().includes(normalized) || conversation.model.toLocaleLowerCase().includes(normalized)) return true;
      return loadConversation(conversation.id)?.messages.some((message) => (message.role === "user" || message.role === "assistant") && message.content.toLocaleLowerCase().includes(normalized)) ?? false;
    });
  }, [conversations, folderFilter, organization, query]);

  const pinnedConversations = useMemo(() => matchingConversations.filter((conversation) => organization.items[conversation.id]?.pinned).sort((a, b) => b.date - a.date), [matchingConversations, organization]);
  const dateConversations = useMemo(() => folderFilter === FILTER_ALL ? matchingConversations.filter((conversation) => !organization.items[conversation.id]?.pinned) : matchingConversations, [folderFilter, matchingConversations, organization]);
  const groups = useMemo(() => groupConversationHistory(dateConversations), [dateConversations]);
  const showPinnedGroup = folderFilter === FILTER_ALL && pinnedConversations.length > 0;

  const exportAllJson = () => downloadFile(exportConversations(), `susan-ai-history-${dateStamp()}.json`, "application/json;charset=utf-8");
  const exportAllMarkdown = () => {
    const fullConversations = conversations.map((conversation) => loadConversation(conversation.id)).filter((conversation): conversation is Conversation => conversation !== null);
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
        <div role="note" className="mb-5 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><strong>Keep a backup:</strong> chats are stored only in this browser. Clearing browser/site data, using private browsing, or switching devices can remove them. Download JSON or Markdown copies of conversations you want to keep.</div>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-text-muted">Search titles and message content, pin important chats, and group conversations into folders on this device.</p>
          <div className="flex flex-wrap gap-2" aria-label="Export all conversations">
            <button type="button" onClick={exportAllJson} disabled={conversations.length === 0} className={actionButton}><FileJson className="h-4 w-4" />Export all JSON</button>
            <button type="button" onClick={exportAllMarkdown} disabled={conversations.length === 0} className={actionButton}><Download className="h-4 w-4" />Download all Markdown</button>
          </div>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-3 py-2.5 shadow-sm focus-within:border-accent/50"><Search className="h-4 w-4 shrink-0 text-text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles or message text" aria-label="Search conversation history" className="min-w-0 flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted/60" /></label>
          <label className="flex items-center gap-2 rounded-xl border border-border-main/70 bg-surface px-3 py-2.5 text-xs font-medium text-text-muted"><Folder className="h-4 w-4 shrink-0 text-accent" /><select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} aria-label="Filter history by folder or pinned status" className="min-w-0 bg-transparent text-sm text-text-main outline-none"><option value={FILTER_ALL}>All chats</option><option value={FILTER_PINNED}>Pinned</option>{organization.folders.map((folder) => <option key={folder} value={`folder:${folder}`}>{folder}</option>)}</select></label>
        </div>
        <form onSubmit={createFolder} className="mb-3 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="new-history-folder">New folder name</label><input id="new-history-folder" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} maxLength={40} placeholder="Create a folder, e.g. Work or Study" className="min-w-0 flex-1 rounded-lg border border-border-main/70 bg-surface px-3 py-2 text-sm outline-none focus:border-accent/50" /><button type="submit" disabled={!newFolderName.trim() || organization.folders.length >= 20} className={actionButton}><FolderPlus className="h-4 w-4" />Create folder</button></form>
        {organizationError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{organizationError}</p>}

        {matchingConversations.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-main/80 bg-surface/60 px-5 py-12 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><MessageSquare className="h-6 w-6" /></span><h2 className="mt-4 font-semibold text-text-main">{query || folderFilter !== FILTER_ALL ? "No matching conversations" : "No saved conversations yet"}</h2><p className="mt-1 max-w-md text-sm leading-6 text-text-muted">{query ? "Try another search term." : folderFilter !== FILTER_ALL ? "Open a chat and assign it to this folder, or select another filter." : "Once a chat is saved, it will appear here under Today, Yesterday, or its calendar date. Start a chat, then return here to find or export it."}</p></div>
        ) : (
          <div className="space-y-7">
            {showPinnedGroup && <section aria-labelledby="history-pinned"><h2 id="history-pinned" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted"><Pin className="h-4 w-4 text-accent" />Pinned<span className="font-normal tracking-normal">· {pinnedConversations.length}</span></h2><div className="grid gap-3 md:grid-cols-2">{pinnedConversations.map((conversation) => <ConversationCard key={conversation.id} conversation={conversation} organization={organization} onOpen={() => onLoadConversation(conversation.id)} onTogglePinned={() => togglePinned(conversation.id)} onSetFolder={(folder) => setConversationFolder(conversation.id, folder)} />)}</div></section>}
            {groups.map((group) => <section key={group.key} aria-labelledby={`history-date-${group.key}`}><h2 id={`history-date-${group.key}`} className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted"><CalendarDays className="h-4 w-4 text-accent" />{group.label}<span className="font-normal tracking-normal">· {group.items.length}</span></h2><div className="grid gap-3 md:grid-cols-2">{group.items.map((conversation) => <ConversationCard key={conversation.id} conversation={conversation} organization={organization} onOpen={() => onLoadConversation(conversation.id)} onTogglePinned={() => togglePinned(conversation.id)} onSetFolder={(folder) => setConversationFolder(conversation.id, folder)} />)}</div></section>)}
          </div>
        )}
      </main>
      <footer className="border-t border-border-main/50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] text-text-muted md:px-8">Saved on this device · Susan AI</footer>
    </div>
  );
}

function ConversationCard({ conversation, organization, onOpen, onTogglePinned, onSetFolder }: { conversation: ConversationSummary; organization: ConversationOrganization; onOpen: () => void; onTogglePinned: () => void; onSetFolder: (folder: string) => void }) {
  const pinned = Boolean(organization.items[conversation.id]?.pinned);
  const selectedFolder = organization.items[conversation.id]?.folder || "";
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
      <button type="button" onClick={onOpen} className="block w-full min-w-0 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/50"><h3 className="truncate font-semibold text-text-main">{conversation.title || "New Conversation"}</h3><p className="mt-1 text-xs text-text-muted">{new Date(conversation.date).toLocaleString()} <span className="mx-1">·</span>{conversation.model}</p></button>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-main/50 pt-3">
        <button type="button" onClick={onOpen} className={actionButton}><MessageSquare className="h-3.5 w-3.5" />Open chat</button>
        <button type="button" onClick={onTogglePinned} aria-pressed={pinned} className={actionButton}>{pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}{pinned ? "Unpin" : "Pin"}</button>
        <label className="flex min-w-0 items-center gap-1 rounded-lg border border-border-main/70 px-2 py-1.5 text-xs text-text-muted"><Folder className="h-3.5 w-3.5 shrink-0" /><select value={selectedFolder} onChange={(event) => onSetFolder(event.target.value)} aria-label={`Move ${conversation.title || "conversation"} to folder`} className="max-w-28 bg-transparent text-xs text-text-main outline-none"><option value="">No folder</option>{organization.folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select></label>
        <button type="button" onClick={downloadMarkdown} className={actionButton}><FileText className="h-3.5 w-3.5" />Markdown</button><button type="button" onClick={downloadJson} className={actionButton}><FileJson className="h-3.5 w-3.5" />JSON</button>
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
