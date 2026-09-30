import { MODELS_METADATA, type ModelProvider, type ProviderCapabilities, type ProviderMetadata } from "@/lib/ai-providers";
import type { CustomProvider } from "@/lib/custom-providers";

export type ProviderId = ModelProvider | (string & {});

export interface ProviderDescriptor {
  id: ProviderId;
  name: string;
  description: string;
  model: string;
  transport: ProviderMetadata["transport"];
  tier: ProviderMetadata["tier"];
  chatAvailable: boolean;
  requiresApiKey: boolean;
  local: boolean;
  capabilities: ProviderCapabilities;
  setupUrl?: string;
}

/**
 * Custom providers are intentionally conservative until the user adds an
 * explicit capability declaration. This keeps file parts from reaching an
 * endpoint that cannot process them.
 */
export const CUSTOM_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  text: true,
  vision: false,
  files: false,
  streaming: true,
  tools: false,
  reasoning: false,
  async: false,
};

export function getProviderDescriptor(provider: string, customProvider?: CustomProvider | null): ProviderDescriptor | undefined {
  if (customProvider && customProvider.id === provider) {
    return {
      id: provider,
      name: customProvider.name,
      description: "Custom OpenAI-compatible provider",
      model: customProvider.model,
      transport: "openai-compatible",
      tier: customProvider.local ? "free-tier" : "paid-or-trial",
      chatAvailable: true,
      requiresApiKey: customProvider.requiresApiKey !== false,
      local: customProvider.local === true,
      capabilities: CUSTOM_PROVIDER_CAPABILITIES,
    };
  }

  const metadata = MODELS_METADATA[provider as ModelProvider];
  if (!metadata) return undefined;
  return {
    id: provider,
    name: metadata.name,
    description: metadata.description,
    model: metadata.model,
    transport: metadata.transport,
    tier: metadata.tier,
    chatAvailable: metadata.chatAvailable,
    requiresApiKey: true,
    local: false,
    capabilities: metadata.capabilities,
    setupUrl: metadata.setupUrl,
  };
}

export function getProviderCapabilities(provider: string, customProvider?: CustomProvider | null): ProviderCapabilities | undefined {
  return getProviderDescriptor(provider, customProvider)?.capabilities;
}

export function supportsProviderCapability(
  provider: string,
  capability: keyof ProviderCapabilities,
  customProvider?: CustomProvider | null,
): boolean {
  return getProviderCapabilities(provider, customProvider)?.[capability] === true;
}

export function isProviderChatCapable(provider: string, customProvider?: CustomProvider | null): boolean {
  return getProviderDescriptor(provider, customProvider)?.chatAvailable === true;
}

export function getProviderDisplayName(provider: string, customProvider?: CustomProvider | null): string {
  return getProviderDescriptor(provider, customProvider)?.name || provider;
}
