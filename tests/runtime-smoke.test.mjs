import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { test, before, after } from "node:test";

const port = 3123;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  const nextCommand = process.platform === "win32" ? "node_modules/.bin/next.cmd" : "node_modules/.bin/next";
  server = spawn(nextCommand, ["start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The Next.js server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const output = `${server.stdout.read() || ""}${server.stderr.read() || ""}`;
  throw new Error(`Production server did not become ready.\n${output}`);
});

after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
});

test("health endpoint responds successfully", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("PWA manifest is installable and all launcher icons are served", async () => {
  const response = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(response.status, 200);
  const manifest = await response.json();
  assert.equal(manifest.name, "Susan AI — Sanket Pixel Technologies");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));

  for (const path of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png"]) {
    const icon = await fetch(`${baseUrl}${path}`);
    assert.equal(icon.status, 200, `${path} must be available to the browser installer`);
    assert.match(icon.headers.get("content-type") || "", /image\/png/);
  }

  const page = await fetch(`${baseUrl}/`);
  const html = await page.text();
  assert.match(html, /rel="manifest"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /viewport-fit=cover/);
});

test("chat route rejects non-JSON requests", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not-json",
  });
  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "Content-Type must be application/json." });
});

test("chat route rejects async-only providers", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "manus",
      apiKey: "placeholder-key",
      messages: [{ role: "user", content: "test" }],
    }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "This provider is not available for instant chat." });
});

test("Jules route requires JSON and a valid API key", async () => {
  const wrongContentType = await fetch(`${baseUrl}/api/jules`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not-json",
  });
  assert.equal(wrongContentType.status, 415);

  const missingKey = await fetch(`${baseUrl}/api/jules`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "list-sources" }),
  });
  assert.equal(missingKey.status, 400);
  assert.deepEqual(await missingKey.json(), { error: "A valid Jules API key is required. Add or re-check it in Settings." });
});

test("Jules route rejects invalid actions, source names, branches, and session IDs before upstream calls", async () => {
  const post = (body) => fetch(`${baseUrl}/api/jules`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: "placeholder-test-key", ...body }),
  });

  const invalidAction = await post({ action: "arbitrary-url" });
  assert.equal(invalidAction.status, 400);
  assert.deepEqual(await invalidAction.json(), { error: "Unsupported Jules action." });

  const invalidSource = await post({ action: "create-session", source: "https://attacker.invalid", branch: "main", prompt: "Fix a test" });
  assert.equal(invalidSource.status, 400);
  assert.deepEqual(await invalidSource.json(), { error: "Select a valid Jules repository source." });

  const invalidBranch = await post({ action: "create-session", source: "sources/github-owner-repo", branch: "../private", prompt: "Fix a test" });
  assert.equal(invalidBranch.status, 400);
  assert.deepEqual(await invalidBranch.json(), { error: "Select a valid repository branch." });

  const invalidSession = await post({ action: "get-session", sessionId: "sessions/123" });
  assert.equal(invalidSession.status, 400);
  assert.deepEqual(await invalidSession.json(), { error: "A valid Jules session ID is required." });
});

test("provider connection route validates content type, keys, and instant-chat support", async () => {
  const wrongContentType = await fetch(`${baseUrl}/api/providers/test`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not-json",
  });
  assert.equal(wrongContentType.status, 415);

  const missingKey = await fetch(`${baseUrl}/api/providers/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "openai" }),
  });
  assert.equal(missingKey.status, 400);
  assert.deepEqual(await missingKey.json(), { error: "A valid provider API key is required." });

  const asyncOnly = await fetch(`${baseUrl}/api/providers/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "jules", apiKey: "placeholder-test-key" }),
  });
  assert.equal(asyncOnly.status, 400);
  assert.deepEqual(await asyncOnly.json(), { error: "This provider does not support an instant connection test." });
});

test("chat route recognizes every instant-chat provider before credential validation", async () => {
  const providers = ["deepseek", "anthropic", "huggingface", "google", "openai", "qwen", "kimi", "sarvam", "openrouter", "groq", "cerebras", "mistral", "nvidia", "cloudflare", "sambanova"];
  for (const provider of providers) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, apiKey: "short", messages: [{ role: "user", content: "test" }] }),
    });
    assert.equal(response.status, 400, `${provider} should reach credential validation`);
    assert.deepEqual(await response.json(), { error: "A valid API key is required." });
  }
});

test("Cloudflare connection tests require its separate account ID before any upstream call", async () => {
  const response = await fetch(`${baseUrl}/api/providers/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "cloudflare", apiKey: "placeholder-test-key" }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "A valid 32-character Cloudflare Account ID is required. Add it in Settings." });
});

test("chat route rejects malformed message parts", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "openai",
      apiKey: "placeholder-key",
      messages: [{ role: "user", parts: [{ type: "file", mediaType: "application/octet-stream", filename: "bad.bin", url: "data:application/octet-stream;base64,AAAA" }] }],
    }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "No valid messages found." });
});

test("chat route rejects valid file parts for providers without file support", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "deepseek",
      apiKey: "placeholder-key",
      messages: [{ role: "user", parts: [{ type: "file", mediaType: "text/plain", filename: "notes.txt", url: "data:text/plain;base64,SGk=" }] }],
    }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "The selected provider does not support file attachments. Choose a vision/file-capable provider." });
});

test("chat errors are not cacheable", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "openai", apiKey: "short", messages: [] }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rate limiting returns Retry-After after the configured burst", async () => {
  let throttled;
  for (let index = 0; index < 35; index += 1) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (response.status === 429) {
      throttled = response;
      break;
    }
  }
  assert.ok(throttled, "expected the memory limiter to throttle the burst");
  assert.equal(throttled.headers.get("retry-after"), "60");
});
