import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { isAllowedCustomProviderUrl, isPrivateOrReservedHost } from "../lib/url-safety.mjs";

// Regression test for an SSRF: isAllowedBaseUrl used to accept any https://
// hostname with no private/internal-address check at all, so a custom
// provider could point the server's own outbound fetch at cloud metadata
// endpoints, internal services, or other private-network targets.

test("rejects literal private, loopback, and link-local IPv4 hosts over https", () => {
  const blocked = [
    "https://169.254.169.254/latest/meta-data/", // cloud metadata endpoint
    "https://10.0.0.5:8443/admin",
    "https://172.16.0.1/",
    "https://192.168.1.1/",
    "https://127.0.0.1/",
    "https://0.0.0.0/",
    "https://100.64.0.1/", // carrier-grade NAT
  ];
  for (const url of blocked) assert.equal(isAllowedCustomProviderUrl(url), false, `${url} must be rejected`);
});

test("rejects obfuscated IPv4 literals that the URL parser canonicalizes", () => {
  const blocked = [
    "https://2130706433/", // decimal for 127.0.0.1
    "https://0x7f000001/", // hex for 127.0.0.1
    "https://0177.0.0.1/", // octal-looking for 127.0.0.1
    "https://127.1/", // shorthand for 127.0.0.1
  ];
  for (const url of blocked) assert.equal(isAllowedCustomProviderUrl(url), false, `${url} must be rejected`);
});

test("rejects IPv4-mapped IPv6 private addresses", () => {
  const blocked = [
    "https://[::ffff:127.0.0.1]/",
    "https://[::ffff:a9fe:a9fe]/", // 169.254.169.254 in hex-mapped form
    "https://[::1]/",
    "https://[fe80::1]/",
    "https://[fc00::1]/",
  ];
  for (const url of blocked) assert.equal(isAllowedCustomProviderUrl(url), false, `${url} must be rejected`);
});

test("still allows ordinary public https hosts and the documented local-tool http hosts", () => {
  const allowed = ["https://api.openai.com/v1", "https://openrouter.ai/api/v1", "http://localhost:11434/v1", "http://127.0.0.1:1234/v1", "http://[::1]:11434/v1"];
  for (const url of allowed) assert.equal(isAllowedCustomProviderUrl(url), true, `${url} must still be allowed`);
});

test("rejects http to any host other than the three documented local-tool loopback hosts", () => {
  const blocked = ["http://api.openai.com/v1", "http://10.0.0.5/v1", "http://example.com/v1"];
  for (const url of blocked) assert.equal(isAllowedCustomProviderUrl(url), false, `${url} must be rejected`);
});

test("rejects malformed URLs instead of throwing", () => {
  assert.equal(isAllowedCustomProviderUrl("not a url"), false);
  assert.equal(isAllowedCustomProviderUrl(""), false);
});

test("isPrivateOrReservedHost recognizes bare IPs as returned by DNS lookups", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.1", "::1", "fe80::1", "fc00::1"]) {
    assert.equal(isPrivateOrReservedHost(ip), true, `${ip} must be recognized as private/reserved`);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1"]) {
    assert.equal(isPrivateOrReservedHost(ip), false, `${ip} must be recognized as public`);
  }
});

test("custom-providers.ts delegates to the shared SSRF-safe checker", async () => {
  const source = await readFile(new URL("../lib/custom-providers.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ isAllowedCustomProviderUrl \} from "@\/lib\/url-safety\.mjs"/, "custom-providers.ts must import the shared checker");
  assert.match(source, /export function isAllowedBaseUrl\(value: string\): boolean \{\s*return isAllowedCustomProviderUrl\(value\);/, "isAllowedBaseUrl must delegate, not reimplement, URL validation");
});

test("chat route and provider test route resolve custom provider hosts before fetching them", async () => {
  const chatRoute = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  const testRoute = await readFile(new URL("../app/api/providers/test/route.ts", import.meta.url), "utf8");
  for (const [label, source] of [["chat route", chatRoute], ["provider test route", testRoute]]) {
    assert.match(source, /import \{ assertCustomProviderHostResolvesSafely, UnsafeCustomProviderHostError \} from "@\/lib\/custom-provider-dns-guard"/, `${label} must import the DNS-rebinding guard`);
    assert.match(source, /await assertCustomProviderHostResolvesSafely\(/, `${label} must call the DNS-rebinding guard before building a custom model`);
  }
});
