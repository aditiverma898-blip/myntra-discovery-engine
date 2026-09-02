import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const aiProviderApprovalSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  approvalId: slugSchema,
  status: z.enum(["approved", "disabled", "rejected"]),
  provider: z.literal("gemini"),
  allowedHost: z.literal("generativelanguage.googleapis.com"),
  reviewedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  termsUrls: z.array(z.url()).min(1),
  allowedModelIds: z.array(z.string().regex(/^[A-Za-z0-9._-]+$/)).min(1),
  minimizedTextOnly: z.literal(true),
  maxItems: z.number().int().positive().max(22_000),
  maxRequests: z.number().int().positive(),
  maxCostUsd: z.number().finite().nonnegative(),
}).strict();

const commonJobSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  jobId: slugSchema,
  approvalId: slugSchema,
  modelId: z.string().regex(/^[A-Za-z0-9._-]+$/),
  inputPath: z.string().startsWith("data/intermediate/"),
  outputPath: z.string().startsWith("data/intermediate/"),
  failurePath: z.string().startsWith("data/intermediate/"),
  maxItems: z.number().int().positive().max(22_000),
  maxRequests: z.number().int().positive(),
  maxCostUsd: z.number().finite().nonnegative(),
  estimatedCostPerRequestUsd: z.number().finite().nonnegative(),
  maxAttempts: z.number().int().min(1).max(5).default(3),
});

export const classificationJobSchema = commonJobSchema.extend({
  kind: z.literal("classification"),
  promptVersion: z.string().min(1),
  taxonomyVersion: z.string().min(1),
}).strict();

export const embeddingJobSchema = commonJobSchema.extend({
  kind: z.literal("embedding"),
  dimensions: z.number().int().min(8).max(3_072),
}).strict();

export const geminiConnectivityJobSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  kind: z.literal("connectivity"),
  jobId: slugSchema,
  approvalId: slugSchema,
  modelId: z.string().regex(/^[A-Za-z0-9._-]+$/),
  outputPath: z.string().startsWith("data/intermediate/"),
  failurePath: z.string().startsWith("data/intermediate/"),
  maxItems: z.literal(1),
  maxRequests: z.literal(1),
  maxCostUsd: z.literal(0),
}).strict();

export const aiRunManifestSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  jobId: slugSchema,
  kind: z.enum(["classification", "embedding", "connectivity"]),
  approvalId: slugSchema,
  provider: z.literal("gemini"),
  modelId: z.string().min(1),
  status: z.enum(["running", "completed", "partial", "failed"]),
  inputChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  externalCallsMade: z.boolean(),
  requestCount: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().finite().nonnegative(),
  completedEvidenceIds: z.array(z.string().min(1)),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
}).strict();

export const aiFailureSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  jobId: slugSchema,
  evidenceId: z.string().min(1),
  category: z.enum(["authorization", "quota", "rate_limit", "transient", "schema", "permanent"]),
  message: z.string().min(1),
  occurredAt: z.iso.datetime(),
}).strict();

export type AiProviderApproval = z.infer<typeof aiProviderApprovalSchema>;
export type ClassificationJob = z.infer<typeof classificationJobSchema>;
export type EmbeddingJob = z.infer<typeof embeddingJobSchema>;
export type GeminiConnectivityJob = z.infer<typeof geminiConnectivityJobSchema>;
export type AiRunManifest = z.infer<typeof aiRunManifestSchema>;
export type AiFailure = z.infer<typeof aiFailureSchema>;
