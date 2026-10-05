import type { UsageActivityItem, UsagePricingRate } from "@/lib/usage-types";

export const USAGE_ACTIVITY_UPDATED_EVENT: string;
export const MAX_USAGE_EVENTS: number;
export function createUsageEventId(): string;
export function recordUsageEvent(input: unknown, storage?: Storage | null): boolean;
export function listUsageEvents(storage?: Storage | null): UsageActivityItem[];
export function clearUsageEvents(storage?: Storage | null): boolean;
export function listUsagePricingRates(storage?: Storage | null): UsagePricingRate[];
export function saveUsagePricingRate(input: unknown, storage?: Storage | null): boolean;
export function deleteUsagePricingRate(provider: string, model: string, storage?: Storage | null): boolean;
export function estimateUsageCost(event: UsageActivityItem, rates?: UsagePricingRate[]): number | null;
export function summarizeUsage(events?: UsageActivityItem[], rates?: UsagePricingRate[]): {
  completed: number;
  failed: number;
  cancelled: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reportedEvents: number;
  costEstimateUsd: number;
  pricedEvents: number;
};

export const USAGE_BUDGET_ALERT_EVENT: string;
export function getUsageBudgetSettings(storage?: Storage | null): { monthlyLimitUsd: number | null; alertPercent: number };
export function saveUsageBudgetSettings(input: unknown, storage?: Storage | null): boolean;
export function getCurrentMonthUsageSummary(events?: UsageActivityItem[], rates?: UsagePricingRate[], budget?: { monthlyLimitUsd: number | null; alertPercent: number }, now?: number): {
  month: string;
  spentUsd: number;
  monthlyLimitUsd: number | null;
  percent: number | null;
  remainingUsd: number | null;
  pricedEvents: number;
  alertPercent: number;
  level: "disabled" | "over" | "near" | "normal";
};
