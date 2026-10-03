"use client";
import { BarChart3, ClipboardList, FileText, Maximize2, Minimize2, Table2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentTask } from "@/lib/agent/types";
import { CsvTableSummary, SheetTableSummary } from "@/lib/agent/tools/file-analysis";
import { DataPreviewTable } from "@/components/agent/data-preview-table";
import { VisualizationPanel } from "@/components/agent/visualization-panel";
import { ReportExportActions } from "@/components/agent/report-export-actions";

type OutputTab = "charts" | "data" | "findings" | "report";
type Execution = { message: string; output?: string; table?: CsvTableSummary; sheetTables?: SheetTableSummary[]; ok: boolean } | null;

export function AgentOutputWorkspace({ task, execution }: { task: AgentTask; execution: Execution }) {
  const [tab, setTab] = useState<OutputTab>(execution?.table ? "charts" : "findings");
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);
  const tabs: Array<{ id: OutputTab; label: string; icon: React.ReactNode }> = [
    { id: "charts", label: "Charts", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "data", label: "Data Preview", icon: <Table2 className="h-3.5 w-3.5" /> },
    { id: "findings", label: "Findings", icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { id: "report", label: "Report Draft", icon: <FileText className="h-3.5 w-3.5" /> },
  ];
  return <section role={isFullscreen ? "dialog" : undefined} aria-modal={isFullscreen ? true : undefined} aria-label="Agent live output workspace" className={isFullscreen ? "fixed inset-0 z-50 flex min-h-0 w-full flex-col bg-bg-main p-3 md:p-8" : "mx-auto w-full max-w-5xl px-4 pb-3 md:px-8"}>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-main/70 bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-main/60 px-4 py-3">
        <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-highlight text-accent"><BarChart3 className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-text-main">Live Output</h2><p className="text-[10px] text-text-muted">Workspace results update as Susan AI executes the plan.</p></div></div>
        <div className="flex items-center gap-1.5"><button type="button" onClick={() => setIsFullscreen((current) => !current)} aria-label={isFullscreen ? "Exit full screen" : "View output full screen"} className="flex items-center gap-1.5 rounded-lg border border-border-main/70 px-2.5 py-1.5 text-[10px] font-semibold text-text-muted hover:bg-black/5 hover:text-text-main">{isFullscreen ? <><Minimize2 className="h-3 w-3" />Exit full screen</> : <><Maximize2 className="h-3 w-3" />View full screen</>}</button>{isFullscreen && <button type="button" onClick={() => setIsFullscreen(false)} aria-label="Close full screen output" className="rounded-lg p-1.5 text-text-muted hover:bg-black/5 hover:text-text-main"><X className="h-4 w-4" /></button>}</div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border-main/50 px-3 pt-2">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${tab === item.id ? "bg-cream-highlight text-accent" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`}>{item.icon}{item.label}</button>)}</div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === "charts" && <VisualizationPanel table={execution?.table} sheetTables={execution?.sheetTables} />}
        {tab === "data" && (execution?.table ? <DataPreviewTable table={execution.table} sheetTables={execution.sheetTables} /> : <WorkspaceEmpty title="Data preview will appear here" description="Attach a CSV, PDF, DOCX, or XLSX file to inspect extracted data." />)}
        {tab === "findings" && <div className="rounded-xl border border-border-main/70 bg-bg-main p-4"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Analysis findings</p><p className="mt-2 text-sm leading-6 text-text-main">{execution?.output || execution?.message || "Start the task to see findings, quality checks, and recommendations here."}</p>{execution?.ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">The latest agent step completed successfully.</p>}</div>}
        {tab === "report" && <div className="space-y-3"><div className="rounded-xl border border-border-main/70 bg-bg-main p-4"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-accent" /><p className="text-sm font-semibold text-text-main">{task.goal}</p></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-text-muted">{execution?.output || "The report draft will be assembled from the completed analysis steps."}</p></div><ReportExportActions task={task} output={execution?.output} table={execution?.table} /></div>}
      </div>
    </div>
  </section>;
}
function WorkspaceEmpty({ title, description }: { title: string; description: string }) { return <div className="flex min-h-[170px] flex-col items-center justify-center rounded-xl border border-dashed border-border-main bg-bg-main p-5 text-center"><Table2 className="h-5 w-5 text-accent" /><p className="mt-2 text-sm font-semibold text-text-main">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-text-muted">{description}</p></div>; }
