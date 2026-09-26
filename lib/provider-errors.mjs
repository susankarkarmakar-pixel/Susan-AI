const KIMI_AUTH_GUIDANCE = "Kimi rejected this API key. This app uses the international Kimi platform at https://platform.kimi.ai with its matching API endpoint; keys from other regional platforms (including platform.moonshot.cn) are not interchangeable. Re-enter a key from the matching platform in Settings.";
const KIMI_PERMISSION_GUIDANCE = "Kimi denied access to this API or model. Check that the key belongs to the correct Kimi account, has model access, and is not restricted by an IP or account policy.";
const KIMI_MODEL_GUIDANCE = "Kimi could not find or authorize model kimi-k3 for this account. Check the model ID and account access; the previous moonshot-v1-8k model is discontinued.";
const KIMI_QUOTA_GUIDANCE = "Kimi reports insufficient balance or API quota. Check the Kimi account balance and quota, then try again.";

/**
 * Convert SDK/provider errors into a safe, actionable HTTP response without returning
 * upstream response bodies, request data, prompts, or credentials to the browser.
 * @param {unknown} error
 * @param {string} [provider]
 * @returns {{ status: number, message: string, retryAfterSeconds?: number }}
 */
export function mapProviderError(error, provider = "") {
  const details = readErrorDetails(error);
  const normalized = `${details.type} ${details.code} ${details.message}`.toLowerCase();
  const isKimi = provider === "kimi";

  if (details.status === 401 || /invalid_authentication_error|incorrect_api_key_error|invalid api key|unauthorized|authentication failed/.test(normalized)) {
    return {
      status: 401,
      message: isKimi ? KIMI_AUTH_GUIDANCE : "The provider rejected this API key. Check that it is correct and active.",
    };
  }

  if (details.status === 403 || /permission_denied_error|permission denied|forbidden/.test(normalized)) {
    return {
      status: 403,
      message: isKimi ? KIMI_PERMISSION_GUIDANCE : "The provider denied access. Check account permissions and model access.",
    };
  }

  if (details.status === 404 || /resource_not_found_error|model not found|model.*not available|not found/.test(normalized)) {
    return {
      status: 404,
      message: isKimi ? KIMI_MODEL_GUIDANCE : "The selected model was not found or is unavailable to this account.",
    };
  }

  if (details.status === 410 && provider === "nvidia") {
    return {
      status: 410,
      message: "NVIDIA returned HTTP 410 for this hosted inference request. The selected endpoint or model may be retired or unavailable to this account; verify the API Catalog model and account access on build.nvidia.com, then test again.",
    };
  }

  if (/exceeded_current_quota_error|insufficient balance|insufficient quota|balance is insufficient/.test(normalized)) {
    return {
      status: details.status === 403 ? 403 : 429,
      message: isKimi ? KIMI_QUOTA_GUIDANCE : "The provider reports insufficient balance or quota. Check the provider account and try again.",
      retryAfterSeconds: 60,
    };
  }

  if (details.status === 402 || /insufficient credit|billing issue|payment required/.test(normalized)) {
    return {
      status: 402,
      message: isKimi ? KIMI_QUOTA_GUIDANCE : "The provider reports a billing or credit issue. Check the provider account.",
    };
  }

  if (details.status === 429 || /rate_limit_reached_error|engine_overloaded_error|rate limit|too many requests|quota/.test(normalized)) {
    const overloaded = details.type === "engine_overloaded_error" || /engine_overloaded_error|currently overloaded|temporarily overloaded/.test(normalized);
    return {
      status: overloaded ? 503 : 429,
      message: isKimi
        ? (overloaded ? "Kimi is temporarily overloaded. Wait briefly and retry; this is a service-capacity issue, not an API-key balance issue." : "Kimi API rate or token quota was reached. Wait before retrying or check the account's rate limits.")
        : (overloaded ? "The provider is temporarily overloaded. Wait briefly and retry." : "The provider rate limit or quota was reached. Wait and try again."),
      retryAfterSeconds: 60,
    };
  }

  if (details.status === 503 || details.status === 504 || /server_unavailable|timeout|timed out|network error/.test(normalized)) {
    return {
      status: details.status === 504 || /timeout|timed out/.test(normalized) ? 504 : 503,
      message: isKimi ? "Kimi is temporarily unavailable or the connection timed out. Check the network and retry shortly." : "The provider is temporarily unavailable or the connection timed out. Retry shortly.",
    };
  }

  return {
    status: 502,
    message: isKimi
      ? "Kimi could not complete the request. Check the API key's platform/region, kimi-k3 access, account quota, and Kimi service status."
      : "The provider could not complete the request. Check the API key, model access, quota, and provider status.",
  };
}

function readErrorDetails(error) {
  const candidate = error && typeof error === "object" ? /** @type {Record<string, unknown>} */ (error) : {};
  const statusValue = candidate.statusCode ?? candidate.status;
  const status = typeof statusValue === "number" ? statusValue : undefined;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  let body = candidate.responseBody;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = undefined;
    }
  }
  const data = candidate.data && typeof candidate.data === "object" ? candidate.data : undefined;
  const response = body && typeof body === "object" ? body : data;
  const responseRecord = response && typeof response === "object" ? /** @type {Record<string, unknown>} */ (response) : {};
  const nestedError = responseRecord.error && typeof responseRecord.error === "object"
    ? /** @type {Record<string, unknown>} */ (responseRecord.error)
    : responseRecord;
  const responseMessage = typeof nestedError.message === "string" ? nestedError.message : "";
  const type = typeof nestedError.type === "string" ? nestedError.type : "";
  const code = typeof nestedError.code === "string" ? nestedError.code : "";
  return { status, message: `${message} ${responseMessage}`.trim(), type, code };
}
