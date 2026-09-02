import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const releaseReviewApprovalSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  approvalId: slugSchema,
  datasetVersion: slugSchema,
  decision: z.literal("approved"),
  reviewKind: z.literal("human"),
  reviewedBy: z.string().min(1),
  reviewedAt: z.iso.datetime(),
  humanEvaluationId: slugSchema,
  evaluationReportPath: z.string().startsWith("data/intermediate/review/"),
  relevanceDirectPrecision: z.number().min(0.85).max(1),
  relevanceDirectAdjacentRecall: z.number().min(0.8).max(1),
  structuredSchemaSuccess: z.number().min(0.98).max(1),
  unsupportedInferenceCount: z.literal(0),
  primaryBarrierAgreement: z.number().min(0.75).max(1),
  lowConfidenceDirectReviewed: z.literal(true),
  highSeverityDisplayedReviewed: z.literal(true),
  taxonomyReviewed: z.literal(true),
  contradictionsReviewed: z.literal(true),
  privacyReviewed: z.literal(true),
  claimsReviewed: z.literal(true),
  notes: z.array(z.string().min(1)),
}).strict();

export const releaseBuildConfigSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  datasetVersion: slugSchema,
  releasePath: slugSchema,
  runDirectory: z.string().startsWith("data/intermediate/runs/"),
  status: z.enum(["partial", "ready"]),
  generatedAt: z.iso.datetime(),
  codeCommit: z.string().min(1).nullable(),
  taxonomyVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  classifier: z.object({ provider: z.string().min(1), model: z.string().min(1) }).strict(),
  embedding: z.object({ provider: z.string().min(1), model: z.string().min(1), dimensions: z.number().int().positive() }).strict().nullable(),
  reviewApprovalPath: z.string().startsWith("data/intermediate/review/").nullable(),
  taxonomyReviewPath: z.string().startsWith("data/intermediate/review/").nullable().default(null),
  limitations: z.array(z.string().min(1)).min(1),
}).strict().superRefine((value, context) => {
  if (value.status === "ready" && !value.reviewApprovalPath) context.addIssue({ code: "custom", path: ["reviewApprovalPath"], message: "Ready releases require an explicit review approval artifact." });
  if (value.status === "ready" && !value.taxonomyReviewPath) context.addIssue({ code: "custom", path: ["taxonomyReviewPath"], message: "Ready releases require a human-reviewed taxonomy artifact." });
});

export type ReleaseReviewApproval = z.infer<typeof releaseReviewApprovalSchema>;
export type ReleaseBuildConfig = z.infer<typeof releaseBuildConfigSchema>;
