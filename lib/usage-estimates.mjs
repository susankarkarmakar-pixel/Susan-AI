/**
 * Deliberately rough, provider-independent estimate: approximately four UTF-16
 * characters per token. This is a UI hint, not provider-reported billing data.
 */
export function estimateTextTokens(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateConversationTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  return messages.reduce((total, message) => total + estimateTextTokens(typeof message?.content === "string" ? message.content : ""), 0);
}

export function formatEstimatedTokens(count) {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (safeCount >= 1_000_000) return `~${(safeCount / 1_000_000).toFixed(1)}M`;
  if (safeCount >= 10_000) return `~${Math.round(safeCount / 1_000)}k`;
  if (safeCount >= 1_000) return `~${(safeCount / 1_000).toFixed(1)}k`;
  return `~${safeCount}`;
}
