import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function assertIncludes(source, patterns, component) {
  for (const pattern of patterns) {
    assert.match(source, pattern, `${component} is missing responsive contract: ${pattern}`);
  }
}

test("chat shell protects mobile viewport height and safe areas", async () => {
  const chat = await read("components/chat/chat-area.tsx");

  assertIncludes(chat, [
    /h-full flex-1 flex-col overflow-hidden/,
    /min-h-\[64px\]/,
    /pt-\[max\(0\.5rem,env\(safe-area-inset-top\)\)\]/,
    /px-2 .*sm:px-4.*md:px-8/,
    /min-w-0 flex-1 flex-col overflow-hidden/,
  ], "ChatArea");
});

test("mobile chat header keeps controls compact without hiding accessibility labels", async () => {
  const chat = await read("components/chat/chat-area.tsx");

  assertIncludes(chat, [
    /aria-label="Open sidebar"/,
    /aria-label="Workspace mode"/,
    /aria-label="Open settings"/,
    /hidden sm:inline/, // Mode labels collapse visually but remain represented by accessible group/button labels.
    /gap-1 sm:gap-2/,
    /rounded-full border border-border-main\/60 bg-surface p-0\.5 shadow-sm sm:p-1/,
  ], "ChatArea header");
});

test("composer uses a two-row mobile layout with narrow-screen overflow guards", async () => {
  const composer = await read("components/chat/message-input.tsx");
  const modelPanel = await read("components/chat/model-control-panel.tsx");

  assertIncludes(composer, [
    /px-2 pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\] pt-2 sm:px-4/,
    /max-w-5xl rounded-3xl border bg-surface p-2 .*sm:p-3/,
    /block min-h-\[48px\] w-full min-w-0 resize-none/,
    /flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-2/,
    /grid min-w-0 grid-cols-\[auto_minmax\(0,1fr\)_auto_auto\]/,
    /border-t border-border-main\/40 pt-1 sm:contents sm:border-0 sm:pt-0/,
    /p-2 transition-colors sm:p-2\.5/,
    /sm:hidden.*Attach files · AI can make mistakes/,
    /aria-label="Send message"/,
    /aria-label="More composer options"/,
  ], "MessageInput");

  assertIncludes(modelPanel, [
    /w-full max-w-full/,
    /sm:w-auto sm:max-w-\[15rem\]/,
  ], "ModelControlPanel");
});

test("mobile welcome state uses a single-column card flow with readable spacing", async () => {
  const messages = await read("components/chat/chat-messages.tsx");

  assertIncludes(messages, [
    /overflow-y-auto px-3 py-4 sm:px-4 sm:py-8 md:px-8/,
    /py-3 sm:py-8 md:py-14/,
    /text-2xl .*sm:text-3xl md:text-4xl/,
    /mt-6 grid w-full grid-cols-1 gap-2\.5 sm:mt-10 sm:grid-cols-2/,
    /rounded-2xl .*bg-surface p-3\.5 .*sm:p-4/,
  ], "ChatMessages welcome");
});

test("Settings and About use mobile sheets with scrollable section navigation", async () => {
  const settings = await read("components/settings/settings-modal.tsx");
  const about = await read("components/about/about-modal.tsx");

  assertIncludes(settings, [
    /items-end justify-center px-0 pb-\[env\(safe-area-inset-bottom\)\]/,
    /h-\[100dvh\] w-full max-w-6xl/,
    /rounded-t-3xl .*sm:h-\[min\(860px,calc\(100dvh-2rem\)\)\] sm:rounded-\[26px\]/,
    /overflow-x-auto .*md:hidden/,
    /min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6 md:p-8/,
    /aria-label="Close Settings"/,
  ], "SettingsModal");

  assertIncludes(about, [
    /items-end justify-center sm:items-center/,
    /h-\[100dvh\] w-full max-w-6xl/,
    /rounded-t-3xl .*sm:h-\[min\(860px,92vh\)\] sm:rounded-\[26px\]/,
    /overflow-x-auto .*md:hidden/,
    /min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-10/,
  ], "AboutModal");
});

test("mobile attachment and message content prevent horizontal overflow", async () => {
  const composer = await read("components/chat/message-input.tsx");
  const bubble = await read("components/chat/message-bubble.tsx");

  assertIncludes(composer, [
    /grid gap-2 px-2 pb-2 sm:grid-cols-2/,
    /min-w-0 rounded-xl/,
    /min-w-0 flex-1/,
    /max-w-full truncate/,
    /whitespace-pre-wrap.*break-words/,
  ], "MessageInput attachments");
  assertIncludes(bubble, [
    /max-w-\[92%\] md:max-w-\[86%\]/,
    /whitespace-pre-wrap break-words/,
    /overflow-x-auto/,
  ], "MessageBubble");
});
