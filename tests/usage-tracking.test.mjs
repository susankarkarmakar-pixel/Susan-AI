import assert from "node:assert/strict";
import test from "node:test";
import { clearUsageEvents, createUsageEventId, deleteUsagePricingRate, estimateUsageCost, listUsageEvents, listUsagePricingRates, recordUsageEvent, saveUsagePricingRate, summarizeUsage, summarizeUsageByProject } from "../lib/usage-tracking.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const event = (overrides = {}) => ({
  id: "request-1", timestamp: 1_800_000_000_000, provider: "openai", model: "gpt-4o-mini",
  status: "completed", source: "provider", inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500,
  durationMs: 250, conversationId: "conversation_1", projectId: null, ...overrides,
});

test("usage activity stores only bounded metadata and strips prompt, response, and API-key fields", () => {
  const storage = memoryStorage();
  assert.equal(recordUsageEvent({ ...event(), prompt: "private prompt", response: "private answer", apiKey: "secret" }, storage), true);
  const saved = storage.getItem("susan_usage_activity_v1");
  assert.ok(saved);
  assert.doesNotMatch(saved, /private prompt|private answer|secret|apiKey|prompt|response/);
  assert.deepEqual(listUsageEvents(storage), [event()]);
});

test("usage activity upserts by request ID and caps retention", () => {
  const storage = memoryStorage();
  recordUsageEvent(event({ status: "failed", source: "unavailable", inputTokens: null, outputTokens: null, totalTokens: null }), storage);
  recordUsageEvent(event(), storage);
  assert.equal(listUsageEvents(storage).length, 1);
  for (let i = 0; i < 510; i++) recordUsageEvent(event({ id: `request-${i + 2}`, timestamp: 1_800_000_000_000 + i }), storage);
  assert.equal(listUsageEvents(storage).length, 500);
});

test("usage pricing is explicit per provider/model and estimates USD from reported tokens", () => {
  const storage = memoryStorage();
  assert.equal(saveUsagePricingRate({ provider: "openai", model: "gpt-4o-mini", inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 }, storage), true);
  const rates = listUsagePricingRates(storage);
  assert.equal(estimateUsageCost(event(), rates), 0.00045);
  assert.equal(estimateUsageCost(event({ model: "unknown-model" }), rates), null);
  assert.equal(estimateUsageCost(event({ source: "unavailable" }), rates), null);
  assert.equal(deleteUsagePricingRate("openai", "gpt-4o-mini", storage), true);
  assert.equal(listUsagePricingRates(storage).length, 0);
});

test("usage summary separates reported tokens, priced requests, failures, and cancellations", () => {
  const rates = [{ provider: "openai", model: "gpt-4o-mini", inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6, updatedAt: 1 }];
  const summary = summarizeUsage([
    event(),
    event({ id: "failed", status: "failed", source: "unavailable", inputTokens: null, outputTokens: null, totalTokens: null }),
    event({ id: "cancelled", status: "cancelled", source: "unavailable", inputTokens: null, outputTokens: null, totalTokens: null }),
  ], rates);
  assert.deepEqual(summary, { completed: 1, failed: 1, cancelled: 1, inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500, reportedEvents: 1, costEstimateUsd: 0.00045, pricedEvents: 1 });
});

test("project attribution stores only a validated ID and groups activity and estimates by project", () => {
  const storage = memoryStorage();
  const rates = [{ provider: "openai", model: "gpt-4o-mini", inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6, updatedAt: 1 }];
  recordUsageEvent(event({ projectId: "project_alpha", prompt: "do not store project content" }), storage);
  recordUsageEvent(event({ id: "project-b", projectId: "project_beta", inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 }), storage);
  recordUsageEvent(event({ id: "no-project", projectId: "INVALID ID" }), storage);
  const events = listUsageEvents(storage);
  assert.equal(events.find((item) => item.id === "request-1").projectId, "project_alpha");
  assert.equal(events.find((item) => item.id === "no-project").projectId, null);
  assert.doesNotMatch(storage.getItem("susan_usage_activity_v1"), /do not store project content|project title/i);
  const groups = summarizeUsageByProject(events, rates);
  assert.deepEqual(groups.map((item) => item.projectId), ["project_beta", null, "project_alpha"]);
  assert.equal(groups.find((item) => item.projectId === "project_beta").totalTokens, 3000);
  assert.equal(groups.find((item) => item.projectId === "project_beta").pricedEvents, 1);
  assert.equal(groups.find((item) => item.projectId === null).completed, 1);
});

