import * as Sentry from "@sentry/nextjs";

export type ErrorCode =
  | "PROVIDER_AUTH"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_MODEL_UNAVAILABLE"
  | "ATTACHMENT_UNSUPPORTED"
  | "EXTRACTION_FAILED"
  | "OCR_FAILED"
  | "AGENT_APPROVAL_REQUIRED"
  | "AGENT_TOOL_FAILED"
  | "INTERNAL_ERROR";

export const REQUEST_ID_HEADER = "x-request-id";

export function createCorrelationId(): string {
  return crypto.randomUUID();
}

export function getCorrelationId(request: Request): string {
  const supplied = request.headers.get(REQUEST_ID_HEADER)?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied) ? supplied : createCorrelationId();
}

export function withCorrelationId(response: Response, correlationId: string): Response {
  response.headers.set(REQUEST_ID_HEADER, correlationId);
  return response;
}

export function reportServerError(error: unknown, context: {
  correlationId: string;
  route: string;
  code?: ErrorCode;
}): void {
  const code = context.code ?? "INTERNAL_ERROR";
  console.error("Susan AI request failed", {
    correlationId: context.correlationId,
    route: context.route,
    code,
    error: safeErrorDetails(error),
  });

  Sentry.withScope((scope) => {
    scope.setTag("correlation_id", context.correlationId);
    scope.setTag("route", context.route);
    scope.setTag("error_code", code);
    Sentry.captureException(error);
  });
}

function safeErrorDetails(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 500) };
  return { message: typeof error === "string" ? error.slice(0, 500) : "Unknown error" };
}
