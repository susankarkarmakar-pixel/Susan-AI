export interface ApiKeys {
  [provider: string]: string | undefined;
  deepseek?: string;
  anthropic?: string;
  huggingface?: string;
  google?: string;
  openai?: string;
  qwen?: string;
  kimi?: string;
  manus?: string;
  sarvam?: string;
  openrouter?: string;
  jules?: string;
  groq?: string;
  cerebras?: string;
  mistral?: string;
  nvidia?: string;
  cloudflare?: string;
  cloudflareAccountId?: string;
  sambanova?: string;
}

const STORAGE_KEY = "susan_api_keys_v1";
const OLD_STORAGE_KEY = "omnikey_api_keys_v1";
const SESSION_STORAGE_KEY = "susan_api_keys_session_v1";

export type KeyStorageMode = "session" | "browser";

export function saveKeys(keys: ApiKeys, mode: KeyStorageMode = "browser"): void {
  if (typeof window === "undefined") return;
  const cleanedKeys: ApiKeys = {};
  for (const key of Object.keys(keys)) {
    const value = keys[key]?.trim();
    if (value) cleanedKeys[key] = value;
  }
  try {
    const encoded = btoa(JSON.stringify(cleanedKeys));
    if (mode === "session") {
      sessionStorage.setItem(SESSION_STORAGE_KEY, encoded);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(OLD_STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, encoded);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    window.dispatchEvent(new Event("keys-updated"));
  } catch (error) {
    console.error("Failed to save API keys", error);
  }
}

export function getKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  let stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    stored = localStorage.getItem(OLD_STORAGE_KEY);
    if (stored) {
      localStorage.setItem(STORAGE_KEY, stored);
      localStorage.removeItem(OLD_STORAGE_KEY);
    }
  }
  if (!stored) return {};
  try {
    const parsed = JSON.parse(atob(stored)) as ApiKeys;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Failed to decode stored API keys", error);
    return {};
  }
}

export function hasKey(provider: string): boolean {
  return Boolean(getApiKey(provider));
}

export function getApiKey(provider: string, keys: ApiKeys = getKeys()): string | undefined {
  const aliases: Record<string, string[]> = {
    google: ["google", "gemini", "gemini_api_key"],
    openrouter: ["openrouter", "open_router"],
  };
  for (const key of aliases[provider] || [provider]) {
    const value = keys[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function clearKeys(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(OLD_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event("keys-updated"));
}

export function getKeyStorageMode(): KeyStorageMode {
  if (typeof window === "undefined") return "session";
  return sessionStorage.getItem(SESSION_STORAGE_KEY) ? "session" : "browser";
}
