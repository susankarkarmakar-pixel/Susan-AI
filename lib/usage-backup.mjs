import {
  MAX_USAGE_EVENTS,
  getUsageBudgetSettings,
  listUsageEvents,
  listUsagePricingRates,
  saveUsageBudgetSettings,
  USAGE_ACTIVITY_UPDATED_EVENT,
} from "./usage-tracking.mjs";

export const USAGE_BACKUP_FORMAT = "susan-ai-usage-backup";
export const USAGE_BACKUP_VERSION = 1;
export const USAGE_BACKUP_KDF_ITERATIONS = 310_000;
const ACTIVITY_KEY = "susan_usage_activity_v1";
const PRICING_KEY = "susan_usage_pricing_v1";
const BUDGET_KEY = "susan_usage_budget_v1";
const MAX_BACKUP_CHARACTERS = 8_000_000;
const MAX_PRICING_RATES = 100;

/** Export only usage metadata, model prices, and budget settings; encrypt the complete payload before it leaves this function. */
export async function createEncryptedUsageBackup(passphrase, storage = browserStorage(), cryptoApi = globalThis.crypto) {
  if (!storage || !cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") throw new Error("Encrypted backup is unavailable in this browser.");
  validatePassphrase(passphrase);
  const payload = {
    format: USAGE_BACKUP_FORMAT,
    version: USAGE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    events: listUsageEvents(storage),
    rates: listUsagePricingRates(storage),
    budget: getUsageBudgetSettings(storage),
  };
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, cryptoApi);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  try {
    const ciphertext = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, plaintext);
    return JSON.stringify({ format: USAGE_BACKUP_FORMAT, version: USAGE_BACKUP_VERSION, kdf: "PBKDF2-SHA-256", iterations: USAGE_BACKUP_KDF_ITERATIONS, cipher: "AES-256-GCM", salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) });
  } finally {
    plaintext.fill(0);
  }
}

/** Decrypt and validate a backup, then non-destructively merge its events and rates into this browser. */
export async function restoreEncryptedUsageBackup(serialized, passphrase, storage = browserStorage(), cryptoApi = globalThis.crypto) {
  if (!storage || !cryptoApi?.subtle) throw new Error("Encrypted backup is unavailable in this browser.");
  if (typeof passphrase !== "string" || passphrase.length === 0 || passphrase.length > 256) throw new Error("Enter the password used when this backup was created.");
  if (typeof serialized !== "string" || serialized.length === 0 || serialized.length > MAX_BACKUP_CHARACTERS) throw new Error("This backup file is invalid or too large.");

  let envelope;
  try { envelope = JSON.parse(serialized); } catch { throw new Error("This backup file is not valid JSON."); }
  if (!envelope || envelope.format !== USAGE_BACKUP_FORMAT || envelope.version !== USAGE_BACKUP_VERSION || envelope.kdf !== "PBKDF2-SHA-256" || envelope.cipher !== "AES-256-GCM" || envelope.iterations !== USAGE_BACKUP_KDF_ITERATIONS) {
    throw new Error("This backup format or version is not supported.");
  }

  let plaintext;
  try {
    const salt = fromBase64(envelope.salt, 16);
    const iv = fromBase64(envelope.iv, 12);
    const ciphertext = fromBase64(envelope.ciphertext);
    const key = await deriveKey(passphrase, salt, cryptoApi);
    plaintext = new Uint8Array(await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext));
  } catch {
    throw new Error("Could not decrypt this backup. Check the file and password.");
  }

  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(plaintext)); }
  catch { throw new Error("The decrypted backup payload is invalid."); }
  finally { plaintext.fill(0); }
  if (!payload || payload.format !== USAGE_BACKUP_FORMAT || payload.version !== USAGE_BACKUP_VERSION || !Array.isArray(payload.events) || !Array.isArray(payload.rates)) {
    throw new Error("The decrypted backup does not contain supported usage data.");
  }

  const importedEvents = payload.events.filter(isUsageEvent).map(sanitizeUsageEvent).slice(0, MAX_USAGE_EVENTS);
  const importedRates = payload.rates.filter(isPricingRate).map(sanitizePricingRate).slice(0, MAX_PRICING_RATES);
  const previous = {
    events: storage.getItem(ACTIVITY_KEY),
    rates: storage.getItem(PRICING_KEY),
    budget: storage.getItem(BUDGET_KEY),
  };
  const eventMap = new Map(listUsageEvents(storage).map((item) => [item.id, item]));
  for (const item of importedEvents) {
    const local = eventMap.get(item.id);
    if (!local || item.timestamp > local.timestamp) eventMap.set(item.id, item);
  }
  const mergedEvents = [...eventMap.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_USAGE_EVENTS);
  const rateMap = new Map(listUsagePricingRates(storage).map((item) => [`${item.provider}:${item.model}`, item]));
  for (const item of importedRates) {
    const key = `${item.provider}:${item.model}`;
    const local = rateMap.get(key);
    if (!local || item.updatedAt > local.updatedAt) rateMap.set(key, item);
  }
  const mergedRates = [...rateMap.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_PRICING_RATES);
  const currentBudget = getUsageBudgetSettings(storage);
  const restoreBudget = currentBudget.monthlyLimitUsd === null && isBudgetSettings(payload.budget) ? payload.budget : currentBudget;

  try {
    storage.setItem(ACTIVITY_KEY, JSON.stringify(mergedEvents));
    storage.setItem(PRICING_KEY, JSON.stringify(mergedRates));
    if (!saveUsageBudgetSettings(restoreBudget, storage)) throw new Error("Could not apply budget settings.");
    if (typeof window !== "undefined") window.dispatchEvent(new Event(USAGE_ACTIVITY_UPDATED_EVENT));
  } catch {
    rollback(storage, previous);
    throw new Error("Could not restore the backup because browser storage is unavailable or full.");
  }

  return { importedEvents: importedEvents.length, importedRates: importedRates.length, budgetRestored: currentBudget.monthlyLimitUsd === null && isBudgetSettings(payload.budget) };
}

