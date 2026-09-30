export type AppTheme = "system" | "light" | "dark";
export type AssistantProfile = "general" | "coding" | "research";
export type AiEffort = "low" | "medium" | "high" | "max";
export type AssistantSystemPrompts = Record<AssistantProfile, string>;

export interface AppSettings {
  defaultProvider: string;
  language: "auto" | "en" | "bn";
  startupBehavior: "welcome" | "last-conversation";
  autoSave: boolean;
  streaming: boolean;
  notifications: boolean;
  compactMode: boolean;
  theme: AppTheme;
  temperature: number;
  maxOutputTokens: number;
  effort: AiEffort;
  assistantProfile: AssistantProfile;
  systemPrompts: AssistantSystemPrompts;
  projectInstructions: Record<string, string>;
}

const STORAGE_KEY = "susan_app_settings_v1";
export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultProvider: "google",
  language: "auto",
  startupBehavior: "welcome",
  autoSave: true,
  streaming: true,
  notifications: false,
  compactMode: false,
  theme: "light",
  temperature: 0.7,
  maxOutputTokens: 2048,
  effort: "medium",
  assistantProfile: "general",
  systemPrompts: { general: "", coding: "", research: "" },
  projectInstructions: {},
};

const MAX_SYSTEM_PROMPT_LENGTH = 6000;
const MAX_PROJECTS_WITH_INSTRUCTIONS = 100;

export function getAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return DEFAULT_APP_SETTINGS;
    const candidate = parsed as Partial<AppSettings>;
    const defaultProvider = ["deepseek", "anthropic", "huggingface", "google", "openai", "qwen", "kimi", "sarvam", "openrouter"].includes(String(candidate.defaultProvider)) ? String(candidate.defaultProvider) : DEFAULT_APP_SETTINGS.defaultProvider;
    const language = candidate.language === "en" || candidate.language === "bn" || candidate.language === "auto" ? candidate.language : DEFAULT_APP_SETTINGS.language;
    const startupBehavior = candidate.startupBehavior === "last-conversation" || candidate.startupBehavior === "welcome" ? candidate.startupBehavior : DEFAULT_APP_SETTINGS.startupBehavior;
    const theme = candidate.theme === "dark" || candidate.theme === "system" || candidate.theme === "light" ? candidate.theme : DEFAULT_APP_SETTINGS.theme;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...candidate,
      defaultProvider,
      language,
      startupBehavior,
      theme,
      autoSave: typeof candidate.autoSave === "boolean" ? candidate.autoSave : DEFAULT_APP_SETTINGS.autoSave,
      streaming: typeof candidate.streaming === "boolean" ? candidate.streaming : DEFAULT_APP_SETTINGS.streaming,
      notifications: typeof candidate.notifications === "boolean" ? candidate.notifications : DEFAULT_APP_SETTINGS.notifications,
      compactMode: typeof candidate.compactMode === "boolean" ? candidate.compactMode : DEFAULT_APP_SETTINGS.compactMode,
      temperature: finiteNumber(candidate.temperature) ? clamp(candidate.temperature, 0, 2) : DEFAULT_APP_SETTINGS.temperature,
      maxOutputTokens: finiteNumber(candidate.maxOutputTokens) ? clamp(Math.round(candidate.maxOutputTokens), 256, 8192) : DEFAULT_APP_SETTINGS.maxOutputTokens,
      effort: isAiEffort(candidate.effort) ? candidate.effort : DEFAULT_APP_SETTINGS.effort,
      assistantProfile: isAssistantProfile(candidate.assistantProfile) ? candidate.assistantProfile : DEFAULT_APP_SETTINGS.assistantProfile,
      systemPrompts: normalizeSystemPrompts(candidate.systemPrompts),
      projectInstructions: normalizeProjectInstructions(candidate.projectInstructions),
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("app-settings-updated"));
}

export function updateAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getAppSettings(), ...patch };
  saveAppSettings(next);
  return next;
}

export function resetAppSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("app-settings-updated"));
}

function normalizeSystemPrompts(value: unknown): AssistantSystemPrompts {
  if (!value || typeof value !== "object") return { ...DEFAULT_APP_SETTINGS.systemPrompts };
  const candidate = value as Partial<AssistantSystemPrompts>;
  return {
    general: boundedPrompt(candidate.general),
    coding: boundedPrompt(candidate.coding),
    research: boundedPrompt(candidate.research),
  };
}

function normalizeProjectInstructions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([id, prompt]) => id.length <= 200 && typeof prompt === "string" && prompt.trim().length > 0)
    .slice(0, MAX_PROJECTS_WITH_INSTRUCTIONS)
    .map(([id, prompt]) => [id, boundedPrompt(prompt)]));
}

function boundedPrompt(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_SYSTEM_PROMPT_LENGTH) : "";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isAssistantProfile(value: unknown): value is AssistantProfile {
  return value === "general" || value === "coding" || value === "research";
}

function isAiEffort(value: unknown): value is AiEffort {
  return value === "low" || value === "medium" || value === "high" || value === "max";
}
