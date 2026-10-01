export type RequestLifecycle = "idle" | "preparing" | "sending" | "streaming" | "completed" | "failed";

export const MAX_AUTOMATIC_FALLBACK_ATTEMPTS = 2;

export interface RequestLifecycleInput {
  chatStatus: "submitted" | "streaming" | "ready" | "error";
  isPreparing: boolean;
  hasError: boolean;
  previous: RequestLifecycle;
}

export function getRequestLifecycle({ chatStatus, isPreparing, hasError, previous }: RequestLifecycleInput): RequestLifecycle {
  if (hasError) return "failed";
  if (isPreparing) return "preparing";
  if (chatStatus === "submitted") return "sending";
  if (chatStatus === "streaming") return "streaming";
  if (chatStatus === "ready") {
    return ["preparing", "sending", "streaming"].includes(previous) ? "completed" : previous === "completed" ? "completed" : "idle";
  }
  return previous;
}

export function canAttemptAutomaticFallback(attempts: number): boolean {
  return Number.isInteger(attempts) && attempts >= 0 && attempts < MAX_AUTOMATIC_FALLBACK_ATTEMPTS;
}
