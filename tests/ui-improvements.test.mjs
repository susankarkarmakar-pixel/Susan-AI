import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard shows browser-local conversations instead of hard-coded recent activity", async () => {
  const dashboard = await read("app/dashboard/page.tsx");
  assert.match(dashboard, /getConversations\(\)\.slice\(0, 4\)/);
  assert.match(dashboard, /addEventListener\("conversations-updated"/);
  assert.match(dashboard, /open-conversation=\$\{encodeURIComponent\(conversation\.id\)\}/);
  assert.match(dashboard, /No saved chats yet/);
  assert.doesNotMatch(dashboard, /const recentItems\s*=/);
});

test("dashboard section and conversation links are handled by the chat shell", async () => {
  const app = await read("app/page.tsx");
  assert.match(app, /params\.get\("open-conversation"\)/);
  assert.match(app, /loadSavedConversation\(conversationId\)/);
  assert.match(app, /params\.get\("section"\)/);
  assert.match(app, /params\.get\("mode"\)/);
  assert.match(app, /params\.get\("open"\) === "settings"/);
});

test("model picker supports text search and a connected-only filter", async () => {
  const picker = await read("components/chat/model-control-panel.tsx");
  assert.match(picker, /aria-label="Search providers and models"/);
  assert.match(picker, /aria-pressed=\{connectedOnly\}/);
  assert.match(picker, /readyChoices\.length\} of \{choices\.length\} connected/);
  assert.match(picker, /No models match that search/);
  assert.match(picker, /No connected model found/);
});

test("chat preserves manual reading position and provides a jump-to-latest action", async () => {
  const chat = await read("components/chat/chat-messages.tsx");
  assert.match(chat, /isAtBottomRef\.current/);
  assert.match(chat, /const atBottom = element\.scrollHeight - element\.scrollTop - element\.clientHeight < 56/);
  assert.match(chat, /scrollTo\(\{ top: element\.scrollHeight, behavior: "smooth" \}\)/);
  assert.match(chat, /aria-label="Jump to latest message"/);
});

test("first-use onboarding guides setup, does not auto-send, and traps keyboard focus", async () => {
  const tour = await read("components/onboarding/first-use-tour.tsx");
  assert.match(tour, /Set up your first AI model/);
  assert.match(tour, /No connected model detected yet/);
  assert.match(tour, /Try a sample prompt/);
  assert.match(tour, /onStartSampleChat\(SAMPLE_PROMPT\)/);
  assert.match(tour, /press Send when ready/);
  assert.match(tour, /event\.key === "Escape"/);
  assert.match(tour, /event\.shiftKey && document\.activeElement === first/);
  assert.match(tour, /previousFocusRef\.current\?\.focus\(\)/);
});

test("sidebar section and recent-chat labels use stronger text contrast", async () => {
  const sidebar = await read("components/sidebar/sidebar.tsx");
  assert.match(sidebar, /uppercase tracking-\[0\.18em\] text-white\/65/);
  assert.match(sidebar, /text-\[9px\] text-white\/65/);
  assert.match(sidebar, /text-\[11px\] text-white\/75/);
});
