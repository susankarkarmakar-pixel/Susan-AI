export const DIAGNOSTIC_ERROR_CODES = Object.freeze([
  "PROVIDER_AUTH",
  "PROVIDER_PERMISSION",
  "PROVIDER_RATE_LIMIT",
  "PROVIDER_QUOTA",
  "PROVIDER_BILLING",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_MODEL_UNAVAILABLE",
  "PROVIDER_ERROR",
  "ATTACHMENT_UNSUPPORTED",
  "EXTRACTION_FAILED",
  "OCR_FAILED",
  "AGENT_APPROVAL_REQUIRED",
  "AGENT_TOOL_FAILED",
  "REQUEST_INVALID",
  "REQUEST_RATE_LIMITED",
  "REQUEST_TOO_LARGE",
  "INTERNAL_ERROR",
]);

const DIAGNOSTIC_CODE_SET = new Set(DIAGNOSTIC_ERROR_CODES);

export function createCorrelationId(cryptoObject = globalThis.crypto) {
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return `req_${cryptoObject.randomUUID()}`;
  }
  if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    return `req_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  throw new Error("Secure random generation is unavailable.");
}

export function classifyRequestError(status, message = "") {
  const normalized = String(message).toLowerCase();
  if (/attachment|file support|file type/.test(normalized) && status < 500) return "ATTACHMENT_UNSUPPORTED";
  if (status === 401) return "PROVIDER_AUTH";
  if (status === 402) return "PROVIDER_BILLING";
  if (status === 403) return "PROVIDER_PERMISSION";
  if (status === 404 || status === 410) return "PROVIDER_MODEL_UNAVAILABLE";
  if (status === 413) return "REQUEST_TOO_LARGE";
  if (/quota|insufficient balance|insufficient credit/.test(normalized)) return "PROVIDER_QUOTA";
  if (status === 429) return "PROVIDER_RATE_LIMIT";
  if (/timed? out|timeout/.test(normalized) || status === 504) return "PROVIDER_TIMEOUT";
  if (/temporarily unavailable|overloaded/.test(normalized) || status === 503) return "PROVIDER_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  if (status >= 400) return "REQUEST_INVALID";
  return "PROVIDER_ERROR";
}

export function createErrorDiagnostic(message, status, correlationId, explicitCode) {
  const safeId = typeof correlationId === "string" && /^req_[a-zA-Z0-9_-]{16,80}$/.test(correlationId)
    ? correlationId
    : createCorrelationId();
  const code = DIAGNOSTIC_CODE_SET.has(explicitCode) ? explicitCode : classifyRequestError(status, message);
  const safeMessage = typeof message === "string" && message.trim()
    ? message.trim().slice(0, 700)
    : "The request could not be completed.";
  return { error: safeMessage, code, correlationId: safeId };
}

export function formatDiagnosticMessage(message, code, correlationId) {
  const safeCode = DIAGNOSTIC_CODE_SET.has(code) ? code : "PROVIDER_ERROR";
  const safeId = typeof correlationId === "string" && /^req_[a-zA-Z0-9_-]{16,80}$/.test(correlationId) ? correlationId : "unavailable";
  const safeMessage = typeof message === "string" && message.trim() ? message.trim().slice(0, 700) : "The request could not be completed.";
  return `${safeMessage}\nError code: ${safeCode} · Reference: ${safeId}`;
}
