import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const destinationOperationKindSchema = z.enum([
  "offline_baseline",
  "collection_dry_run",
  "collection_external",
  "classification_external",
  "embedding_external",
  "gemini_connectivity",
  "real_pipeline",
  "release_build",
]);

export const destinationOperationReportSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  reportId: slugSchema,
  projectVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  operation: z.object({
    kind: destinationOperationKindSchema,
    operationId: slugSchema,
    reportedExitCode: z.number().int().min(0).max(255),
  }).strict(),
  outcome: z.object({
    state: z.enum(["success", "partial", "failed", "blocked", "unsafe_incomplete"]),
    successCriteriaMet: z.boolean(),
    externalCallsMade: z.boolean(),
    summary: z.string().min(1),
    reportedError: z.string().min(1).nullable(),
    nextAction: z.string().min(1),
  }).strict(),
  metrics: z.object({
    received: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    requests: z.number().int().nonnegative(),
    costUsd: z.number().finite().nonnegative(),
  }).strict(),
  safety: z.object({
    allowExternalCallsRestored: z.boolean(),
    runtimeLlmDisabled: z.boolean(),
    redditSourceApproval: z.enum(["approved", "disabled"]),
    credentialValuesIncluded: z.literal(false),
  }).strict(),
  runtime: z.object({
    node: z.string().min(1),
    platform: z.string().min(1),
    architecture: z.string().min(1),
  }).strict(),
  sourceArtifacts: z.array(z.object({
    role: z.enum(["plan", "manifest", "failures"]),
    path: z.string().min(1),
    exists: z.boolean(),
    bytes: z.number().int().nonnegative().nullable(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  }).strict()),
  failureSummary: z.object({
    total: z.number().int().nonnegative(),
    byCategory: z.record(z.string(), z.number().int().nonnegative()),
    examples: z.array(z.object({
      category: z.string().min(1),
      code: z.string().min(1).nullable(),
      message: z.string().min(1),
    }).strict()).max(10),
  }).strict(),
}).strict();

export type DestinationOperationKind = z.infer<typeof destinationOperationKindSchema>;
export type DestinationOperationReport = z.infer<typeof destinationOperationReportSchema>;