async function deriveKey(passphrase, salt, cryptoApi) {
  const material = await cryptoApi.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return cryptoApi.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: USAGE_BACKUP_KDF_ITERATIONS }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function validatePassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.trim().length < 12 || passphrase.length > 256) {
    throw new Error("Use a backup password with at least 12 characters and save it somewhere safe.");
  }
}

function toBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function fromBase64(value, exactLength) {
  if (typeof value !== "string" || value.length > MAX_BACKUP_CHARACTERS || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("Invalid encoding");
  const decoded = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if ((exactLength && decoded.length !== exactLength) || decoded.length === 0) throw new Error("Invalid encoded length");
  return decoded;
}

function isUsageEvent(value) {
  return Boolean(value && typeof value === "object" && typeof value.id === "string" && value.id.length > 0 && value.id.length <= 128 &&
    Number.isSafeInteger(value.timestamp) && value.timestamp > 0 && typeof value.provider === "string" && value.provider.length > 0 && value.provider.length <= 100 &&
    typeof value.model === "string" && value.model.length > 0 && value.model.length <= 200 &&
    ["completed", "failed", "cancelled"].includes(value.status) && ["provider", "unavailable"].includes(value.source) &&
    nullableCount(value.inputTokens) && nullableCount(value.outputTokens) && nullableCount(value.totalTokens) && nullableCount(value.durationMs) &&
    (value.conversationId === null || (typeof value.conversationId === "string" && value.conversationId.length <= 200 && /^[a-zA-Z0-9_-]+$/.test(value.conversationId))));
}

function sanitizeUsageEvent(value) {
  return { id: value.id, timestamp: value.timestamp, provider: value.provider, model: value.model, status: value.status, source: value.source, inputTokens: value.inputTokens, outputTokens: value.outputTokens, totalTokens: value.totalTokens, durationMs: value.durationMs, conversationId: value.conversationId };
}

function isPricingRate(value) {
  return Boolean(value && typeof value === "object" && typeof value.provider === "string" && value.provider.length > 0 && value.provider.length <= 100 &&
    typeof value.model === "string" && value.model.length > 0 && value.model.length <= 200 &&
    safePrice(value.inputUsdPerMillion) !== null && safePrice(value.outputUsdPerMillion) !== null && Number.isFinite(value.updatedAt));
}

function sanitizePricingRate(value) {
  return { provider: value.provider, model: value.model, inputUsdPerMillion: value.inputUsdPerMillion, outputUsdPerMillion: value.outputUsdPerMillion, updatedAt: value.updatedAt };
}

function isBudgetSettings(value) {
  return Boolean(value && typeof value === "object" && (value.monthlyLimitUsd === null || (Number.isFinite(value.monthlyLimitUsd) && value.monthlyLimitUsd > 0)) &&
    Number.isInteger(value.alertPercent) && value.alertPercent >= 50 && value.alertPercent <= 99);
}

function nullableCount(value) {
  return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000);
}

function safePrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100_000 ? value : null;
}

function rollback(storage, previous) {
  for (const [key, value] of [[ACTIVITY_KEY, previous.events], [PRICING_KEY, previous.rates], [BUDGET_KEY, previous.budget]]) {
    try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* Best-effort rollback on storage quota failures. */ }
  }
}

function browserStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}
