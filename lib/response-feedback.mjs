const STORAGE_KEY = "susan_response_feedback_v1";
const VALID_VOTES = new Set(["up", "down"]);

export function getResponseFeedback(messageId) {
  if (typeof window === "undefined" || !messageId) return null;
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const vote = all && typeof all === "object" ? all[messageId] : null;
    return VALID_VOTES.has(vote) ? vote : null;
  } catch {
    return null;
  }
}

export function setResponseFeedback(messageId, vote) {
  if (typeof window === "undefined" || typeof messageId !== "string" || !messageId || !VALID_VOTES.has(vote)) return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const all = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    if (all[messageId] === vote) delete all[messageId];
    else all[messageId] = vote;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("response-feedback-updated"));
  } catch {
    // Feedback is optional; storage failures must never disrupt chatting.
  }
}
