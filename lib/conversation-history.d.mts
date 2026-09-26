import type { Conversation, ConversationSummary } from "./chat-storage";

export interface ConversationDateGroup {
  key: string;
  label: string;
  items: ConversationSummary[];
}

export interface ConversationOrganization {
  folders: string[];
  items: Record<string, { pinned?: true; folder?: string }>;
}

export function groupConversationHistory(conversations: ConversationSummary[], now?: Date): ConversationDateGroup[];
export function normalizeConversationOrganization(value: unknown): ConversationOrganization;
export function createConversationFolder(folders: string[], input: string): string[];
export function updateConversationOrganization(organization: ConversationOrganization, id: string, patch: { pinned?: boolean; folder?: string | null }): ConversationOrganization;
export function sortConversationsPinnedFirst(conversations: ConversationSummary[], organization: ConversationOrganization): ConversationSummary[];
export function removeConversationOrganizationEntry(organization: ConversationOrganization, id: string): ConversationOrganization;
export function conversationToMarkdown(conversation: Conversation): string;
