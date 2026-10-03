/**
 * Shared, dependency-free helpers for deciding whether a custom-provider
 * base URL is safe to let the server fetch.
 *
 * Without this check, any HTTPS hostname was accepted (see isAllowedBaseUrl's
 * history): a user-supplied custom provider could point at a private/internal
 * address and the server would fetch it on their behalf (SSRF). WHATWG URL
 * parsing already canonicalizes obfuscated IPv4 literals (decimal/hex/octal/
 * shorthand) into dotted-decimal form before this code ever sees `hostname`,
 * so only the canonical forms need to be checked here.
 *
 * This module intentionally has zero imports so it can run unmodified in the
 * browser (client-side validation in Settings) and in Node (server-side
 * validation before an outbound request, including the DNS-resolution check
 * in lib/custom-provider-dns-guard.ts).
 */

const LOCAL_HTTP_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * @param {number[]} octets
 * @returns {boolean}
 */
function isPrivateOrReservedIPv4(octets) {
  const [a, b, c] = octets;
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true; // malformed, reject closed
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 special-use (incl. relay anycast)
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // 224.0.0.0+ multicast, reserved, broadcast
  return false;
}

/**
 * True if `hostname` (as it appears in a parsed URL, brackets and all for
 * IPv6) or a bare IP address string (as returned by dns.lookup) is a
 * loopback, private, link-local, or otherwise non-public address.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isPrivateOrReservedHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost") return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) return isPrivateOrReservedIPv4(ipv4.slice(1, 5).map(Number));

  if (host === "::" || host === "::1") return true; // unspecified / loopback
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true; // fc00::/7 unique local

  // IPv4-mapped/compatible IPv6: ::ffff:a.b.c.d or ::ffff:HHHH:HHHH
  const mappedDotted = host.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (mappedDotted) return isPrivateOrReservedIPv4(mappedDotted.slice(1, 5).map(Number));
  const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateOrReservedIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }

  return false;
}

/**
 * Full replacement for the old `isAllowedBaseUrl`: http is only ever allowed
 * to the three documented local-tool loopback hosts (Ollama/LM Studio); https
 * is allowed to any host that isn't a private/internal/loopback address.
 * @param {string} value
 * @returns {boolean}
 */
export function isAllowedCustomProviderUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:") return LOCAL_HTTP_HOSTS.includes(url.hostname);
    if (url.protocol !== "https:") return false;
    return !isPrivateOrReservedHost(url.hostname);
  } catch {
    return false;
  }
}
