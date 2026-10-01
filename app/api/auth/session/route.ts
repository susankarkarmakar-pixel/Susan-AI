import { NextResponse } from "next/server";
import { getSessionCookieName, isGoogleAuthConfigured, readCookie, verifySessionToken } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = readCookie(request, getSessionCookieName());
  const user = token ? await verifySessionToken(token) : null;
  return NextResponse.json({ user, googleConfigured: isGoogleAuthConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
