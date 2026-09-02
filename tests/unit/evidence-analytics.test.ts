import { describe, expect, it } from "vitest";

import { SYNTHETIC_RAW_RECORDS } from "../../data-pipeline/fixtures/synthetic-raw";
import { buildFixtureAggregates } from "../../data-pipeline/stages/aggregate";
import { deduplicateRecords } from "../../data-pipeline/stages/deduplicate";
import { mockClassifyRecords } from "../../data-pipeline/stages/mock-classifier";
import { normalizeRecords, validateRawRecords } from "../../data-pipeline/stages/normalize";
import { buildFilteredAnalytics } from "@/lib/data/evidence-analytics";
import { activeEvidenceFilters } from "@/lib/data/evidence-query";
import { buildEvidenceFacets, filterPublicEvidence } from "@/lib/data/public-evidence";
import { decodeEvidenceCursor, encodeEvidenceCursor } from "@/lib/data/pagination";
import { evidenceQuerySchema } from "@/lib/schemas";

function fixture() {
  const normalized = normalizeRecords(validateRawRecords(SYNTHETIC_RAW_RECORDS).valid);
  const canonical = deduplicateRecords(normalized).canonical;
  const classifications = mockClassifyRecords(canonical);
  return { canonical, classifications, ...buildFixtureAggregates(canonical, classifications) };
}

describe("interview-ready evidence analytics", () => {
  it("projects the public-safe classification fields and exact release denominators", () => {
    const { canonical, classifications, dashboard, publicEvidence } = fixture();
    const first = publicEvidence[0]!;
    const record = canonical.find((item) => item.evidenceId === first.evidenceId)!;
    const classification = classifications.find((item) => item.evidenceId === first.evidenceId)!;

    expect(first).toMatchObject({
      rating: record.rating,
      severity: classification.severity,
      primaryBarrier: classification.primaryBarrier,
      explicitAction: classification.explicitAction,
      contradictoryOrPositive: classification.contradictoryOrPositive,
    });
    expect(dashboard.analytics?.denominators).toEqual({
      corpus: publicEvidence.length,
      candidateRelevant: publicEvidence.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent").length,
      ratedStoreEvidence: publicEvidence.filter((item) => (item.source === "google_play" || item.source === "app_store") && item.rating !== null).length,
      humanReviewed: publicEvidence.length,
    });
    expect(dashboard.analytics?.sourceMetrics.reduce((sum, item) => sum + item.canonicalCount, 0)).toBe(publicEvidence.length);
    expect(dashboard.analytics?.ratingDistribution.reduce((sum, item) => sum + item.count, 0)).toBe(dashboard.analytics?.denominators.ratedStoreEvidence);
  });

  it("computes true journey-by-barrier intersections", () => {
    const { dashboard, publicEvidence } = fixture();
    const relevant = publicEvidence.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent");
    for (const cell of dashboard.analytics?.journeyBarrierMatrix ?? []) {
      expect(cell.count).toBe(relevant.filter((item) => item.journeyStages.includes(cell.journeyStage) && item.barrierIds.includes(cell.barrier)).length);
      expect(cell.count).toBeGreaterThan(0);
    }
  });

  it("supports repeated OR filters, contextual facets, dates, IDs, and deterministic sorting", () => {
    const { publicEvidence } = fixture();
    const twoSources = [...new Set(publicEvidence.map((item) => item.source))].slice(0, 2);
    const query = evidenceQuerySchema.parse({ source: twoSources, relevance: ["direct_wishlist", "journey_adjacent"], sort: "rating_desc" });
    const filtered = filterPublicEvidence(publicEvidence, query);
    expect(filtered.every((item) => twoSources.includes(item.source) && item.relevance !== "general" && item.relevance !== "irrelevant")).toBe(true);
    const rated = filtered.filter((item) => item.rating !== null);
    expect(rated.map((item) => item.rating)).toEqual([...rated].sort((a, b) => b.rating! - a.rating!).map((item) => item.rating));

    const facets = buildEvidenceFacets(publicEvidence, query);
    expect(facets.source.some((item) => !twoSources.includes(item.value as typeof twoSources[number]))).toBe(true);
    const exact = publicEvidence[0]!;
    expect(filterPublicEvidence(publicEvidence, { id: [exact.evidenceId] })).toEqual([exact]);
    if (exact.publishedAt) {
      const day = exact.publishedAt.slice(0, 10);
      expect(filterPublicEvidence(publicEvidence, { id: [exact.evidenceId], from: day, to: day })).toEqual([exact]);
    }
  });

  it("binds cursors to every active filter and produces filter-aware analytics", () => {
    const { publicEvidence } = fixture();
    const query = evidenceQuerySchema.parse({ source: ["google_play", "reddit"], sort: "oldest" });
    const filters = activeEvidenceFilters(query);
    const cursor = encodeEvidenceCursor(2, filters);
    expect(decodeEvidenceCursor(cursor, filters)).toBe(2);
    expect(() => decodeEvidenceCursor(cursor, { ...filters, sort: "newest" })).toThrow("INVALID_EVIDENCE_CURSOR");

    const items = filterPublicEvidence(publicEvidence, query);
    const facets = buildEvidenceFacets(publicEvidence, query);
    const analytics = buildFilteredAnalytics({ items, releaseCorpus: publicEvidence.length, status: "ready", mode: "fixtures", datasetVersion: "fixture-001", facets, activeFilters: filters });
    expect(analytics.denominators).toMatchObject({ releaseCorpus: publicEvidence.length, matchingEvidence: items.length });
    expect(analytics.kpis.candidateRelevant).toBe(items.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent").length);
    expect(analytics.journeyBarrierMatrix.every((cell) => cell.count > 0)).toBe(true);
  });
});
