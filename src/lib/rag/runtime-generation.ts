import { createHash } from "node:crypto";

import { readServerEnv } from "@/lib/env";

export class RuntimeGenerationDeniedError extends Error {
  constructor(readonly code: "RUNTIME_LLM_DISABLED" | "EXTERNAL_CALLS_DISABLED" | "EXPLICIT_RUNTIME_FLAG_MISSING" | "MODEL_CREDENTIAL_MISSING") {
    super(code);
    this.name = "RuntimeGenerationDeniedError";
  }
}

export function assertRuntimeGenerationAllowed(options: { environment?: Record<string, string | undefined>; explicitRuntimeFlag: boolean }): void {
  const environment = readServerEnv(options.environment);
  if (!environment.ENABLE_RUNTIME_LLM) throw new RuntimeGenerationDeniedError("RUNTIME_LLM_DISABLED");
  if (!environment.ALLOW_EXTERNAL_CALLS) throw new RuntimeGenerationDeniedError("EXTERNAL_CALLS_DISABLED");
  if (!options.explicitRuntimeFlag) throw new RuntimeGenerationDeniedError("EXPLICIT_RUNTIME_FLAG_MISSING");
  if (!environment.GEMINI_API_KEY) throw new RuntimeGenerationDeniedError("MODEL_CREDENTIAL_MISSING");
}

export function validateGeneratedCitations(citedIds: readonly string[], retrievedIds: readonly string[]): void {
  const allowed = new Set(retrievedIds);
  if (citedIds.some((id) => !allowed.has(id))) throw new Error("GENERATED_CITATION_OUTSIDE_CONTEXT");
}

export class FixedWindowRateLimiter {
  private readonly counters = new Map<string, { windowStart: number; count: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error("Invalid rate limiter configuration.");
  }
  consume(identity: string): boolean {
    const key = createHash("sha256").update(identity).digest("hex");
    const time = this.now();
    const current = this.counters.get(key);
    if (!current || time - current.windowStart >= this.windowMs) { this.counters.set(key, { windowStart: time, count: 1 }); return true; }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }
}

export class ExpiringResponseCache<T> {
  private readonly values = new Map<string, { expiresAt: number; value: T }>();
  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}
  get(key: string): T | undefined {
    const item = this.values.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= this.now()) { this.values.delete(key); return undefined; }
    return item.value;
  }
  set(key: string, value: T): void { this.values.set(key, { expiresAt: this.now() + this.ttlMs, value }); }
}

export async function callRuntimeGenerationProvider<T extends { evidenceIds: string[] }>(options: {
  environment?: Record<string, string | undefined>;
  explicitRuntimeFlag: boolean;
  retrievedEvidenceIds: string[];
  transport: () => Promise<T>;
}): Promise<T> {
  assertRuntimeGenerationAllowed(options);
  const response = await options.transport();
  validateGeneratedCitations(response.evidenceIds, options.retrievedEvidenceIds);
  return response;
}
