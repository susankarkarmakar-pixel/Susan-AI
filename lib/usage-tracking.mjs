const ACTIVITY_KEY = "susan_usage_activity_v1";
const PRICING_KEY = "susan_usage_pricing_v1";
const BUDGET_KEY = "susan_usage_budget_v1";
const BUDGET_NOTIFICATIONS_KEY = "susan_usage_budget_notified_v1";
export const USAGE_ACTIVITY_UPDATED_EVENT = "usage-activity-updated";
export const USAGE_BUDGET_ALERT_EVENT = "usage-budget-alert";
export const MAX_USAGE_EVENTS = 500;
const MAX_PRICING_RATES = 100;
const STATUSES = new Set(["completed", "failed", "cancelled"]);

export function createUsageEventId() {
  return globalThis.crypto?.randomUUID?.() || `usage_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function recordUsageEvent(input, storage = browserStorage()) {
  if (!storage) return false;
  const item = normalizeUsageEvent(input);
  if (!item) return false;
  const events = readJsonArray(storage, ACTIVITY_KEY, isUsageEvent);
  const next = [item, ...events.filter((event) => event.id !== item.id)].slice(0, MAX_USAGE_EVENTS);
  try {
    storage.setItem(ACTIVITY_KEY, JSON.stringify(next));
    dispatchUpdated();
    if (item.status === "completed") dispatchBudgetAlertIfNeeded(storage);
    return true;
  } catch {
    return false;
  }
}

export function listUsageEvents(storage = browserStorage()) {
  return storage ? readJsonArray(storage, ACTIVITY_KEY, isUsageEvent) : [];
}

export function clearUsageEvents(storage = browserStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(ACTIVITY_KEY);
    dispatchUpdated();
    return true;
  } catch {
    return false;
  }
}

export function getUsageBudgetSettings(storage = browserStorage()) {
  if (!storage) return { monthlyLimitUsd: null, alertPercent: 80 };
  try {
    return normalizeBudgetSettings(JSON.parse(storage.getItem(BUDGET_KEY) || "null")) || { monthlyLimitUsd: null, alertPercent: 80 };
  } catch {
    return { monthlyLimitUsd: null, alertPercent: 80 };
  }
}

export function saveUsageBudgetSettings(input, storage = browserStorage()) {
  if (!storage) return false;
  const settings = normalizeBudgetSettings(input);
  if (!settings) return false;
  try {
    storage.setItem(BUDGET_KEY, JSON.stringify(settings));
    dispatchUpdated();
    dispatchBudgetAlertIfNeeded(storage);
    return true;
  } catch {
    return false;
  }
}

export function getCurrentMonthUsageSummary(events = listUsageEvents(), rates = listUsagePricingRates(), budget = getUsageBudgetSettings(), now = Date.now()) {
  const month = getMonthKey(now);
  let spentUsd = 0;
  let pricedEvents = 0;
  for (const event of events) {
    if (!isUsageEvent(event) || event.status !== "completed" || getMonthKey(event.timestamp) !== month) continue;
    const cost = estimateUsageCost(event, rates);
    if (cost === null) continue;
    spentUsd += cost;
    pricedEvents += 1;
  }
  const settings = normalizeBudgetSettings(budget) || { monthlyLimitUsd: null, alertPercent: 80 };
  const monthlyLimitUsd = settings.monthlyLimitUsd;
  const percent = monthlyLimitUsd === null ? null : (spentUsd / monthlyLimitUsd) * 100;
  return {
    month,
    spentUsd,
    monthlyLimitUsd,
    percent,
    remainingUsd: monthlyLimitUsd === null ? null : Math.max(0, monthlyLimitUsd - spentUsd),
    pricedEvents,
    alertPercent: settings.alertPercent,
    level: percent === null ? "disabled" : percent >= 100 ? "over" : percent >= settings.alertPercent ? "near" : "normal",
  };
}

export function listUsagePricingRates(storage = browserStorage()) {
  return storage ? readJsonArray(storage, PRICING_KEY, isPricingRate) : [];
}

export function saveUsagePricingRate(input, storage = browserStorage()) {
  if (!storage || !input || typeof input !== "object") return false;
  const provider = safeText(input.provider, 100);
  const model = safeText(input.model, 200);
  const inputUsdPerMillion = safePrice(input.inputUsdPerMillion);
  const outputUsdPerMillion = safePrice(input.outputUsdPerMillion);
  if (!provider || !model || inputUsdPerMillion === null || outputUsdPerMillion === null) return false;
  const rate = { provider, model, inputUsdPerMillion, outputUsdPerMillion, updatedAt: Date.now() };
  const existing = listUsagePricingRates(storage);
  const key = pricingKey(rate);
  const next = [rate, ...existing.filter((item) => pricingKey(item) !== key)].slice(0, MAX_PRICING_RATES);
  try {
    storage.setItem(PRICING_KEY, JSON.stringify(next));
    dispatchUpdated();
    return true;
  } catch {
    return false;
  }
}

export function deleteUsagePricingRate(provider, model, storage = browserStorage()) {
  if (!storage) return false;
  const key = pricingKey({ provider, model });
  const next = listUsagePricingRates(storage).filter((rate) => pricingKey(rate) !== key);
  try {
    storage.setItem(PRICING_KEY, JSON.stringify(next));
    dispatchUpdated();
    return true;
  } catch {
    return false;
  }
}

/** Cost is an estimate only, using the user's own USD-per-million-token rates. */
export function estimateUsageCost(event, rates = listUsagePricingRates()) {
  if (!isUsageEvent(event) || event.source !== "provider" || event.inputTokens === null || event.outputTokens === null) return null;
  const rate = rates.find((item) => item.provider === event.provider && item.model === event.model);
  if (!rate) return null;
  return (event.inputTokens * rate.inputUsdPerMillion + event.outputTokens * rate.outputUsdPerMillion) / 1_000_000;
}

export function summarizeUsage(events = listUsageEvents(), rates = listUsagePricingRates()) {
  const summary = { completed: 0, failed: 0, cancelled: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, reportedEvents: 0, costEstimateUsd: 0, pricedEvents: 0 };
  for (const event of events) {
    if (!isUsageEvent(event)) continue;
    summary[event.status] += 1;
    if (event.source !== "provider") continue;
    summary.reportedEvents += 1;
    summary.inputTokens += event.inputTokens || 0;
    summary.outputTokens += event.outputTokens || 0;
    summary.totalTokens += event.totalTokens || 0;
    const cost = estimateUsageCost(event, rates);
    if (cost !== null) {
      summary.costEstimateUsd += cost;
      summary.pricedEvents += 1;
    }
  }
  return summary;
}

function normalizeUsageEvent(input) {
  if (!input || typeof input !== "object") return null;
  const status = input.status;
  const provider = safeText(input.provider, 100);
  const model = safeText(input.model, 200);
  const id = safeText(input.id, 128);
  if (!STATUSES.has(status) || !provider || !model || !id) return null;
  const source = input.source === "provider" ? "provider" : "unavailable";
  const inputTokens = safeCount(input.inputTokens);
  const outputTokens = safeCount(input.outputTokens);
  const totalTokens = safeCount(input.totalTokens);
  const timestamp = typeof input.timestamp === "number" && Number.isSafeInteger(input.timestamp) && input.timestamp > 0 ? input.timestamp : Date.now();
  const durationMs = safeCount(input.durationMs);
  const conversationId = typeof input.conversationId === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(input.conversationId) ? input.conversationId : null;
  return { id, timestamp, provider, model, status, source, inputTokens, outputTokens, totalTokens, durationMs, conversationId };
}

function normalizeBudgetSettings(value) {
  if (!value || typeof value !== "object") return null;
  const disabled = value.monthlyLimitUsd === null;
  const monthlyLimitUsd = disabled ? null : safePrice(value.monthlyLimitUsd);
  const alertPercent = value.alertPercent;
  if ((!disabled && (monthlyLimitUsd === null || monthlyLimitUsd <= 0)) ||
      typeof alertPercent !== "number" || !Number.isInteger(alertPercent) || alertPercent < 50 || alertPercent > 99) return null;
  return { monthlyLimitUsd, alertPercent };
}

function dispatchBudgetAlertIfNeeded(storage) {
  const settings = getUsageBudgetSettings(storage);
  if (settings.monthlyLimitUsd === null) return;
  const summary = getCurrentMonthUsageSummary(listUsageEvents(storage), listUsagePricingRates(storage), settings);
  if (summary.level !== "near" && summary.level !== "over") return;
  const key = `${summary.month}:${summary.level}`;
  let notified = {};
  try {
    const stored = JSON.parse(storage.getItem(BUDGET_NOTIFICATIONS_KEY) || "{}");
    if (stored && typeof stored === "object" && !Array.isArray(stored)) notified = stored;
  } catch { /* Ignore corrupt notification state and allow the alert. */ }
  if (notified[key]) return;
  notified[key] = true;
  try {
    const keys = Object.keys(notified).sort().slice(-48);
    storage.setItem(BUDGET_NOTIFICATIONS_KEY, JSON.stringify(Object.fromEntries(keys.map((item) => [item, true]))));
  } catch { /* Keep the in-page alert useful if browser storage is full. */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(USAGE_BUDGET_ALERT_EVENT, { detail: summary }));
}

function getMonthKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isUsageEvent(value) {
  return Boolean(value && typeof value === "object" && typeof value.id === "string" && value.id.length <= 128 &&
    typeof value.timestamp === "number" && Number.isFinite(value.timestamp) && value.timestamp > 0 &&
    typeof value.provider === "string" && value.provider.length > 0 && value.provider.length <= 100 &&
    typeof value.model === "string" && value.model.length > 0 && value.model.length <= 200 &&
    STATUSES.has(value.status) && (value.source === "provider" || value.source === "unavailable") &&
    nullableCount(value.inputTokens) && nullableCount(value.outputTokens) && nullableCount(value.totalTokens) &&
    nullableCount(value.durationMs) && (value.conversationId === null || typeof value.conversationId === "string"));
}

function isPricingRate(value) {
  return Boolean(value && typeof value === "object" && typeof value.provider === "string" && value.provider.length <= 100 &&
    typeof value.model === "string" && value.model.length <= 200 &&
    safePrice(value.inputUsdPerMillion) !== null && safePrice(value.outputUsdPerMillion) !== null &&
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt));
}

function readJsonArray(storage, key, validator) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter(validator) : [];
  } catch {
    return [];
  }
}

function safeText(value, maxLength) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : "";
}

function safeCount(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null;
}

function nullableCount(value) {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000);
}

function safePrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100_000 ? value : null;
}

function pricingKey(value) {
  return `${value.provider}\u0000${value.model}`;
}

function browserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function dispatchUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(USAGE_ACTIVITY_UPDATED_EVENT));
}
