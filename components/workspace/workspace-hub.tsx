"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Archive, ArrowRight, BookOpen, Check, CheckCircle2, CircleHelp, Database, FileText, FolderKanban, KeyRound, Loader2, Menu, Plug, Plus, Search, Sparkles, Trash2, Upload, Workflow, Wrench, XCircle } from "lucide-react";
import { createDefaultToolRegistry } from "@/lib/agent/tools";
import { getKeys } from "@/lib/key-storage";
import { MODELS_METADATA, PROVIDERS } from "@/lib/ai-providers";
import { getCustomProviders } from "@/lib/custom-providers";
import { clearPluginActivities, isPluginToolEnabled, listPluginActivities, PluginActivity, recordPluginActivity, setPluginToolEnabled } from "@/lib/plugin-settings";
import { deleteKnowledgeNote, deleteProject, getKnowledgeNotes, getProjects, KnowledgeNote, saveKnowledgeNote, saveProject, setProjectStatus, WorkspaceProject } from "@/lib/workspace-storage";
import { deleteWorkspaceDocument, getWorkspaceDocumentBlob, isSupportedWorkspaceDocument, listWorkspaceDocuments, saveWorkspaceDocument, WorkspaceDocument } from "@/lib/document-storage";
import { AgentAttachment } from "@/lib/agent/types";

export type WorkspaceSection = "home" | "chat" | "agent" | "projects" | "workflows" | "knowledge" | "plugins" | "documents" | "history";

interface WorkspaceHubProps {
  section: Extract<WorkspaceSection, "projects" | "workflows" | "knowledge" | "plugins" | "documents">;
  onStartAgent: (goal: string, attachments?: AgentAttachment[]) => void;
  onOpenChat: (prompt: string) => void;
  onOpenSettings: () => void;
  onOpenSection: (section: WorkspaceSection) => void;
  onOpenSidebar: () => void;
}

const WORKFLOWS = [
  { id: "calculator", name: "Calculate & explain", description: "Run a safe calculation and get a clear, worked explanation.", goal: "Calculate 125 * 4 and explain the result.", icon: Activity, tag: "Calculator tool" },
  { id: "file-analysis", name: "Analyze a document", description: "Inspect a supported file, preview its contents, and summarize its structure.", goal: "Analyze the attached file and summarize its key findings, structure, and any data-quality issues.", icon: FileText, tag: "File analysis tool" },
];

export function WorkspaceHub({ section, onStartAgent, onOpenChat, onOpenSettings, onOpenSection, onOpenSidebar }: WorkspaceHubProps) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);
  useEffect(() => {
    window.addEventListener("workspace-data-updated", refresh);
    return () => window.removeEventListener("workspace-data-updated", refresh);
  }, [refresh]);

  switch (section) {
    case "projects": return <ProjectsWorkspace refreshVersion={refreshVersion} onOpenChat={onOpenChat} onOpenSidebar={onOpenSidebar} />;
    case "workflows": return <WorkflowsWorkspace onStartAgent={onStartAgent} onOpenSection={onOpenSection} onOpenSidebar={onOpenSidebar} />;
    case "knowledge": return <KnowledgeWorkspace refreshVersion={refreshVersion} onOpenSidebar={onOpenSidebar} />;
    case "plugins": return <PluginsWorkspace onOpenSettings={onOpenSettings} onStartAgent={onStartAgent} onOpenSection={onOpenSection} onOpenSidebar={onOpenSidebar} />;
    case "documents": return <DocumentsWorkspace onStartAgent={onStartAgent} onOpenSidebar={onOpenSidebar} />;
  }
}

