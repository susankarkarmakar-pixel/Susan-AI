export function getChatErrorAction(message) {
  const normalized = String(message || "").toLowerCase();
  if (/api key|unauthorized|forbidden|denied access|permission denied|account access|insufficient balance|quota|billing/.test(normalized)) return "settings";
  if (/rate.?limit|temporarily unavailable|provider.*busy|try again|network|timed? out|timeout/.test(normalized)) return "retry";
  if (/model.*(not found|unavailable|retired)|endpoint.*(retired|unavailable)|choose another model/.test(normalized)) return "models";
  return null;
}

/** Never switch providers automatically for rate/quota/billing/auth/access errors. */
export function shouldAutomaticallyFallback(message) {
  const normalized = String(message || "").toLowerCase();
  if (/rate.?limit|too many requests|retry-after|\b429\b|quota|billing|credit|spend limit|usage limit|insufficient balance|api.?key|unauthorized|authentication|forbidden|permission|\b401\b|\b402\b|\b403\b/.test(normalized)) return false;
  return /temporarily unavailable|provider.*busy|network|timed? out|timeout|\b50[0-9]\b|\b529\b|model.*(not found|unavailable|retired)|endpoint.*(retired|unavailable)|choose another model/.test(normalized);
}
