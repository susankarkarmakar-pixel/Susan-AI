import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30);
const MAX_RATE_LIMIT_KEYS = 10_000;
const requestLog = new Map<string, number[]>();
let upstashLimiter: Ratelimit | null | undefined;

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("The shared rate-limiting service is unavailable.");
    this.name = "RateLimitUnavailableError";
  }
}

export function getClientIdentifier(request: Request): string {
  // Forwarded headers are client-controlled unless the deployment proxy is trusted.
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded && isSafeIdentifier(forwarded)) return forwarded;
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp && isSafeIdentifier(realIp)) return realIp;
  }
  return "anonymous";
}

export async function enforceRateLimit(clientId: string): Promise<boolean> {
  const hasUpstashConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const requestedBackend = process.env.RATE_LIMIT_BACKEND;
  const backend = requestedBackend || (hasUpstashConfig ? "upstash" : "memory");

  // Missing Redis configuration never blocks local development. The bounded memory
  // limiter is the safe fallback; it is not suitable as the production multi-instance backend.
  if (backend === "upstash" && !hasUpstashConfig) return isWithinMemoryRateLimit(clientId);
  if (backend === "upstash") return enforceUpstashLimit(clientId);
  if (backend === "memory") return isWithinMemoryRateLimit(clientId);
  throw new RateLimitUnavailableError();
}

export const RATE_LIMIT_RETRY_AFTER_SECONDS = RATE_LIMIT_WINDOW_SECONDS;

async function enforceUpstashLimit(clientId: string): Promise<boolean> {
  const limiter = getUpstashLimiter();
  if (!limiter) return isWithinMemoryRateLimit(clientId);
  try {
    const result = await limiter.limit(clientId);
    return result.success;
  } catch {
    // Fail closed when Redis was configured but unavailable. This prevents an
    // outage from silently removing protection on a public endpoint.
    throw new RateLimitUnavailableError();
  }
}

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter !== undefined) return upstashLimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashLimiter = null;
    return upstashLimiter;
  }
  upstashLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, `${RATE_LIMIT_WINDOW_SECONDS} s`),
    prefix: "susan-ai:rate",
  });
  return upstashLimiter;
}

function isWithinMemoryRateLimit(clientId: string): boolean {
  const now = Date.now();
  if (requestLog.size >= MAX_RATE_LIMIT_KEYS && !requestLog.has(clientId)) {
    for (const [key, timestamps] of requestLog) {
      if (timestamps.every((timestamp) => now - timestamp >= RATE_LIMIT_WINDOW_SECONDS * 1000)) requestLog.delete(key);
    }
  }
  const recent = (requestLog.get(clientId) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_SECONDS * 1000);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(clientId, recent);
    return false;
  }
  recent.push(now);
  requestLog.set(clientId, recent);
  return true;
}

function isSafeIdentifier(value: string): boolean {
  return value.length <= 128 && /^[a-zA-Z0-9:.[\]-]+$/.test(value);
}
