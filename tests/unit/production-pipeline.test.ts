import { describe, expect, it } from "vitest";

import { SYNTHETIC_RAW_RECORDS } from "../../data-pipeline/fixtures/synthetic-raw";
import { runGeneratedPerformanceBenchmark } from "../../data-pipeline/performance/generated-benchmark";
import { applyReviewDecisions } from "../../data-pipeline/review/adjudication";
import { createReviewSample, createSimulatedReviewDecisions, evaluateReview } from "../../data-pipeline/review/evaluation-workflow";
import { applyTaxonomyDecisions, createTaxonomyCandidates } from "../../data-pipeline/review/taxonomy-workflow";
import { deduplicateRecordsScalable } from "../../data-pipeline/stages/deduplicate-scalable";
import { buildAggregates } from "../../data-pipeline/stages/aggregate";
import { deterministicClassifyRecords } from "../../data-pipeline/stages/deterministic-classifier";
import { mockClassifyRecords } from "../../data-pipeline/stages/mock-classifier";
import { minimizeText, normalizeRecords, sha256, validateRawRecords } from "../../data-pipeline/stages/normalize";
import { discoverLexicalThemes } from "../../data-pipeline/stages/theme-discovery";

describe("Phase 5 production contracts", () => {
  it("decodes common HTML entities before minimization", () => {
    expect(minimizeText("Fit &amp; size &#x2014; good&nbsp;value <b>today</b>").text).toBe("Fit & size — good value today");
  });
  it("preserves fixture duplicate semantics with the scalable implementation", () => {
    const normalized = normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid);
    const result = deduplicateRecordsScalable(normalized);
    expect(result.canonical).toHaveLength(13);
    expect(result.duplicateCount).toBe(2);
  });

  it("never collapses matching text across independent source strata", () => {
    const base = normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)[0];
    if (!base) throw new Error("Missing normalized fixture.");
    const otherSource = { ...base, evidenceId: "ev-other-source", rawId: "raw-other-source", source: "reddit" as const, sourceItemId: "other-source-item", collectionRunId: "other-source-run" };
    const result = deduplicateRecordsScalable([base, otherSource]);
    expect(result).toMatchObject({ duplicateCount: 0 });
    expect(result.canonical).toHaveLength(2);
  });

  it("never describes unreviewed real candidates as reviewed support", () => {
    const canonical = deduplicateRecordsScalable(normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)).canonical;
    const classifications = deterministicClassifyRecords(canonical, () => "2026-08-22T00:00:00.000Z");
    const aggregate = buildAggregates(canonical, classifications, { datasetVersion: "candidate-language-test", generatedAt: "2026-08-22T00:00:00.000Z", synthetic: false, releaseStatus: "partial" });
    expect(aggregate.dashboard.quality.warnings.join(" ")).toContain("unreviewed candidates");
    expect(aggregate.dashboard.segments.every((segment) => segment.status === "hypothesis")).toBe(true);
    expect(aggregate.dashboard.opportunities.flatMap((item) => item.limitations).join(" ")).toContain("unreviewed candidate-relevant");
    expect(aggregate.dashboard.themes.every((theme) => theme.taxonomyVersion === "candidate-taxonomy-v1")).toBe(true);
  });

  it("keeps duplicate-heavy real-sized input on the scalable path", () => {
    const base = normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)[0];
    if (!base) throw new Error("Missing normalized fixture.");
    const unique = Array.from({ length: 4_000 }, (_, index) => {
      const text = `myntra evidence token${index} variant${index} garment${index} context${index} choice${index} has a distinct shopping decision description`;
      return {
        ...base,
        evidenceId: `ev-load-${index}`,
        rawId: `raw-load-${index}`,
        sourceItemId: `load-${index}`,
        queryIds: [`myntra-load-${index % 20}`],
        originalText: text,
        normalizedText: text,
        contentHash: sha256(text),
      };
    });
    const duplicates = unique.slice(0, 400).map((record, index) => ({
      ...record,
      evidenceId: `ev-duplicate-${index}`,
      rawId: `raw-duplicate-${index}`,
      sourceItemId: `duplicate-${index}`,
      queryIds: [`myntra-duplicate-${index % 20}`],
    }));
    const result = deduplicateRecordsScalable([...unique, ...duplicates]);
    expect(result.canonical).toHaveLength(4_000);
    expect(result.duplicateCount).toBe(400);
    expect(result.canonical[0]?.queryIds).toEqual(expect.arrayContaining(["myntra-load-0", "myntra-duplicate-0"]));
  });

  it("applies file-shaped human review decisions without mutating input", () => {
    const canonical = deduplicateRecordsScalable(normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)).canonical;
    const original = mockClassifyRecords(canonical);
    const target = original[0];
    if (!target) throw new Error("Missing fixture classification.");
    const reviewed = applyReviewDecisions(original, [{ schemaVersion: "1.0.0", evidenceId: target.evidenceId, decision: "correct", correctedRelevance: "journey_adjacent", correctedBarrierIds: ["other"], reviewerId: "fixture-reviewer", reviewedAt: "2026-08-22T00:00:00.000Z", notes: "Synthetic correction." }]);
    expect(reviewed[0]).toMatchObject({ relevance: "journey_adjacent", barriers: ["other"] });
    expect(reviewed[0]?.humanReviewStatus).toBe("corrected");
    expect(original[0]).not.toEqual(reviewed[0]);
  });

  it("keeps taxonomy candidates separate from explicit review decisions", () => {
    const canonical = deduplicateRecordsScalable(normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)).canonical;
    const classifications = mockClassifyRecords(canonical);
    const candidates = createTaxonomyCandidates(discoverLexicalThemes(canonical, classifications));
    const first = candidates[0];
    if (!first) throw new Error("Missing taxonomy candidate.");
    const accepted = applyTaxonomyDecisions(candidates, [{ schemaVersion: "1.0.0", candidateThemeId: first.candidateThemeId, action: "rename", targetThemeIds: ["reviewed-theme"], finalName: "Reviewed synthetic theme", reviewerId: "fixture-reviewer", reviewedAt: "2026-08-22T00:00:00.000Z", rationale: "Fixture contract test." }]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ finalThemeIds: ["reviewed-theme"], finalName: "Reviewed synthetic theme" });
  });

  it("marks simulated evaluation as workflow-only and not release eligible", () => {
    const canonical = deduplicateRecordsScalable(normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)).canonical;
    const classifications = mockClassifyRecords(canonical);
    const sample = createReviewSample({ reviewId: "simulation-test", records: canonical, classifications, sampleSize: 9 });
    const decisions = createSimulatedReviewDecisions(sample, "2026-08-22T00:00:00.000Z");
    const report = evaluateReview({ evaluationId: "simulation-eval", datasetVersion: "simulation-dataset", generatedAt: "2026-08-22T00:00:00.000Z", sample, rawDecisions: decisions });
    expect(report).toMatchObject({ reviewKind: "simulated", releaseEligible: false, sampleSize: 9 });
    expect(report.limitations.join(" ")).toMatch(/not independent/u);
  });

  it("requires exactly one decision for every sampled evidence ID", () => {
    const canonical = deduplicateRecordsScalable(normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid)).canonical;
    const classifications = mockClassifyRecords(canonical);
    const sample = createReviewSample({ reviewId: "incomplete-test", records: canonical, classifications, sampleSize: 6 });
    const decisions = createSimulatedReviewDecisions(sample, "2026-08-22T00:00:00.000Z").slice(1);
    expect(() => evaluateReview({ evaluationId: "incomplete-eval", datasetVersion: "incomplete-dataset", generatedAt: "2026-08-22T00:00:00.000Z", sample, rawDecisions: decisions })).toThrow("incomplete");
  });

  it("processes a generated local load without external access", () => {
    const result = runGeneratedPerformanceBenchmark(1_000);
    expect(result).toMatchObject({ count: 1_000, canonicalCount: 1_000, externalCallsMade: false });
    expect(result.durationsMs.total).toBeLessThan(10_000);
  });
});
