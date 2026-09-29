"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Mail, ShieldCheck, Sparkles } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const showUnavailable = (provider: string) => setMessage(`${provider} sign-in will be available after its secure OAuth setup is added in Vercel.`);
  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return setMessage("Enter your email address to continue.");
    setMessage("Email sign-in needs a verified email delivery provider before it can send a secure magic link.");
  };

  return <main className="min-h-dvh bg-[#f7f4ef] px-4 py-5 text-[#2b1b14] sm:px-6 lg:px-10">
    <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#e7ded3] bg-[#fffdf9] shadow-[0_24px_80px_rgba(64,39,22,0.12)]">
      <section className="relative hidden w-[45%] overflow-hidden bg-[#2b1b14] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#9e6945]/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#c08b5c]/20 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2dfbf] text-[#6b3d23]"><Sparkles className="h-5 w-5" /></span><span><span className="block font-serif text-xl font-semibold">Susan AI</span><span className="block text-[11px] text-white/55">Your personal AI workspace</span></span></Link>
        <div className="relative mt-auto max-w-md pb-7"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e7bb8d]">Welcome back</p><h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight">A calmer way to think, create and get things done.</h1><p className="mt-6 text-sm leading-7 text-white/65">Bring your models, tools and projects together in one private workspace designed around your way of working.</p><div className="mt-8 grid gap-3 text-sm text-white/80"><Benefit text="One workspace for chat, search and agents" /><Benefit text="Your API keys stay in your browser" /><Benefit text="Secure, simple and distraction-free" /></div></div>
        <p className="relative mt-8 text-[11px] text-white/35">© 2026 Sanket Pixel Technologies</p>
      </section>

      <section className="flex w-full flex-col px-5 py-7 sm:px-12 sm:py-10 lg:w-[55%] lg:px-20">
        <Link href="/" className="mb-10 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[#806b5b] transition hover:text-[#2b1b14]"><ArrowLeft className="h-3.5 w-3.5" /> Back to Susan AI</Link>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left"><div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4e4cc] text-[#8d5938] lg:mx-0"><Sparkles className="h-5 w-5" /></div><h2 className="font-serif text-3xl font-semibold tracking-tight">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-[#806b5b]">Continue with your preferred account to access Susan AI.</p></div>

          <div className="grid gap-3">
            <a href="/api/auth/google" className="flex h-12 items-center justify-center gap-3 rounded-xl bg-[#2b1b14] px-4 text-sm font-semibold text-white transition hover:bg-[#43291d]"><GoogleMark /> Continue with Google <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/65">Ready</span></a>
            <button type="button" onClick={() => showUnavailable("GitHub")} className="flex h-12 items-center justify-center gap-3 rounded-xl border border-[#e2d8ce] bg-white px-4 text-sm font-semibold text-[#2b1b14] transition hover:border-[#bca693] hover:bg-[#fcfaf7]"><GitHubMark /> Continue with GitHub <span className="ml-auto rounded-full bg-[#f4eee8] px-2 py-0.5 text-[10px] font-medium text-[#806b5b]">Setup</span></button>
            <button type="button" onClick={() => showUnavailable("Apple")} className="flex h-12 items-center justify-center gap-3 rounded-xl border border-[#e2d8ce] bg-white px-4 text-sm font-semibold text-[#2b1b14] transition hover:border-[#bca693] hover:bg-[#fcfaf7]"><AppleMark /> Continue with Apple <span className="ml-auto rounded-full bg-[#f4eee8] px-2 py-0.5 text-[10px] font-medium text-[#806b5b]">Setup</span></button>
          </div>

          <div className="my-7 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#aa998b]"><span className="h-px flex-1 bg-[#eadfd5]" /> or continue with email <span className="h-px flex-1 bg-[#eadfd5]" /></div>
          <form onSubmit={submitEmail} className="space-y-3"><label htmlFor="signin-email" className="sr-only">Email address</label><div className="flex h-12 items-center gap-3 rounded-xl border border-[#e2d8ce] bg-white px-3.5 transition focus-within:border-[#9b6a48] focus-within:ring-4 focus-within:ring-[#d6b18c]/20"><Mail className="h-4 w-4 shrink-0 text-[#aa998b]" /><input id="signin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-w-0 flex-1 bg-transparent text-sm text-[#2b1b14] outline-none placeholder:text-[#b8aaa0]" /></div><button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d6c5b5] bg-[#f8f1e8] text-sm font-semibold text-[#5d3925] transition hover:bg-[#f1e5d7]">Continue with email <ArrowRight className="h-4 w-4" /></button></form>
          {message && <div role="status" className="mt-4 rounded-xl border border-[#ead8c5] bg-[#fff8ef] px-3.5 py-3 text-xs leading-5 text-[#80552f]">{message}</div>}
          <p className="mt-7 flex items-start gap-2 text-[11px] leading-5 text-[#aa998b]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8eab91]" /> By continuing, you agree to use Susan AI responsibly. Your Google session is protected with a secure, HttpOnly cookie.</p>
          <p className="mt-8 text-center text-xs text-[#aa998b]">New to Susan AI? <Link href="/" className="font-semibold text-[#8d5938] hover:underline">Explore the workspace</Link></p>
        </div>
      </section>
    </div>
  </main>;
}

function Benefit({ text }: { text: string }) { return <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[#e7bb8d]"><Check className="h-3 w-3" /></span>{text}</div>; }
function GoogleMark() { return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#4285F4]">G</span>; }
function GitHubMark() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 .7a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.42-4.04-1.42-.55-1.4-1.33-1.77-1.33-1.77-1.09-.75.08-.74.08-.74 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.45 11.45 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .7Z" /></svg>; }
function AppleMark() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M16.7 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.8-.4 7 1.1 9.3.8 1.1 1.6 2.3 2.8 2.3 1.1 0 1.6-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-.1 2.8-1.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.4-.9-2.4-4.3Zm-2.2-7c.6-.8 1-1.9.9-3-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.7-1.2Z" /></svg>; }
