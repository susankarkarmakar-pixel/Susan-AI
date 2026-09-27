"use client";

import { useState } from "react";
import { Activity, Eye, EyeOff, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApiKeyConnectionTest {
  state: "testing" | "connected" | "failed";
  message: string;
}

interface ApiKeyInputProps {
  label: string;
  provider: string;
  placeholder: string;
  helpUrl: string;
  helpText?: string;
  value: string;
  onChange: (val: string) => void;
  isSaved: boolean;
  onTest?: () => void;
  connectionTest?: ApiKeyConnectionTest;
}

export function ApiKeyInput({
  label,
  provider,
  placeholder,
  helpUrl,
  helpText,
  value,
  onChange,
  isSaved,
  onTest,
  connectionTest,
}: ApiKeyInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <div className="flex items-center justify-between">
        <label htmlFor={`api-key-${provider}`} className="text-sm font-medium text-text-main flex items-center gap-2">
          {label}
          {isSaved && <CheckCircle2 className="w-4 h-4 text-green-600" />}
        </label>
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          Get Key <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="relative">
        <input
          id={`api-key-${provider}`}
          type={showPassword ? "text" : "password"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-surface border border-border-main rounded-xl px-3 py-2.5 text-sm text-text-main outline-none transition-colors",
            "focus:border-text-main focus:ring-1 focus:ring-text-main/20",
            isSaved && "border-green-600/30 bg-green-50/50"
          )}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={showPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {isSaved && value && <p className="text-[11px] text-text-muted">Key is masked in this field · ending {value.slice(-4)}</p>}
      {helpText && <p className="text-xs leading-5 text-text-muted">{helpText}</p>}
      {onTest && <button type="button" onClick={onTest} disabled={!value.trim() || connectionTest?.state === "testing"} className="mt-1 inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-border-main/70 bg-surface px-3 py-2 text-xs font-semibold text-text-main hover:border-accent/40 hover:bg-cream-highlight hover:text-accent disabled:cursor-not-allowed disabled:opacity-45" aria-label={`Test ${label} connection`}>
        {connectionTest?.state === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : connectionTest?.state === "connected" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> : connectionTest?.state === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-700" /> : <Activity className="h-3.5 w-3.5" />}
        {connectionTest?.state === "testing" ? "Testing…" : "Test connection"}
      </button>}
      {connectionTest && connectionTest.state !== "testing" && <p role={connectionTest.state === "failed" ? "alert" : "status"} className={`text-xs leading-5 ${connectionTest.state === "failed" ? "text-red-700" : "text-emerald-800"}`}>{connectionTest.message}</p>}
    </div>
  );
}
