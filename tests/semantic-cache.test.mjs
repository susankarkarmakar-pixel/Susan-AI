import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Module from "node:module";
import test from "node:test";
import ts from "typescript";

async function loadImplementation() {
  const directory = await mkdtemp(join(tmpdir(), "susan-semantic-cache-test-"));
  for (const filename of ["web-search.ts", "search-diagnostics.ts", "embedding-cache.ts", "semantic-rerank.ts"]) {
    const source = await readFile(new URL(`../lib/${filename}`, import.meta.url), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    await writeFile(join(directory, filename.replace(/\.ts$/, ".js")), output);
  }
  const implementation = new Module(join(directory, "semantic-rerank.js"));
  implementation.filename = join(directory, "semantic-rerank.js");
  implementation.paths = Module._nodeModulePaths(directory);
  implementation._compile(await readFile(join(directory, "semantic-rerank.js"), "utf8"), implementation.filename);
  const cacheModule = new Module(join(directory, "embedding-cache.js"));
  cacheModule.filename = join(directory, "embedding-cache.js");
  cacheModule.paths = Module._nodeModulePaths(directory);
  cacheModule._compile(await readFile(join(directory, "embedding-cache.js"), "utf8"), cacheModule.filename);
  return { directory, semanticRerank: implementation.exports.semanticRerank, clearEmbeddingCache: cacheModule.exports.clearEmbeddingCache };
}

const results = [
  { id: "one", title: "Bengali scholarship guide", url: "https://one.example/guide", snippet: "Official application details.", source: "google" },
  { id: "two", title: "General article", url: "https://two.example/article", snippet: "Background information.", source: "duckduckgo" },
];
const vector = (seed) => Array.from({ length: 512 }, (_, index) => Math.sin(seed + index / 100));

const implementation = await loadImplementation();
test.after(async () => rm(implementation.directory, { recursive: true, force: true }));

test("repeated semantic reranking reuses cached query and document embeddings", async () => {
  implementation.clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const requestSizes = [];
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    const inputs = JSON.parse(init.body).input;
    requestSizes.push(inputs.length);
    return { ok: true, json: async () => ({ data: inputs.map((_, index) => ({ index, embedding: vector(index + 1) })) }) };
  };
  try {
    await implementation.semanticRerank("Bengali scholarship", results, "cache-test-repeat");
    await implementation.semanticRerank("Bengali scholarship", results, "cache-test-repeat");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 1);
  assert.deepEqual(requestSizes, [3]);
});

test("a changed query only embeds the missing query while reusing document vectors", async () => {
  implementation.clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  const requestBodies = [];
  globalThis.fetch = async (_url, init) => {
    const inputs = JSON.parse(init.body).input;
    requestBodies.push(inputs);
    return { ok: true, json: async () => ({ data: inputs.map((_, index) => ({ index, embedding: vector(index + 4) })) }) };
  };
  try {
    await implementation.semanticRerank("Bengali scholarship", results, "cache-test-partial");
    await implementation.semanticRerank("official scholarship", results, "cache-test-partial");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requestBodies.length, 2);
  assert.equal(requestBodies[1].length, 1);
  assert.equal(requestBodies[1][0], "official scholarship");
});

test("embedding cache is partitioned by API-key fingerprint", async () => {
  implementation.clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    const inputs = JSON.parse(init.body).input;
    return { ok: true, json: async () => ({ data: inputs.map((_, index) => ({ index, embedding: vector(index + 8) })) }) };
  };
  try {
    await implementation.semanticRerank("Bengali scholarship", results, "cache-test-key-a");
    await implementation.semanticRerank("Bengali scholarship", results, "cache-test-key-b");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 2);
});
