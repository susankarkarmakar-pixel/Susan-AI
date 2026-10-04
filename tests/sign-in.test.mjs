import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/sign-in/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/auth/google/route.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
const sessionRoute = await readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8");

test("sign-in page clearly defers accounts and preserves the local-first promise", () => {
  assert.match(page, /Sign-in is planned for a future version/);
  assert.match(page, /currently works without an account/);
  assert.match(page, /Conversations and settings remain in this browser/);
  assert.match(page, /Continue without sign-in/);
});

test("deferred sign-in page explains future sync consent", () => {
  assert.match(page, /accounts are introduced/);
  assert.match(page, /clearly explain what data is synced/);
  assert.doesNotMatch(page, /googleConfigured/);
  assert.doesNotMatch(page, /inputMode="email"/);
});

test("unconfigured Google OAuth returns users to the branded sign-in page", () => {
  assert.match(route, /NextResponse\.redirect\(`\$\{getAppUrl\(request\)\}\/sign-in\?auth_error=/);
  assert.match(route, /GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and AUTH_SECRET/);
});

test("retained OAuth routes still handle upstream failures safely", () => {
  assert.match(callback, /Could not reach Google to complete sign-in/);
  assert.match(callback, /Could not reach Google to load your profile/);
  assert.match(callback, /\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
});

test("session exposes provider readiness without exposing OAuth secrets", () => {
  assert.match(sessionRoute, /isGoogleAuthConfigured/);
  assert.match(sessionRoute, /googleConfigured/);
  assert.doesNotMatch(sessionRoute, /GOOGLE_CLIENT_SECRET/);
});
