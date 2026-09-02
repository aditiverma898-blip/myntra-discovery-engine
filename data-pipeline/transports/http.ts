export class ExternalHttpError extends Error {
  readonly status: number;
  readonly requestsMade: number;

  constructor(status: number, message: string, requestsMade = 1) {
    super(message);
    this.name = "ExternalHttpError";
    this.status = status;
    this.requestsMade = requestsMade;
  }
}

const credentialValuePattern = /(?:AIza|apify_api_|sk-)[A-Za-z0-9_-]{12,}|(?:authorization|api[_-]?key|token)\s*[=:]\s*[^\s,;]+/giu;

function safeProviderError(text: string): { code: string | null; message: string | null } {
  try {
    const payload = JSON.parse(text) as {
      error?: {
        type?: unknown;
        message?: unknown;
        status?: unknown;
        errors?: Array<{ reason?: unknown }>;
      };
    };
    const candidateCode = payload.error?.type ?? payload.error?.errors?.[0]?.reason ?? payload.error?.status;
    const code = typeof candidateCode === "string" && /^[A-Za-z0-9_-]{1,80}$/u.test(candidateCode) ? candidateCode : null;
    const rawMessage = payload.error?.message;
    if (typeof rawMessage !== "string") return { code, message: null };
    const message = rawMessage
      .replace(credentialValuePattern, "[redacted]")
      .replace(/[\u0000-\u001F\u007F]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 300);
    return { code, message: message || null };
  } catch {
    return { code: null, message: null };
  }
}

export async function fetchJson(fetchImpl: typeof fetch, url: URL, init?: RequestInit, timeoutMs = 60_000): Promise<unknown> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) throw new Error("HTTP timeout must be between 1,000 and 300,000 milliseconds.");
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  if (!response.ok) {
    const detail = safeProviderError(text);
    const reason = detail.code ? ` (${detail.code})` : "";
    const message = detail.message ? ` ${detail.message}` : "";
    throw new ExternalHttpError(response.status, `External provider returned HTTP ${response.status}${reason}.${message}`);
  }
  try { return JSON.parse(text) as unknown; }
  catch { throw new ExternalHttpError(response.status, "External provider returned invalid JSON."); }
}
