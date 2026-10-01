import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAppUrl, isGoogleAuthConfigured, stateCookie } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isGoogleAuthConfigured()) {
    const message = encodeURIComponent("Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and AUTH_SECRET in Vercel.");
    return NextResponse.redirect(`${getAppUrl(request)}/sign-in?auth_error=${message}`);
  }
  const state = randomBytes(32).toString("hex");
  const callback = `${getAppUrl(request)}/api/auth/google/callback`;
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: callback, response_type: "code", scope: "openid email profile", access_type: "online", prompt: "select_account", state });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.headers.append("Set-Cookie", stateCookie(state, new URL(request.url).protocol === "https:"));
  return response;
}
