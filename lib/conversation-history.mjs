const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Group summaries by the user's local calendar day, newest day first.
 * @param {import("./chat-storage").ConversationSummary[]} conversations
 * @param {Date} [now]
 */
export function groupConversationHistory(conversations, now = new Date()) {
  const todayIndex = localDayIndex(now);
  const groups = new Map();
  const sorted = [...conversations].sort((a, b) => b.date - a.date);

  for (const conversation of sorted) {
    const date = new Date(conversation.date);
    const difference = todayIndex - localDayIndex(date);
    const label = difference === 0
      ? "Today"
      : difference === 1
        ? "Yesterday"
        : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const key = difference === 0 ? "today" : difference === 1 ? "yesterday" : `date-${localDayIndex(date)}`;
    const current = groups.get(key);
    if (current) current.items.push(conversation);
    else groups.set(key, { key, label, items: [conversation], dayIndex: localDayIndex(date) });
  }

  return [...groups.values()].sort((a, b) => b.dayIndex - a.dayIndex).map(({ key, label, items }) => ({ key, label, items }));
}

/** @param {import("./chat-storage").Conversation} conversation */
export function conversationToMarkdown(conversation) {
  const title = conversation.title || "New Conversation";
  const date = new Date(conversation.date);
  const model = conversation.model || "Unknown model";
  const turns = conversation.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `### ${message.role === "user" ? "You" : "Susan AI"}\n\n${message.content.trim()}`)
    .join("\n\n");

  return `# ${title}\n\n- Date: ${Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString()}\n- Model: ${model}\n\n---\n\n${turns}\n`;
}

function localDayIndex(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}
