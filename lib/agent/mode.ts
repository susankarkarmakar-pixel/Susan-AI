export type AgentMode = "chat" | "agent" | "search";

const STORAGE_KEY = "susan_agent_mode_v1";
const MODE_UPDATED_EVENT = "agent-mode-updated";

export function isAgentMode(value: unknown): value is AgentMode {
  return value === "chat" || value === "agent" || value === "search";
}

export function getAgentMode(): AgentMode {
  if (typeof window === "undefined") return "chat";
  return isAgentMode(localStorage.getItem(STORAGE_KEY)) ? localStorage.getItem(STORAGE_KEY) as AgentMode : "chat";
}

export function saveAgentMode(mode: AgentMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(MODE_UPDATED_EVENT));
}

export function resetAgentMode(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(MODE_UPDATED_EVENT));
}

export { MODE_UPDATED_EVENT };
