import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getCustomModelConfig, getModelConfig, isInstantChatProvider, ModelProvider } from "@/lib/ai-providers";
import { CustomProvider, isAllowedBaseUrl } from "@/lib/custom-providers";
import { assertCustomProviderHostResolvesSafely, UnsafeCustomProviderHostError } from "@/lib/custom-provider-dns-guard";
import { enforceRateLimit, getClientIdentifier, RateLimitUnavailableError, RATE_LIMIT_RETRY_AFTER_SECONDS } from "@/lib/rate-limit";
import { mapProviderError } from "@/lib/provider-errors.mjs";
import { createCorrelationId, createErrorDiagnostic, formatDiagnosticMessage } from "@/lib/error-diagnostics.mjs";

const MAX_BODY_BYTES = 16_000;

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  const respondError = (message: string, status: number, headers: Record<string, string> = {}, code?: string) => jsonError(message, status, headers, correlationId, code);
  let selectedProvider = "";
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return respondError("Content-Type must be application/json.", 415);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_BODY_BYTES) return respondError("Request is too large.", 413);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respondError("Invalid JSON request body.", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body) || new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_BODY_BYTES) return respondError("Invalid request body.", 400);
    const input = body as Record<string, unknown>;
    const provider = typeof input.provider === "string" ? input.provider : "";
    selectedProvider = provider;
    const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
    const isCustom = provider.startsWith("custom_");
    const isLocal = isCustom && isLocalCustomProvider(input.customProvider);
    if ((!isLocal && (apiKey.length < 8 || apiKey.length > 500)) || (isLocal && apiKey !== "local")) return respondError(isLocal ? "Local provider authentication marker is invalid." : "A valid provider API key is required.", 400, {}, "PROVIDER_AUTH");
    const cloudflareAccountId = typeof input.cloudflareAccountId === "string" ? input.cloudflareAccountId.trim() : "";
    if (provider === "cloudflare" && !/^[a-f0-9]{32}$/i.test(cloudflareAccountId)) return respondError("A valid 32-character Cloudflare Account ID is required. Add it in Settings.", 400, {}, "PROVIDER_AUTH");
    if (!(await enforceRateLimit(getClientIdentifier(request)))) return respondError("Too many provider tests. Please wait and try again.", 429, { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) }, "REQUEST_RATE_LIMITED");

    let model;
    if (isCustom) {
      if (!isValidCustomProvider(input.customProvider, provider)) return respondError("Custom provider configuration is invalid.", 400);
      try {
        await assertCustomProviderHostResolvesSafely(input.customProvider.baseUrl);
      } catch (error) {
        if (error instanceof UnsafeCustomProviderHostError) return respondError(error.message, 400);
        throw error;
      }
      model = getCustomModelConfig(input.customProvider, apiKey);
    } else {
      if (!isInstantChatProvider(provider)) return respondError("This provider does not support an instant connection test.", 400);
      model = getModelConfig(provider as ModelProvider, apiKey, { cloudflareAccountId });
    }

    await generateText({
      model,
      prompt: "Reply with the single word OK.",
      maxOutputTokens: 2,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(15_000),
    });
    return NextResponse.json({ ok: true, message: "Provider connection verified.", correlationId }, { headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlationId } });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return respondError("Security rate limiting is temporarily unavailable. Try again shortly.", 503, { "Retry-After": "30" }, "INTERNAL_ERROR");
    const diagnosis = mapProviderError(error, selectedProvider);
    const headers: Record<string, string> = {};
    if (diagnosis.retryAfterSeconds) headers["Retry-After"] = String(diagnosis.retryAfterSeconds || RATE_LIMIT_RETRY_AFTER_SECONDS);
    console.error(JSON.stringify({ event: "provider_test_failed", code: diagnosis.code, correlationId, status: diagnosis.status }));
    return respondError(`Connection failed: ${diagnosis.message}`, diagnosis.status, headers, diagnosis.code);
  }
}

function isValidCustomProvider(value: unknown, expectedId: string): value is CustomProvider {
  if (!value || typeof value !== "object") return false;
  const provider = value as Partial<CustomProvider>;
  return provider.id === expectedId && typeof provider.name === "string" && provider.name.length <= 100 && typeof provider.model === "string" && provider.model.length > 0 && provider.model.length <= 200 && typeof provider.baseUrl === "string" && isAllowedBaseUrl(provider.baseUrl);
}

function isLocalCustomProvider(value: unknown): value is CustomProvider {
  return Boolean(value && typeof value === "object" && (value as Partial<CustomProvider>).local === true && (value as Partial<CustomProvider>).requiresApiKey === false);
}

function jsonError(error: string, status: number, headers: Record<string, string> = {}, correlationId = createCorrelationId(), code?: string) {
  const diagnostic = createErrorDiagnostic(error, status, correlationId, code);
  return NextResponse.json({ ...diagnostic, error: formatDiagnosticMessage(diagnostic.error, diagnostic.code, diagnostic.correlationId) }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Correlation-ID": diagnostic.correlationId, ...headers },
  });
}