function ProjectsWorkspace({ refreshVersion, onOpenChat, onOpenSidebar }: { refreshVersion: number; onOpenChat: (prompt: string) => void; onOpenSidebar: () => void }) {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setProjects(getProjects()), 0); return () => window.clearTimeout(timer); }, [refreshVersion]);
  const visible = projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(filter.toLowerCase()));
  const create = (event: React.FormEvent) => {
    event.preventDefault();
    try { saveProject({ name, description }); setName(""); setDescription(""); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save that project."); }
  };
  return <WorkspaceFrame onOpenSidebar={onOpenSidebar} icon={FolderKanban} eyebrow="Workspace" title="Projects" description="Keep related work organized in this browser. Your projects are private to this device." action={<span className="rounded-full bg-cream-highlight px-3 py-1 text-xs font-semibold text-accent">{projects.length} saved</span>}>
    <form onSubmit={create} className="mb-6 rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-main"><Plus className="h-4 w-4 text-accent" />Create a project</div>
      <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Project name" aria-label="Project name" className={inputClass} /><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="What are you working on? (optional)" aria-label="Project description" className={inputClass} /><button type="submit" disabled={!name.trim()} className={primaryButton}><Plus className="h-4 w-4" />Add project</button></div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
    <div className="mb-3 flex items-center gap-2"><Search className="h-4 w-4 text-text-muted" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter projects" aria-label="Filter projects" className="w-full max-w-sm rounded-lg border border-border-main/70 bg-surface px-3 py-2 text-sm outline-none focus:border-accent/50" /></div>
    {visible.length ? <div className="grid gap-3 md:grid-cols-2">{visible.map((project) => <ProjectCard key={project.id} project={project} onOpenChat={onOpenChat} />)}</div> : <EmptyState icon={FolderKanban} title={filter ? "No matching projects" : "Your project space is ready"} body={filter ? "Try another search." : "Create a project above to keep a goal and its next steps in one place."} />}
  </WorkspaceFrame>;
}

