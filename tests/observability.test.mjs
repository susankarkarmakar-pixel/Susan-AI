import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../lib/observability.ts", import.meta.url), "utf8");
const middleware = await readFile(new URL("../middleware.ts", import.meta.url), "utf8");

test("observability uses a redacted correlation ID and standard header", () => {
  assert.match(source, /REQUEST_ID_HEADER = "x-request-id"/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /safeErrorDetails/);
  assert.doesNotMatch(source, /prompt|apiKey|responseText|documentText/i);
});

test("API middleware propagates correlation IDs", () => {
  assert.match(middleware, /matcher: \["\/api\/:path\*"\]/);
  assert.match(middleware, /REQUEST_ID_HEADER/);
  assert.match(middleware, /NextResponse\.next/);
});
