import { describe, expect, it } from "vitest";

import { SYNTHETIC_RAW_RECORDS } from "../../data-pipeline/fixtures/synthetic-raw";
import { buildFixtureAggregates, calculateOpportunityScore } from "../../data-pipeline/stages/aggregate";
import { deduplicateRecords } from "../../data-pipeline/stages/deduplicate";
import { mockClassifyRecords } from "../../data-pipeline/stages/mock-classifier";
import { normalizeRecords, validateRawRecords } from "../../data-pipeline/stages/normalize";
import { discoverLexicalThemes } from "../../data-pipeline/stages/theme-discovery";

function buildFixture() {
  const validated = validateRawRecords(SYNTHETIC_RAW_RECORDS);
  const normalized = normalizeRecords(validated.valid);
  const deduplicated = deduplicateRecords(normalized);
  const classifications = mockClassifyRecords(deduplicated.canonical);
  return { validated, normalized, ...deduplicated, classifications };
}

describe("Phase 4 synthetic fixture pipeline", () => {
  it("quarantines malformed input and minimizes identity metadata", () => {
    const { validated, normalized } = buildFixture();
    expect(validated.valid).toHaveLength(15);
    expect(validated.ledger).toEqual([
      expect.objectContaining({ rawId: "raw-invalid-001", disposition: "quarantined" }),
    ]);
    const identityFixture = normalized.find((item) => item.rawId === "raw-fit-001");
    expect(identityFixture?.piiReview).toBe("redacted");
    expect(JSON.stringify(identityFixture)).not.toContain("sample_user");
    expect(JSON.stringify(identityFixture)).not.toContain("profileUrl");
  });

  it("groups exact and near duplicates while retaining discovery query IDs", () => {
    const { canonical, duplicateCount } = buildFixture();
    expect(duplicateCount).toBe(2);
    expect(canonical).toHaveLength(13);
    const fit = canonical.find((item) => item.scenarioId === "fit_wait");
    expect(fit?.queryIds).toEqual(["myntra-size-guide", "saved-size-help", "wishlist-fit"]);
    expect(fit?.duplicateGroupId).toMatch(/^dup-/u);
  });

  it("applies deterministic relevance and mocked structured labels", () => {
    const { classifications } = buildFixture();
    const count = (value: string) => classifications.filter((item) => item.relevance === value).length;
    expect({ direct: count("direct_wishlist"), adjacent: count("journey_adjacent"), general: count("general"), irrelevant: count("irrelevant") }).toEqual({ direct: 7, adjacent: 4, general: 1, irrelevant: 1 });
    expect(classifications.every((item) => item.modelId === "mock-structured-classifier-v1")).toBe(true);
    expect(classifications.every((item) => item.humanReviewStatus === "accepted")).toBe(true);
  });

  it("discovers stable lexical clusters and publishes public-safe aggregates", () => {
    const { canonical, classifications } = buildFixture();
    const first = discoverLexicalThemes(canonical, classifications);
    const second = discoverLexicalThemes(canonical, classifications);
    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
    const { dashboard, publicEvidence } = buildFixtureAggregates(canonical, classifications);
    expect(dashboard.totals).toEqual({ evidence: 13, themes: 6, segments: 3, opportunities: 5 });
    expect(dashboard.opportunities.map((item) => item.opportunityId)).toEqual(expect.arrayContaining(["fit-decision-support", "product-evidence-clarity", "shortlist-memory", "reversibility-clarity", "preferred-variant-availability"]));
    expect(dashboard.opportunities.find((item) => item.opportunityId === "preferred-variant-availability")?.themeIds).toEqual(["availability-planning"]);
    expect(dashboard.opportunities[0]?.adjustedScore).toBeGreaterThan(0);
    expect(publicEvidence.every((item) => item.canonicalUrl === null)).toBe(true);
  });

  it("calculates the documented score and monetary adjustment exactly", () => {
    expect(calculateOpportunityScore({ corpusFrequency: 40, severity: 60, conversionProximity: 80, nonMonetarySolvability: 100, targetSegmentValue: 70, evidenceConfidence: 90, monetaryDependency: 0.5 })).toEqual({ baseScore: 69, adjustedScore: 51.8 });
  });
});
