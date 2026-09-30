import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const registry = await readFile(new URL("../lib/provider-capabilities.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const chatArea = await readFile(new URL("../components/chat/chat-area.tsx", import.meta.url), "utf8");
const modelPanel = await readFile(new URL("../components/chat/model-control-panel.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("../components/settings/settings-modal.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../components/workspace/workspace-hub.tsx", import.meta.url), "utf8");

function assertContains(source, pattern, label) {
  assert.match(source, pattern, `${label} is missing registry contract: ${pattern}`);
}

test("provider registry exposes one descriptor and capability API", () => {
  assertContains(registry, /export interface ProviderDescriptor/, "ProviderDescriptor");
  assertContains(registry, /export const CUSTOM_PROVIDER_CAPABILITIES/, "custom capability defaults");
  assertContains(registry, /export function getProviderDescriptor\(/, "getProviderDescriptor");
  assertContains(registry, /export function getProviderCapabilities\(/, "getProviderCapabilities");
  assertContains(registry, /export function supportsProviderCapability\(/, "supportsProviderCapability");
  assertContains(registry, /files: false/, "conservative custom file capability");
});

test("server attachment validation uses the canonical capability helper", () => {
  assertContains(route, /import \{ supportsProviderCapability \} from "@\/lib\/provider-capabilities"/, "chat route registry import");
  assertContains(route, /supportsProviderCapability\(provider, "files"\)/, "server file capability check");
  assert.doesNotMatch(route, /MODELS_METADATA\[provider/, "direct route metadata lookup");
});

test("chat UI consumers use provider descriptors for names and capabilities", () => {
  assertContains(chatArea, /getProviderDescriptor, getProviderDisplayName, supportsProviderCapability/, "chat area registry imports");
  assertContains(chatArea, /supportsProviderCapability\(selectedModel, "files", customProvider\)/, "composer attachment capability");
  assertContains(modelPanel, /getProviderDescriptor\(provider\)/, "model panel descriptor lookup");
  assertContains(settings, /getProviderDescriptor\(item\.provider\)/, "settings setup link lookup");
  assertContains(workspace, /getProviderDescriptor\(provider\)/, "workspace provider lookup");
});

test("provider metadata remains centralized in the registry boundary", () => {
  for (const [source, label] of [[route, "chat route"], [chatArea, "chat area"], [modelPanel, "model panel"], [settings, "settings"], [workspace, "workspace"]]) {
    assert.doesNotMatch(source, /MODELS_METADATA\[/, `${label} should not read MODELS_METADATA directly`);
  }
});