function ProjectCard({ project, onOpenChat }: { project: WorkspaceProject; onOpenChat: (prompt: string) => void }) {
  const complete = project.status === "complete";
  return <article className="rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-highlight text-accent"><FolderKanban className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-text-main">{project.name}</h2><p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-text-muted">{project.description || "No project description yet."}</p></div><button type="button" onClick={() => setProjectStatus(project.id, complete ? "active" : "complete")} title={complete ? "Reopen project" : "Mark project complete"} aria-label={complete ? `Reopen ${project.name}` : `Complete ${project.name}`} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${complete ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"}`}>{complete ? "Complete" : "Active"}</button></div><div className="mt-4 flex items-center justify-between border-t border-border-main/50 pt-3"><button type="button" onClick={() => onOpenChat(`Help me make progress on the project “${project.name}”. ${project.description}`.trim())} className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"><Sparkles className="h-3.5 w-3.5" />Discuss with AI</button><button type="button" onClick={() => deleteProject(project.id)} aria-label={`Delete ${project.name}`} title="Delete project" className="rounded-lg p-2 text-text-muted hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></div></article>;
}

function WorkflowsWorkspace({ onStartAgent, onOpenSection, onOpenSidebar }: { onStartAgent: (goal: string) => void; onOpenSection: (section: WorkspaceSection) => void; onOpenSidebar: () => void }) {
  return <WorkspaceFrame onOpenSidebar={onOpenSidebar} icon={Workflow} eyebrow="Repeatable tasks" title="Workflows" description="Start a guided task using the tools that are actually available in Susan AI."><div className="grid gap-4 lg:grid-cols-2">{WORKFLOWS.map((workflow) => { const Icon = workflow.icon; return <article key={workflow.id} className="rounded-2xl border border-border-main/70 bg-surface p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Icon className="h-5 w-5" /></span><div><h2 className="font-semibold text-text-main">{workflow.name}</h2><p className="mt-1 text-sm leading-6 text-text-muted">{workflow.description}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-border-main/50 pt-3"><span className="rounded-full bg-bg-main px-2.5 py-1 text-[10px] font-medium text-text-muted">{workflow.tag}</span><button type="button" onClick={() => workflow.id === "file-analysis" ? onOpenSection("documents") : onStartAgent(workflow.goal)} className={secondaryButton}>{workflow.id === "file-analysis" ? "Choose a document" : "Start workflow"}<ArrowRight className="h-3.5 w-3.5" /></button></div></article>; })}</div><div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0" /><p>Workflows are saved as guided task plans; file-analysis tasks use a document you choose from the Documents workspace. No workflow runs external actions without your input.</p></div></WorkspaceFrame>;
}

function KnowledgeWorkspace({ refreshVersion, onOpenSidebar }: { refreshVersion: number; onOpenSidebar: () => void }) {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setNotes(getKnowledgeNotes()), 0); return () => window.clearTimeout(timer); }, [refreshVersion]);
  const visible = notes.filter((note) => `${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const reset = () => { setEditingId(undefined); setTitle(""); setContent(""); setTags(""); setError(null); };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    try { saveKnowledgeNote({ title, content, tags: tags.split(",") }, editingId); reset(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this note."); }
  };
  const edit = (note: KnowledgeNote) => { setEditingId(note.id); setTitle(note.title); setContent(note.content); setTags(note.tags.join(", ")); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <WorkspaceFrame onOpenSidebar={onOpenSidebar} icon={BookOpen} eyebrow="Private notes" title="Knowledge Base" description="Save searchable notes and reference material locally on this device.">
    <form onSubmit={save} className="mb-6 rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-text-main"><Database className="h-4 w-4 text-accent" />{editingId ? "Edit note" : "Add a knowledge note"}</div>{editingId && <button type="button" onClick={reset} className="text-xs font-medium text-text-muted hover:text-text-main">Cancel edit</button>}</div><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Note title" aria-label="Note title" className={`${inputClass} mb-3`} /><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000} rows={4} placeholder="Write down useful facts, project context, or ideas…" aria-label="Note content" className={`${inputClass} resize-y`} /><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags, separated by commas" aria-label="Note tags" className={`${inputClass} flex-1`} /><button type="submit" disabled={!title.trim() || !content.trim()} className={primaryButton}>{editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? "Save changes" : "Save note"}</button></div>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</form>
    <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, notes, and tags" aria-label="Search knowledge notes" className="w-full max-w-md rounded-lg border border-border-main/70 bg-surface px-3 py-2 text-sm outline-none focus:border-accent/50" /></div>
    {visible.length ? <div className="space-y-3">{visible.map((note) => <article key={note.id} className="rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold text-text-main">{note.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">{note.content}</p>{note.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{note.tags.map((tag) => <span key={tag} className="rounded-full bg-cream-highlight px-2 py-0.5 text-[10px] font-medium text-accent">{tag}</span>)}</div>}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => edit(note)} title="Edit note" aria-label={`Edit ${note.title}`} className="rounded-lg p-2 text-text-muted hover:bg-cream-highlight hover:text-accent"><FileText className="h-4 w-4" /></button><button type="button" onClick={() => deleteKnowledgeNote(note.id)} title="Delete note" aria-label={`Delete ${note.title}`} className="rounded-lg p-2 text-text-muted hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></div></div></article>)}</div> : <EmptyState icon={BookOpen} title={query ? "No matching notes" : "Nothing saved yet"} body={query ? "Try another search term." : "Add your first private note above. Notes never leave this browser."} />}
  </WorkspaceFrame>;
}

function PluginsWorkspace({ onOpenSettings, onStartAgent, onOpenSection, onOpenSidebar }: { onOpenSettings: () => void; onStartAgent: (goal: string) => void; onOpenSection: (section: WorkspaceSection) => void; onOpenSidebar: () => void }) {
  const [keys, setKeys] = useState<Record<string, string | undefined>>({});
  const [customProviders, setCustomProviders] = useState<ReturnType<typeof getCustomProviders>>([]);
  const [toolStates, setToolStates] = useState<Record<string, boolean>>({});
  const [activities, setActivities] = useState<PluginActivity[]>([]);
  const [testStates, setTestStates] = useState<Record<string, { state: "testing" | "connected" | "failed"; message: string }>>({});
  const [testingIds, setTestingIds] = useState<string[]>([]);
  const tools = useMemo(() => createDefaultToolRegistry().list(), []);

  useEffect(() => {
    const refreshKeys = () => {
      setKeys(getKeys());
      setCustomProviders(getCustomProviders());
      setTestStates({});
    };
    const refreshToolSettings = () => setToolStates(Object.fromEntries(tools.map((tool) => [tool.id, isPluginToolEnabled(tool.id)])));
    const refreshActivity = () => setActivities(listPluginActivities());
    const initialTimer = window.setTimeout(() => { refreshKeys(); refreshToolSettings(); refreshActivity(); }, 0);
    window.addEventListener("keys-updated", refreshKeys);
    window.addEventListener("custom-providers-updated", refreshKeys);
    window.addEventListener("plugin-settings-updated", refreshToolSettings);
    window.addEventListener("plugin-activity-updated", refreshActivity);
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("keys-updated", refreshKeys);
      window.removeEventListener("custom-providers-updated", refreshKeys);
      window.removeEventListener("plugin-settings-updated", refreshToolSettings);
      window.removeEventListener("plugin-activity-updated", refreshActivity);
    };
  }, [tools]);

  const testProvider = async (providerId: string, label: string, asyncProvider = false, customProvider?: ReturnType<typeof getCustomProviders>[number]) => {
    const isLocal = customProvider?.requiresApiKey === false;
    const apiKey = keys[providerId]?.trim() || (isLocal ? "local" : "");
    if (!apiKey || testingIds.includes(providerId)) return;
    setTestingIds((current) => [...current, providerId]);
    setTestStates((current) => ({ ...current, [providerId]: { state: "testing", message: "Checking connection…" } }));
    try {
      const response = await fetch(asyncProvider ? "/api/jules" : "/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(asyncProvider ? { action: "list-sources", apiKey } : { provider: providerId, apiKey, ...(providerId === "cloudflare" ? { cloudflareAccountId: keys.cloudflareAccountId || "" } : {}), ...(customProvider ? { customProvider } : {}) }),
      });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result && typeof result === "object" && typeof (result as { error?: unknown }).error === "string" ? (result as { error: string }).error : `Test failed (HTTP ${response.status}).`);
      const sourceCount = asyncProvider && result && typeof result === "object" && Array.isArray((result as { sources?: unknown }).sources) ? (result as { sources: unknown[] }).sources.length : undefined;
      const message = typeof sourceCount === "number" ? sourceCount > 0 ? `Connected · ${sourceCount} Jules source${sourceCount === 1 ? "" : "s"}.` : "API key accepted; no Jules repositories are connected yet." : "Connection verified with a small test request.";
      setTestStates((current) => ({ ...current, [providerId]: { state: "connected", message } }));
      recordPluginActivity({ kind: "provider-test", itemId: providerId, label, ok: true, message });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not test this provider.";
      setTestStates((current) => ({ ...current, [providerId]: { state: "failed", message } }));
      recordPluginActivity({ kind: "provider-test", itemId: providerId, label, ok: false, message });
    } finally {
      setTestingIds((current) => current.filter((id) => id !== providerId));
    }
  };

  const providers = [
    ...PROVIDERS.filter((provider) => provider !== "manus").map((provider) => ({ id: provider, label: MODELS_METADATA[provider].name, description: MODELS_METADATA[provider].description, async: provider === "jules", model: MODELS_METADATA[provider].model })),
    ...customProviders.map((provider) => ({ id: provider.id, label: provider.name, description: `${provider.local ? "Local endpoint" : "Custom endpoint"} · ${provider.model}`, async: false, model: provider.model, customProvider: provider })),
    { id: "manus", label: MODELS_METADATA.manus.name, description: "Asynchronous tasks; connection testing is not supported here.", async: false, model: MODELS_METADATA.manus.model, unsupported: true },
  ];

  return <WorkspaceFrame onOpenSidebar={onOpenSidebar} icon={Plug} eyebrow="Connections & tools" title="Plugins" description="Manage AI provider connections and the local tools Agent Mode may use. Third-party plugin installation is not enabled in this version.">
    <section className="mb-7">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold text-text-main">AI providers</h2><p className="mt-1 text-xs leading-5 text-text-muted">Saved-key status is separate from a verified connection. Testing sends a tiny request that may use provider quota or incur a small charge.</p></div><button type="button" onClick={onOpenSettings} className={secondaryButton}><Plug className="h-3.5 w-3.5" />Manage keys</button></div>
      <div className="grid gap-3 lg:grid-cols-2">{providers.map((provider) => <ProviderCard key={provider.id} provider={provider} keySaved={Boolean(("customProvider" in provider && provider.customProvider?.requiresApiKey === false) || (keys[provider.id]?.trim() && (provider.id !== "cloudflare" || keys.cloudflareAccountId?.trim())))} test={testStates[provider.id]} testing={testingIds.includes(provider.id)} onTest={() => void testProvider(provider.id, provider.label, provider.async, "customProvider" in provider ? provider.customProvider : undefined)} onManage={onOpenSettings} />)}</div>
    </section>
    <section className="mb-7">
      <div className="mb-3"><h2 className="font-semibold text-text-main">Built-in agent tools</h2><p className="mt-1 text-xs leading-5 text-text-muted">Turn tools on or off for Agent Mode. Current tools are read-only and do not change files or external accounts.</p></div>
      <div className="grid gap-3 md:grid-cols-2">{tools.map((tool) => {
        const enabled = toolStates[tool.id] ?? true;
        return <article key={tool.id} className="rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-text-muted"}`}><Wrench className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-text-main">{tool.name}</h3><label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-muted"><span>{enabled ? "Enabled" : "Disabled"}</span><input type="checkbox" role="switch" aria-label={`${enabled ? "Disable" : "Enable"} ${tool.name}`} checked={enabled} onChange={(event) => setPluginToolEnabled(tool.id, event.target.checked)} className="h-4 w-4 accent-accent" /></label></div><p className="mt-1 text-sm leading-5 text-text-muted">{tool.description}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-cream-highlight px-2 py-0.5 text-[10px] font-semibold text-accent">Permission: {tool.permission}</span><span className="rounded-full bg-bg-main px-2 py-0.5 text-[10px] text-text-muted">{tool.id === "calculator" ? "No network access" : "Local file read only"}</span></div>{enabled && <button type="button" onClick={() => tool.id === "calculator" ? onStartAgent("Calculate 125 * 4 and explain the result.") : onOpenSection("documents")} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">{tool.id === "calculator" ? "Try this tool" : "Choose a file"}<ArrowRight className="h-3 w-3" /></button>}</div></div></article>;
      })}</div>
    </section>
    <ActivityPanel activities={activities} onClear={clearPluginActivities} onManageKeys={onOpenSettings} />
  </WorkspaceFrame>;
}

