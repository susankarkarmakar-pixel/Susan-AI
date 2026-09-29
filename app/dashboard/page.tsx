"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, Clock3, FileSearch, Globe2, MessageSquare, Plus, Search, Settings2, Sparkles, UserRound, Workflow } from "lucide-react";

interface UserProfile { name: string; email: string; picture?: string }

const quickActions = [
  { title: "Start a new chat", description: "Ask anything with your preferred AI model.", href: "/?new=1", icon: MessageSquare, tone: "bg-[#f4e4cc] text-[#8d5938]" },
  { title: "Search the web", description: "Find current answers across trusted sources.", href: "/?mode=search", icon: Globe2, tone: "bg-[#e6f0f4] text-[#46758a]" },
  { title: "Run an agent", description: "Turn a goal into an actionable task plan.", href: "/?mode=agent", icon: Bot, tone: "bg-[#eee7f4] text-[#79568e]" },
  { title: "Analyze a file", description: "Upload a document and extract insights.", href: "/?action=analyze", icon: FileSearch, tone: "bg-[#e8f2e9] text-[#4e8660]" },
];

const recentItems = [
  { title: "Explore your workspace", type: "Getting started", time: "Just now", icon: Sparkles, href: "/dashboard" },
  { title: "Ask Susan AI anything", type: "Chat", time: "Start a conversation", icon: MessageSquare, href: "/?new=1" },
  { title: "Search the latest updates", type: "Web Search", time: "Find current information", icon: Search, href: "/?mode=search" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((data: { user?: UserProfile | null }) => {
      if (!data.user) router.push("/sign-in");
      else setUser(data.user);
    }).catch(() => { router.push("/sign-in"); }).finally(() => setLoading(false));
  }, [router]);

  if (loading || !user) return <main className="flex min-h-dvh items-center justify-center bg-[#f7f4ef]"><div className="flex items-center gap-2 text-sm text-[#806b5b]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#9b6a48]" /> Preparing your workspace…</div></main>;

  const firstName = user.name.split(" ")[0] || "there";
  return <main className="min-h-dvh bg-[#f7f4ef] px-4 py-5 text-[#2b1b14] sm:px-6 lg:px-10">
    <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-[#e7ded3] bg-[#fffdf9] shadow-[0_24px_80px_rgba(64,39,22,0.1)]">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#2b1b14] p-5 text-white md:flex">
        <Link href="/dashboard" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2dfbf] text-[#6b3d23]"><Sparkles className="h-5 w-5" /></span><span><span className="block font-serif text-lg font-semibold">Susan AI</span><span className="block text-[10px] text-white/45">Personal AI workspace</span></span></Link>
        <nav className="mt-10 space-y-1"><DashboardNav icon={Sparkles} label="Overview" active /><DashboardNav icon={MessageSquare} label="Chat" href="/?new=1" /><DashboardNav icon={Globe2} label="Web Search" href="/?mode=search" /><DashboardNav icon={Bot} label="Agent Mode" href="/?mode=agent" /><DashboardNav icon={Workflow} label="Workflows" /><DashboardNav icon={Settings2} label="Settings" href="/" /></nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Your workspace</p><p className="mt-2 truncate text-xs text-white/80">{user.email}</p><button type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/sign-in"); }} className="mt-3 text-xs font-semibold text-[#e7bb8d] hover:text-white">Sign out</button></div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-center justify-between border-b border-[#eadfd5] px-5 py-4 sm:px-8"><div className="flex items-center gap-2 md:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4e4cc] text-[#8d5938]"><Sparkles className="h-4 w-4" /></span><span className="font-serif font-semibold">Susan AI</span></div><div className="hidden md:block"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#aa998b]">Workspace overview</p></div><div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-xs font-semibold">{user.name}</span><span className="block max-w-44 truncate text-[11px] text-[#aa998b]">{user.email}</span></span>{user.picture ? <><img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" /></> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4e4cc] text-[#8d5938]"><UserRound className="h-4 w-4" /></span>}</div></header>
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-12">
          <section className="relative overflow-hidden rounded-3xl bg-[#2b1b14] p-6 text-white sm:p-8"><div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#a86d47]/35 blur-3xl" /><div className="relative"><p className="text-sm font-semibold text-[#e7bb8d]">Good to see you, {firstName}</p><h1 className="mt-2 max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">What would you like to accomplish today?</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Start with a conversation, search the web, or let an agent help you turn an idea into results.</p><Link href="/?new=1" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#f2dfbf] px-4 py-2.5 text-sm font-semibold text-[#5d3925] transition hover:bg-white">Start a new chat <ArrowRight className="h-4 w-4" /></Link></div></section>

          <div className="mt-8 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Quick actions</h2><p className="mt-1 text-xs text-[#aa998b]">Jump straight into your next task.</p></div><Link href="/?new=1" className="hidden items-center gap-1 text-xs font-semibold text-[#8d5938] hover:underline sm:flex">View workspace <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{quickActions.map((action) => <Link key={action.title} href={action.href} className="group rounded-2xl border border-[#eadfd5] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#cda883] hover:shadow-[0_8px_25px_rgba(64,39,22,0.07)]"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.tone}`}><action.icon className="h-5 w-5" /></span><h3 className="mt-4 text-sm font-semibold">{action.title}</h3><p className="mt-1 text-xs leading-5 text-[#8e7c6d]">{action.description}</p><ArrowRight className="mt-4 h-4 w-4 text-[#b7a69a] transition group-hover:translate-x-1 group-hover:text-[#8d5938]" /></Link>)}</div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]"><section><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Continue where you left off</h2><p className="mt-1 text-xs text-[#aa998b]">Your recent workspace activities.</p></div><Clock3 className="h-5 w-5 text-[#b7a69a]" /></div><div className="mt-4 space-y-2">{recentItems.map((item) => <Link key={item.title} href={item.href} className="flex items-center gap-3 rounded-2xl border border-[#eadfd5] bg-white p-4 transition hover:border-[#cda883]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f1e8] text-[#8d5938]"><item.icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-[#aa998b]">{item.type} · {item.time}</span></span><ArrowRight className="h-4 w-4 text-[#c0afa2]" /></Link>)}</div></section><section className="rounded-2xl border border-[#eadfd5] bg-[#fff8ef] p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4e4cc] text-[#8d5938]"><Plus className="h-5 w-5" /></span><h2 className="mt-4 text-base font-semibold">Make Susan AI yours</h2><p className="mt-2 text-xs leading-5 text-[#806b5b]">Connect your preferred model API keys and personalize your assistant settings.</p><Link href="/?open=settings" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8d5938] hover:underline">Open settings <ArrowRight className="h-3.5 w-3.5" /></Link></section></div>
        </div>
      </section>
    </div>
  </main>;
}

function DashboardNav({ icon: Icon, label, href, active = false }: { icon: typeof Sparkles; label: string; href?: string; active?: boolean }) { const content = <span className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</span>; return href ? <Link href={href}>{content}</Link> : <button type="button" className="w-full text-left">{content}</button>; }
