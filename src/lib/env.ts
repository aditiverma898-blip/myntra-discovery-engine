import { z } from "zod";

import { dataModeSchema } from "@/lib/schemas";

const booleanStringSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optionalSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export const serverEnvSchema = z
  .object({
    DATA_MODE: dataModeSchema.default("empty"),
    ALLOW_EXTERNAL_CALLS: booleanStringSchema,
    ENABLE_RUNTIME_LLM: booleanStringSchema,
    REDDIT_SOURCE_APPROVAL: z
      .enum(["disabled", "approved"])
      .default("disabled"),
    GEMINI_API_KEY: optionalSecretSchema,
    GEMINI_MODEL: optionalSecretSchema,
    YOUTUBE_API_KEY: optionalSecretSchema,
    APIFY_TOKEN: optionalSecretSchema,
    REDDIT_CLIENT_ID: optionalSecretSchema,
    REDDIT_CLIENT_SECRET: optionalSecretSchema,
    REDDIT_USER_AGENT: optionalSecretSchema,
  })
  .readonly();

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(
  environment: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse(environment);
}