test("invalid usage events and unsafe rates are rejected; clear only removes activity", () => {
  const storage = memoryStorage();
  assert.equal(recordUsageEvent(event({ model: "x".repeat(201) }), storage), false);
  assert.equal(saveUsagePricingRate({ provider: "openai", model: "x", inputUsdPerMillion: -1, outputUsdPerMillion: 0 }, storage), false);
  recordUsageEvent(event(), storage);
  saveUsagePricingRate({ provider: "openai", model: "gpt-4o-mini", inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.2 }, storage);
  assert.equal(clearUsageEvents(storage), true);
  assert.equal(listUsageEvents(storage).length, 0);
  assert.equal(listUsagePricingRates(storage).length, 1);
  assert.match(createUsageEventId(), /^usage_|^[0-9a-f-]{36}$/i);
});

test("monthly budget counts only this month's completed priced usage and validates thresholds", async () => {
  const { getCurrentMonthUsageSummary, getUsageBudgetSettings, saveUsageBudgetSettings } = await import("../lib/usage-tracking.mjs");
  const storage = memoryStorage();
  const now = new Date(2026, 2, 15, 12).getTime();
  const inMonth = new Date(2026, 2, 4, 12).getTime();
  const priorMonth = new Date(2026, 1, 25, 12).getTime();
  const rates = [{ provider: "openai", model: "gpt-4o-mini", inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6, updatedAt: now }];
  const events = [event({ timestamp: inMonth }), event({ id: "old", timestamp: priorMonth }), event({ id: "failed", timestamp: inMonth, status: "failed" })];
  assert.equal(saveUsageBudgetSettings({ monthlyLimitUsd: 0.0005, alertPercent: 80 }, storage), true);
  assert.deepEqual(getUsageBudgetSettings(storage), { monthlyLimitUsd: 0.0005, alertPercent: 80 });
  const summary = getCurrentMonthUsageSummary(events, rates, getUsageBudgetSettings(storage), now);
  assert.equal(summary.spentUsd, 0.00045);
  assert.equal(summary.pricedEvents, 1);
  assert.ok(Math.abs(summary.percent - 90) < 1e-9);
  assert.ok(Math.abs(summary.remainingUsd - 0.00005) < 1e-12);
  assert.equal(summary.level, "near");
  assert.equal(saveUsageBudgetSettings({ monthlyLimitUsd: -1, alertPercent: 80 }, storage), false);
  assert.equal(saveUsageBudgetSettings({ monthlyLimitUsd: 20, alertPercent: 25 }, storage), false);
  assert.equal(saveUsageBudgetSettings({ monthlyLimitUsd: null, alertPercent: 80 }, storage), true);
  assert.equal(getCurrentMonthUsageSummary(events, rates, getUsageBudgetSettings(storage), now).level, "disabled");
});

test("monthly budget warning dispatches once at its threshold and never changes request status", async () => {
  const { saveUsageBudgetSettings, USAGE_BUDGET_ALERT_EVENT } = await import("../lib/usage-tracking.mjs");
  const storage = memoryStorage();
  const priorWindow = globalThis.window;
  const priorCustomEvent = globalThis.CustomEvent;
  const dispatched = [];
  const currentMonth = new Date();
  currentMonth.setDate(5);
  currentMonth.setHours(12, 0, 0, 0);
  const timestamp = currentMonth.getTime();
  globalThis.window = { dispatchEvent: (event) => { dispatched.push(event); return true; } };
  globalThis.CustomEvent = class {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  };
  try {
    saveUsagePricingRate({ provider: "openai", model: "gpt-4o-mini", inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 }, storage);
    saveUsageBudgetSettings({ monthlyLimitUsd: 0.0005, alertPercent: 80 }, storage);
    recordUsageEvent(event({ id: "near", timestamp }), storage);
    assert.equal(dispatched.filter((entry) => entry.type === USAGE_BUDGET_ALERT_EVENT).length, 1);
    recordUsageEvent(event({ id: "over", timestamp }), storage);
    assert.equal(dispatched.filter((entry) => entry.type === USAGE_BUDGET_ALERT_EVENT).length, 2);
    recordUsageEvent(event({ id: "over-again", timestamp }), storage);
    assert.equal(dispatched.filter((entry) => entry.type === USAGE_BUDGET_ALERT_EVENT).length, 2);
    assert.ok(dispatched.filter((entry) => entry.type === USAGE_BUDGET_ALERT_EVENT).every((entry) => entry.detail && ["near", "over"].includes(entry.detail.level)));
    assert.equal(listUsageEvents(storage).every((entry) => entry.status === "completed"), true);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
    if (priorCustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = priorCustomEvent;
  }
});