function ProviderCard({ provider, keySaved, test, testing, onTest, onManage }: { provider: { id: string; label: string; description: string; async: boolean; model: string; unsupported?: boolean }; keySaved: boolean; test?: { state: "testing" | "connected" | "failed"; message: string }; testing: boolean; onTest: () => void; onManage: () => void }) {
  const statusText = provider.unsupported ? "Not testable" : !keySaved ? "Key not added" : test?.state === "testing" ? "Testing…" : test?.state === "connected" ? "Verified" : test?.state === "failed" ? "Needs attention" : "Key saved · not tested";
  const statusClass = test?.state === "connected" ? "bg-emerald-50 text-emerald-800" : test?.state === "failed" || (keySaved && !test && provider.id === "jules") ? "bg-amber-50 text-amber-900" : "bg-bg-main text-text-muted";
  return <article className="rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-text-main">{provider.label}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{statusText}</span></div><p className="mt-1 text-xs leading-5 text-text-muted">{provider.description}</p><p className="mt-1 truncate text-[10px] text-text-muted">{provider.async ? "Asynchronous connection" : `Model: ${provider.model}`}</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent">{test?.state === "connected" ? <CheckCircle2 className="h-4 w-4" /> : test?.state === "failed" ? <XCircle className="h-4 w-4" /> : <Plug className="h-4 w-4" />}</span></div>{test && test.state !== "testing" && <p role={test.state === "failed" ? "alert" : undefined} className={`mt-2 text-xs leading-5 ${test.state === "failed" ? "text-red-700" : "text-emerald-800"}`}>{test.message}</p>}<div className="mt-3 flex gap-2">{keySaved && !provider.unsupported ? <button type="button" onClick={onTest} disabled={testing} className={secondaryButton}>{testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}Test connection</button> : <button type="button" onClick={onManage} className={secondaryButton}>{provider.unsupported ? "Manage key" : "Add API key"}</button>}</div></article>;
}

