"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language: string;
  children: React.ReactNode;
  value: string;
}

export function CodeBlock({ language, children, value }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  return (
    <div className="relative my-4 rounded-xl overflow-hidden bg-[#0D1117] border border-brand-gray/50 group">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-brand-gray/30 border-b border-brand-gray/50 text-xs text-brand-white/70">
        <span className="font-mono lowercase" aria-label={`Code language: ${language || "text"}`}>{language || "text"}</span>
        <button
          type="button"
          onClick={copyToClipboard}
          aria-label={isCopied ? "Code copied" : `Copy ${language || "text"} code`}
          className="flex items-center gap-1.5 hover:text-brand-white transition-colors p-1 -mr-1"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <div className="p-4 overflow-x-auto custom-scrollbar text-sm font-mono leading-relaxed">
        {children}
      </div>
    </div>
  );
}
