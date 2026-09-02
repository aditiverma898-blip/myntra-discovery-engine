import { z } from "zod";

import {
  barrierIdSchema,
  journeyStageSchema,
  relevanceSchema,
  sourceIdSchema,
} from "./release";

export const selectionMethodSchema = z.enum([
  "organic_feed",
  "keyword_query",
  "video_query",
  "thread_query",
  "manual_sample",
  "provided_dataset",
]);

export const rawEvidenceSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    synthetic: z.boolean(),
    scenarioId: z.string().min(1).nullable(),
    rawId: z.string().min(1),
    collectionRunId: z.string().min(1),
    source: sourceIdSchema,
    sourceItemType: z.enum(["review", "post", "comment", "video", "observation"]),
    sourceItemId: z.string().min(1).nullable(),
    parentSourceItemId: z.string().min(1).nullable(),
    canonicalUrl: z.url(),
    sourceScope: z.literal("myntra_specific"),
    sourceStratum: z.string().min(1),
    selectionMethod: selectionMethodSchema,
    queryIds: z.array(z.string().min(1)).min(1),
    resultPosition: z.number().int().positive().nullable(),
    collectedAt: z.iso.datetime(),
    publishedAt: z.iso.datetime().nullable(),
    rating: z.number().min(1).max(5).nullable(),
    title: z.string().nullable(),
    text: z.string().min(1),
    language: z.string().nullable(),
    region: z.string().nullable(),
    sourceMetadata: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    ),
  })
  .strict();

export const normalizedEvidenceSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    synthetic: z.boolean(),
    scenarioId: z.string().min(1).nullable(),
    evidenceId: z.string().min(1),
    rawId: z.string().min(1),
    collectionRunId: z.string().min(1),
    source: sourceIdSchema,
    sourceItemType: z.string().min(1),
    sourceItemId: z.string().min(1).nullable(),
    parentThreadId: z.string().min(1).nullable(),
    canonicalUrl: z.url(),
    sourceStratum: z.string().min(1),
    selectionMethod: selectionMethodSchema,
    queryIds: z.array(z.string().min(1)).min(1),
    collectedAt: z.iso.datetime(),
    publishedAt: z.iso.datetime().nullable(),
    rating: z.number().min(1).max(5).nullable().default(null),
    title: z.string().nullable(),
    originalText: z.string().min(1),
    normalizedText: z.string().min(1),
    language: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    duplicateGroupId: z.string().nullable(),
    isCanonicalDuplicate: z.boolean(),
    piiReview: z.enum(["not_required", "redacted", "needs_review"]),
    validationWarnings: z.array(z.string()),
  })
  .strict();

export const evidenceClassificationSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    evidenceId: z.string().min(1),
    relevance: relevanceSchema,
    relevanceReason: z.string().min(1),
    wishlistExplicit: z.boolean(),
    journeyStages: z.array(journeyStageSchema).min(1),
    barriers: z.array(barrierIdSchema),
    primaryBarrier: barrierIdSchema.nullable(),
    themeIds: z.array(z.string().min(1)),
    segmentIds: z.array(z.string().min(1)),
    workarounds: z.array(z.string().min(1)),
    desiredOutcomes: z.array(z.string().min(1)),
    explicitAction: z.enum(["wait", "research", "ask", "compare", "bag", "buy", "buy_elsewhere", "remove", "abandon", "return", "unknown"]),
    severity: z.number().int().min(0).max(3),
    monetaryDependency: z.number().int().min(0).max(2),
    nonMonetarySolvability: z.number().int().min(0).max(3),
    contradictoryOrPositive: z.boolean(),
    method: z.enum(["model", "human", "hybrid", "rule"]),
    modelId: z.string().min(1),
    promptVersion: z.string().min(1),
    taxonomyVersion: z.string().min(1),
    confidence: z.number().min(0).max(1),
    confidenceReason: z.string().min(1),
    classifiedAt: z.iso.datetime(),
    humanReviewStatus: z.enum(["unreviewed", "accepted", "corrected", "rejected"]),
  })
  .strict();

export const validationLedgerEntrySchema = z
  .object({
    rawId: z.string().min(1),
    stage: z.enum(["raw_validation", "normalization", "classification", "publication"]),
    code: z.string().min(1),
    message: z.string().min(1),
    disposition: z.enum(["quarantined", "warning"]),
  })
  .strict();

export const embeddingRecordSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  evidenceId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  dimensions: z.number().int().positive(),
  vector: z.array(z.number().finite()).min(1),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  embeddedAt: z.iso.datetime(),
}).strict().superRefine((value, context) => {
  if (value.vector.length !== value.dimensions) context.addIssue({ code: "custom", path: ["vector"], message: "Embedding vector length must match dimensions." });
});

export type RawEvidence = z.infer<typeof rawEvidenceSchema>;
export type NormalizedEvidence = z.infer<typeof normalizedEvidenceSchema>;
export type EvidenceClassification = z.infer<typeof evidenceClassificationSchema>;
export type ValidationLedgerEntry = z.infer<typeof validationLedgerEntrySchema>;
export type EmbeddingRecord = z.infer<typeof embeddingRecordSchema>;
