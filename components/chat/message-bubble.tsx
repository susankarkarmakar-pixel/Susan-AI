"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, Link2, Pencil, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { estimateTextTokens, formatEstimatedTokens } from "@/lib/usage-estimates.mjs";
import { getResponseFeedback, setResponseFeedback, type ResponseVote } from "@/lib/response-feedback.mjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./code-block";
import { getRelatedQuestions } from "@/lib/related-questions";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "data";
  id?: string;
  content: string;
  isStreaming?: boolean;
  isResearchResponse?: boolean;
  onRetry?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRelatedQuestion?: (question: string) => void;
  relatedContext?: string;
}

export function MessageBubble({ id, role, content, isStreaming, isResearchResponse, onRetry, onEdit, onDelete, onRelatedQuestion, relatedContext }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<ResponseVote | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setVote(id ? getResponseFeedback(id) : null), 0);
    return () => window.clearTimeout(timer);
  }, [id]);
  // If it's a system message, we don't render it here (chat-messages handles it)
  // or if we must, just return null to avoid breaking layout
  if (role === "system" || role === "data") return null;

  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full mb-5 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[92%] md:max-w-[86%] flex items-start gap-3 relative group",
          isUser
            ? "bg-cream-highlight/70 border border-cream-highlight rounded-2xl px-5 py-3.5 text-text-main shadow-sm"
            : "rounded-2xl border border-border-main/70 bg-surface px-5 py-4 text-text-main shadow-sm"
        )}
      >
        {!isUser && (
            <div className="shrink-0 w-9 h-9 rounded-full bg-sidebar-cocoa text-cream-highlight flex items-center justify-center font-serif font-bold text-sm shadow-sm mt-0.5">
              ✦
          </div>
        )}

        <div className={cn(
          "flex-1 whitespace-pre-wrap break-words leading-relaxed text-[15px] overflow-hidden",
          !isUser && "pt-1"
        )}>
          {isUser ? (
            <>
              {content}
              {isStreaming && <span aria-hidden="true" className="ml-1 inline-block h-4 w-2 animate-pulse bg-text-main/50 align-middle motion-reduce:animate-none" />}
              {!isStreaming && onEdit && <div className="mt-2 flex justify-end"><button type="button" onClick={onEdit} aria-label="Edit last message" title="Edit last message" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-black/5 hover:text-text-main focus-visible:outline-2 focus-visible:outline-accent"><Pencil className="h-3.5 w-3.5" />Edit</button></div>}
            </>
          ) : (
            <div className="markdown-prose w-full overflow-hidden text-text-main">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  h1: ({ children }) => <h1 className="text-text-main text-2xl font-semibold mb-4 mt-6">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-text-main text-xl font-semibold mb-3 mt-5">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-text-main text-lg font-semibold mb-3 mt-4">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-text-main text-base font-semibold mb-2 mt-4">{children}</h4>,
                  p: ({ children }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline underline-offset-2">
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="marker:text-text-muted">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-border-main pl-4 italic text-text-muted mb-4 py-1">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-4 border border-border-main rounded-lg">
                      <table className="w-full text-left border-collapse bg-surface">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => <th className="border-b border-border-main px-4 py-2 font-medium bg-black/5 text-text-muted">{children}</th>,
                  td: ({ children }) => <td className="border-b border-border-main px-4 py-2 last:border-b-0">{children}</td>,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code: ({ inline, className, children, node, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || "");
                    const language = match ? match[1] : "";

                    // Extract raw text for copying
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const extractText = (node: any): string => {
                      if (!node) return "";
                      if (node.type === "text") return node.value || "";
                      if (node.children) return node.children.map(extractText).join("");
                      return "";
                    };

                    const rawCodeString = node ? extractText(node) : String(children).replace(/\n$/, "");
                    const codeString = rawCodeString.replace(/\n$/, "");

                    if (!inline) {
                      return (
                        <CodeBlock language={language} value={codeString}>
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </CodeBlock>
                      );
                    }

                    return (
                      <code className="bg-black/5 text-accent font-mono text-[0.9em] px-1.5 py-0.5 rounded" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {content}
              </ReactMarkdown>
              {isResearchResponse && !isStreaming && <ResearchReferences content={content} />}
              {isStreaming && !content && <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-text-muted"><span>Thinking</span><span className="inline-flex gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent motion-reduce:animate-none" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/70 motion-reduce:animate-none" style={{ animationDelay: "120ms" }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/40 motion-reduce:animate-none" style={{ animationDelay: "240ms" }} /></span></span>}
              {isStreaming && content && <><span className="sr-only" role="status" aria-live="polite">Streaming response</span><span aria-hidden="true" className="ml-1 inline-block h-4 w-2 animate-pulse bg-text-main/50 align-middle motion-reduce:animate-none" /></>}
              {!isStreaming && content && (
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(content);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }}
                    aria-label={copied ? "Response copied" : "Copy response"}
                    title={copied ? "Copied" : "Copy response"}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-black/5 hover:text-text-main"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      aria-label="Retry response"
                      title="Retry response"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-black/5 hover:text-text-main"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                  )}
                  {onDelete && <button type="button" onClick={onDelete} aria-label="Delete response" title="Delete response" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /><span>Delete</span></button>}
                </div>
              )}
              {!isStreaming && content && onRelatedQuestion && <RelatedQuestions content={content} context={relatedContext} onSelect={onRelatedQuestion} />}
              {!isStreaming && content && id && <div className="mt-1 flex items-center gap-1" role="group" aria-label="Rate this response">
                <button type="button" onClick={() => { setResponseFeedback(id, "up"); setVote(vote === "up" ? null : "up"); }} aria-label="Helpful response" aria-pressed={vote === "up"} title="Helpful" className={`rounded-md p-2 focus-visible:outline-2 focus-visible:outline-accent ${vote === "up" ? "bg-emerald-50 text-emerald-800" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`}><ThumbsUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => { setResponseFeedback(id, "down"); setVote(vote === "down" ? null : "down"); }} aria-label="Unhelpful response" aria-pressed={vote === "down"} title="Not helpful" className={`rounded-md p-2 focus-visible:outline-2 focus-visible:outline-accent ${vote === "down" ? "bg-red-50 text-red-800" : "text-text-muted hover:bg-black/5 hover:text-text-main"}`}><ThumbsDown className="h-4 w-4" /></button>
                <span className="ml-1 text-[10px] text-text-muted">Saved on this device</span>
              </div>}
              {!isStreaming && content && <p className="mt-2 text-[10px] text-text-muted">Estimated response usage: {formatEstimatedTokens(estimateTextTokens(content))} text tokens · rough estimate, not provider billing data</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RelatedQuestions({ content, context, onSelect }: { content: string; context?: string; onSelect: (question: string) => void }) {
  const questions = getRelatedQuestions(content, context);
  if (questions.length === 0) return null;

  return (
    <section className="mt-4 border-t border-border-main/50 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none" aria-label="Related questions">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent"><Sparkles className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" />Continue the conversation</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map((question, index) => <button key={question} type="button" onClick={() => onSelect(question)} style={{ animationDelay: `${index * 90}ms` }} className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both rounded-xl border border-border-main/70 bg-bg-main/70 px-3 py-2 text-left text-xs leading-5 text-text-main transition duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-cream-highlight/50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent motion-reduce:animate-none" aria-label={`Ask related question: ${question}`}>{question}</button>)}
      </div>
    </section>
  );
}

function ResearchReferences({ content }: { content: string }) {
  const links = collectReferences(content);
  if (links.length === 0) return null;

  return (
    <section aria-label="Research links" className="mt-4 rounded-2xl border border-accent/10 bg-gradient-to-br from-cream-highlight/45 to-bg-main/70 p-3 sm:p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-accent"><Link2 className="h-3.5 w-3.5" />Sources & links</div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" title={link.title} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-main/70 bg-white/85 px-3 py-1.5 text-xs font-medium text-text-main shadow-sm transition hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent">
            <span className="max-w-[13rem] truncate">{link.title}</span><ArrowUpRight className="h-3 w-3 shrink-0 text-text-muted" />
          </a>
        ))}
      </div>
    </section>
  );
}

function collectReferences(content: string) {
  const links = new Map<string, string>();
  const expression = /\[([^\]]{1,100})\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)|(https?:\/\/[^\s<>\])]+)/g;
  for (const match of content.matchAll(expression)) {
    const url = match[2] || match[3];
    if (!url || links.has(url)) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      links.set(url, (match[1] || parsed.hostname.replace(/^www\./, "")).slice(0, 100));
    } catch {
      // Ignore malformed links; the Markdown renderer handles the visible answer.
    }
    if (links.size >= 5) break;
  }
  return Array.from(links, ([url, title]) => ({ url, title }));
}
