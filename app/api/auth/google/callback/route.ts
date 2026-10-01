import { NextResponse } from "next/server";
import { clearStateCookie, createSessionToken, getAppUrl, getStateCookieName, isGoogleAuthConfigured, readCookie, sessionCookie } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const secure = url.protocol === "https:";
  const failure = (message: string) => {
    const response = NextResponse.redirect(`${getAppUrl(request)}/sign-in?auth_error=${encodeURIComponent(message)}`);
    response.headers.append("Set-Cookie", clearStateCookie(secure));
    return response;
  };

  if (error) return failure("Google sign-in was cancelled.");
  if (!isGoogleAuthConfigured()) return failure("Google sign-in is not configured yet.");
  if (!code || !state || state !== readCookie(request, getStateCookieName())) return failure("Google sign-in could not be verified. Please try again.");

  const redirectUri = `${getAppUrl(request)}/api/auth/google/callback`;
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
  } catch {
    return failure("Could not reach Google to complete sign-in. Please try again.");
  }
  if (!tokenResponse.ok) return failure("Google did not accept the sign-in request.");
  const tokenData = await tokenResponse.json().catch(() => ({})) as { access_token?: string };
  if (!tokenData.access_token) return failure("Google did not return an access token.");

  let profileResponse: Response;
  try {
    profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  } catch {
    return failure("Could not reach Google to load your profile. Please try again.");
  }
  if (!profileResponse.ok) return failure("Could not load your Google profile.");
  const profile = await profileResponse.json().catch(() => ({})) as { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean };
  if (!profile.sub || !profile.email || profile.email_verified === false) return failure("Google did not provide a verified email address.");

  try {
    const token = await createSessionToken({ sub: profile.sub, email: profile.email, name: profile.name || profile.email, picture: profile.picture });
    const response = NextResponse.redirect(`${getAppUrl(request)}/dashboard`);
    response.headers.append("Set-Cookie", sessionCookie(token, secure));
    response.headers.append("Set-Cookie", clearStateCookie(secure));
    return response;
  } catch (reason) {
    return failure(reason instanceof Error ? reason.message : "Could not create a sign-in session.");
  }
}
