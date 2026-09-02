import { z } from "zod";

export const releaseStatusSchema = z.enum([
  "empty",
  "partial",
  "ready",
  "error",
]);

export const dataModeSchema = z.enum(["empty", "fixtures", "provisional", "ready"]);

export const activeReleasePointerSchema = z
  .object({
    schemaVersion: z.string().min(1),
    datasetVersion: z.string().min(1),
    releasePath: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  })
  .strict();

export const sourceIdSchema = z.enum([
  "google_play",
  "app_store",
  "youtube",
  "reddit",
  "myntra_product_review",
  "community",
  "manual_import",
]);

export const relevanceSchema = z.enum([
  "direct_wishlist",
  "journey_adjacent",
  "general",
  "irrelevant",
]);

export const confidenceBandSchema = z.enum(["low", "medium", "high"]);

export const journeyStageSchema = z.enum([
  "wishlist_add",
  "active_intent",
  "revisit",
  "research",
  "comparison",
  "decision",
  "bag",
  "checkout",
  "post_purchase",
  "unknown",
]);

export const barrierIdSchema = z.enum([
  "fit_size_uncertainty",
  "material_quality_uncertainty",
  "color_image_mismatch",
  "review_trust_gap",
  "authenticity_trust_gap",
  "comparison_overload",
  "choice_overload",
  "styling_occasion_uncertainty",
  "social_validation_gap",
  "price_waiting",
  "budget_timing",
  "stock_size_unavailability",
  "delivery_timing_uncertainty",
  "return_refund_risk",
  "wishlist_clutter_forgetting",
  "low_purchase_intent_bookmarking",
  "checkout_or_payment_friction",
  "actual_product_or_fulfillment_failure",
  "other",
]);

export const qualityStatusSchema = z.enum([
  "not_evaluated",
  "passed",
  "passed_with_warnings",
  "failed",
]);

const nullableCountSchema = z.number().int().nonnegative().nullable();

export const releaseScopeSchema = z
  .object({
    product: z.literal("myntra"),
    targetRawRecords: z.literal(20_000),
    acceptableRawMinimum: z.literal(18_000),
    acceptableRawMaximum: z.literal(22_000),
    otherShoppingPlatformsIncluded: z.literal(false),
  })
  .strict();

