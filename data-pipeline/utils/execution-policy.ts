import { createHash } from "node:crypto";

export type FailureCategory = "authorization" | "quota" | "rate_limit" | "transient" | "schema" | "permanent";

export function buildProviderCacheKey(value: { provider: string; model: string; version: string; evidenceId: string; textHash: string }): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function categorizeProviderFailure(error: unknown): FailureCategory {
  const message = error instanceof Error ? error.message.toLocaleLowerCase("en-IN") : String(error).toLocaleLowerCase("en-IN");
  if (/auth|permission|forbidden|unauthorized/u.test(message)) return "authorization";
  if (/quota|cost|budget/u.test(message)) return "quota";
  if (/429|rate limit/u.test(message)) return "rate_limit";
  if (/timeout|temporar|503|502/u.test(message)) return "transient";
  if (/schema|json|validation/u.test(message)) return "schema";
  return "permanent";
}

export async function withBoundedRetry<T>(operation: (attempt: number) => Promise<T>, options: { maxAttempts: number; retryable: readonly FailureCategory[]; delay?: (attempt: number) => Promise<void> }): Promise<T> {
  if (!Number.isSafeInteger(options.maxAttempts) || options.maxAttempts < 1 || options.maxAttempts > 5) throw new Error("maxAttempts must be between 1 and 5.");
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try { return await operation(attempt); }
    catch (error) {
      lastError = error;
      if (attempt === options.maxAttempts || !options.retryable.includes(categorizeProviderFailure(error))) throw error;
      await options.delay?.(attempt);
    }
  }
  throw lastError;
}
