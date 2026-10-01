import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/sign-in/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/auth/google/route.ts", import.meta.url), "utf8");

test("sign-in page keeps unavailable providers honest and accessible", () => {
  assert.match(page, /Google sign-in is the available secure option right now/);
  assert.match(page, /GitHub sign-in not connected/);
  assert.match(page, /Apple sign-in not connected/);
  assert.match(page, /aria-live="polite"/);
});

test("email sign-in validates input and clearly communicates its availability", () => {
  assert.match(page, /inputMode="email"/);
  assert.match(page, /required maxLength=\{254\}/);
  assert.match(page, /Enter a valid email address/);
  assert.match(page, /Email sign-in is coming soon/);
});

test("unconfigured Google OAuth returns users to the branded sign-in page", () => {
  assert.match(route, /NextResponse\.redirect\(`\$\{getAppUrl\(request\)\}\/sign-in\?auth_error=/);
  assert.match(route, /GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and AUTH_SECRET/);
});