function ActivityPanel({ activities, onClear, onManageKeys }: { activities: PluginActivity[]; onClear: () => void; onManageKeys: () => void }) {
  return <section className="rounded-2xl border border-border-main/70 bg-surface p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="font-semibold text-text-main">Recent plugin activity</h2><p className="mt-1 text-xs text-text-muted">Stores only provider/tool labels, outcome and time—never keys, prompts, file contents or tool outputs.</p></div>{activities.length > 0 && <button type="button" onClick={onClear} className="shrink-0 text-xs font-medium text-text-muted hover:text-red-700">Clear history</button>}</div>{activities.length ? <ul className="space-y-2">{activities.slice(0, 10).map((item) => <li key={item.id} className="flex items-start gap-2 rounded-lg bg-bg-main p-2.5"><span className={item.ok ? "mt-0.5 text-emerald-700" : "mt-0.5 text-red-700"}>{item.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text-main">{item.label} · {item.kind === "provider-test" ? "connection test" : "tool run"}</p><p className="mt-0.5 text-xs leading-5 text-text-muted">{item.message}</p></div><time className="shrink-0 text-[10px] text-text-muted" dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString()}</time></li>)}</ul> : <div className="rounded-lg bg-bg-main px-3 py-4"><p className="text-sm text-text-muted">No checks or tool runs yet. Add a provider key and test its connection, or try one of the built-in tools above.</p><button type="button" onClick={onManageKeys} className={`${secondaryButton} mt-3`}><KeyRound className="h-3.5 w-3.5" />Add or manage API keys</button></div>}</section>;
}


