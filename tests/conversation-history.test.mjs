import assert from "node:assert/strict";
import test from "node:test";
import { conversationToMarkdown, groupConversationHistory } from "../lib/conversation-history.mjs";

const localDate = (year, month, day, hour = 12) => new Date(year, month, day, hour).getTime();

test("history groups chats as Today, Yesterday, then local calendar dates", () => {
  const now = new Date(2026, 8, 27, 14);
  const conversations = [
    { id: "older", title: "Older", date: localDate(2026, 8, 24), model: "google" },
    { id: "today-late", title: "Today late", date: localDate(2026, 8, 27, 13), model: "google" },
    { id: "yesterday", title: "Yesterday", date: localDate(2026, 8, 26), model: "kimi" },
    { id: "today-early", title: "Today early", date: localDate(2026, 8, 27, 8), model: "google" },
    { id: "recent", title: "Recent", date: localDate(2026, 8, 25), model: "openrouter" },
  ];

  const groups = groupConversationHistory(conversations, now);
  assert.deepEqual(groups.map(({ label }) => label), ["Today", "Yesterday", "September 25, 2026", "September 24, 2026"]);
  assert.deepEqual(groups[0].items.map(({ id }) => id), ["today-late", "today-early"]);
  assert.deepEqual(groups[1].items.map(({ id }) => id), ["yesterday"]);
});

test("history exporter formats readable Markdown and excludes non-chat data messages", () => {
  const markdown = conversationToMarkdown({
    id: "chat-1",
    title: "Export test",
    date: localDate(2026, 8, 27),
    model: "groq",
    messages: [
      { id: "u1", role: "user", content: "Hello" },
      { id: "a1", role: "assistant", content: "Hi there." },
      { id: "d1", role: "data", content: "internal" },
    ],
  });
  assert.match(markdown, /^# Export test/m);
  assert.match(markdown, /- Model: groq/);
  assert.match(markdown, /### You\n\nHello/);
  assert.match(markdown, /### Susan AI\n\nHi there\./);
  assert.doesNotMatch(markdown, /internal/);
});