export const releaseManifestSchema = z
  .object({
    schemaVersion: z.string().min(1),
    datasetVersion: z.string().min(1),
    status: releaseStatusSchema,
    generatedAt: z.iso.datetime().nullable(),
    scope: releaseScopeSchema,
    codeCommit: z.string().min(1).nullable(),
    taxonomyVersion: z.string().min(1).nullable(),
    promptVersion: z.string().min(1).nullable(),
    classifier: z
      .object({
        provider: z.string().min(1),
        model: z.string().min(1),
      })
      .strict()
      .nullable(),
    embedding: z
      .object({
        provider: z.string().min(1),
        model: z.string().min(1),
        dimensions: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    coverage: z.array(
      z
        .object({
          source: sourceIdSchema,
          runIds: z.array(z.string().min(1)),
          from: z.iso.datetime().nullable(),
          to: z.iso.datetime().nullable(),
          queries: z.array(z.string()),
        })
        .strict(),
    ),
    counts: z
      .object({
        raw: nullableCountSchema,
        normalized: nullableCountSchema,
        canonical: nullableCountSchema,
        direct: nullableCountSchema,
        adjacent: nullableCountSchema,
        general: nullableCountSchema,
        irrelevant: nullableCountSchema,
        reviewed: nullableCountSchema,
      })
      .strict(),
    files: z.array(
      z
        .object({
          role: z.string().min(1),
          path: z.string().min(1),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          recordCount: nullableCountSchema,
          visibility: z.enum(["client", "server", "restricted"]),
        })
        .strict(),
    ),
    qualityStatus: qualityStatusSchema,
    limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((release, context) => {
    if (release.status === "empty") {
      if (release.generatedAt !== null) {
        context.addIssue({
          code: "custom",
          path: ["generatedAt"],
          message: "Empty releases cannot claim a generation timestamp.",
        });
      }

      for (const [key, value] of Object.entries(release.counts)) {
        if (value !== null) {
          context.addIssue({
            code: "custom",
            path: ["counts", key],
            message: "Empty-release counts must be null, not zero.",
          });
        }
      }

      if (release.qualityStatus !== "not_evaluated") {
        context.addIssue({
          code: "custom",
          path: ["qualityStatus"],
          message: "Empty releases must use not_evaluated quality status.",
        });
      }
    }
  });

const hypothesisCardSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.literal("hypothesis"),
    description: z.string().min(1),
  })
  .strict();

export const themeDefinitionSchema = z
  .object({
    themeId: z.string().min(1),
    taxonomyVersion: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(["hypothesis", "discovered", "reviewed", "retired"]),
    userGoal: z.string().min(1),
    barrierOrNeed: z.string().min(1),
    journeyStages: z.array(journeyStageSchema),
    inclusionCriteria: z.array(z.string().min(1)),
    exclusionCriteria: z.array(z.string().min(1)),
    relatedBarrierIds: z.array(barrierIdSchema),
    typicalWorkarounds: z.array(z.string().min(1)),
    representativeEvidenceIds: z.array(z.string().min(1)),
    contradictoryEvidenceIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    reviewedBy: z.string().min(1).nullable(),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const behavioralSegmentSchema = z
  .object({
    segmentId: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(["hypothesis", "evidence_supported", "interview_validated"]),
    definition: z.string().min(1),
    qualifyingBehaviors: z.array(z.string().min(1)),
    exclusionRules: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    topBarrierIds: z.array(barrierIdSchema),
    unknowns: z.array(z.string().min(1)),
    interviewRecruitmentRule: z.string().min(1),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

export const opportunityScoreInputsSchema = z
  .object({
    corpusFrequency: z.number().min(0).max(100),
    severity: z.number().min(0).max(100),
    conversionProximity: z.number().min(0).max(100),
    nonMonetarySolvability: z.number().min(0).max(100),
    targetSegmentValue: z.number().min(0).max(100),
    evidenceConfidence: z.number().min(0).max(100),
    monetaryDependency: z.number().min(0).max(1),
  })
  .strict();

export const opportunitySchema = z
  .object({
    opportunityId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    status: z.enum(["hypothesis", "engine_candidate", "selected_for_interviews", "retired"]),
    affectedProductOutcomes: z.array(z.string().min(1)),
    themeIds: z.array(z.string().min(1)),
    segmentIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    directEvidenceCount: z.number().int().nonnegative(),
    adjacentEvidenceCount: z.number().int().nonnegative(),
    sourceDistribution: z.record(z.string(), z.number().int().nonnegative()),
    workaroundSummary: z.array(z.string().min(1)),
    scoreInputs: opportunityScoreInputsSchema,
    baseScore: z.number().min(0).max(100),
    adjustedScore: z.number().min(0).max(100),
    confidenceBand: confidenceBandSchema,
    limitations: z.array(z.string().min(1)),
    interviewQuestions: z.array(z.string().min(1)),
  })
  .strict();

const sourceCountRecordSchema = z.partialRecord(sourceIdSchema, z.number().int().nonnegative());
const journeyCountRecordSchema = z.partialRecord(journeyStageSchema, z.number().int().nonnegative());

export const releaseAnalyticsSchema = z
  .object({
    denominators: z
      .object({
        corpus: z.number().int().nonnegative(),
        candidateRelevant: z.number().int().nonnegative(),
        ratedStoreEvidence: z.number().int().nonnegative(),
        humanReviewed: z.number().int().nonnegative(),
      })
      .strict(),
    sourceMetrics: z.array(
      z
        .object({
          source: sourceIdSchema,
          canonicalCount: z.number().int().nonnegative(),
          corpusShare: z.number().min(0).max(1),
          relevantCount: z.number().int().nonnegative(),
          relevanceRate: z.number().min(0).max(1),
          directWishlistCount: z.number().int().nonnegative(),
          ratingCount: z.number().int().nonnegative(),
          averageRating: z.number().min(1).max(5).nullable(),
          coverageFrom: z.iso.datetime().nullable(),
          coverageTo: z.iso.datetime().nullable(),
        })
        .strict(),
    ),
    ratingDistribution: z.array(
      z
        .object({
          source: sourceIdSchema,
          rating: z.number().int().min(1).max(5),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    sourceByRelevance: z.array(
      z
        .object({
          source: sourceIdSchema,
          counts: z.array(
            z
              .object({
                relevance: relevanceSchema,
                count: z.number().int().nonnegative(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    barrierStats: z.array(
      z
        .object({
          barrier: barrierIdSchema,
          count: z.number().int().nonnegative(),
          relevantShare: z.number().min(0).max(1),
          directCount: z.number().int().nonnegative(),
          averageSeverity: z.number().min(0).max(3),
          sourceCount: z.number().int().nonnegative(),
          sourceDistribution: sourceCountRecordSchema,
        })
        .strict(),
    ),
    journeyStageStats: z
      .object({
        nonExclusive: z.literal(true),
        items: z.array(
          z
            .object({
              journeyStage: journeyStageSchema,
              count: z.number().int().nonnegative(),
              relevantShare: z.number().min(0).max(1),
              sourceDistribution: sourceCountRecordSchema,
            })
            .strict(),
        ),
      })
      .strict(),
    journeyBarrierMatrix: z.array(
      z
        .object({
          journeyStage: journeyStageSchema,
          barrier: barrierIdSchema,
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    monthlyCoverage: z.array(
      z
        .object({
          month: z.string().regex(/^\d{4}-\d{2}$/),
          source: sourceIdSchema,
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    themeStats: z.array(
      z
        .object({
          themeId: z.string().min(1),
          supportCount: z.number().int().nonnegative(),
          relevantShare: z.number().min(0).max(1),
          directCount: z.number().int().nonnegative(),
          adjacentCount: z.number().int().nonnegative(),
          averageSeverity: z.number().min(0).max(3),
          sourceDistribution: sourceCountRecordSchema,
          journeyStageDistribution: journeyCountRecordSchema,
          representativeEvidenceIds: z.array(z.string().min(1)),
          controlEvidenceIds: z.array(z.string().min(1)),
        })
        .strict(),
    ),
    opportunityStats: z.array(
      z
        .object({
          opportunityId: z.string().min(1),
          adjustedScore: z.number().min(0).max(100),
          evidenceCount: z.number().int().nonnegative(),
          directCount: z.number().int().nonnegative(),
          adjacentCount: z.number().int().nonnegative(),
          sourceBreadth: z.number().int().nonnegative(),
          nonMonetarySolvability: z.number().min(0).max(100),
          reviewState: z.enum(["unreviewed", "reviewed"]),
        })
        .strict(),
    ),
  })
  .strict();

export const dashboardReleaseSchema = z
  .object({
    status: releaseStatusSchema,
    datasetVersion: z.string().min(1),
    generatedAt: z.iso.datetime().nullable(),
    productScope: z.literal("myntra"),
    sources: z
      .object({
        configured: z.array(sourceIdSchema),
        collected: z.array(sourceIdSchema),
      })
      .strict(),
    totals: z
      .object({
        evidence: nullableCountSchema,
        themes: nullableCountSchema,
        segments: nullableCountSchema,
        opportunities: nullableCountSchema,
      })
      .strict(),
    relevanceDistribution: z.array(
      z
        .object({
          key: relevanceSchema,
          count: z.number().int().nonnegative(),
          denominator: z.number().int().positive(),
        })
        .strict(),
    ),
    sourceStats: z.array(
      z
        .object({
          source: sourceIdSchema,
          count: z.number().int().nonnegative(),
          directCount: z.number().int().nonnegative(),
          coverageFrom: z.iso.datetime().nullable(),
          coverageTo: z.iso.datetime().nullable(),
          warnings: z.array(z.string()),
        })
        .strict(),
    ),
    analytics: releaseAnalyticsSchema.nullable().default(null),
    themes: z.array(themeDefinitionSchema),
    segments: z.array(behavioralSegmentSchema),
    opportunities: z.array(opportunitySchema),
    hypotheses: z
      .object({
        themes: z.array(hypothesisCardSchema),
        segments: z.array(hypothesisCardSchema),
      })
      .strict(),
    quality: z
      .object({
        status: qualityStatusSchema,
        warnings: z.array(z.string()),
      })
      .strict(),
  })
  .strict()
  .superRefine((release, context) => {
    if (release.status !== "empty") return;

    const totals = Object.values(release.totals);
    if (totals.some((value) => value !== null)) {
      context.addIssue({
        code: "custom",
        path: ["totals"],
        message: "Empty dashboard totals must be null.",
      });
    }

    if (
      release.sources.collected.length > 0 ||
      release.relevanceDistribution.length > 0 ||
      release.sourceStats.length > 0 ||
      release.analytics !== null ||
      release.themes.length > 0 ||
      release.segments.length > 0 ||
      release.opportunities.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Empty releases cannot contain evidence-derived output.",
      });
    }
  });

export type ReleaseStatus = z.infer<typeof releaseStatusSchema>;
export type DataMode = z.infer<typeof dataModeSchema>;
export type SourceId = z.infer<typeof sourceIdSchema>;
export type Relevance = z.infer<typeof relevanceSchema>;
export type JourneyStage = z.infer<typeof journeyStageSchema>;
export type BarrierId = z.infer<typeof barrierIdSchema>;
export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;
export type BehavioralSegment = z.infer<typeof behavioralSegmentSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type ReleaseAnalytics = z.infer<typeof releaseAnalyticsSchema>;
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export type DashboardRelease = z.infer<typeof dashboardReleaseSchema>;
export type ActiveReleasePointer = z.infer<
  typeof activeReleasePointerSchema
>;