function DocumentsWorkspace({ onStartAgent, onOpenSidebar }: { onStartAgent: (goal: string, attachments?: AgentAttachment[]) => void; onOpenSidebar: () => void }) {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { try { setDocuments(await listWorkspaceDocuments()); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read local documents."); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const visible = documents.filter((document) => document.name.toLowerCase().includes(searchText.toLowerCase()));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!isSupportedWorkspaceDocument(file)) throw new Error(`${file.name}: use TXT, Markdown, CSV, JSON, PDF, DOCX, or XLSX.`);
        await saveWorkspaceDocument(file);
      }
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the document."); }
    finally { setBusy(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };
  const download = async (document: WorkspaceDocument) => {
    try {
      const blob = await getWorkspaceDocumentBlob(document.id);
      if (!blob) throw new Error("This document is no longer available in local storage.");
      const url = URL.createObjectURL(blob); const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = document.name; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not download the document."); }
  };
  const analyze = async (document: WorkspaceDocument) => {
    try {
      const blob = await getWorkspaceDocumentBlob(document.id);
      if (!blob) throw new Error("This document is no longer available in local storage.");
      const file = new File([blob], document.name, { type: document.mediaType });
      const dataUrl = await readAsDataUrl(file);
      const attachment: AgentAttachment = { id: crypto.randomUUID(), filename: file.name, mediaType: file.type || "application/octet-stream", sizeBytes: file.size, dataUrl };
      onStartAgent(`Analyze the attached file “${file.name}” and summarize its structure, key findings, and any data-quality issues.`, [attachment]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not prepare the document for analysis."); }
  };
  const remove = async (document: WorkspaceDocument) => { try { await deleteWorkspaceDocument(document.id); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this document."); } };
  return <WorkspaceFrame onOpenSidebar={onOpenSidebar} icon={Archive} eyebrow="Local files" title="Documents" description="Upload a supported file to keep it in this browser, download it later, or send it to the Agent for analysis." action={<button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className={primaryButton}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload files</button>}>
    <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx" className="sr-only" onChange={(event) => void upload(event.target.files)} />
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border-main/60 bg-bg-main px-4 py-3 text-xs text-text-muted"><span>TXT · MD · CSV · JSON · PDF · DOCX · XLSX · up to 4 MB per file</span><span className="shrink-0">{documents.length} saved</span></div>
    <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-text-muted" /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search documents" aria-label="Search documents" className="w-full max-w-md rounded-lg border border-border-main/70 bg-surface px-3 py-2 text-sm outline-none focus:border-accent/50" /></div>
    {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" />Loading local documents…</div> : visible.length ? <div className="space-y-2">{visible.map((document) => <article key={document.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-main/70 bg-surface p-3 shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream-highlight text-accent"><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-text-main">{document.name}</h2><p className="mt-0.5 text-[10px] text-text-muted">{formatBytes(document.sizeBytes)} · Added {new Date(document.addedAt).toLocaleDateString()}</p></div><button type="button" onClick={() => void analyze(document)} className="rounded-lg border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-cream-highlight hover:text-accent">Analyze</button><button type="button" onClick={() => void download(document)} className="rounded-lg border border-border-main/70 px-3 py-2 text-xs font-semibold text-text-main hover:bg-bg-main">Download</button><button type="button" onClick={() => void remove(document)} aria-label={`Delete ${document.name}`} title="Delete document" className="rounded-lg p-2 text-text-muted hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></article>)}</div> : <EmptyState icon={Archive} title={searchText ? "No matching documents" : "No documents saved"} body={searchText ? "Try another search term." : "Upload a small document to keep it available in this browser and optionally analyze it with the Agent."} />}
  </WorkspaceFrame>;
}

function WorkspaceFrame({ icon: Icon, eyebrow, title, description, action, children, onOpenSidebar }: { icon: typeof FolderKanban; eyebrow: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode; onOpenSidebar: () => void }) {
  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main"><header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border-main/50 bg-bg-main/95 px-3 py-3 backdrop-blur-sm sm:gap-4 sm:px-5 md:px-8" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}><button type="button" onClick={onOpenSidebar} aria-label="Open sidebar" className="-ml-1 shrink-0 rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-main lg:hidden"><Menu className="h-5 w-5" /></button><div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-highlight text-accent"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p><h1 className="truncate text-lg font-semibold text-text-main">{title}</h1></div></div>{action}</header><main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 md:px-8 md:py-8"><p className="mb-6 max-w-3xl text-sm leading-6 text-text-muted">{description}</p>{children}</main><footer className="border-t border-border-main/50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] text-text-muted md:px-8">Saved on this device · Susan AI</footer></div>;
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof FolderKanban; title: string; body: string }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-main/80 bg-surface/60 px-5 py-12 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><Icon className="h-6 w-6" /></span><h2 className="mt-4 font-semibold text-text-main">{title}</h2><p className="mt-1 max-w-md text-sm leading-6 text-text-muted">{body}</p></div>;
}

const inputClass = "w-full rounded-lg border border-border-main/70 bg-bg-main px-3 py-2.5 text-sm text-text-main outline-none placeholder:text-text-muted/60 focus:border-accent/50 focus:ring-2 focus:ring-accent/10";
const primaryButton = "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sidebar-cocoa px-3.5 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "inline-flex items-center gap-1.5 rounded-lg border border-border-main/70 bg-surface px-3 py-2 text-xs font-semibold text-text-main hover:border-accent/40 hover:bg-cream-highlight hover:text-accent";

function formatBytes(bytes: number): string { return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`; }
function readAsDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); }); }
