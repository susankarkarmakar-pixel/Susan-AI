import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Module from "node:module";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url);
const DIMENSIONS = 512;
const RUNS = 30;
const CANDIDATE_COUNTS = [5, 10, 20];

function percentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[index];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function vector(seed, dimensions = DIMENSIONS) {
  const values = new Array(dimensions);
  for (let index = 0; index < dimensions; index += 1) values[index] = Math.sin(seed * 0.17 + index * 0.013);
  return values;
}

function responseFor(inputs) {
  return inputs.map((_, index) => vector(index === 0 ? 1 : index % 4 === 0 ? 1.02 : index + 10));
}

function makeResults(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `result-${index}`,
    title: index % 4 === 0 ? `Bengali scholarship official guide ${index}` : `General technology article ${index}`,
    url: `https://example-${index}.com/article`,
    snippet: index % 4 === 0 ? "Official Bengali scholarship application information and eligibility." : "A general article with unrelated background information.",
    source: index % 2 === 0 ? "google" : "duckduckgo",
    providerRank: index,
  }));
}

async function loadImplementation() {
  const directory = await mkdtemp(join(tmpdir(), "susan-semantic-benchmark-"));
  const files = ["web-search.ts", "search-diagnostics.ts", "embedding-cache.ts", "semantic-rerank.ts"];
  for (const filename of files) {
    const source = await readFile(new URL(`./lib/${filename}`, ROOT), "utf8");
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

async function measure(semanticRerank, clearEmbeddingCache, count, delayMs = 0) {
  clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async (_url, init) => {
    providerCalls += 1;
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const inputs = JSON.parse(init.body).input;
    return { ok: true, json: async () => ({ data: responseFor(inputs).map((embedding, index) => ({ index, embedding })) }) };
  };
  const warmDurations = [];
  let diagnostics;
  let coldMs = 0;
  try {
    const started = process.hrtime.bigint();
    const coldResult = await semanticRerank("official Bengali scholarship", makeResults(count), `benchmark-${count}-${delayMs}`);
    coldMs = Number(process.hrtime.bigint() - started) / 1e6;
    diagnostics = coldResult.diagnostics;
    for (let run = 0; run < RUNS; run += 1) {
      const warmStarted = process.hrtime.bigint();
      const result = await semanticRerank("official Bengali scholarship", makeResults(count), `benchmark-${count}-${delayMs}`);
      warmDurations.push(Number(process.hrtime.bigint() - warmStarted) / 1e6);
      diagnostics = result.diagnostics;
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  return {
    candidates: count,
    runs: RUNS,
    delayMs,
    coldMs,
    warmAvgMs: average(warmDurations),
    warmP50Ms: percentile(warmDurations, 50),
    warmP95Ms: percentile(warmDurations, 95),
    providerCalls,
    topKOverlap: diagnostics.topKOverlap,
    rerankedCount: diagnostics.rerankedCount,
  };
}

async function measureFallback(semanticRerank, clearEmbeddingCache) {
  clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const started = process.hrtime.bigint();
  let failed = false;
  try {
    await semanticRerank("official Bengali scholarship", makeResults(20), "benchmark-failure");
  } catch {
    failed = true;
  } finally {
    globalThis.fetch = originalFetch;
  }
  return { durationMs: Number(process.hrtime.bigint() - started) / 1e6, failed };
}

const { directory, semanticRerank, clearEmbeddingCache } = await loadImplementation();
try {
  const local = [];
  const withNetworkDelay = [];
  for (const count of CANDIDATE_COUNTS) {
    local.push(await measure(semanticRerank, clearEmbeddingCache, count));
    withNetworkDelay.push(await measure(semanticRerank, clearEmbeddingCache, count, 50));
  }
  const fallback = await measureFallback(semanticRerank, clearEmbeddingCache);
  console.log(JSON.stringify({ benchmark: "semantic-rerank", dimensions: DIMENSIONS, local, withNetworkDelay, fallback }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
