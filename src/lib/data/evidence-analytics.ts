import {
  analyticsResponseSchema,
  type AnalyticsResponse,
  type EvidenceActiveFilters,
  type EvidenceFacets,
  releaseAnalyticsSchema,
  type Opportunity,
  type Relevance,
  type ReleaseAnalytics,
  type SourceId,
  type ThemeDefinition,
} from "@/lib/schemas";
import type { PublicEvidenceItem } from "@/lib/data/public-evidence";

const relevanceKeys: readonly Relevance[] = ["direct_wishlist", "journey_adjacent", "general", "irrelevant"];
const storeSources = new Set<SourceId>(["google_play", "app_store"]);

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: readonly number[]): number | null {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : null;
}

function distribution(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

export function buildFilteredAnalytics(options: {
  items: readonly PublicEvidenceItem[];
  releaseCorpus: number;
  status: AnalyticsResponse["status"];
  mode: AnalyticsResponse["mode"];
  datasetVersion: string;
  facets: EvidenceFacets;
  activeFilters: EvidenceActiveFilters;
}): AnalyticsResponse {
  const { items } = options;
  const relevant = items.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent");
  const ratedStore = items.filter((item) => storeSources.has(item.source) && item.rating !== null);
  const sources = [...new Set(items.map((item) => item.source))].sort();

  const sourceMetrics = sources.map((source) => {
    const sourceItems = items.filter((item) => item.source === source);
    const sourceRelevant = sourceItems.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent");
    const ratings = sourceItems.flatMap((item) => item.rating === null || !storeSources.has(source) ? [] : [item.rating]);
    const dates = sourceItems.flatMap((item) => item.publishedAt ? [item.publishedAt] : []).sort();
    return {
      source,
      canonicalCount: sourceItems.length,
      corpusShare: items.length ? round(sourceItems.length / items.length) : 0,
      relevantCount: sourceRelevant.length,
      relevanceRate: sourceItems.length ? round(sourceRelevant.length / sourceItems.length) : 0,
      directWishlistCount: sourceItems.filter((item) => item.relevance === "direct_wishlist").length,
      ratingCount: ratings.length,
      averageRating: average(ratings),
      coverageFrom: dates[0] ?? null,
      coverageTo: dates.at(-1) ?? null,
    };
  });

  const barrierIds = [...new Set(relevant.flatMap((item) => item.barrierIds))].sort();
  const journeyStages = [...new Set(relevant.flatMap((item) => item.journeyStages))].sort();
  const months = [...new Set(items.flatMap((item) => item.publishedAt ? [item.publishedAt.slice(0, 7)] : []))].sort();
  const emptyRelease = options.mode === "empty";

  return analyticsResponseSchema.parse({
    status: options.status,
    mode: options.mode,
    datasetVersion: options.datasetVersion,
    denominators: {
      releaseCorpus: emptyRelease ? null : options.releaseCorpus,
      matchingEvidence: emptyRelease ? null : items.length,
      candidateRelevant: emptyRelease ? null : relevant.length,
      ratedStoreEvidence: emptyRelease ? null : ratedStore.length,
      humanReviewed: emptyRelease ? null : items.filter((item) => item.humanReviewStatus !== "unreviewed").length,
    },
    kpis: {
      evidence: emptyRelease ? null : items.length,
      candidateRelevant: emptyRelease ? null : relevant.length,
      candidateRelevantRate: emptyRelease ? null : items.length ? round(relevant.length / items.length) : 0,
      averageStoreRating: average(ratedStore.map((item) => item.rating!)),
      directWishlist: emptyRelease ? null : items.filter((item) => item.relevance === "direct_wishlist").length,
    },
    sourceMetrics,
    relevanceDistribution: relevanceKeys.map((key) => ({ key, count: items.filter((item) => item.relevance === key).length, denominator: items.length })),
    ratingDistribution: sources.flatMap((source) => storeSources.has(source) ? [1, 2, 3, 4, 5].map((rating) => ({ source, rating, count: items.filter((item) => item.source === source && item.rating === rating).length })) : []),
    sourceByRelevance: sources.map((source) => ({ source, counts: relevanceKeys.map((relevance) => ({ relevance, count: items.filter((item) => item.source === source && item.relevance === relevance).length })) })),
    barrierStats: barrierIds.map((barrier) => {
      const support = relevant.filter((item) => item.barrierIds.includes(barrier));
      const sourceDistribution = distribution(support.map((item) => item.source));
      return { barrier, count: support.length, relevantShare: relevant.length ? round(support.length / relevant.length) : 0, directCount: support.filter((item) => item.relevance === "direct_wishlist").length, averageSeverity: average(support.map((item) => item.severity)) ?? 0, sourceCount: Object.keys(sourceDistribution).length, sourceDistribution };
    }).sort((a, b) => b.count - a.count || a.barrier.localeCompare(b.barrier)),
    journeyStageStats: { nonExclusive: true, items: journeyStages.map((journeyStage) => {
      const support = relevant.filter((item) => item.journeyStages.includes(journeyStage));
      return { journeyStage, count: support.length, relevantShare: relevant.length ? round(support.length / relevant.length) : 0, sourceDistribution: distribution(support.map((item) => item.source)) };
    }).sort((a, b) => b.count - a.count || a.journeyStage.localeCompare(b.journeyStage)) },
    journeyBarrierMatrix: journeyStages.flatMap((journeyStage) => barrierIds.map((barrier) => ({
      journeyStage,
      barrier,
      count: relevant.filter((item) => item.journeyStages.includes(journeyStage) && item.barrierIds.includes(barrier)).length,
    }))).filter((item) => item.count > 0),
    monthlyCoverage: months.flatMap((month) => sources.map((source) => ({ month, source, count: items.filter((item) => item.source === source && item.publishedAt?.startsWith(month)).length })).filter((item) => item.count > 0)),
    facets: options.facets,
    activeFilters: options.activeFilters,
  });
}

export function buildReleaseAnalytics(
  items: readonly PublicEvidenceItem[],
  themes: readonly ThemeDefinition[],
  opportunities: readonly Opportunity[],
): ReleaseAnalytics {
  const emptyFilters = {
    source: [], relevance: [], theme: [], barrier: [], journey: [], segment: [], rating: [], id: [],
    sort: "newest" as const,
  };
  const emptyFacets = { source: [], relevance: [], theme: [], barrier: [], journey: [], segment: [], confidence: [], rating: [] };
  const core = buildFilteredAnalytics({
    items,
    releaseCorpus: items.length,
    status: "partial",
    mode: "provisional",
    datasetVersion: "aggregate-internal",
    facets: emptyFacets,
    activeFilters: emptyFilters,
  });
  const relevant = items.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent");
  const byId = new Map(items.map((item) => [item.evidenceId, item]));

  return releaseAnalyticsSchema.parse({
    denominators: {
      corpus: items.length,
      candidateRelevant: relevant.length,
      ratedStoreEvidence: core.denominators.ratedStoreEvidence,
      humanReviewed: core.denominators.humanReviewed,
    },
    sourceMetrics: core.sourceMetrics,
    ratingDistribution: core.ratingDistribution,
    sourceByRelevance: core.sourceByRelevance,
    barrierStats: core.barrierStats,
    journeyStageStats: core.journeyStageStats,
    journeyBarrierMatrix: core.journeyBarrierMatrix,
    monthlyCoverage: core.monthlyCoverage,
    themeStats: themes.map((theme) => {
      const support = relevant.filter((item) => item.themeIds.includes(theme.themeId));
      return {
        themeId: theme.themeId,
        supportCount: support.length,
        relevantShare: relevant.length ? round(support.length / relevant.length) : 0,
        directCount: support.filter((item) => item.relevance === "direct_wishlist").length,
        adjacentCount: support.filter((item) => item.relevance === "journey_adjacent").length,
        averageSeverity: average(support.map((item) => item.severity)) ?? 0,
        sourceDistribution: distribution(support.map((item) => item.source)),
        journeyStageDistribution: distribution(support.flatMap((item) => item.journeyStages)),
        representativeEvidenceIds: theme.representativeEvidenceIds,
        controlEvidenceIds: theme.contradictoryEvidenceIds,
      };
    }).sort((a, b) => b.supportCount - a.supportCount || a.themeId.localeCompare(b.themeId)),
    opportunityStats: opportunities.map((opportunity) => ({
      opportunityId: opportunity.opportunityId,
      adjustedScore: opportunity.adjustedScore,
      evidenceCount: opportunity.evidenceIds.length,
      directCount: opportunity.directEvidenceCount,
      adjacentCount: opportunity.adjacentEvidenceCount,
      sourceBreadth: Object.values(opportunity.sourceDistribution).filter((count) => count > 0).length,
      nonMonetarySolvability: opportunity.scoreInputs.nonMonetarySolvability,
      reviewState: opportunity.evidenceIds.length > 0 && opportunity.evidenceIds.every((id) => byId.get(id)?.humanReviewStatus !== "unreviewed") ? "reviewed" : "unreviewed",
    })),
  });
}
