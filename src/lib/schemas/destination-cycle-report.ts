import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const destinationCycleReportSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  cycleId: slugSchema,
  projectVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  outcome: z.object({
    state: z.enum(["success", "partial", "failed", "blocked", "unsafe_incomplete"]),
    successCriteriaMet: z.boolean(),
    summary: z.string().min(1),
    nextAction: z.string().min(1),
  }).strict(),
  metrics: z.object({
    stages: z.number().int().positive(),
    successfulStages: z.number().int().nonnegative(),
    externalCallsMade: z.boolean(),
    requests: z.number().int().nonnegative(),
    costUsd: z.number().finite().nonnegative(),
  }).strict(),
  safety: z.object({
    allowExternalCallsRestoredForEveryStage: z.boolean(),
    credentialValuesIncluded: z.literal(false),
    youtubeDataSubmittedToGemini: z.literal(false),
    paidServicesRequired: z.literal(false),
  }).strict(),
  stages: z.array(z.object({
    name: z.enum(["youtube_collection", "gemini_synthetic_connectivity"]),
    reportId: slugSchema,
    state: z.enum(["success", "partial", "failed", "blocked", "unsafe_incomplete"]),
    successCriteriaMet: z.boolean(),
    externalCallsMade: z.boolean(),
    requests: z.number().int().nonnegative(),
    costUsd: z.number().finite().nonnegative(),
    reportPath: z.string().startsWith("data/intermediate/operator-reports/"),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()).length(2),
}).strict();

export type DestinationCycleReport = z.infer<typeof destinationCycleReportSchema>;
