import { SignJWT, jwtVerify } from "jose";

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

const SESSION_COOKIE = "susan_ai_session";
const STATE_COOKIE = "susan_ai_oauth_state";

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getStateCookieName() {
  return STATE_COOKIE;
}

export function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  return new TextEncoder().encode(secret);
}

export function getAppUrl(request: Request): string {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_SECRET);
}

export async function createSessionToken(user: GoogleUser): Promise<string> {
  return new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<GoogleUser | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : payload.email, picture: typeof payload.picture === "string" ? payload.picture : undefined };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function stateCookie(state: string, secure: boolean): string {
  return `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`;
}

export function clearStateCookie(secure: boolean): string {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}
