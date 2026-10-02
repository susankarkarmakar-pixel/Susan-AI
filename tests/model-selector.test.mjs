import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("model selector labels chat, coding-agent, local, and key readiness states", async () => {
  const source = await read("components/sidebar/model-selector.tsx");
  assert.match(source, /modeLabel: "Chat"/);
  assert.match(source, /modeLabel: "Coding Agent"/);
  assert.match(source, /modeLabel: provider\.local \? "Local" : "Custom Chat"/);
  assert.match(source, /model\.modeLabel === "Coding Agent"/);
  assert.match(source, /model\.modeLabel === "Local"/);
  assert.match(source, /hasKey \? "Ready" : "Needs key"/);
});
