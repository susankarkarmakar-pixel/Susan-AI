import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../local/airllm-server/server.py", import.meta.url), "utf8");
const readme = await readFile(new URL("../local/airllm-server/README.md", import.meta.url), "utf8");

test("AirLLM sidecar exposes a local-only OpenAI-compatible contract", () => {
  assert.match(source, /@app\.get\("\/health"\)/);
  assert.match(source, /@app\.get\("\/v1\/models"\)/);
  assert.match(source, /@app\.post\("\/v1\/chat\/completions"\)/);
  assert.match(source, /allow_origins=\["http:\/\/localhost:3000", "http:\/\/127\.0\.0\.1:3000"\]/);
  assert.match(source, /AIRLLM_MODEL/);
  assert.match(source, /Load AirLLM only when a chat request arrives/);
  assert.match(source, /status.*configured/);
  assert.match(source, /TextIteratorStreamer/);
  assert.match(source, /streamer=streamer/);
  assert.match(source, /buffered chunk/);
});

test("AirLLM sidecar documentation prevents accidental public or automatic model use", () => {
  assert.match(readme, /binds to `127\.0\.0\.1` only/);
  assert.match(readme, /does \*\*not\*\* download or load a model at startup/);
  assert.match(readme, /Do not expose this endpoint to the public internet/);
  assert.match(readme, /TextIteratorStreamer/);
});
