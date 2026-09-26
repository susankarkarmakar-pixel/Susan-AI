import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModel } from "ai";
import { CustomProvider } from "@/lib/custom-providers";

export type ModelProvider = "deepseek" | "anthropic" | "huggingface" | "google" | "openai" | "qwen" | "kimi" | "manus" | "jules" | "sarvam" | "openrouter";

export type ProviderTransport = "openai-compatible" | "anthropic" | "google" | "async";

export interface ProviderCapabilities {
  text: boolean;
  vision: boolean;
  files: boolean;
  streaming: boolean;
  tools: boolean;
  reasoning: boolean;
  async: boolean;
}

export interface ProviderMetadata {
  name: string;
  description: string;
  color: string;
  icon: string;
  model: string;
  tier: "free-tier" | "paid-or-trial" | "async";
  setupUrl: string;
  transport: ProviderTransport;
  baseURL?: string;
  chatAvailable: boolean;
  capabilities: ProviderCapabilities;
}

export const MODELS_METADATA: Record<ModelProvider, ProviderMetadata> = {
  deepseek: { name: "DeepSeek Chat", description: "Fast reasoning model", color: "text-blue-400", icon: "🧠", model: "deepseek-chat", tier: "paid-or-trial", setupUrl: "https://platform.deepseek.com/api_keys", transport: "openai-compatible", baseURL: "https://api.deepseek.com/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  anthropic: { name: "Claude Sonnet", description: "Advanced reasoning by Anthropic", color: "text-orange-400", icon: "✨", model: "claude-3-5-sonnet-20241022", tier: "paid-or-trial", setupUrl: "https://console.anthropic.com/settings/keys", transport: "anthropic", chatAvailable: true, capabilities: { text: true, vision: true, files: true, streaming: true, tools: false, reasoning: true, async: false } },
  huggingface: { name: "Hugging Face", description: "Open models; quota varies", color: "text-yellow-400", icon: "🤗", model: "NousResearch/Hermes-3-Llama-3.1-8B", tier: "free-tier", setupUrl: "https://huggingface.co/settings/tokens", transport: "openai-compatible", baseURL: "https://api-inference.huggingface.co/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: false, async: false } },
  google: { name: "Google Gemini Flash-Lite", description: "Google AI Studio free-tier eligible", color: "text-blue-500", icon: "G", model: "gemini-3.5-flash-lite", tier: "free-tier", setupUrl: "https://aistudio.google.com/apikey", transport: "google", chatAvailable: true, capabilities: { text: true, vision: true, files: true, streaming: true, tools: false, reasoning: true, async: false } },
  openai: { name: "OpenAI GPT", description: "OpenAI API", color: "text-emerald-500", icon: "O", model: "gpt-4o-mini", tier: "paid-or-trial", setupUrl: "https://platform.openai.com/api-keys", transport: "openai-compatible", chatAvailable: true, capabilities: { text: true, vision: true, files: true, streaming: true, tools: true, reasoning: true, async: false } },
  qwen: { name: "Qwen Max", description: "Alibaba Cloud model", color: "text-purple-400", icon: "Q", model: "qwen-max", tier: "paid-or-trial", setupUrl: "https://bailian.console.aliyun.com/", transport: "openai-compatible", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  kimi: { name: "Kimi K3", description: "Frontier reasoning model by Moonshot AI", color: "text-red-400", icon: "K", model: "kimi-k3", tier: "paid-or-trial", setupUrl: "https://platform.moonshot.cn/console/api-keys", transport: "openai-compatible", baseURL: "https://api.moonshot.cn/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  manus: { name: "Manus", description: "Async agent tasks; not instant chat", color: "text-indigo-400", icon: "M", model: "manus-1.6", tier: "async", setupUrl: "https://manus.im/app/developers", transport: "async", chatAvailable: false, capabilities: { text: false, vision: false, files: true, streaming: false, tools: true, reasoning: true, async: true } },
  jules: { name: "Google Jules", description: "Google's asynchronous coding agent", color: "text-blue-600", icon: "J", model: "jules", tier: "async", setupUrl: "https://jules.google.com/settings", transport: "async", chatAvailable: false, capabilities: { text: false, vision: false, files: true, streaming: false, tools: true, reasoning: true, async: true } },
  sarvam: { name: "Sarvam 105B", description: "Indian-language chat model", color: "text-teal-400", icon: "S", model: "sarvam-105b-conversations", tier: "paid-or-trial", setupUrl: "https://dashboard.sarvam.ai/", transport: "openai-compatible", baseURL: "https://api.sarvam.ai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: false, async: false } },
  openrouter: { name: "OpenRouter Free Router", description: "Automatically routes to available free models", color: "text-violet-500", icon: "R", model: "openrouter/free", tier: "free-tier", setupUrl: "https://openrouter.ai/settings/keys", transport: "openai-compatible", baseURL: "https://openrouter.ai/api/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
};

export const PROVIDERS = Object.keys(MODELS_METADATA) as ModelProvider[];
export const INSTANT_CHAT_PROVIDERS = PROVIDERS.filter((provider) => MODELS_METADATA[provider].chatAvailable) as Array<Exclude<ModelProvider, "manus">>;

export function isInstantChatProvider(value: string): value is Exclude<ModelProvider, "manus"> {
  return INSTANT_CHAT_PROVIDERS.includes(value as Exclude<ModelProvider, "manus">);
}

export function getModelConfig(provider: ModelProvider, apiKey: string): LanguageModel {
  const metadata = MODELS_METADATA[provider];
  if (!metadata.chatAvailable) throw new Error(`${metadata.name} is not available for instant chat yet.`);
  if (metadata.transport === "anthropic") return createAnthropic({ apiKey })(metadata.model);
  if (metadata.transport === "google") return createGoogleGenerativeAI({ apiKey })(metadata.model);
  if (metadata.transport === "openai-compatible") {
    const headers: Record<string, string> | undefined = provider === "sarvam"
      ? { "api-subscription-key": apiKey }
      : provider === "openrouter"
        ? { "HTTP-Referer": "https://susan-ai.app", "X-Title": "Susan AI" }
        : undefined;
    return createOpenAI({ ...(metadata.baseURL ? { baseURL: metadata.baseURL } : {}), apiKey, ...(headers ? { headers } : {}) })(metadata.model);
  }
  throw new Error(`Unsupported provider transport: ${metadata.transport}`);
}

export function getCustomModelConfig(provider: CustomProvider, apiKey: string): LanguageModel {
  return createOpenAI({ baseURL: provider.baseUrl.replace(/\/$/, ""), apiKey })(provider.model);
}

export const FREE_TIER_DIRECTORY: Array<{ provider: ModelProvider; title: string; model: string; note: string }> = [
  { provider: "google", title: "Google AI Studio", model: "Gemini 3.5 Flash-Lite", note: "Free-tier availability and quotas depend on region and account." },
  { provider: "openrouter", title: "OpenRouter Free Router", model: "openrouter/free", note: "Routes to currently available free models; availability can change." },
  { provider: "huggingface", title: "Hugging Face Inference", model: "Open models", note: "Free credits or access depend on the account and selected model." },
];
