import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Agent orchestration consumes non-tool planning steps and finalizes tool-less tasks", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /candidate\.status === "pending"/);
  assert.match(page, /currentTask\.steps\.every\(\(candidate\) => candidate\.status === "completed" \|\| candidate\.status === "skipped"\)/);
  assert.match(page, /transitionTask\(currentTask, "completed"\)/);
});

test("Agent task composer exposes run control for tool and non-tool pending steps", async () => {
  const composer = await read("components/agent/agent-task-composer.tsx");
  assert.match(composer, /activeTask\.steps\.some\(\(step\) => step\.status === "pending"\)/);
  assert.match(composer, /Run next step/);
});

test("new Agent tasks automatically start safe execution", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /const handleCreateAgentTask =/);
  assert.match(page, /void handleRunAgentTask\(task\)/);
  assert.match(page, /approval-gated step/);
});
