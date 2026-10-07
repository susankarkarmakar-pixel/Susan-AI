import { NextResponse } from "next/server";
import { createCorrelationId, REQUEST_ID_HEADER } from "@/lib/observability";

export function middleware(request: Request) {
  const correlationId = createCorrelationId();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, correlationId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
