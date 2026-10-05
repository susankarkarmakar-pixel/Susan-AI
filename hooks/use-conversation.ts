"use client";

import { useEffect, useState } from "react";
import { ModelOption } from "@/components/sidebar/model-selector";
import { Message } from "@/components/chat/chat-messages";
import type { ChatMessageMetadata } from "@/lib/usage-types";
import {
  Conversation,
  generateConversationId,
  generateTitle,
  loadConversation as readConversation,
  saveConversation,
} from "@/lib/chat-storage";

type RestorableMessage = {
  id: string;
  role: "user" | "assistant";
  metadata?: ChatMessageMetadata;
  parts: [{ type: "text"; text: string }];
};

interface UseConversationOptions {
  messages: Message[];
  isLoading: boolean;
  autoSave?: boolean;
  selectedModel: ModelOption;
  setMessages: (messages: RestorableMessage[]) => void;
  setInput: (value: string) => void;
}

export function useConversation({ messages, isLoading, autoSave = true, selectedModel, setMessages, setInput }: UseConversationOptions) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!autoSave || messages.length === 0 || isLoading) return;
    const timeout = window.setTimeout(() => {
      let idToUse = currentConversationId;
      let titleToUse = conversationTitle;
      if (!idToUse) {
        idToUse = generateConversationId();
        setCurrentConversationId(idToUse);
        const firstUserMessage = messages.find((message) => message.role === "user");
        titleToUse = firstUserMessage ? generateTitle(firstUserMessage.content) : "New Conversation";
        setConversationTitle(titleToUse);
      }
      saveConversation(idToUse, titleToUse || "New Conversation", messages, selectedModel);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [autoSave, messages, isLoading, currentConversationId, conversationTitle, selectedModel]);

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setConversationTitle(null);
    setInput("");
    setMessages([]);
  };

  const loadSavedConversation = (id: string) => {
    const conversation = readConversation(id);
    if (!conversation) return;
    setCurrentConversationId(conversation.id);
    setConversationTitle(conversation.title);
    setInput("");
    setMessages(toRestorableMessages(conversation));
    return conversation;
  };

  return { currentConversationId, conversationTitle, startNewConversation, loadSavedConversation };
}

function toRestorableMessages(conversation: Conversation): RestorableMessage[] {
  return conversation.messages
    .filter((message): message is Message & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id || generateConversationId(),
      role: message.role,
      parts: [{ type: "text", text: message.content }],
      metadata: message.metadata,
    }));
}
