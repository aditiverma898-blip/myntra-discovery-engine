import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const rawIntakeConfigSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  intakeId: slugSchema,
  datasetVersion: slugSchema,
  createdAt: z.iso.datetime(),
  inputs: z.array(z.object({
    label: slugSchema,
    path: z.string().startsWith("data/raw/imports/").endsWith(".jsonl"),
  }).strict()).min(1),
  outputDirectory: z.string().startsWith("data/raw/combined/"),
  retention: z.object({
    rawRetentionDeadline: z.iso.datetime().nullable(),
    policyId: z.string().min(1),
  }).strict(),
}).strict();

export type RawIntakeConfig = z.infer<typeof rawIntakeConfigSchema>;
