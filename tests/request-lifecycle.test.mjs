import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../lib/request-lifecycle.ts", import.meta.url), "utf8");

test("request lifecycle defines the explicit phases", () => {
  for (const phase of ["idle", "preparing", "sending", "streaming", "completed", "failed"]) {
    assert.match(source, new RegExp(`\\"${phase}\\"`), `${phase} lifecycle phase is missing`);
  }
  assert.match(source, /getRequestLifecycle/);
});

test("automatic fallback is bounded at two attempts", () => {
  assert.match(source, /MAX_AUTOMATIC_FALLBACK_ATTEMPTS = 2/);
  assert.match(source, /attempts < MAX_AUTOMATIC_FALLBACK_ATTEMPTS/);
  assert.match(source, /canAttemptAutomaticFallback/);
});
