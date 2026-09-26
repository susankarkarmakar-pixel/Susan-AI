import assert from "node:assert/strict";
import JSZip from "jszip";
import test from "node:test";
import { conversationToMarkdown, createConversationFolder, groupConversationHistory, normalizeConversationOrganization, removeConversationOrganizationEntry, sortConversationsPinnedFirst, updateConversationOrganization } from "../lib/conversation-history.mjs";
import { conversationToDocxBlob } from "../lib/conversation-docx.mjs";

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

test("history folders validate names and reject case-insensitive duplicates", () => {
  const folders = createConversationFolder([], "  Client   Work  ");
  assert.deepEqual(folders, ["Client Work"]);
  assert.throws(() => createConversationFolder(folders, "client work"), /already exists/);
  assert.throws(() => createConversationFolder(folders, "   "), /folder name/);
});

test("history pins sort before recent chats and folder assignment round-trips safely", () => {
  const chats = [
    { id: "new", title: "New", date: 200, model: "google" },
    { id: "old", title: "Old", date: 100, model: "openai" },
  ];
  const organization = { folders: ["Work"], items: {} };
  const withFolder = updateConversationOrganization(organization, "old", { pinned: true, folder: "Work" });
  assert.deepEqual(sortConversationsPinnedFirst(chats, withFolder).map(({ id }) => id), ["old", "new"]);
  assert.deepEqual(normalizeConversationOrganization(JSON.parse(JSON.stringify(withFolder))), withFolder);
  assert.throws(() => updateConversationOrganization(organization, "new", { folder: "Missing" }), /existing folder/);
});

test("deleting a chat removes its stale pin and folder metadata without touching other chats", () => {
  const organization = { folders: ["Work"], items: { chat1: { pinned: true, folder: "Work" }, chat2: { pinned: true } } };
  assert.deepEqual(removeConversationOrganizationEntry(organization, "chat1"), { folders: ["Work"], items: { chat2: { pinned: true } } });
});

test("single chat DOCX export is a valid Office archive", async () => {
  const blob = await conversationToDocxBlob({
    id: "docx-1",
    title: "DOCX export",
    date: localDate(2026, 8, 27),
    model: "groq",
    messages: [
      { id: "u1", role: "user", content: "Hello" },
      { id: "a1", role: "assistant", content: "Welcome to DOCX" },
      { id: "d1", role: "data", content: "internal" },
    ],
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.deepEqual(Array.from(bytes.slice(0, 2)), [0x50, 0x4b]);
  assert.ok(bytes.byteLength > 1000);
  const archive = await JSZip.loadAsync(bytes);
  const documentXml = await archive.file("word/document.xml")?.async("string");
  assert.ok(documentXml);
  assert.match(documentXml, /DOCX export/);
  assert.match(documentXml, /Welcome to DOCX/);
  assert.doesNotMatch(documentXml, /internal/);
});
