"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";

interface UserProfile { sub: string; email: string; name: string; picture?: string }

export function AccountButton() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((data: { user?: UserProfile | null }) => { if (active) setUser(data.user || null); }).catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    const error = params.get("auth_error");
    if (error) {
      // The callback communicates an external OAuth result through the URL.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthError(error);
      window.history.replaceState({}, "", window.location.pathname);
    }
    return () => { active = false; };
  }, []);

  // The branded sign-in page owns the provider selection and OAuth redirect.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  const signIn = () => { window.location.href = "/sign-in"; };
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setOpen(false); };

  if (!user) return <div className="relative">
    {authError && <span className="sr-only" role="alert">{authError}</span>}
    <button type="button" onClick={signIn} className="inline-flex items-center gap-1.5 rounded-full border border-border-main/60 bg-surface px-3 py-2 text-xs font-semibold text-text-main shadow-sm hover:border-accent/40 hover:text-accent" title={authError || "Sign in with Google"}>
      <GoogleMark /> <span className="hidden sm:inline">Sign in</span>
    </button>
  </div>;

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`Account: ${user.name}`} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border-main/60 bg-cream-highlight text-accent shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {user.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <UserRound className="h-4 w-4" />}
    </button>
    {open && <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-border-main/70 bg-surface p-3 shadow-xl">
      <p className="truncate text-sm font-semibold text-text-main">{user.name}</p>
      <p className="truncate text-xs text-text-muted">{user.email}</p>
      <button type="button" onClick={() => void signOut()} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-text-muted hover:bg-bg-main hover:text-text-main"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
    </div>}
  </div>;
}

function GoogleMark() { return <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#4285F4]">G</span>; }
