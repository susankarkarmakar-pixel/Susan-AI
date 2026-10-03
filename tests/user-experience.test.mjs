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

test("settings provides grouped workspace navigation, account state, and help links", async () => {
  const settings = await read("components/settings/settings-modal.tsx");
  assert.match(settings, /Account & Workspace/);
  assert.match(settings, /Get Help/);
  assert.match(settings, /Local workspace profile/);
  assert.match(settings, /Provider setup guides/);
  assert.match(settings, /group: "Workspace"/);
  assert.match(settings, /group: "AI & Chat"/);
});

test("chat exposes connected-model control and optional automatic fallback", async () => {
  const chat = await read("components/chat/chat-area.tsx");
  const composer = await read("components/chat/message-input.tsx");
  const panel = await read("components/chat/model-control-panel.tsx");
  assert.match(composer, /ModelControlPanel/);
  assert.match(chat, /fallbackNotice/);
  assert.match(chat, /is retrying it/);
  assert.match(chat, /setTimeout\(\(\) => onRetry\(\), 0\)/);
  assert.match(chat, /fallbackAttemptRef/);
  assert.match(chat, /MAX_AUTOMATIC_FALLBACK_ATTEMPTS/);
  assert.match(panel, /Automatic fallback/);
  assert.match(panel, /Cloud & BYOK models/);
  assert.match(panel, /Local models/);
  assert.match(panel, /model-fallback-updated/);
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

test("Sidebar organizes workspace, recent chats, library, and support controls", async () => {
  const sidebar = await read("components/sidebar/sidebar.tsx");
  assert.match(sidebar, /label="History"/);
  assert.match(sidebar, /Recent chats/);
  assert.match(sidebar, /View all/);
  assert.match(sidebar, /Workspace/);
  assert.match(sidebar, /Library/);
  assert.match(sidebar, /Preferences & support/);
  assert.match(sidebar, /getConversations/);
  assert.match(sidebar, /Expand library/);
  assert.match(sidebar, /General Assistant/);
  assert.match(sidebar, /w-\[72px\]/);
  assert.doesNotMatch(sidebar, /ModelSelector/);
  assert.doesNotMatch(sidebar, /Export conversations|Import conversations|Delete all conversations/);
});

test("sidebar collapse state persists between sessions", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /susan_sidebar_collapsed_v1/);
  assert.match(page, /localStorage\.getItem\(SIDEBAR_COLLAPSED_STORAGE_KEY\)/);
  assert.match(page, /localStorage\.setItem\(SIDEBAR_COLLAPSED_STORAGE_KEY, String\(next\)\)/);
});

test("About sections describe current product capabilities and privacy model", async () => {
  const about = await read("components/about/about-modal.tsx");
  assert.match(about, /Inline model control/);
  assert.match(about, /Automatic fallback/);
  assert.match(about, /Attachment workflows/);
  assert.match(about, /Encrypted browser-local keys/);
  assert.match(about, /Provider credentials stay under your control/);
  assert.match(about, /License & Use/);
  assert.match(about, /About sections/);
  assert.match(about, /h-\[100dvh\]/);
  assert.match(about, /bg-bg-main/);
  assert.doesNotMatch(about, /#FCFAF5|#FAF5EC/);
});

test("Settings and About remain usable and theme-aware on mobile", async () => {
  const settings = await read("components/settings/settings-modal.tsx");
  const about = await read("components/about/about-modal.tsx");
  assert.match(settings, /h-\[100dvh\]/);
  assert.match(settings, /aria-label="Close Settings"/);
  assert.match(settings, /bg-surface/);
  assert.match(settings, /bg-cream-highlight/);
  assert.doesNotMatch(settings, /bg-white px-3 py-2 text-sm/);
  assert.match(about, /overflow-x-auto/);
});

test("workspace empty states provide next steps and Plugins points users to key management", async () => {
  const workspaces = await read("components/workspace/workspace-hub.tsx");
  assert.match(workspaces, /Create a project above/);
  assert.match(workspaces, /Add your first private note above/);
  assert.match(workspaces, /Upload a small document/);
  assert.match(workspaces, /Add or manage API keys/);
  assert.match(workspaces, /Start workflow/);
});

test("West Bengal schemes are hidden from users while source data is preserved for future work", async () => {
  const schemes = await read("lib/civic-schemes.ts");
  const sidebar = await read("components/sidebar/sidebar.tsx");
  const workspaceHub = await read("components/workspace/workspace-hub.tsx");
  const page = await read("app/page.tsx");
  assert.doesNotMatch(sidebar, /Civic Services|open-civic|"civic"/);
  assert.doesNotMatch(workspaceHub, /"civic"/);
  assert.doesNotMatch(page, /CivicServicesWorkspace|activeSection === "civic"|open-civic|"civic"/);
  assert.match(schemes, /WEST_BENGAL_SCHEMES/);
});

test("Agent output provides an accessible fullscreen view and dashboard Workflows opens the workspace", async () => {
  const output = await read("components/agent/agent-output-workspace.tsx");
  const dashboard = await read("app/dashboard/page.tsx");
  const page = await read("app/page.tsx");
  assert.match(output, /isFullscreen/);
  assert.match(output, /role=\{isFullscreen \? "dialog"/);
  assert.match(output, /Exit full screen/);
  assert.match(output, /event\.key === "Escape"/);
  assert.match(dashboard, /label="Workflows" href="\/\?section=workflows"/);
  assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\("section"\)/);
  assert.match(page, /setActiveSection\(section\)/);
});
