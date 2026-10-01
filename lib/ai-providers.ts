import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModel } from "ai";
import { CustomProvider } from "@/lib/custom-providers";

export type ModelProvider = "deepseek" | "anthropic" | "huggingface" | "google" | "openai" | "qwen" | "kimi" | "manus" | "jules" | "sarvam" | "openrouter" | "groq" | "cerebras" | "mistral" | "nvidia" | "cloudflare" | "sambanova" | "xai" | "perplexity" | "together";

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
  kimi: { name: "Kimi K3", description: "Frontier reasoning model by Moonshot AI", color: "text-red-400", icon: "K", model: "kimi-k3", tier: "paid-or-trial", setupUrl: "https://platform.kimi.ai/console/api-keys", transport: "openai-compatible", baseURL: "https://api.moonshot.ai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  manus: { name: "Manus", description: "Async agent tasks; not instant chat", color: "text-indigo-400", icon: "M", model: "manus-1.6", tier: "async", setupUrl: "https://manus.im/app/developers", transport: "async", chatAvailable: false, capabilities: { text: false, vision: false, files: true, streaming: false, tools: true, reasoning: true, async: true } },
  jules: { name: "Google Jules", description: "Google's asynchronous coding agent", color: "text-blue-600", icon: "J", model: "jules", tier: "async", setupUrl: "https://jules.google.com/settings", transport: "async", chatAvailable: false, capabilities: { text: false, vision: false, files: true, streaming: false, tools: true, reasoning: true, async: true } },
  sarvam: { name: "Sarvam 105B", description: "Indian-language chat model", color: "text-teal-400", icon: "S", model: "sarvam-105b-conversations", tier: "paid-or-trial", setupUrl: "https://dashboard.sarvam.ai/", transport: "openai-compatible", baseURL: "https://api.sarvam.ai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: false, async: false } },
  openrouter: { name: "OpenRouter Free Router", description: "Automatically routes to available free models", color: "text-violet-500", icon: "R", model: "openrouter/free", tier: "free-tier", setupUrl: "https://openrouter.ai/settings/keys", transport: "openai-compatible", baseURL: "https://openrouter.ai/api/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  groq: { name: "Groq · GPT-OSS 120B", description: "Fast inference · free plan quota applies", color: "text-orange-500", icon: "G", model: "openai/gpt-oss-120b", tier: "free-tier", setupUrl: "https://console.groq.com/keys", transport: "openai-compatible", baseURL: "https://api.groq.com/openai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  cerebras: { name: "Cerebras · GPT-OSS 120B", description: "High-speed inference · $5 trial requires verified payment method", color: "text-sky-600", icon: "C", model: "gpt-oss-120b", tier: "paid-or-trial", setupUrl: "https://cloud.cerebras.ai/", transport: "openai-compatible", baseURL: "https://api.cerebras.ai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  mistral: { name: "Mistral Small 4", description: "Mistral free mode · limited monthly usage", color: "text-amber-500", icon: "M", model: "mistral-small-2603", tier: "free-tier", setupUrl: "https://console.mistral.ai/api-keys", transport: "openai-compatible", baseURL: "https://api.mistral.ai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  nvidia: { name: "NVIDIA NIM · Nemotron 3.5 Lightning", description: "Hosted NIM API · free to prototype; evaluation use only", color: "text-green-600", icon: "N", model: "nvidia/nemotron-3.5-lightning-30b-a3b", tier: "paid-or-trial", setupUrl: "https://build.nvidia.com/settings/api-keys", transport: "openai-compatible", baseURL: "https://integrate.api.nvidia.com/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  cloudflare: { name: "Cloudflare Workers AI", description: "10,000 free Neurons/day · Cloudflare account ID required", color: "text-orange-400", icon: "C", model: "@cf/meta/llama-3.1-8b-instruct", tier: "free-tier", setupUrl: "https://dash.cloudflare.com/profile/api-tokens", transport: "openai-compatible", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: false, async: false } },
  sambanova: { name: "SambaNova · DeepSeek V3.1", description: "Free tier: 20 requests/day when no payment method is linked", color: "text-red-500", icon: "S", model: "DeepSeek-V3.1", tier: "free-tier", setupUrl: "https://cloud.sambanova.ai/apis", transport: "openai-compatible", baseURL: "https://api.sambanova.ai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  xai: { name: "xAI · Grok 4.7", description: "Frontier chat, coding, and reasoning by xAI", color: "text-slate-900", icon: "X", model: "grok-4.7", tier: "paid-or-trial", setupUrl: "https://console.x.ai/team/default/api-keys", transport: "openai-compatible", baseURL: "https://api.x.ai/v1", chatAvailable: true, capabilities: { text: true, vision: true, files: false, streaming: true, tools: true, reasoning: true, async: false } },
  perplexity: { name: "Perplexity · Sonar", description: "Web-grounded answers with current sources", color: "text-cyan-600", icon: "P", model: "sonar", tier: "paid-or-trial", setupUrl: "https://www.perplexity.ai/settings/api", transport: "openai-compatible", baseURL: "https://api.perplexity.ai", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: false, reasoning: true, async: false } },
  together: { name: "Together AI · Llama", description: "Open models through one fast API", color: "text-indigo-600", icon: "T", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", tier: "paid-or-trial", setupUrl: "https://api.together.ai/settings/api-keys", transport: "openai-compatible", baseURL: "https://api.together.ai/v1", chatAvailable: true, capabilities: { text: true, vision: false, files: false, streaming: true, tools: true, reasoning: false, async: false } },
};

export const PROVIDERS = Object.keys(MODELS_METADATA) as ModelProvider[];
export const INSTANT_CHAT_PROVIDERS = PROVIDERS.filter((provider) => MODELS_METADATA[provider].chatAvailable) as Array<Exclude<ModelProvider, "manus">>;

export function isInstantChatProvider(value: string): value is Exclude<ModelProvider, "manus"> {
  return INSTANT_CHAT_PROVIDERS.includes(value as Exclude<ModelProvider, "manus">);
}

export function getModelConfig(provider: ModelProvider, apiKey: string, options: { cloudflareAccountId?: string } = {}): LanguageModel {
  const metadata = MODELS_METADATA[provider];
  if (!metadata.chatAvailable) throw new Error(`${metadata.name} is not available for instant chat yet.`);
  if (metadata.transport === "anthropic") return createAnthropic({ apiKey })(metadata.model);
  if (metadata.transport === "google") return createGoogleGenerativeAI({ apiKey })(metadata.model);
  if (metadata.transport === "openai-compatible") {
    const cloudflareAccountId = options.cloudflareAccountId?.trim();
    if (provider === "cloudflare" && !/^[a-f0-9]{32}$/i.test(cloudflareAccountId || "")) {
      throw new Error("Enter the 32-character Cloudflare Account ID from your dashboard in Settings.");
    }
    const baseURL = provider === "cloudflare"
      ? `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1`
      : metadata.baseURL;
    const headers: Record<string, string> | undefined = provider === "sarvam"
      ? { "api-subscription-key": apiKey }
      : provider === "openrouter"
        ? { "HTTP-Referer": "https://susan-ai.app", "X-Title": "Susan AI" }
        : undefined;
    return createOpenAI({ ...(baseURL ? { baseURL } : {}), apiKey, ...(headers ? { headers } : {}) })(metadata.model);
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
  { provider: "groq", title: "GroqCloud", model: "openai/gpt-oss-120b", note: "Free plan: currently 30 requests/min, 1,000/day and 200,000 tokens/day; account limits can vary." },
  { provider: "mistral", title: "Mistral La Plateforme", model: "mistral-small-2603", note: "Free mode requires no card; limited evaluation/prototyping usage with monthly credits and account-specific limits." },
  { provider: "nvidia", title: "NVIDIA API Catalog (hosted NIM)", model: "nvidia/nemotron-3.5-lightning-30b-a3b", note: "Free to prototype; up to 40 RPM for most models, but limits vary by account/model. Trial terms restrict use to testing/evaluation, not production." },
  { provider: "cloudflare", title: "Cloudflare Workers AI", model: "@cf/meta/llama-3.1-8b-instruct", note: "10,000 Neurons/day free; needs an Account ID. Workers Paid can bill usage above the free allocation." },
  { provider: "sambanova", title: "SambaNova SambaCloud", model: "DeepSeek-V3.1", note: "Free tier applies without a payment method; model limit is 20 requests/day and 200,000 tokens/day." },
];
