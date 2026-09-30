"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
interface ThemeContextValue { theme: ThemeMode; resolvedTheme: "light" | "dark"; setTheme: (theme: ThemeMode) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "susan-ai-theme";

function systemTheme(): "light" | "dark" {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const applyTheme = useCallback((mode: ThemeMode) => {
    const resolved = mode === "system" ? systemTheme() : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    setResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    // Hydrate the preference from browser storage after the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    applyTheme(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => { if (initial === "system") applyTheme("system"); };
    media.addEventListener?.("change", onSystemChange);
    return () => media.removeEventListener?.("change", onSystemChange);
  }, [applyTheme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, [applyTheme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
