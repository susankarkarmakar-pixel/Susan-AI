import { lookup } from "node:dns/promises";
import { isPrivateOrReservedHost } from "@/lib/url-safety.mjs";

/**
 * isAllowedBaseUrl (lib/custom-providers.ts) only catches a literal private
 * IP in the URL itself. A public-looking hostname that *resolves* to a
 * private/internal address (classic DNS-rebinding) would still slip through
 * that check. This guard closes that gap by resolving the hostname at
 * request time, immediately before the server makes the real request, and
 * rejecting it if any resolved address is private/internal.
 *
 * Server-only: uses node:dns, so this must never be imported from client code.
 */
export class UnsafeCustomProviderHostError extends Error {
  constructor() {
    super("This custom provider's address resolves to a private or internal network location and cannot be used.");
    this.name = "UnsafeCustomProviderHostError";
  }
}

export async function assertCustomProviderHostResolvesSafely(baseUrl: string): Promise<void> {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") return; // http is already restricted to literal loopback hosts upstream
  if (isPrivateOrReservedHost(url.hostname)) throw new UnsafeCustomProviderHostError();

  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeCustomProviderHostError();
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateOrReservedHost(entry.address))) {
    throw new UnsafeCustomProviderHostError();
  }
}
