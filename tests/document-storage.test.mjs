import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storage = await readFile(new URL("../lib/document-storage.ts", import.meta.url), "utf8");
const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

test("document storage keeps a bounded local search index and extraction metadata", () => {
  assert.match(storage, /DB_VERSION = 2/);
  assert.match(storage, /searchWorkspaceDocuments/);
  assert.match(storage, /searchableText/);
  assert.match(storage, /MAX_INDEXED_TEXT = 120_000/);
  assert.match(storage, /extractionSource/);
  assert.match(storage, /characterCount/);
  assert.match(storage, /queryTokens\.every/);
  assert.match(storage, /makeSnippet/);
});

test("deployment configuration uses Next standalone output", () => {
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.installCommand, "npm ci");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.match(dockerfile, /\.next\/standalone/);
  assert.match(dockerfile, /HOSTNAME=0\.0\.0\.0/);
  assert.match(dockerfile, /USER nextjs/);
});
