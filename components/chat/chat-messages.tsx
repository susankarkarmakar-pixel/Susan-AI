"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenText, Check, Code2, FileSearch, FileText, Lightbulb, Link2, PenLine, Sparkles } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { isResearchIntent } from "@/lib/research-intent.mjs";

// Use the built-in Message type or structure it explicitly to avoid ai sdk version issues
export type Message = {
  id?: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
};

const NEAR_BOTTOM_THRESHOLD = 96;

interface ChatMessagesProps {
  messages: Message[];
  isStreaming?: boolean;
  isPreparingResearch?: boolean;
  onRetry?: (messageId?: string) => void;
  onEditMessage?: (id: string, content: string) => void;
  onDeleteMessage?: (id: string) => void;
  onPrompt?: (prompt: string) => void;
  onRelatedQuestion?: (question: string) => void;
  hideWelcome?: boolean;
}

export function ChatMessages({ messages, isStreaming, isPreparingResearch, onRetry, onEditMessage, onDeleteMessage, onPrompt, onRelatedQuestion, hideWelcome }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const unseenContentRef = useRef(false);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const animationFrameRef = useRef<number | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const isNearBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = scrollRef.current;
    if (!element) return;
    autoFollowRef.current = true;
    unseenContentRef.current = false;
    setShowJumpToLatest(false);
    const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? "auto" : behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    autoFollowRef.current = nearBottom;
    if (nearBottom) {
      unseenContentRef.current = false;
      setShowJumpToLatest(false);
    } else if (unseenContentRef.current) {
      setShowJumpToLatest(true);
    }
  }, [isNearBottom]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    const latestMessageId = latestMessage?.id;
    const latestIsNewUserMessage = latestMessageId !== lastMessageIdRef.current && latestMessage?.role === "user";
    lastMessageIdRef.current = latestMessageId;
    if (latestIsNewUserMessage) autoFollowRef.current = true;
    if (!autoFollowRef.current) {
      unseenContentRef.current = true;
      setShowJumpToLatest(true);
      return;
    }
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      scrollToLatest();
      animationFrameRef.current = null;
    });
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPreparingResearch, isStreaming, messages, scrollToLatest]);

  if (messages.length === 0 && hideWelcome) {
    return <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar" />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-8 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center py-3 sm:py-8 md:py-14 animate-in fade-in duration-500">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-highlight text-accent shadow-sm sm:mb-5 sm:h-14 sm:w-14">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h1 className="text-center font-serif text-2xl font-semibold tracking-tight text-text-main sm:text-3xl md:text-4xl">Welcome to Susan AI</h1>
          <p className="mt-2 max-w-xl text-center text-sm leading-5 text-text-muted sm:mt-3 md:text-base">Your personal AI assistant for learning, creating, and exploring ideas.</p>
          <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:mt-10 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {[
              [PenLine, "Help me write", "Create content, emails, blogs and more", "Help me write a polished email about"],
              [Lightbulb, "Explain concepts", "Learn new topics in simple terms", "Explain this concept in simple terms:"],
              [Code2, "Help with coding", "Debug, review code and best practices", "Help me understand and improve this code:"],
              [FileText, "Summarize content", "Get key insights from articles, PDFs and more", "Summarize the following content:"],
              [FileSearch, "Analyze a file", "Extract key findings from an attached document", "Analyze this attached file and list the key findings:"],
              [BookOpenText, "Research a topic", "Find current information with useful sources", "Research this topic and cite reliable sources:"],
            ].map(([Icon, title, description, prompt]) => {
              const PromptIcon = Icon as typeof PenLine;
              return (
                <button key={title as string} type="button" onClick={() => onPrompt?.(prompt as string)} className="group rounded-2xl border border-border-main/70 bg-surface p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md sm:p-4">
                  <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-cream-highlight text-accent sm:mb-4"><PromptIcon className="h-5 w-5" /></span>
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
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto p-4 custom-scrollbar">
        <div className="mx-auto flex w-full max-w-3xl flex-col pb-4">
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
              onRelatedQuestion={msg.role === "assistant" ? onRelatedQuestion : undefined}
            />
          );
        })}
        {isPreparingResearch ? <ResearchLoadingCard /> : isStreaming && messages[messages.length - 1]?.role === "user" && (
          isResearchIntent(messages[messages.length - 1]?.content || "")
            ? <ResearchLoadingCard />
            : <MessageBubble role="assistant" content="" isStreaming={true} />
        )}
        </div>
      </div>
      {showJumpToLatest && <button type="button" onClick={() => scrollToLatest("smooth")} aria-label="Jump to latest response" className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border-main/80 bg-surface px-3 py-2 text-xs font-semibold text-text-main shadow-lg transition hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">↓ Jump to latest</button>}
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
              <p className="mt-0.5 truncate text-sm font-semibold text-text-main">Searching the web and grounding your answer</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-accent">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
            Working
          </span>
        </div>

        <p className="ml-[3.25rem] mt-1 text-xs leading-5 text-text-muted">Finding relevant sources, checking context, and preparing a cited response.</p>

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
