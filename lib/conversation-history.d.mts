import type { Conversation, ConversationSummary } from "./chat-storage";

export interface ConversationDateGroup {
  key: string;
  label: string;
  items: ConversationSummary[];
}

export function groupConversationHistory(conversations: ConversationSummary[], now?: Date): ConversationDateGroup[];
export function conversationToMarkdown(conversation: Conversation): string;
