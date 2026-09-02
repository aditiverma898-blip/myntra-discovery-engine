import { z } from "zod";

import {
  barrierIdSchema,
  confidenceBandSchema,
  dataModeSchema,
  journeyStageSchema,
  releaseAnalyticsSchema,
  relevanceSchema,
  releaseStatusSchema,
  sourceIdSchema,
} from "@/lib/schemas/release";

const repeatedFilterSchema = z.array(z.string().trim().min(1).max(100)).default([]);
const dateFilterSchema = z.iso.date();

export const evidenceSortSchema = z.enum([
  "newest",
  "oldest",
  "confidence_desc",
  "rating_asc",
  "rating_desc",
]);

const evidenceQueryObjectSchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    source: z.array(sourceIdSchema).default([]),
    relevance: z.array(relevanceSchema).default([]),
    theme: repeatedFilterSchema,
    barrier: z.array(barrierIdSchema).default([]),
    journey: z.array(journeyStageSchema).default([]),
    segment: repeatedFilterSchema,
    confidence: confidenceBandSchema.optional(),
    rating: z.array(z.coerce.number().int().min(1).max(5)).default([]),
    from: dateFilterSchema.optional(),
    to: dateFilterSchema.optional(),
    sort: evidenceSortSchema.default("newest"),
    id: repeatedFilterSchema,
    cursor: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const evidenceQuerySchema = evidenceQueryObjectSchema
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "The to date must be on or after the from date.",
      });
    }
  });

export const publicEvidenceItemSchema = z
  .object({
    evidenceId: z.string().min(1),
    source: sourceIdSchema,
    sourceItemType: z.string().min(1),
    parentThreadId: z.string().min(1).nullable(),
    canonicalUrl: z.url().nullable(),
    publishedAt: z.iso.datetime().nullable(),
    excerpt: z.string().min(1),
    relevance: relevanceSchema,
    themeIds: z.array(z.string().min(1)),
    segmentIds: z.array(z.string().min(1)),
    barrierIds: z.array(barrierIdSchema),
    journeyStages: z.array(journeyStageSchema),
    confidence: z.number().min(0).max(1),
    rating: z.number().min(1).max(5).nullable().default(null),
    severity: z.number().int().min(0).max(3).default(0),
    primaryBarrier: barrierIdSchema.nullable().default(null),
    explicitAction: z.enum(["wait", "research", "ask", "compare", "bag", "buy", "buy_elsewhere", "remove", "abandon", "return", "unknown"]).default("unknown"),
    contradictoryOrPositive: z.boolean().default(false),
    labelMethod: z.enum(["heuristic", "model", "human"]),
    humanReviewStatus: z.string().min(1),
  })
  .strict();

export const evidenceActiveFiltersSchema = evidenceQueryObjectSchema.omit({
  cursor: true,
  limit: true,
});

const facetValueSchema = z
  .object({
    value: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const evidenceFacetsSchema = z
  .object({
    source: z.array(facetValueSchema),
    relevance: z.array(facetValueSchema),
    theme: z.array(facetValueSchema),
    barrier: z.array(facetValueSchema),
    journey: z.array(facetValueSchema),
    segment: z.array(facetValueSchema),
    confidence: z.array(facetValueSchema),
    rating: z.array(facetValueSchema),
  })
  .strict();

export const evidenceResponseSchema = z
  .object({
    status: releaseStatusSchema,
    mode: dataModeSchema,
    items: z.array(publicEvidenceItemSchema),
    nextCursor: z.string().min(1).nullable(),
    total: z.number().int().nonnegative().nullable(),
    datasetVersion: z.string().min(1),
    facets: evidenceFacetsSchema,
    activeFilters: evidenceActiveFiltersSchema,
    message: z.string().min(1).optional(),
  })
  .strict();

export const copilotFiltersSchema = evidenceQueryObjectSchema
  .pick({ source: true, relevance: true, theme: true, barrier: true, journey: true, segment: true, rating: true, from: true, to: true })
  .partial();

export const copilotRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(1_000),
    filters: copilotFiltersSchema.optional(),
  })
  .strict();

const copilotFindingSchema = z
  .object({
    finding: z.string().min(1),
    evidenceCount: z.number().int().nonnegative(),
    evidenceIds: z.array(z.string().min(1)),
    sources: z.array(sourceIdSchema),
    barrierIds: z.array(barrierIdSchema),
    journeyStages: z.array(journeyStageSchema),
    confidence: confidenceBandSchema,
  })
  .strict();

export const analyticsResponseSchema = z
  .object({
    status: releaseStatusSchema,
    mode: dataModeSchema,
    datasetVersion: z.string().min(1),
    denominators: z
      .object({
        releaseCorpus: z.number().int().nonnegative().nullable(),
        matchingEvidence: z.number().int().nonnegative().nullable(),
        candidateRelevant: z.number().int().nonnegative().nullable(),
        ratedStoreEvidence: z.number().int().nonnegative().nullable(),
        humanReviewed: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    kpis: z
      .object({
        evidence: z.number().int().nonnegative().nullable(),
        candidateRelevant: z.number().int().nonnegative().nullable(),
        candidateRelevantRate: z.number().min(0).max(1).nullable(),
        averageStoreRating: z.number().min(1).max(5).nullable(),
        directWishlist: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    sourceMetrics: releaseAnalyticsSchema.shape.sourceMetrics,
    relevanceDistribution: z.array(
      z
        .object({
          key: relevanceSchema,
          count: z.number().int().nonnegative(),
          denominator: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    ratingDistribution: releaseAnalyticsSchema.shape.ratingDistribution,
    sourceByRelevance: releaseAnalyticsSchema.shape.sourceByRelevance,
    barrierStats: releaseAnalyticsSchema.shape.barrierStats,
    journeyStageStats: releaseAnalyticsSchema.shape.journeyStageStats,
    journeyBarrierMatrix: releaseAnalyticsSchema.shape.journeyBarrierMatrix,
    monthlyCoverage: releaseAnalyticsSchema.shape.monthlyCoverage,
    facets: evidenceFacetsSchema,
    activeFilters: evidenceActiveFiltersSchema,
  })
  .strict();

export const copilotResponseSchema = z
  .object({
    status: releaseStatusSchema,
    relevant: z.boolean(),
    mode: z.enum(["unavailable", "extractive", "generated"]),
    usedLLM: z.boolean(),
    answer: z.string().min(1),
    findings: z.array(copilotFindingSchema),
    metricLinks: z.array(
      z
        .object({
          productOutcome: z.string().min(1),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    limitations: z.array(z.string().min(1)),
    datasetVersion: z.string().min(1),
  })
  .strict();

export type EvidenceQuery = z.infer<typeof evidenceQuerySchema>;
export type EvidenceQueryInput = z.input<typeof evidenceQuerySchema>;
export type PublicEvidenceItem = z.infer<typeof publicEvidenceItemSchema>;
export type EvidenceResponse = z.infer<typeof evidenceResponseSchema>;
export type EvidenceActiveFilters = z.infer<typeof evidenceActiveFiltersSchema>;
export type EvidenceFacets = z.infer<typeof evidenceFacetsSchema>;
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
export type CopilotRequest = z.infer<typeof copilotRequestSchema>;
export type CopilotResponse = z.infer<typeof copilotResponseSchema>;
