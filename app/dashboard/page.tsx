"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, Clock3, FileSearch, Globe2, MessageSquare, Plus, Settings2, UserRound, Workflow } from "lucide-react";
import { getConversations, type ConversationSummary } from "@/lib/chat-storage";

interface UserProfile { name: string; email: string; picture?: string }

const quickActions = [
  { title: "Start a new chat", description: "Ask anything with your preferred AI model.", href: "/?new=1", icon: MessageSquare, tone: "bg-[#f4e4cc] text-[#8d5938]" },
  { title: "Search the web", description: "Find current answers across trusted sources.", href: "/?mode=search", icon: Globe2, tone: "bg-[#e6f0f4] text-[#46758a]" },
  { title: "Run an agent", description: "Turn a goal into an actionable task plan.", href: "/?mode=agent", icon: Bot, tone: "bg-[#eee7f4] text-[#79568e]" },
  { title: "Analyze a file", description: "Upload a document and extract insights.", href: "/?section=documents", icon: FileSearch, tone: "bg-[#e8f2e9] text-[#4e8660]" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((data: { user?: UserProfile | null }) => {
      if (!data.user) router.push("/sign-in");
      else setUser(data.user);
    }).catch(() => { router.push("/sign-in"); }).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const refreshRecent = () => setRecentConversations(getConversations().slice(0, 4));
    const timer = window.setTimeout(refreshRecent, 0);
    window.addEventListener("conversations-updated", refreshRecent);
    return () => { window.clearTimeout(timer); window.removeEventListener("conversations-updated", refreshRecent); };
  }, []);

  if (loading || !user) return <main className="flex min-h-dvh items-center justify-center bg-[#f7f4ef]"><div className="flex items-center gap-2 text-sm text-[#66584b]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#9b6a48]" /> Preparing your workspace…</div></main>;

  const firstName = user.name.split(" ")[0] || "there";
  return <main className="min-h-dvh bg-[#f7f4ef] px-4 py-5 text-[#2b1b14] sm:px-6 lg:px-10">
    <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-[#e7ded3] bg-[#fffdf9] shadow-[0_24px_80px_rgba(64,39,22,0.1)]">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#2b1b14] p-5 text-white md:flex">
        <Link href="/dashboard" className="flex items-center gap-3"><img src="/susan-ai-logo-sidebar-dark.png" alt="Susan AI — Sanket Pixel Technologies" className="h-auto w-52 object-contain object-left" /></Link>
        <nav className="mt-10 space-y-1"><DashboardNav icon={UserRound} label="Overview" active /><DashboardNav icon={MessageSquare} label="Chat" href="/?new=1" /><DashboardNav icon={Globe2} label="Web Search" href="/?mode=search" /><DashboardNav icon={Bot} label="Agent Mode" href="/?mode=agent" /><DashboardNav icon={Workflow} label="Workflows" href="/?section=workflows" /><DashboardNav icon={Settings2} label="Settings" href="/?open=settings" /></nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">Your workspace</p><p className="mt-2 truncate text-xs text-white/85">{user.email}</p><button type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/sign-in"); }} className="mt-3 text-xs font-semibold text-[#e7bb8d] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7bb8d]">Sign out</button></div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-center justify-between border-b border-[#eadfd5] px-5 py-4 sm:px-8"><div className="flex items-center gap-2 md:hidden"><img src="/susan-ai-logo-sidebar.png" alt="Susan AI" className="h-8 w-auto max-w-36 object-contain object-left" /></div><div className="hidden md:block"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716254]">Workspace overview</p></div><div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-xs font-semibold">{user.name}</span><span className="block max-w-44 truncate text-[11px] text-[#716254]">{user.email}</span></span>{user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4e4cc] text-[#8d5938]"><UserRound className="h-4 w-4" /></span>}</div></header>
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-12">
          <section className="relative overflow-hidden rounded-3xl bg-[#2b1b14] p-6 text-white sm:p-8"><div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#a86d47]/35 blur-3xl" /><div className="relative"><p className="text-sm font-semibold text-[#e7bb8d]">Good to see you, {firstName}</p><h1 className="mt-2 max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">What would you like to accomplish today?</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Start with a conversation, search the web, or let an agent help you turn an idea into results.</p><Link href="/?new=1" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#f2dfbf] px-4 py-2.5 text-sm font-semibold text-[#5d3925] transition hover:bg-white">Start a new chat <ArrowRight className="h-4 w-4" /></Link></div></section>

          <div className="mt-8 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Quick actions</h2><p className="mt-1 text-xs text-[#716254]">Jump straight into your next task.</p></div><Link href="/?new=1" className="hidden items-center gap-1 text-xs font-semibold text-[#8d5938] hover:underline sm:flex">View workspace <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{quickActions.map((action) => <Link key={action.title} href={action.href} className="group rounded-2xl border border-[#eadfd5] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#cda883] hover:shadow-[0_8px_25px_rgba(64,39,22,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d5938]"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.tone}`}><action.icon className="h-5 w-5" /></span><h3 className="mt-4 text-sm font-semibold">{action.title}</h3><p className="mt-1 text-xs leading-5 text-[#716254]">{action.description}</p><ArrowRight className="mt-4 h-4 w-4 text-[#8d5938] transition group-hover:translate-x-1" /></Link>)}</div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]"><section><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Continue where you left off</h2><p className="mt-1 text-xs text-[#716254]">Your most recently saved conversations on this device.</p></div><Clock3 className="h-5 w-5 text-[#8d5938]" aria-hidden="true" /></div><div className="mt-4 space-y-2">{recentConversations.length > 0 ? recentConversations.map((conversation) => <Link key={conversation.id} href={`/?open-conversation=${encodeURIComponent(conversation.id)}`} className="flex items-center gap-3 rounded-2xl border border-[#eadfd5] bg-white p-4 transition hover:border-[#cda883] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d5938]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f8f1e8] text-[#8d5938]"><MessageSquare className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{conversation.title || "Untitled chat"}</span><span className="mt-1 block text-xs text-[#716254]">{conversation.model} · {formatConversationDate(conversation.date)}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#8d5938]" /></Link>) : <div className="rounded-2xl border border-dashed border-[#cdbfb1] bg-white/70 p-5"><p className="text-sm font-semibold">No saved chats yet</p><p className="mt-1 text-xs leading-5 text-[#716254]">Chats you save on this device will appear here. Your conversation history stays in this browser.</p><Link href="/?new=1" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#8d5938] hover:underline">Start your first chat <ArrowRight className="h-3.5 w-3.5" /></Link></div>}</div></section><section className="rounded-2xl border border-[#eadfd5] bg-[#fff8ef] p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4e4cc] text-[#8d5938]"><Plus className="h-5 w-5" /></span><h2 className="mt-4 text-base font-semibold">Make Susan AI yours</h2><p className="mt-2 text-xs leading-5 text-[#66584b]">Connect your preferred model API keys and personalize your assistant settings.</p><Link href="/?open=settings" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8d5938] hover:underline">Open settings <ArrowRight className="h-3.5 w-3.5" /></Link></section></div>
        </div>
      </section>
    </div>
  </main>;
}

function formatConversationDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Today · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function DashboardNav({ icon: Icon, label, href, active = false }: { icon: typeof UserRound; label: string; href?: string; active?: boolean }) {
  const content = <span className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</span>;
  return href ? <Link href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7bb8d]">{content}</Link> : <button type="button" className="w-full text-left">{content}</button>;
}
