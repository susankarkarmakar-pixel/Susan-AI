import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole } from "lucide-react";

export default function SignInPage() {
  return <main className="flex min-h-dvh items-center justify-center bg-bg-main px-4 py-8 text-text-main">
    <section className="w-full max-w-xl rounded-[2rem] border border-border-main/70 bg-surface p-6 shadow-[0_24px_80px_rgba(64,39,22,0.12)] sm:p-10">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted transition hover:text-accent"><ArrowLeft className="h-3.5 w-3.5" /> Back to Susan AI</Link>
      <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-highlight text-accent"><LockKeyhole className="h-6 w-6" /></div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Privacy-first workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign-in is planned for a future version</h1>
      <p className="mt-4 text-sm leading-7 text-text-muted">Susan AI currently works without an account. We are keeping the core workspace local-first while account sync and multi-device features are being designed.</p>
      <div className="mt-7 space-y-3 rounded-2xl border border-border-main/60 bg-bg-main p-4 text-sm text-text-main">
        <Benefit text="No sign-in is required to use Chat, Search, Agent Mode, or local providers." />
        <Benefit text="Conversations and settings remain in this browser unless you export them." />
        <Benefit text="Your API keys are managed through browser-local BYOK storage." />
      </div>
      <Link href="/" className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-sidebar-cocoa px-4 py-3 text-sm font-semibold text-white transition hover:bg-sidebar-cocoa-soft">Continue without sign-in</Link>
      <p className="mt-5 text-center text-[11px] leading-5 text-text-muted">When accounts are introduced, Susan AI will clearly explain what data is synced and require your explicit choice.</p>
    </section>
  </main>;
}

function Benefit({ text }: { text: string }) {
  return <div className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span>{text}</span></div>;
}
