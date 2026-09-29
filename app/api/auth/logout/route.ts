import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie(new URL(request.url).protocol === "https:"));
  return response;
}
