import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("API-key settings expose first-party test buttons and keep errors inline", async () => {
  const settings = await read("components/settings/settings-modal.tsx");
  const input = await read("components/settings/api-key-input.tsx");
  assert.match(settings, /Add \/ Manage API Keys/);
  for (const provider of ["openai", "google", "anthropic", "deepseek"]) {
    assert.match(settings, new RegExp(`connectionTests\\.${provider}`));
  }
  assert.match(input, /Test connection/);
  assert.match(input, /role=\{connectionTest\.state === "failed" \? "alert"/);
});

test("first-use tour explains Agent, Workflows, and Knowledge Base and can be replayed", async () => {
  const tour = await read("components/onboarding/first-use-tour.tsx");
  const sidebar = await read("components/sidebar/sidebar.tsx");
  assert.match(tour, /Agent Mode/);
  assert.match(tour, /Workflows/);
  assert.match(tour, /Knowledge Base/);
  assert.match(tour, /susan_first_use_tour_seen_v1/);
  assert.match(sidebar, /Quick tour/);
});

test("streaming status is visible and accessible before and during token output", async () => {
  const bubble = await read("components/chat/message-bubble.tsx");
  assert.match(bubble, /Thinking/);
  assert.match(bubble, /Streaming response/);
  assert.match(bubble, /aria-live="polite"/);
});

test("history searches chat content and offers pins, folders, exports, and a clear backup warning", async () => {
  const history = await read("components/workspace/history-workspace.tsx");
  assert.match(history, /message\.content\.toLocaleLowerCase\(\)\.includes\(normalized\)/);
  assert.match(history, /Pinned/);
  assert.match(history, /Create folder/);
  assert.match(history, /Export all DOCX/);
  assert.match(history, /DOCX<\/button>/);
  assert.doesNotMatch(history, /Export all JSON|downloadJson|JSON<\/button>/);
  assert.match(history, /Clear all chats/);
  assert.match(history, /Delete \$\{/);
  assert.match(history, /conversationToDocxBlob/);
  assert.match(history, /Clearing browser\/site data/);
  assert.match(history, /Download DOCX or Markdown copies/);
});

test("Sidebar no longer renders recent chats or chat export/delete controls", async () => {
  const sidebar = await read("components/sidebar/sidebar.tsx");
  assert.match(sidebar, /label="History"/);
  assert.doesNotMatch(sidebar, /Today|Previous 7 days|No conversations yet|Export conversations|Import conversations|Delete all conversations/);
  assert.doesNotMatch(sidebar, /getConversations|deleteConversation|exportConversations|importConversations/);
});

test("workspace empty states provide next steps and Plugins points users to key management", async () => {
  const workspaces = await read("components/workspace/workspace-hub.tsx");
  assert.match(workspaces, /Create a project above/);
  assert.match(workspaces, /Add your first private note above/);
  assert.match(workspaces, /Upload a small document/);
  assert.match(workspaces, /Add or manage API keys/);
  assert.match(workspaces, /Start workflow/);
});
