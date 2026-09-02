import { describe, expect, it, vi } from "vitest";

import { FALLBACK_COLLECTION_MATRIX, PREFERRED_COLLECTION_MATRIX, validateMyntraOnlyKeywords } from "../../config/collection-plan";
import { COLLECTOR_ADAPTERS } from "../../data-pipeline/adapters";
import { SAVED_PROVIDER_RESPONSES } from "../../data-pipeline/fixtures/saved-provider-responses";
import { planCollection } from "../../data-pipeline/planning/dry-run-plan";
import { classifyWithExternalProvider, embedWithMock } from "../../data-pipeline/providers/mock-ai";
import { boundedMap } from "../../data-pipeline/utils/bounded-map";
import { buildProviderCacheKey, categorizeProviderFailure, withBoundedRetry } from "../../data-pipeline/utils/execution-policy";
import { deduplicateRecordsScalable } from "../../data-pipeline/stages/deduplicate-scalable";
import { normalizeRecords, validateRawRecords } from "../../data-pipeline/stages/normalize";
import { SYNTHETIC_RAW_RECORDS } from "../../data-pipeline/fixtures/synthetic-raw";

describe("Phase 6 fixture-backed adapters and planning", () => {
  it("parses saved provider responses without invoking transport", () => {
    for (const source of ["google_play", "app_store", "youtube", "reddit", "myntra_product_review"] as const) {
      const records = COLLECTOR_ADAPTERS[source].parseSavedFixture([...SAVED_PROVIDER_RESPONSES[source]]);
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ source, synthetic: true, sourceScope: "myntra_specific" });
    }
  });

  it("denies collector transport before construction or invocation", async () => {
    const transport = vi.fn();
    await expect(COLLECTOR_ADAPTERS.youtube.collectExternal({ sourceApprovalStatus: "approved", maxItems: 10, maxCost: 0, argv: ["--allow-external"], environment: { ALLOW_EXTERNAL_CALLS: "false" } }, transport)).rejects.toMatchObject({ code: "EXTERNAL_CALLS_DISABLED" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("hard-disables legacy fixture adapters even after external opt-in", async () => {
    const transport = vi.fn();
    await expect(COLLECTOR_ADAPTERS.youtube.collectExternal({ sourceApprovalStatus: "approved", maxItems: 10, maxCost: 0, argv: ["--allow-external"], environment: { ALLOW_EXTERNAL_CALLS: "true" } }, transport)).rejects.toThrow("Fixture adapters cannot collect live data");
    expect(transport).not.toHaveBeenCalled();
  });

  it("builds a sanitized, non-executing dry-run plan", () => {
    const plan = planCollection({ source: "reddit", approvalStatus: "disabled", queryIds: ["wishlist-fit"], maxItems: 50, maxRequests: 5, maxCost: 1, outputPath: "data/raw/batch-001", quarantinePath: "data/intermediate/quarantine/batch-001", retentionDays: 2, environment: { ALLOW_EXTERNAL_CALLS: "false", REDDIT_SOURCE_APPROVAL: "disabled", APIFY_TOKEN: "" } });
    expect(plan.externalExecutionPerformed).toBe(false);
    expect(plan.credentialsPresent).toBe(false);
    expect(plan.blockedReasons).toEqual(expect.arrayContaining(["External calls are disabled.", "Source approval is not active.", "Reddit-specific approval is disabled."]));
    expect(JSON.stringify(plan)).not.toContain("APIFY_TOKEN");
  });

  it("locks Myntra-only queries and both 20K allocations", () => {
    expect(validateMyntraOnlyKeywords().length).toBeGreaterThan(20);
    expect(PREFERRED_COLLECTION_MATRIX.reduce((sum, item) => sum + item.target, 0)).toBe(20_000);
    expect(FALLBACK_COLLECTION_MATRIX.reduce((sum, item) => sum + item.target, 0)).toBe(20_000);
  });

  it("provides deterministic mock embeddings and blocks external AI transport", async () => {
    const canonical = deduplicateRecordsScalable(normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)).canonical;
    const record = canonical[0];
    if (!record) throw new Error("Missing normalized fixture.");
    expect(embedWithMock(record)).toEqual(embedWithMock(record));
    expect(embedWithMock(record).vector).toHaveLength(8);
    const transport = vi.fn();
    await expect(classifyWithExternalProvider(record, { source: record.source, sourceApprovalStatus: "approved", maxItems: 1, maxCost: 0, argv: ["--allow-external"], environment: { ALLOW_EXTERNAL_CALLS: "false" } }, transport)).rejects.toMatchObject({ code: "EXTERNAL_CALLS_DISABLED" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("enforces bounded concurrency while preserving result order", async () => {
    let active = 0;
    let maximum = 0;
    const result = await boundedMap([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1; maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });
    expect(maximum).toBeLessThanOrEqual(2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("uses stable cache keys, explicit failure categories, and bounded retries", async () => {
    const input = { provider: "mock", model: "fixture", version: "v1", evidenceId: "ev-1", textHash: "abc" };
    expect(buildProviderCacheKey(input)).toBe(buildProviderCacheKey(input));
    expect(categorizeProviderFailure(new Error("429 rate limit"))).toBe("rate_limit");
    let attempts = 0;
    const result = await withBoundedRetry(async () => { attempts += 1; if (attempts < 3) throw new Error("503 temporary"); return "ok"; }, { maxAttempts: 3, retryable: ["transient"] });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});
