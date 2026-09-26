"use client";

import { Plus, Settings, X, Info, Home, MessageSquare, Bot, FolderKanban, Workflow, Network, Puzzle, FileText, History, PanelLeftClose, PanelLeftOpen, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelSelector, ModelOption } from "./model-selector";
import { PwaInstallButton } from "@/components/pwa/pwa-install-button";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: "home" | "chat" | "agent" | "projects" | "workflows" | "knowledge" | "plugins" | "documents" | "history";
  onNavigate: (section: SidebarProps["activeSection"]) => void;
  onSelectPinnedAgent: (agent: "General Assistant" | "Data & Report Agent" | "Study & Research Agent") => void;
  onOpenSettings: () => void;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  onNewChat: () => void;
  onOpenAbout: () => void;
  onOpenTour: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  activeSection,
  onNavigate,
  onSelectPinnedAgent,
  onOpenSettings,
  selectedModel,
  onSelectModel,
  onNewChat,
  onOpenAbout,
  onOpenTour,
  collapsed,
  onToggleCollapsed
}: SidebarProps) {
  const navigate = (section: SidebarProps["activeSection"]) => {
    onNavigate(section);
    if (window.innerWidth < 1024) onClose();
  };
  const choosePinnedAgent = (agent: NonNullable<SidebarProps["onSelectPinnedAgent"]> extends (value: infer T) => void ? T : never) => {
    onSelectPinnedAgent(agent);
    if (window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 bg-sidebar-cocoa text-white flex flex-col transition-[width,transform] duration-300 ease-in-out border-r border-white/10",
        collapsed ? "w-[78px]" : "w-[300px]",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        "lg:static lg:inset-0"
      )}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 custom-scrollbar" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
          {/* Header */}
          <div className={cn("flex items-center mb-7", collapsed ? "justify-center" : "justify-between")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/susan-ai-logo-sidebar-dark.png"
              alt="Susan AI — Sanket Pixel Technologies"
              className={cn("h-auto max-h-20 object-contain object-left", collapsed ? "w-10" : "w-60 max-w-full")}
            />
            <div className="flex items-center gap-1">
              <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:block">
                {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
              <button type="button" onClick={onClose} aria-label="Close sidebar" className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Model Selector */}
          <div className="mb-5 [&>div>button]:shadow-none [&_svg]:text-cream-highlight">
            <ModelSelector selected={selectedModel} onSelect={onSelectModel} collapsed={collapsed} />
          </div>

          {/* New Chat Button */}
          <button
            onClick={() => {
              onNewChat();
              onNavigate("chat");
              if (window.innerWidth < 1024) onClose();
            }}
            title="New Chat"
            className={cn("w-full flex items-center justify-center gap-2 rounded-full bg-cream-highlight text-sidebar-cocoa shadow-sm hover:bg-white transition-colors mb-6 text-sm font-semibold", collapsed ? "px-2 py-3" : "px-4 py-3")}
          >
            <Plus className="w-4 h-4" />
            {!collapsed && "New Chat"}
          </button>

          <nav className="mb-5 space-y-1" aria-label="Primary navigation">
            <SidebarNavItem icon={<Home className="h-4 w-4" />} label="Home" active={activeSection === "home"} collapsed={collapsed} onClick={() => navigate("home")} />
            <SidebarNavItem icon={<MessageSquare className="h-4 w-4" />} label="Chat" active={activeSection === "chat"} collapsed={collapsed} onClick={() => navigate("chat")} />
            <SidebarNavItem icon={<Bot className="h-4 w-4" />} label="Agent Mode" active={activeSection === "agent"} collapsed={collapsed} onClick={() => navigate("agent")} />
            <SidebarNavItem icon={<FolderKanban className="h-4 w-4" />} label="Projects" active={activeSection === "projects"} collapsed={collapsed} onClick={() => navigate("projects")} />
            <SidebarNavItem icon={<Workflow className="h-4 w-4" />} label="Workflows" active={activeSection === "workflows"} collapsed={collapsed} onClick={() => navigate("workflows")} />
            <SidebarNavItem icon={<Network className="h-4 w-4" />} label="Knowledge Base" active={activeSection === "knowledge"} collapsed={collapsed} onClick={() => navigate("knowledge")} />
            <SidebarNavItem icon={<Puzzle className="h-4 w-4" />} label="Plugins" active={activeSection === "plugins"} collapsed={collapsed} onClick={() => navigate("plugins")} />
            <SidebarNavItem icon={<FileText className="h-4 w-4" />} label="Documents" active={activeSection === "documents"} collapsed={collapsed} onClick={() => navigate("documents")} />
            <SidebarNavItem icon={<History className="h-4 w-4" />} label="History" active={activeSection === "history"} collapsed={collapsed} onClick={() => navigate("history")} />
          </nav>
          {!collapsed && <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45"><span>Pinned agents</span><span>⌃</span></div>}
          <div className={cn("mb-4 space-y-1", collapsed && "mb-2")}>
            <PinnedAgent label="General Assistant" collapsed={collapsed} onClick={() => choosePinnedAgent("General Assistant")} />
            <PinnedAgent label="Data & Report Agent" collapsed={collapsed} onClick={() => choosePinnedAgent("Data & Report Agent")} />
            <PinnedAgent label="Study & Research Agent" collapsed={collapsed} onClick={() => choosePinnedAgent("Study & Research Agent")} />
          </div>

        </div>

        {/* Footer */}
        <div className={cn("border-t border-white/10 flex flex-col gap-2", collapsed ? "items-center p-3" : "p-5")} style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <button
            onClick={onOpenSettings}
            title="Settings"
            className={cn("flex items-center gap-2 text-white/75 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 text-sm font-medium", collapsed ? "justify-center" : "w-full")}
          >
            <Settings className="w-4 h-4" />
            {!collapsed && <span>Settings</span>}
          </button>
          <button
            onClick={onOpenTour}
            title="Quick tour"
            className={cn("flex items-center gap-2 text-white/75 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 text-sm font-medium", collapsed ? "justify-center" : "w-full")}
          >
            <CircleHelp className="w-4 h-4" />
            {!collapsed && <span>Quick tour</span>}
          </button>
          <button
            onClick={onOpenAbout}
            title="About"
            className={cn("flex items-center gap-2 text-white/75 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 text-sm font-medium", collapsed ? "justify-center" : "w-full")}
          >
            <Info className="w-4 h-4" />
            {!collapsed && <span>About</span>}
          </button>
          <PwaInstallButton collapsed={collapsed} />
          {!collapsed && <div className="text-center text-[10px] text-white/40">
            © 2026 Sanket Pixel Technologies
          </div>}
        </div>
      </div>
    </>
  );
}

function SidebarNavItem({ icon, label, active = false, collapsed, onClick }: { icon: React.ReactNode; label: string; active?: boolean; collapsed: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={collapsed ? label : undefined} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors", collapsed && "justify-center px-2", active ? "bg-sidebar-cocoa-soft text-white" : "text-white/70 hover:bg-white/10 hover:text-white")}><span className={active ? "text-cream-highlight" : "text-white/65"}>{icon}</span>{!collapsed && <span>{label}</span>}</button>;
}

function PinnedAgent({ label, collapsed, onClick }: { label: "General Assistant" | "Data & Report Agent" | "Study & Research Agent"; collapsed: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white", collapsed && "justify-center px-2")}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-cream-highlight">✦</span>{!collapsed && <span className="truncate">{label}</span>}</button>;
}
