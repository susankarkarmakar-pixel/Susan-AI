export type DiagnosticErrorCode =
  | "PROVIDER_AUTH"
  | "PROVIDER_PERMISSION"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_QUOTA"
  | "PROVIDER_BILLING"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_MODEL_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "ATTACHMENT_UNSUPPORTED"
  | "EXTRACTION_FAILED"
  | "OCR_FAILED"
  | "AGENT_APPROVAL_REQUIRED"
  | "AGENT_TOOL_FAILED"
  | "REQUEST_INVALID"
  | "REQUEST_RATE_LIMITED"
  | "REQUEST_TOO_LARGE"
  | "INTERNAL_ERROR";

export const DIAGNOSTIC_ERROR_CODES: readonly DiagnosticErrorCode[];
export function createCorrelationId(cryptoObject?: Crypto): string;
export function classifyRequestError(status: number, message?: string): DiagnosticErrorCode;
export function createErrorDiagnostic(message: string, status: number, correlationId?: string, explicitCode?: string): {
  error: string;
  code: DiagnosticErrorCode;
  correlationId: string;
};
export function formatDiagnosticMessage(message: string, code: string, correlationId: string): string;
