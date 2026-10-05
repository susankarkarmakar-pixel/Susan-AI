export type UsageActivityStatus = "completed" | "failed" | "cancelled";
export type UsageSource = "provider" | "unavailable";

export interface ProviderUsageMetadata {
  source: "provider";
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ChatMessageMetadata {
  usage?: ProviderUsageMetadata;
}

/** This record deliberately contains no prompt, response, filename, API key, or raw error. */
export interface UsageActivityItem {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  status: UsageActivityStatus;
  source: UsageSource;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  conversationId: string | null;
}

export interface UsagePricingRate {
  provider: string;
  model: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  updatedAt: number;
}
