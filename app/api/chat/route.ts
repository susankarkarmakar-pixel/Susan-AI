import { convertToModelMessages, streamText } from "ai";
import { getCustomModelConfig, getModelConfig, isInstantChatProvider, MODELS_METADATA, ModelProvider } from "@/lib/ai-providers";
import { CustomProvider, isAllowedBaseUrl } from "@/lib/custom-providers";
import { enforceRateLimit, getClientIdentifier, RateLimitUnavailableError, RATE_LIMIT_RETRY_AFTER_SECONDS } from "@/lib/rate-limit";
import { mapProviderError } from "@/lib/provider-errors.mjs";
import { NextResponse } from "next/server";

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 100_000;
const MAX_MESSAGE_PARTS = 24;
const MAX_BODY_BYTES = 20_000_000;
const MAX_FILE_DATA_URL_LENGTH = 16_000_000;
export async function POST(req: Request) {
  let requestedProvider = "";
  try {
    if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) return jsonError("Content-Type must be application/json.", 415);
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) return jsonError("Request is too large. Keep attachments under 20 MB total.", 413);
    const clientId = getClientIdentifier(req);
    if (!(await enforceRateLimit(clientId))) return jsonError("Too many requests. Please wait a moment and try again.", 429, { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) });

    const body: unknown = await req.json();
    const parsedBodyBytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
    if (parsedBodyBytes > MAX_BODY_BYTES) return jsonError("Request is too large. Keep attachments under 20 MB total.", 413);
    if (!body || typeof body !== "object") return jsonError("Invalid request body.", 400);
    const { messages, provider, apiKey, language, customProvider } = body as { messages?: unknown; provider?: unknown; apiKey?: unknown; language?: unknown; customProvider?: unknown };
    requestedProvider = typeof provider === "string" ? provider : "";
    const isCustom = typeof provider === "string" && provider.startsWith("custom_");
    if (typeof provider !== "string" || (!isInstantChatProvider(provider) && !isCustom)) return jsonError("This provider is not available for instant chat.", 400);
    if (typeof apiKey !== "string" || apiKey.trim().length < 8 || apiKey.length > 500) return jsonError("A valid API key is required.", 400);
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return jsonError("Messages must contain between 1 and 100 items.", 400);

    const validMessages = messages.filter(isUIMessage).slice(-MAX_MESSAGES);
    if (validMessages.length === 0) return jsonError("No valid messages found.", 400);
    if ((!isCustom && !MODELS_METADATA[provider as keyof typeof MODELS_METADATA].capabilities.files) && validMessages.some((message) => message.parts?.some(isFilePart))) {
      return jsonError("The selected provider does not support file attachments. Choose a vision/file-capable provider.", 400);
    }

    const modelMessages = validMessages.some((message) => Array.isArray(message.parts))
      ? await convertToModelMessages(validMessages as never)
      : validMessages
          .filter((message) => typeof message.content === "string" && message.content.length <= MAX_MESSAGE_LENGTH)
          .map((message) => ({ role: message.role, content: message.content as string }));
    if (modelMessages.length === 0) return jsonError("No valid message content found.", 400);

    const languageInstruction = language === "bn" ? "Respond in Bengali unless the user asks for another language." : language === "en" ? "Respond in English unless the user asks for another language." : "";
    let model: ReturnType<typeof getModelConfig>;
    if (isCustom) {
      if (!isValidCustomProvider(customProvider, provider)) return jsonError("Custom provider configuration is invalid.", 400);
      model = getCustomModelConfig(customProvider, apiKey.trim());
    } else {
      model = getModelConfig(provider as ModelProvider, apiKey.trim());
    }
    const result = streamText({ model, messages: languageInstruction ? [{ role: "system", content: languageInstruction }, ...modelMessages] : modelMessages });
    const anyResult = result as unknown as { toUIMessageStreamResponse?: (options?: { onError?: (error: unknown) => string }) => Response; toDataStreamResponse?: () => Response; toTextStreamResponse?: () => Response };
    const response = anyResult.toUIMessageStreamResponse?.({ onError: (error) => providerStreamError(error, requestedProvider) }) ?? anyResult.toDataStreamResponse?.() ?? anyResult.toTextStreamResponse?.() ?? jsonError("Streaming is unavailable.", 500);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error: unknown) {
    if (error instanceof RateLimitUnavailableError) return jsonError("Security rate limiting is temporarily unavailable. Please try again shortly.", 503, { "Retry-After": "30" });
    const rawMessage = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
    if (rawMessage.toLowerCase().includes("json") || rawMessage.toLowerCase().includes("unexpected end")) return jsonError("Invalid JSON request body.", 400);
    if (rawMessage.includes("asynchronous") || rawMessage.includes("instant chat")) return jsonError(rawMessage, 400);
    const diagnosis = mapProviderError(error, requestedProvider);
    const headers: Record<string, string> = {};
    if (diagnosis.retryAfterSeconds) headers["Retry-After"] = String(diagnosis.retryAfterSeconds || RATE_LIMIT_RETRY_AFTER_SECONDS);
    return jsonError(diagnosis.message, diagnosis.status, headers);
  }
}

function isUIMessage(value: unknown): value is { role: "user" | "assistant"; parts?: unknown[]; content?: unknown } {
  if (!value || typeof value !== "object") return false;
  const message = value as { role?: unknown; parts?: unknown; content?: unknown };
  if (message.role !== "user" && message.role !== "assistant") return false;
  if (typeof message.content === "string") return message.content.length <= MAX_MESSAGE_LENGTH;
  return Array.isArray(message.parts) && message.parts.length <= MAX_MESSAGE_PARTS && message.parts.every(isUIPart);
}

function isUIPart(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const part = value as { type?: unknown; text?: unknown; mediaType?: unknown; filename?: unknown; url?: unknown };
  if (part.type === "text" || part.type === "reasoning") return typeof part.text === "string" && part.text.length <= MAX_MESSAGE_LENGTH;
  if (part.type !== "file") return false;
  if (typeof part.mediaType !== "string" || typeof part.filename !== "string" || typeof part.url !== "string") return false;
  if (part.filename.length === 0 || part.filename.length > 255 || part.url.length > MAX_FILE_DATA_URL_LENGTH) return false;
  if (!(part.url.startsWith("data:image/") || part.url.startsWith("data:application/pdf") || part.url.startsWith("data:text/"))) return false;
  return part.mediaType.startsWith("image/") || ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"].includes(part.mediaType);
}

function isFilePart(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "file");
}

function isValidCustomProvider(value: unknown, expectedId: string): value is CustomProvider {
  if (!value || typeof value !== "object") return false;
  const provider = value as Partial<CustomProvider>;
  return provider.id === expectedId && typeof provider.name === "string" && provider.name.length <= 100 && typeof provider.model === "string" && provider.model.length > 0 && provider.model.length <= 200 && typeof provider.baseUrl === "string" && isAllowedBaseUrl(provider.baseUrl);
}

function jsonError(error: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function providerStreamError(error: unknown, provider: string): string {
  return mapProviderError(error, provider).message;
}
