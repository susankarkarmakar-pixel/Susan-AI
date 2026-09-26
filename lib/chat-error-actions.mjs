export function getChatErrorAction(message) {
  const normalized = String(message || "").toLowerCase();
  if (/api key|unauthorized|forbidden|denied access|permission denied|account access|insufficient balance|quota|billing/.test(normalized)) return "settings";
  if (/rate.?limit|temporarily unavailable|provider.*busy|try again|network|timed? out|timeout/.test(normalized)) return "retry";
  if (/model.*(not found|unavailable|retired)|endpoint.*(retired|unavailable)|choose another model/.test(normalized)) return "models";
  return null;
}
