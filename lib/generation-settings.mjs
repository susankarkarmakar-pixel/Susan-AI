const MIN_TOKENS = 256;
const MAX_TOKENS = 8192;
const MAX_SYSTEM_PROMPT_LENGTH = 6000;

export function normalizeGenerationOptions({ temperature, maxOutputTokens } = {}) {
  return {
    temperature: typeof temperature === "number" && Number.isFinite(temperature) ? clamp(temperature, 0, 2) : 0.7,
    maxOutputTokens: typeof maxOutputTokens === "number" && Number.isFinite(maxOutputTokens) ? Math.round(clamp(maxOutputTokens, MIN_TOKENS, MAX_TOKENS)) : 2048,
  };
}

export function normalizeSystemPrompt(value) {
  if (value === undefined || value === null) return { valid: true, prompt: "" };
  if (typeof value !== "string" || value.length > MAX_SYSTEM_PROMPT_LENGTH) return { valid: false, prompt: "" };
  return { valid: true, prompt: value.trim() };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
