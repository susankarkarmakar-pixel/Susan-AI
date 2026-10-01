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
  xai?: string;
  perplexity?: string;
  together?: string;
  googleSearch?: string;
  googleSearchCx?: string;
  bingSearch?: string;
  braveSearch?: string;
}

const STORAGE_KEY = "susan_api_keys_v1";
const OLD_STORAGE_KEY = "omnikey_api_keys_v1";
const SESSION_STORAGE_KEY = "susan_api_keys_session_v1";
const DEVICE_KEY_STORAGE_KEY = "susan_api_device_key_v1";
const ENCRYPTED_VERSION = 2;
const AES_KEY_BYTES = 32;
const IV_BYTES = 12;

export type KeyStorageMode = "session" | "browser";

let memoryKeys: ApiKeys = {};
let storageHydrated = false;
let hydrationPromise: Promise<void> | null = null;

export async function saveKeys(keys: ApiKeys, mode: KeyStorageMode = "browser"): Promise<void> {
  if (typeof window === "undefined") return;
  const cleanedKeys: ApiKeys = {};
  for (const key of Object.keys(keys)) {
    const value = keys[key]?.trim();
    if (value) cleanedKeys[key] = value;
  }
  memoryKeys = cleanedKeys;
  try {
    const encrypted = await encryptKeys(cleanedKeys);
    if (mode === "session") {
      sessionStorage.setItem(SESSION_STORAGE_KEY, encrypted);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(OLD_STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, encrypted);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    storageHydrated = true;
    window.dispatchEvent(new Event("keys-updated"));
  } catch (error) {
    console.error("Failed to save encrypted API keys", error);
  }
}

/** Hydrates the in-memory key cache and migrates legacy Base64 storage once. */
export async function hydrateKeys(): Promise<void> {
  if (typeof window === "undefined" || storageHydrated) return;
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const encrypted = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (encrypted) {
        memoryKeys = await decryptKeys(encrypted);
        storageHydrated = true;
        return;
      }
      const legacy = localStorage.getItem(OLD_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        const migrated = decodeLegacyKeys(legacy);
        if (migrated) {
          await saveKeys(migrated, "browser");
          return;
        }
      }
      storageHydrated = true;
    } catch (error) {
      console.error("Failed to hydrate encrypted API keys", error);
      storageHydrated = true;
    } finally {
      hydrationPromise = null;
    }
  })();
  return hydrationPromise;
}

export function getKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  if (!storageHydrated) void hydrateKeys();
  return memoryKeys;
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
  memoryKeys = {};
  storageHydrated = true;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(OLD_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event("keys-updated"));
}

/** Removes encrypted keys and the per-device encryption key. This device must be re-authorized. */
export function forgetThisDevice(): void {
  if (typeof window === "undefined") return;
  clearKeys();
  localStorage.removeItem(DEVICE_KEY_STORAGE_KEY);
  storageHydrated = false;
  window.dispatchEvent(new Event("keys-updated"));
}

export function getKeyStorageMode(): KeyStorageMode {
  if (typeof window === "undefined") return "session";
  return sessionStorage.getItem(SESSION_STORAGE_KEY) ? "session" : "browser";
}

export function getKeyStorageSecurity(): "encrypted" | "legacy" | "empty" {
  if (typeof window === "undefined") return "empty";
  if (sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)) return "encrypted";
  if (localStorage.getItem(OLD_STORAGE_KEY)) return "legacy";
  return "empty";
}

async function encryptKeys(keys: ApiKeys): Promise<string> {
  const key = await getDeviceCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(keys));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return JSON.stringify({ v: ENCRYPTED_VERSION, iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) });
}

async function decryptKeys(payload: string): Promise<ApiKeys> {
  const parsed = JSON.parse(payload) as { v?: number; iv?: string; data?: string };
  if (parsed.v !== ENCRYPTED_VERSION || !parsed.iv || !parsed.data) throw new Error("Unsupported encrypted key storage format");
  const key = await getDeviceCryptoKey();
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(parsed.iv)) }, key, toArrayBuffer(base64ToBytes(parsed.data)));
  const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as ApiKeys;
  return decoded && typeof decoded === "object" ? decoded : {};
}

async function getDeviceCryptoKey(): Promise<CryptoKey> {
  let encoded = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (!encoded) {
    const bytes = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES));
    encoded = bytesToBase64(bytes);
    localStorage.setItem(DEVICE_KEY_STORAGE_KEY, encoded);
  }
  return crypto.subtle.importKey("raw", toArrayBuffer(base64ToBytes(encoded)), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function decodeLegacyKeys(encoded: string): ApiKeys | null {
  try {
    const parsed = JSON.parse(atob(encoded)) as ApiKeys;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
