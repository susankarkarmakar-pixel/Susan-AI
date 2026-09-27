import assert from "node:assert/strict";
import test from "node:test";
import { getResponseFeedback, setResponseFeedback } from "../lib/response-feedback.mjs";

test("feedback APIs tolerate missing browser storage and invalid input", () => {
  assert.equal(getResponseFeedback("msg"), null);
  assert.doesNotThrow(() => setResponseFeedback("msg", "up"));
  assert.doesNotThrow(() => setResponseFeedback("", "invalid"));
});

test("feedback implementation is browser-local and never performs a network request", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../lib/response-feedback.mjs", import.meta.url), "utf8");
  assert.match(source, /localStorage/);
  assert.doesNotMatch(source, /fetch\(|navigator\.sendBeacon|XMLHttpRequest/);
});

test("feedback votes persist locally and tapping the same vote clears it", () => {
  const data = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => data.get(key) || null,
      setItem: (key, value) => data.set(key, value),
    },
    dispatchEvent: () => true,
  };
  try {
    setResponseFeedback("assistant-1", "up");
    assert.equal(getResponseFeedback("assistant-1"), "up");
    setResponseFeedback("assistant-1", "up");
    assert.equal(getResponseFeedback("assistant-1"), null);
    setResponseFeedback("assistant-1", "down");
    assert.equal(getResponseFeedback("assistant-1"), "down");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
