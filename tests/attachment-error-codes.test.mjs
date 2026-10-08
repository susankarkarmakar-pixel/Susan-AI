import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../lib/attachment-extraction.ts", import.meta.url), "utf8");

test("attachment extraction exposes stable unsupported, extraction, and OCR error codes", () => {
  assert.match(source, /errorCode\?:\s*"ATTACHMENT_UNSUPPORTED"\s*\|\s*"EXTRACTION_FAILED"\s*\|\s*"OCR_FAILED"/);
  assert.match(source, /errorCode:\s*"ATTACHMENT_UNSUPPORTED"/);
  assert.match(source, /errorCode\s*=\s*error instanceof AttachmentExtractionError \? error\.code : "EXTRACTION_FAILED"/);
});

test("OCR failures are distinguished and returned without exception or document contents", () => {
  assert.match(source, /throw new AttachmentExtractionError\("OCR_FAILED"\)/);
  assert.match(source, /OCR could not read this file\. Try a clearer image or another language setting\./);
  assert.match(source, /Could not extract readable text from this file\./);
  assert.doesNotMatch(source, /console\.(?:log|error)\(.*(?:error|file|text)/i);
});
