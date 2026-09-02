import { z } from "zod";

import { barrierIdSchema, journeyStageSchema, relevanceSchema, sourceIdSchema } from "./release";

export const offlineStageSchema = z.enum([
  "validate_normalize",
  "deduplicate",
  "classify",
  "discover",
  "aggregate",
  "quality",
]);

export const stageCheckpointSchema = z.object({
  stage: offlineStageSchema,
  status: z.enum(["pending", "running", "completed", "failed"]),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  inputChecksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  outputChecksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  outputFiles: z.array(z.string().min(1)),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }).strict().nullable(),
}).strict();

export const offlineRunStateSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  runId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  datasetVersion: z.string().min(1),
  mode: z.enum(["synthetic", "real"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  pipelineVersion: z.string().min(1),
  externalCallsMade: z.literal(false),
  inputChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  checkpoints: z.array(stageCheckpointSchema),
  retention: z.object({
    rawRetentionDeadline: z.iso.datetime().nullable(),
    restrictedRetentionDeadline: z.iso.datetime().nullable(),
    policyId: z.string().min(1),
  }).strict(),
}).strict();

export const reviewDecisionSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  evidenceId: z.string().min(1),
  decision: z.enum(["accept", "correct", "reject"]),
  correctedRelevance: relevanceSchema.optional(),
  correctedBarrierIds: z.array(barrierIdSchema).optional(),
  correctedJourneyStages: z.array(journeyStageSchema).optional(),
  unsupportedInference: z.boolean().default(false),
  reviewerType: z.enum(["human", "simulated"]).default("human"),
  reviewerId: z.string().min(1),
  reviewedAt: z.iso.datetime(),
  notes: z.string().max(2_000).nullable(),
}).strict().superRefine((value, context) => {
  if (value.decision === "correct" && !value.correctedRelevance && !value.correctedBarrierIds && !value.correctedJourneyStages) {
    context.addIssue({ code: "custom", message: "A correction requires at least one corrected label." });
  }
});

export const taxonomyDecisionSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  candidateThemeId: z.string().min(1),
  action: z.enum(["accept", "rename", "merge", "split", "reject"]),
  targetThemeIds: z.array(z.string().min(1)),
  finalName: z.string().min(1).nullable(),
  reviewerType: z.enum(["human", "simulated"]).default("human"),
  reviewerId: z.string().min(1),
  reviewedAt: z.iso.datetime(),
  rationale: z.string().min(1),
}).strict();

export const pipelineQualityReportSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  datasetVersion: z.string().min(1),
  status: z.enum(["passed", "passed_with_warnings", "failed"]),
  gates: z.array(z.object({
    id: z.string().min(1),
    passed: z.boolean(),
    severity: z.enum(["error", "warning"]),
    message: z.string().min(1),
  }).strict()),
  sourceQueryStats: z.array(z.object({
    source: sourceIdSchema,
    queryId: z.string().min(1),
    canonicalCount: z.number().int().nonnegative(),
    directCount: z.number().int().nonnegative(),
  }).strict()),
  contradictionCount: z.number().int().nonnegative(),
  generatedAt: z.iso.datetime(),
}).strict();

export const reviewSampleItemSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  reviewId: z.string().min(1),
  evidenceId: z.string().min(1),
  source: sourceIdSchema,
  sourceStratum: z.string().min(1),
  queryIds: z.array(z.string().min(1)),
  publishedAt: z.iso.datetime().nullable(),
  rating: z.number().min(1).max(5).nullable(),
  language: z.string().min(1),
  text: z.string().min(1),
  predictedRelevance: relevanceSchema,
  predictedBarrierIds: z.array(barrierIdSchema),
  predictedJourneyStages: z.array(journeyStageSchema),
  predictedConfidence: z.number().min(0).max(1),
  predictedSeverity: z.number().int().min(0).max(3),
  contradictoryOrPositive: z.boolean(),
}).strict();

export const reviewEvaluationReportSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  evaluationId: z.string().min(1),
  datasetVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  reviewKind: z.enum(["human", "simulated"]),
  releaseEligible: z.boolean(),
  sampleSize: z.number().int().positive(),
  decisionCounts: z.record(z.string(), z.number().int().nonnegative()),
  metrics: z.object({
    relevanceDirectPrecision: z.number().min(0).max(1),
    relevanceDirectAdjacentRecall: z.number().min(0).max(1),
    structuredSchemaSuccess: z.number().min(0).max(1),
    unsupportedInferenceCount: z.number().int().nonnegative(),
    primaryBarrierAgreement: z.number().min(0).max(1),
    lowConfidenceDirectReviewed: z.boolean(),
    highSeverityDisplayedReviewed: z.boolean(),
  }).strict(),
  thresholds: z.object({
    relevanceDirectPrecision: z.literal(0.85),
    relevanceDirectAdjacentRecall: z.literal(0.8),
    structuredSchemaSuccess: z.literal(0.98),
    unsupportedInferenceCount: z.literal(0),
    primaryBarrierAgreement: z.literal(0.75),
  }).strict(),
  thresholdPass: z.boolean(),
  limitations: z.array(z.string().min(1)),
}).strict();

export type OfflineStage = z.infer<typeof offlineStageSchema>;
export type OfflineRunState = z.infer<typeof offlineRunStateSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type TaxonomyDecision = z.infer<typeof taxonomyDecisionSchema>;
export type PipelineQualityReport = z.infer<typeof pipelineQualityReportSchema>;
export type ReviewSampleItem = z.infer<typeof reviewSampleItemSchema>;
export type ReviewEvaluationReport = z.infer<typeof reviewEvaluationReportSchema>;
