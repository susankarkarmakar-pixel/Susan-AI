import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/sign-in/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/auth/google/route.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
const sessionRoute = await readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8");

test("sign-in page keeps unavailable providers honest and accessible", () => {
  assert.match(page, /Google sign-in is available securely/);
  assert.match(page, /GitHub sign-in not connected/);
  assert.match(page, /Apple sign-in not connected/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /Secure OAuth/);
  assert.match(page, /googleConfigured !== true/);
  assert.match(page, /Google sign-in unavailable/);
  assert.match(page, /email sign-in \(coming soon\)/);
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

test("sign-in handles failed session checks and OAuth upstream failures", () => {
  assert.match(page, /if \(!response\.ok\) throw new Error\(`Session check failed/);
  assert.match(callback, /Could not reach Google to complete sign-in/);
  assert.match(callback, /Could not reach Google to load your profile/);
  assert.match(callback, /\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
});

test("session exposes provider readiness without exposing OAuth secrets", () => {
  assert.match(sessionRoute, /isGoogleAuthConfigured/);
  assert.match(sessionRoute, /googleConfigured/);
  assert.doesNotMatch(sessionRoute, /GOOGLE_CLIENT_SECRET/);
});
