import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createEncryptedUsageBackup, restoreEncryptedUsageBackup } from "../lib/usage-backup.mjs";
import { getUsageBudgetSettings, listUsageEvents, listUsagePricingRates, recordUsageEvent, saveUsageBudgetSettings, saveUsagePricingRate } from "../lib/usage-tracking.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const baseEvent = (overrides = {}) => ({
  id: "backup-request-1", timestamp: 1_800_000_000_000, provider: "openai", model: "gpt-4o-mini",
  status: "completed", source: "provider", inputTokens: 1000, outputTokens: 500, totalTokens: 1500,
  durationMs: 450, conversationId: "conversation_1", projectId: "project_alpha", ...overrides,
});

const rates = { provider: "openai", model: "gpt-4o-mini", inputUsdPerMillion: 0, outputUsdPerMillion: 0.6, updatedAt: 1_800_000_000_001 };
const passphrase = "correct horse battery staple";

test("export is AES-GCM encrypted and restore imports only sanitized usage, rates, and budget", async () => {
  const source = memoryStorage({ susan_api_keys_v2: JSON.stringify({ openai: "top-secret-api-key" }) });
  recordUsageEvent({ ...baseEvent(), prompt: "private prompt", apiKey: "top-secret-api-key" }, source);
  saveUsagePricingRate(rates, source);
  saveUsageBudgetSettings({ monthlyLimitUsd: 20, alertPercent: 75 }, source);
  const storedEvents = JSON.parse(source.getItem("susan_usage_activity_v1"));
  storedEvents[0].prompt = "legacy prompt field";
  storedEvents[0].response = "legacy response field";
  storedEvents[0].apiKey = "legacy-storage-secret";
  source.setItem("susan_usage_activity_v1", JSON.stringify(storedEvents));
  const storedRates = JSON.parse(source.getItem("susan_usage_pricing_v1"));
  storedRates[0].credential = "legacy-rate-secret";
  source.setItem("susan_usage_pricing_v1", JSON.stringify(storedRates));

  const backup = await createEncryptedUsageBackup(passphrase, source, webcrypto);
  assert.equal(backup.includes("top-secret-api-key"), false);
  assert.equal(backup.includes("legacy-storage-secret"), false);
  assert.equal(backup.includes("legacy-rate-secret"), false);
  assert.equal(backup.includes("private prompt"), false);
  assert.equal(backup.includes("legacy response field"), false);
  assert.equal(backup.includes("apiKey"), false);
  assert.equal(backup.includes("gpt-4o-mini"), false);
  const envelope = JSON.parse(backup);
  assert.deepEqual(Object.keys(envelope).sort(), ["cipher", "ciphertext", "format", "iterations", "iv", "kdf", "salt", "version"]);
  assert.equal(envelope.format, "susan-ai-usage-backup");
  assert.equal(envelope.kdf, "PBKDF2-SHA-256");
  assert.equal(envelope.cipher, "AES-256-GCM");
  assert.equal(envelope.iterations, 310_000);

  const target = memoryStorage();
  const result = await restoreEncryptedUsageBackup(backup, passphrase, target, webcrypto);
  assert.deepEqual(result, { importedEvents: 1, importedRates: 1, budgetRestored: true });
  assert.deepEqual(listUsageEvents(target), [baseEvent()]);
  const [restoredRate] = listUsagePricingRates(target);
  assert.deepEqual([restoredRate.provider, restoredRate.model, restoredRate.inputUsdPerMillion, restoredRate.outputUsdPerMillion], ["openai", "gpt-4o-mini", 0, 0.6]);
  assert.ok(Number.isSafeInteger(restoredRate.updatedAt));
  assert.deepEqual(getUsageBudgetSettings(target), { monthlyLimitUsd: 20, alertPercent: 75 });
  assert.equal(target.getItem("susan_api_keys_v2"), null);
});

test("invalid passwords and authenticated ciphertext tampering do not change local records", async () => {
  const source = memoryStorage();
  recordUsageEvent(baseEvent(), source);
  const backup = await createEncryptedUsageBackup(passphrase, source, webcrypto);
  const target = memoryStorage();
  recordUsageEvent(baseEvent({ id: "local-record" }), target);
  const before = target.getItem("susan_usage_activity_v1");

  await assert.rejects(restoreEncryptedUsageBackup(backup, "wrong password", target, webcrypto), /Could not decrypt/);
  const tampered = JSON.parse(backup);
  tampered.ciphertext = `${tampered.ciphertext.slice(0, -3)}AAA`;
  await assert.rejects(restoreEncryptedUsageBackup(JSON.stringify(tampered), passphrase, target, webcrypto), /Could not decrypt/);
  await assert.rejects(createEncryptedUsageBackup("too-short", source, webcrypto), /at least 12 characters/);
  assert.equal(target.getItem("susan_usage_activity_v1"), before);
  assert.deepEqual(listUsageEvents(target).map((event) => event.id), ["local-record"]);
});

test("restore merges by ID while keeping the newer local event/rate and preserving existing budget settings", async () => {
  const source = memoryStorage();
  recordUsageEvent(baseEvent({ timestamp: 1_800_000_000_000 }), source);
  saveUsagePricingRate({ ...rates, updatedAt: 1_800_000_000_000 }, source);
  saveUsageBudgetSettings({ monthlyLimitUsd: 10, alertPercent: 80 }, source);
  const backup = await createEncryptedUsageBackup(passphrase, source, webcrypto);

  const target = memoryStorage();
  recordUsageEvent(baseEvent({ timestamp: 1_800_000_000_100, inputTokens: 2000 }), target);
  saveUsagePricingRate({ ...rates, updatedAt: 1_800_000_000_100, inputUsdPerMillion: 0.2 }, target);
  saveUsageBudgetSettings({ monthlyLimitUsd: 50, alertPercent: 95 }, target);
  recordUsageEvent(baseEvent({ id: "local-only" }), target);

  const result = await restoreEncryptedUsageBackup(backup, passphrase, target, webcrypto);
  assert.deepEqual(result, { importedEvents: 1, importedRates: 1, budgetRestored: false });
  assert.deepEqual(listUsageEvents(target).map((item) => item.id), ["backup-request-1", "local-only"]);
  assert.equal(listUsageEvents(target)[0].inputTokens, 2000);
  assert.equal(listUsagePricingRates(target)[0].inputUsdPerMillion, 0.2);
  assert.deepEqual(getUsageBudgetSettings(target), { monthlyLimitUsd: 50, alertPercent: 95 });
});

test("malformed or oversized backup files are rejected before restore writes", async () => {
  const target = memoryStorage();
  await assert.rejects(restoreEncryptedUsageBackup("not JSON", passphrase, target, webcrypto), /not valid JSON/);
  await assert.rejects(restoreEncryptedUsageBackup("x".repeat(8_000_001), passphrase, target, webcrypto), /invalid or too large/);
  await assert.rejects(restoreEncryptedUsageBackup(JSON.stringify({ format: "other", version: 1 }), passphrase, target, webcrypto), /not supported/);
  assert.equal(target.getItem("susan_usage_activity_v1"), null);
});
