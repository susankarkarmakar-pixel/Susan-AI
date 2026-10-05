"use client";

import { useEffect, useState } from "react";
import { Plus, Settings, X, Info, Home, MessageSquare, Bot, Globe2, FolderKanban, Workflow, Network, Puzzle, FileText, History, PanelLeftClose, PanelLeftOpen, CircleHelp, Search, ChevronDown, ChartNoAxesCombined } from "lucide-react";
import { cn } from "@/lib/utils";
import { PwaInstallButton } from "@/components/pwa/pwa-install-button";
import { getConversations, ConversationSummary } from "@/lib/chat-storage";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: "home" | "chat" | "agent" | "projects" | "workflows" | "knowledge" | "plugins" | "documents" | "history" | "usage";
  onNavigate: (section: SidebarProps["activeSection"]) => void;
  onSelectPinnedAgent: (agent: "General Assistant" | "Data & Report Agent" | "Study & Research Agent") => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  onOpenConversation: (id: string) => void;
  onOpenAbout: () => void;
  onOpenTour: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ isOpen, onClose, activeSection, onNavigate, onSelectPinnedAgent, onOpenSettings, onNewChat, onOpenConversation, onOpenAbout, onOpenTour, collapsed, onToggleCollapsed }: SidebarProps) {
  const [recentChats, setRecentChats] = useState<ConversationSummary[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const refreshRecentChats = () => setRecentChats(getConversations().slice(0, 5));
    const timer = window.setTimeout(refreshRecentChats, 0);
    window.addEventListener("conversations-updated", refreshRecentChats);
    return () => { window.clearTimeout(timer); window.removeEventListener("conversations-updated", refreshRecentChats); };
  }, []);

  const navigate = (section: SidebarProps["activeSection"]) => {
    onNavigate(section);
    if (window.innerWidth < 1024) onClose();
  };
  const choosePinnedAgent = (agent: "General Assistant" | "Data & Report Agent" | "Study & Research Agent") => {
    onSelectPinnedAgent(agent);
    if (window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-sidebar-cocoa text-white transition-[width,transform] duration-300 ease-in-out lg:static lg:inset-0", collapsed ? "w-[72px]" : "w-[292px]", isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")} aria-label="Main sidebar">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 custom-scrollbar sm:px-5" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <header className={cn("mb-5 flex items-center", collapsed ? "justify-center" : "justify-between") }>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/susan-ai-logo-sidebar-dark.png" alt="Susan AI — Sanket Pixel Technologies" className={cn("h-auto object-contain object-left", collapsed ? "w-9" : "w-[13.5rem]")} />
            <div className="flex items-center gap-1">
              <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden rounded-lg p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white lg:block">{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>
              <button type="button" onClick={onClose} aria-label="Close sidebar" className="rounded-lg p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white lg:hidden"><X className="h-5 w-5" /></button>
            </div>
          </header>

          <button type="button" onClick={() => { onNewChat(); onNavigate("chat"); if (window.innerWidth < 1024) onClose(); }} title="New Chat" className={cn("mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cream-highlight text-sm font-semibold text-sidebar-cocoa shadow-sm transition-colors hover:bg-white", collapsed ? "px-2 py-3" : "px-4 py-2.5")}><Plus className="h-4 w-4" />{!collapsed && "New Chat"}</button>

          <SidebarSectionLabel collapsed={collapsed}>Workspace</SidebarSectionLabel>
          <nav className="mb-4 space-y-0.5" aria-label="Workspace navigation">
            <SidebarNavItem icon={<Home className="h-4 w-4" />} label="Home" active={activeSection === "home"} collapsed={collapsed} onClick={() => navigate("home")} />
            <SidebarNavItem icon={<MessageSquare className="h-4 w-4" />} label="Chat" active={activeSection === "chat"} collapsed={collapsed} onClick={() => navigate("chat")} />
            <SidebarNavItem icon={<Globe2 className="h-4 w-4" />} label="Web Search" collapsed={collapsed} onClick={() => { window.dispatchEvent(new CustomEvent("open-search")); if (window.innerWidth < 1024) onClose(); }} />
            <SidebarNavItem icon={<Bot className="h-4 w-4" />} label="Agent Mode" active={activeSection === "agent"} collapsed={collapsed} onClick={() => navigate("agent")} />
            <div className={cn("mt-1 space-y-0.5 border-l border-white/10", collapsed ? "ml-5 pl-0" : "ml-4 pl-2") }>
              <PinnedAgent label="General Assistant" collapsed={collapsed} onClick={() => choosePinnedAgent("General Assistant")} />
              <PinnedAgent label="Data & Report Agent" collapsed={collapsed} onClick={() => choosePinnedAgent("Data & Report Agent")} />
              <PinnedAgent label="Study & Research Agent" collapsed={collapsed} onClick={() => choosePinnedAgent("Study & Research Agent")} />
            </div>
          </nav>

          {!collapsed && <div className="mb-2 flex items-center justify-between border-t border-white/10 pt-4"><SidebarSectionLabel collapsed={false}>Recent chats</SidebarSectionLabel><button type="button" onClick={() => navigate("history")} className="text-[10px] font-semibold text-cream-highlight transition-colors hover:text-white">View all</button></div>}
          {!collapsed && <div className="mb-4 space-y-0.5">{recentChats.length > 0 ? recentChats.map((chat) => <button key={chat.id} type="button" onClick={() => { onOpenConversation(chat.id); navigate("chat"); }} className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white/65 transition-colors hover:bg-white/10 hover:text-white"><MessageSquare className="h-3.5 w-3.5 shrink-0 text-white/35 group-hover:text-cream-highlight" /><span className="min-w-0 flex-1 truncate">{chat.title || "Untitled chat"}</span><span className="hidden text-[9px] text-white/35 group-hover:inline">{formatRecentDate(chat.date)}</span></button>) : <button type="button" onClick={() => navigate("history")} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white/45 transition-colors hover:bg-white/10 hover:text-white"><Search className="h-3.5 w-3.5" />No saved chats yet</button>}</div>}

          <div className="border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between"><SidebarSectionLabel collapsed={collapsed}>Library</SidebarSectionLabel>{!collapsed && <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-label={moreOpen ? "Collapse library" : "Expand library"} className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"><ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !moreOpen && "-rotate-90")} /></button>}</div>
            {(moreOpen || collapsed || ["workflows", "knowledge", "plugins", "usage"].includes(activeSection)) && <nav className="space-y-0.5" aria-label="Library navigation">
              <SidebarNavItem icon={<History className="h-4 w-4" />} label="History" active={activeSection === "history"} collapsed={collapsed} onClick={() => navigate("history")} />
              <SidebarNavItem icon={<FolderKanban className="h-4 w-4" />} label="Projects" active={activeSection === "projects"} collapsed={collapsed} onClick={() => navigate("projects")} />
              <SidebarNavItem icon={<FileText className="h-4 w-4" />} label="Documents" active={activeSection === "documents"} collapsed={collapsed} onClick={() => navigate("documents")} />
              <SidebarNavItem icon={<Network className="h-4 w-4" />} label="Knowledge Base" active={activeSection === "knowledge"} collapsed={collapsed} onClick={() => navigate("knowledge")} />
              <SidebarNavItem icon={<Workflow className="h-4 w-4" />} label="Workflows" active={activeSection === "workflows"} collapsed={collapsed} onClick={() => navigate("workflows")} />
              <SidebarNavItem icon={<Puzzle className="h-4 w-4" />} label="Plugins" active={activeSection === "plugins"} collapsed={collapsed} onClick={() => navigate("plugins")} />
              <SidebarNavItem icon={<ChartNoAxesCombined className="h-4 w-4" />} label="Usage & activity" active={activeSection === "usage"} collapsed={collapsed} onClick={() => navigate("usage")} />
            </nav>}
          </div>
        </div>

        <footer className={cn("flex shrink-0 flex-col gap-1 border-t border-white/10", collapsed ? "items-center p-3" : "p-4")} style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {!collapsed && <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Preferences & support</p>}
          <FooterAction icon={<Settings className="h-4 w-4" />} label="Settings" collapsed={collapsed} onClick={onOpenSettings} />
          <FooterAction icon={<CircleHelp className="h-4 w-4" />} label="Quick tour" collapsed={collapsed} onClick={onOpenTour} />
          <FooterAction icon={<Info className="h-4 w-4" />} label="About" collapsed={collapsed} onClick={onOpenAbout} />
          <PwaInstallButton collapsed={collapsed} />
          {!collapsed && <p className="mt-2 text-center text-[10px] text-white/35">© 2026 Sanket Pixel Technologies</p>}
        </footer>
      </aside>
    </>
  );
}

function SidebarSectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  return collapsed ? <span className="sr-only">{children}</span> : <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{children}</p>;
}

function SidebarNavItem({ icon, label, active = false, collapsed, onClick }: { icon: React.ReactNode; label: string; active?: boolean; collapsed: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={collapsed ? label : undefined} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={cn("group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors", collapsed && "justify-center px-2", active ? "bg-sidebar-cocoa-soft text-white shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white")}><span className={cn(active ? "text-cream-highlight" : "text-white/55 group-hover:text-white")}>{icon}</span>{!collapsed && <span>{label}</span>}</button>;
}

function PinnedAgent({ label, collapsed, onClick }: { label: "General Assistant" | "Data & Report Agent" | "Study & Research Agent"; collapsed: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/50 transition-colors hover:bg-white/10 hover:text-white", collapsed && "justify-center px-1")}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] text-cream-highlight">✦</span>{!collapsed && <span className="truncate">{label}</span>}</button>;
}

function FooterAction({ icon, label, collapsed, onClick }: { icon: React.ReactNode; label: string; collapsed: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} className={cn("flex items-center gap-2 rounded-xl p-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white", collapsed ? "justify-center" : "w-full px-2")}>{icon}{!collapsed && <span>{label}</span>}</button>;
}

function formatRecentDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
