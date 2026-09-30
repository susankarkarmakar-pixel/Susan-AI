import { convertToModelMessages, streamText } from "ai";
import { getCustomModelConfig, getModelConfig, isInstantChatProvider, ModelProvider } from "@/lib/ai-providers";
import { supportsProviderCapability } from "@/lib/provider-capabilities";
import { CustomProvider, isAllowedBaseUrl } from "@/lib/custom-providers";
import { enforceRateLimit, getClientIdentifier, RateLimitUnavailableError, RATE_LIMIT_RETRY_AFTER_SECONDS } from "@/lib/rate-limit";
import { mapProviderError } from "@/lib/provider-errors.mjs";
import { normalizeGenerationOptions, normalizeSystemPrompt } from "@/lib/generation-settings.mjs";
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
    const { messages, provider, apiKey, language, customProvider, cloudflareAccountId, temperature, maxOutputTokens, effort, systemPrompt, researchContext } = body as { messages?: unknown; provider?: unknown; apiKey?: unknown; language?: unknown; customProvider?: unknown; cloudflareAccountId?: unknown; temperature?: unknown; maxOutputTokens?: unknown; effort?: unknown; systemPrompt?: unknown; researchContext?: unknown };
    requestedProvider = typeof provider === "string" ? provider : "";
    const isCustom = typeof provider === "string" && provider.startsWith("custom_");
    const isLocalCustom = isCustom && isLocalCustomProvider(customProvider);
    if (typeof provider !== "string" || (!isInstantChatProvider(provider) && !isCustom)) return jsonError("This provider is not available for instant chat.", 400);
    if ((!isLocalCustom && (typeof apiKey !== "string" || apiKey.trim().length < 8 || apiKey.length > 500)) || (isLocalCustom && apiKey !== "local")) return jsonError(isLocalCustom ? "Local provider authentication marker is invalid." : "A valid API key is required.", 400);
    const normalizedApiKey = isLocalCustom ? "local" : (apiKey as string).trim();
    if (provider === "cloudflare" && (typeof cloudflareAccountId !== "string" || !/^[a-f0-9]{32}$/i.test(cloudflareAccountId.trim()))) return jsonError("A valid 32-character Cloudflare Account ID is required. Add it in Settings.", 400);
    const generation = normalizeGenerationOptions({ temperature, maxOutputTokens, effort } as { temperature?: unknown; maxOutputTokens?: unknown; effort?: unknown });
    const normalizedPrompt = normalizeSystemPrompt(systemPrompt);
    if (!normalizedPrompt.valid) return jsonError("System instructions must be text under 6,000 characters.", 400);
    const researchInstructions = buildResearchInstructions(researchContext);
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return jsonError("Messages must contain between 1 and 100 items.", 400);

    const validMessages = messages.filter(isUIMessage).slice(-MAX_MESSAGES);
    if (validMessages.length === 0) return jsonError("No valid messages found.", 400);
    if ((!isCustom && !supportsProviderCapability(provider, "files")) && validMessages.some((message) => message.parts?.some(isFilePart))) {
      return jsonError("The selected provider does not support file attachments. Choose a vision/file-capable provider.", 400);
    }

    const modelMessages = validMessages.some((message) => Array.isArray(message.parts))
      ? await convertToModelMessages(validMessages as never)
      : validMessages
          .filter((message) => typeof message.content === "string" && message.content.length <= MAX_MESSAGE_LENGTH)
          .map((message) => ({ role: message.role, content: message.content as string }));
    if (modelMessages.length === 0) return jsonError("No valid message content found.", 400);

    const languageInstruction = language === "bn" ? "Respond in Bengali unless the user asks for another language." : language === "en" ? "Respond in English unless the user asks for another language." : "";
    const systemInstructions = [languageInstruction, normalizedPrompt.prompt, researchInstructions].filter(Boolean);
    let model: ReturnType<typeof getModelConfig>;
    if (isCustom) {
      if (!isValidCustomProvider(customProvider, provider)) return jsonError("Custom provider configuration is invalid.", 400);
      model = getCustomModelConfig(customProvider, normalizedApiKey);
    } else {
      model = getModelConfig(provider as ModelProvider, normalizedApiKey, { cloudflareAccountId: typeof cloudflareAccountId === "string" ? cloudflareAccountId : undefined });
    }
    const result = streamText({ model, messages: systemInstructions.length ? [...systemInstructions.map((content) => ({ role: "system" as const, content })), ...modelMessages] : modelMessages, ...generation });
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

function isLocalCustomProvider(value: unknown): value is CustomProvider {
  return Boolean(value && typeof value === "object" && (value as Partial<CustomProvider>).local === true && (value as Partial<CustomProvider>).requiresApiKey === false);
}

function jsonError(error: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function providerStreamError(error: unknown, provider: string): string {
  return mapProviderError(error, provider).message;
}

function buildResearchInstructions(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const context = value as { query?: unknown; sources?: unknown };
  if (typeof context.query !== "string" || !context.query.trim() || !Array.isArray(context.sources)) return "";
  const sources = context.sources.flatMap((source, index) => {
    if (!source || typeof source !== "object") return [];
    const item = source as { title?: unknown; url?: unknown; snippet?: unknown };
    if (typeof item.url !== "string" || !/^https?:\/\//i.test(item.url)) return [];
    return [`[S${index + 1}] ${typeof item.title === "string" ? item.title.slice(0, 180) : "Untitled source"}\nURL: ${item.url.slice(0, 500)}\nExcerpt: ${typeof item.snippet === "string" ? item.snippet.slice(0, 900) : ""}`];
  }).slice(0, 8);
  if (sources.length === 0) return `Research mode is active for the query: ${context.query.slice(0, 300)}. No verified web sources were returned. Be transparent about that limitation and do not invent citations.`;
  return `You are answering a research question using the verified source excerpts below. Query: ${context.query.slice(0, 300)}. Write a polished, direct answer with a short summary, clear headings, key findings, and practical recommendations only when supported. Cite factual claims inline using [S1], [S2] matching the source list. Never invent a source or claim that is not supported; clearly label uncertainty or disagreement. End with a compact "### Sources" list containing the cited source links. Prefer the user's language.\n\nSOURCE PACKET:\n${sources.join("\n\n")}`;
}
