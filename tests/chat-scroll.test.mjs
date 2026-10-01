import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../components/chat/chat-messages.tsx", import.meta.url), "utf8");

test("chat scrolling respects user position during streaming", () => {
  assert.match(source, /NEAR_BOTTOM_THRESHOLD = 96/);
  assert.match(source, /autoFollowRef/);
  assert.match(source, /onScroll=\{handleScroll\}/);
  assert.match(source, /requestAnimationFrame/);
  assert.doesNotMatch(source, /scroll-smooth/);
});

test("chat provides an accessible jump-to-latest control", () => {
  assert.match(source, /Jump to latest response/);
  assert.match(source, /↓ Jump to latest/);
  assert.match(source, /scrollToLatest\("smooth"\)/);
});
