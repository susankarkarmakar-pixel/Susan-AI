import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("chat offers message edit, regenerate, delete, copy, and local response feedback", async () => {
  const bubble = await read("components/chat/message-bubble.tsx");
  const list = await read("components/chat/chat-messages.tsx");
  const page = await read("app/page.tsx");
  for (const label of ["Copy response", "Regenerate", "Delete response", "Helpful response", "Unhelpful response", "Edit last message"]) assert.ok(bubble.includes(label), label);
  assert.match(list, /getLastUserMessageIndex/);
  assert.ok(page.includes("await sendMessage({ text: requestText, files: [...originalFiles, ...fileParts], messageId });"));
  assert.match(page, /useChatProps\.regenerate\(\{ messageId \}\)/);
  assert.match(page, /setMessages\(\(current\) => current\.filter/);
});

test("slash command palette and Ctrl/Cmd+K shortcuts are keyboard-accessible", async () => {
  const palette = await read("components/chat/command-palette.tsx");
  const input = await read("components/chat/message-input.tsx");
  assert.match(palette, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(palette, /event\.key === "\/"/);
  assert.match(palette, /role="dialog" aria-modal="true"/);
  assert.match(palette, /ArrowDown/);
  assert.match(input, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(input, /aria-keyshortcuts="Enter Shift\+Enter"/);
});

test("model controls and scoped prompts are sent to the API with server-side bounds", async () => {
  const settings = await read("components/settings/settings-modal.tsx");
  const composer = await read("components/chat/message-input.tsx");
  const modelPanel = await read("components/chat/model-control-panel.tsx");
  const page = await read("app/page.tsx");
  const route = await read("app/api/chat/route.ts");
  assert.match(settings, /id="temperature-setting"/);
  assert.match(settings, /id="max-output-tokens"/);
  assert.match(settings, /Project-specific instructions/);
  assert.match(composer, /ModelControlPanel/);
  assert.match(composer, /Choose attachment type/);
  assert.match(composer, /extraction\.source/);
  assert.match(composer, /characters/);
  assert.match(composer, /Replace/);
  assert.match(composer, /already attached/);
  assert.match(composer, /Preview of/);
  assert.match(composer, /View extracted text/);
  assert.match(composer, /Retry extraction/);
  assert.match(modelPanel, /Response effort/);
  assert.doesNotMatch(composer, /assistant-profile/);
  assert.doesNotMatch(composer, /option value="coding"/);
  assert.doesNotMatch(composer, /option value="research"/);
  assert.match(composer, /chat-project/);
  assert.match(page, /temperature: settings\.temperature/);
  assert.match(page, /settings\.projectInstructions\[selectedProjectId\]/);
  assert.match(route, /normalizeGenerationOptions/);
  assert.match(route, /normalizeSystemPrompt/);
  assert.match(route, /maxOutputTokens/);
});

test("attachments support local extraction and pass untrusted text context", async () => {
  const extraction = await read("lib/attachment-extraction.ts");
  const composer = await read("components/chat/message-input.tsx");
  const page = await read("app/page.tsx");
  assert.match(extraction, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(extraction, /tesseract\.js/);
  assert.match(extraction, /ocrPdfPages/);
  assert.match(extraction, /createElement\("canvas"\)/);
  assert.match(extraction, /No readable text was found/);
  assert.match(extraction, /AttachmentExtractionStatus/);
  assert.match(extraction, /OcrLanguage/);
  assert.match(extraction, /createWorker\(language/);
  const categorization = await read("lib/attachment-categorization.ts");
  assert.match(categorization, /Scanned PDF/);
  assert.match(categorization, /Text layer/);
  assert.match(categorization, /categorizeAttachment/);
  assert.match(composer, /extractAttachmentText/);
  assert.match(composer, /data-attachment-tag/);
  assert.match(composer, /ocr-language/);
  assert.match(composer, /English \+ বাংলা/);
  assert.match(composer, /Drop files to attach/);
  assert.match(composer, /Batch upload \(up to 3\)/);
  assert.match(composer, /isDraggingFiles/);
  assert.match(composer, /AttachmentPreviewModal/);
  assert.match(composer, /role="progressbar"/);
  assert.match(composer, /Delete \$\{file\.name\}/);
  assert.match(composer, /Full preview of/);
  assert.match(composer, /Summarize the key points from/);
  assert.match(composer, /Use in next message/);
  assert.match(composer, /MAX_ATTACHMENT_CONTEXT_CHARACTERS/);
  assert.match(composer, /safe context budget/);
  assert.match(page, /Untrusted extracted attachment text/);
});

test("usage is prominently labeled a rough text-only estimate, not provider billing", async () => {
  const composer = await read("components/chat/message-input.tsx");
  const bubble = await read("components/chat/message-bubble.tsx");
  const helper = await read("lib/usage-estimates.mjs");
  assert.match(composer, /text tokens \(estimate\)/);
  assert.match(bubble, /rough estimate, not provider billing data/);
  assert.match(helper, /four UTF-16/);
});

test("keys have password masking, last-four display, and encrypted browser-local storage", async () => {
  const input = await read("components/settings/api-key-input.tsx");
  const settings = await read("components/settings/settings-modal.tsx");
  const storage = await read("lib/key-storage.ts");
  assert.match(input, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(input, /ending \{value\.slice\(-4\)\}/);
  assert.match(input, /aria-label=\{showPassword \? `Hide/);
  assert.match(settings, /Encrypted browser-local BYOK storage/);
  assert.match(settings, /Forget this device/);
  assert.match(storage, /AES-GCM/);
  assert.match(storage, /hydrateKeys/);
});

test("code blocks provide a language label and an accessible copy action", async () => {
  const code = await read("components/chat/code-block.tsx");
  const bubble = await read("components/chat/message-bubble.tsx");
  const css = await read("app/globals.css");
  assert.match(code, /Code language:/);
  assert.match(code, /Copy \$\{language \|\| "text"\} code/);
  assert.match(bubble, /rehypePlugins=\{\[rehypeHighlight\]\}/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
