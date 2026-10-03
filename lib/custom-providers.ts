import { ApiKeys, KeyStorageMode, saveKeys } from "@/lib/key-storage";
import { isAllowedCustomProviderUrl } from "@/lib/url-safety.mjs";

export interface CustomProvider {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  createdAt: string;
  local?: boolean;
  requiresApiKey?: boolean;
  localKind?: "ollama" | "lm-studio";
}

const STORAGE_KEY = "susan_custom_providers_v1";

export function getCustomProviders(): CustomProvider[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as CustomProvider[];
    return Array.isArray(value) ? value.filter(isCustomProvider) : [];
  } catch {
    return [];
  }
}

export function saveCustomProviders(providers: CustomProvider[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  window.dispatchEvent(new Event("custom-providers-updated"));
}

export function addCustomProvider(input: Omit<CustomProvider, "id" | "createdAt">): CustomProvider {
  const provider: CustomProvider = { ...input, id: `custom_${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
  saveCustomProviders([...getCustomProviders(), provider]);
  return provider;
}

export function removeCustomProvider(id: string, keys?: ApiKeys, mode: KeyStorageMode = "browser"): void {
  saveCustomProviders(getCustomProviders().filter((provider) => provider.id !== id));
  if (keys && keys[id]) {
    const nextKeys = { ...keys };
    delete nextKeys[id];
    saveKeys(nextKeys, mode);
  }
}

export function isCustomProvider(value: unknown): value is CustomProvider {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CustomProvider>;
  return typeof item.id === "string" && item.id.startsWith("custom_") && typeof item.name === "string" && typeof item.model === "string" && typeof item.baseUrl === "string" && isAllowedBaseUrl(item.baseUrl);
}

/**
 * Rejects private/internal/loopback/link-local hosts (including obfuscated and
 * IPv4-mapped-IPv6 forms) so a custom provider can't be used to make the server
 * fetch an internal address (SSRF). See lib/url-safety.mjs for the shared logic
 * used by both this client-side check and the server-side DNS-resolution guard
 * in lib/custom-provider-dns-guard.ts.
 */
export function isAllowedBaseUrl(value: string): boolean {
  return isAllowedCustomProviderUrl(value);
}
