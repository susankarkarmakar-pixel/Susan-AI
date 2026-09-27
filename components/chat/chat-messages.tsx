"use client";

import { useEffect, useRef } from "react";
import { BookOpenText, Check, Code2, FileSearch, FileText, Lightbulb, Link2, PenLine, Sparkles } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { isResearchIntent } from "@/lib/research-intent.mjs";

// Use the built-in Message type or structure it explicitly to avoid ai sdk version issues
export type Message = {
  id?: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
};

interface ChatMessagesProps {
  messages: Message[];
  isStreaming?: boolean;
  onRetry?: (messageId?: string) => void;
  onEditMessage?: (id: string, content: string) => void;
  onDeleteMessage?: (id: string) => void;
  onPrompt?: (prompt: string) => void;
  hideWelcome?: boolean;
}

export function ChatMessages({ messages, isStreaming, onRetry, onEditMessage, onDeleteMessage, onPrompt, hideWelcome }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or while streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (messages.length === 0 && hideWelcome) {
    return <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar" />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center py-8 md:py-14 animate-in fade-in duration-500">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-highlight text-accent shadow-sm">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-center font-serif text-3xl font-semibold tracking-tight text-text-main md:text-4xl">Welcome to Susan AI</h1>
          <p className="mt-3 max-w-xl text-center text-sm text-text-muted md:text-base">Your personal AI assistant for learning, creating, and exploring ideas.</p>
          <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [PenLine, "Help me write", "Create content, emails, blogs and more", "Help me write a polished email about"],
              [Lightbulb, "Explain concepts", "Learn new topics in simple terms", "Explain this concept in simple terms:"],
              [Code2, "Help with coding", "Debug, review code and best practices", "Help me understand and improve this code:"],
              [FileText, "Summarize content", "Get key insights from articles, PDFs and more", "Summarize the following content:"],
            ].map(([Icon, title, description, prompt]) => {
              const PromptIcon = Icon as typeof PenLine;
              return (
                <button key={title as string} type="button" onClick={() => onPrompt?.(prompt as string)} className="group rounded-2xl border border-border-main/70 bg-surface p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-cream-highlight text-accent"><PromptIcon className="h-5 w-5" /></span>
                  <span className="block text-sm font-semibold text-text-main">{title as string}</span>
                  <span className="mt-1 block text-xs leading-5 text-text-muted">{description as string}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 custom-scrollbar scroll-smooth"
    >
      <div className="max-w-3xl mx-auto flex flex-col w-full pb-4">
        {messages.map((msg, index) => {
          const lastUserMessage = getPreviousUserMessage(messages, index);
          const isResearchResponse = msg.role === "assistant" && isResearchIntent(lastUserMessage?.content || "");
          const lastUserMessageIndex = getLastUserMessageIndex(messages);
          if (msg.role === "system") {
            return (
              <div key={msg.id || index} className="w-full flex justify-center my-6 animate-in fade-in">
                <div className="bg-black/5 text-text-muted text-xs px-4 py-1.5 rounded-full font-medium">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <MessageBubble
              key={msg.id || index}
              id={msg.id}
              role={msg.role as "user" | "assistant"}
              content={msg.content}
              isResearchResponse={isResearchResponse}
              isStreaming={isStreaming && index === messages.length - 1 && msg.role === "assistant"}
              onRetry={onRetry && msg.role === "assistant" && msg.id ? () => onRetry(msg.id) : undefined}
              onEdit={msg.role === "user" && index === lastUserMessageIndex && msg.id ? () => onEditMessage?.(msg.id!, msg.content) : undefined}
              onDelete={msg.role === "assistant" && msg.id ? () => onDeleteMessage?.(msg.id!) : undefined}
            />
          );
        })}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          isResearchIntent(messages[messages.length - 1]?.content || "")
            ? <ResearchLoadingCard />
            : <MessageBubble role="assistant" content="" isStreaming={true} />
        )}
      </div>
    </div>
  );
}

function ResearchLoadingCard() {
  const previewItems = [
    { label: "Key takeaways", icon: Check, width: "w-4/5" },
    { label: "Helpful context", icon: BookOpenText, width: "w-3/5" },
    { label: "Sources & links", icon: Link2, width: "w-2/3" },
  ];

  return (
    <div role="status" aria-live="polite" aria-label="Preparing a research-style response" className="my-1 w-full overflow-hidden rounded-[1.6rem] border border-accent/15 bg-gradient-to-br from-white via-surface to-cream-highlight/45 shadow-xl shadow-accent/[0.07]">
      <div className="h-1 bg-gradient-to-r from-cream-highlight via-accent/80 to-cream-highlight" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sidebar-cocoa text-cream-highlight shadow-md shadow-sidebar-cocoa/15"><FileSearch className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Research response</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-text-main">Preparing a thoughtful answer</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-accent">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
            Working
          </span>
        </div>

        <p className="ml-[3.25rem] mt-1 text-xs leading-5 text-text-muted">Organizing the key ideas and useful context for your question.</p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {previewItems.map(({ label, icon: Icon, width }, index) => (
            <div key={label} className="rounded-2xl border border-border-main/55 bg-white/65 p-3 shadow-sm shadow-black/[0.02]">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-text-muted"><Icon className="h-3.5 w-3.5 text-accent/80" />{label}</div>
              <div className="mt-3 space-y-1.5" aria-hidden="true">
                <div className={`h-1.5 ${width} animate-pulse rounded-full bg-accent/10 motion-reduce:animate-none`} style={{ animationDelay: `${index * 180}ms` }} />
                <div className="h-1.5 w-2/5 animate-pulse rounded-full bg-cream-highlight motion-reduce:animate-none" style={{ animationDelay: `${index * 180 + 90}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getLastUserMessageIndex(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return index;
  }
  return -1;
}

function getPreviousUserMessage(messages: Message[], index: number) {
  for (let current = index - 1; current >= 0; current -= 1) {
    if (messages[current].role === "user") return messages[current];
  }
  return undefined;
}
