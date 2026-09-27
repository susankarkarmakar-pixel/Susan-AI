import type { Message } from "@/components/chat/chat-messages";
export function estimateTextTokens(text: string): number;
export function estimateConversationTokens(messages: Message[]): number;
export function formatEstimatedTokens(count: number): string;
