import type { Conversation } from "./chat-storage";

export function conversationToDocxBlob(conversation: Conversation): Promise<Blob>;
export function conversationsToDocxBlob(conversations: Conversation[]): Promise<Blob>;
