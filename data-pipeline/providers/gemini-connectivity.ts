import path from "node:path";

import { z } from "zod";

import { assertExternalCallsAllowed } from "../../src/lib/external-access";
import {
  aiFailureSchema,
  aiRunManifestSchema,
  type AiFailure,
  type AiProviderApproval,
  type AiRunManifest,
  type GeminiConnectivityJob,
} from "../../src/lib/schemas/ai-run";
import { validateRestrictedPath, stableHash } from "../collection/validation";
import { writeJsonAtomically, writeTextAtomically } from "../io/atomic";
import { fetchJson } from "../transports/http";
import { categorizeProviderFailure } from "../utils/execution-policy";

const PROBE_TEXT = "This is synthetic test data. Return the exact requested JSON object. No user, source, review, comment, or YouTube data is included.";
const probeResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({ parts: z.array(z.object({ text: z.string() }).passthrough()).min(1) }).passthrough(),
  }).passthrough()).min(1),
}).passthrough();
const probePayloadSchema = z.object({ status: z.literal("ok"), probe: z.literal("synthetic-connectivity") }).strict();

function validateJob(job: GeminiConnectivityJob, approval: AiProviderApproval, now: Date): void {
  if (approval.approvalId !== job.approvalId || approval.status !== "approved") throw new Error("Gemini connectivity approval is not active for this job.");
  if (new Date(approval.expiresAt).getTime() <= now.getTime()) throw new Error("Gemini connectivity approval has expired.");
  if (!approval.allowedModelIds.includes(job.modelId)) throw new Error("Connectivity model is not included in the provider approval.");
  if (job.maxItems > approval.maxItems || job.maxRequests > approval.maxRequests || job.maxCostUsd > approval.maxCostUsd) throw new Error("Connectivity limits exceed provider approval.");
}

function safeMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : "Unknown Gemini connectivity failure.";
  return value.replace(/(?:AIza|apify_api_|sk-)[A-Za-z0-9_-]+/gu, "[redacted]").slice(0, 500);
}

export async function runGeminiConnectivityProbe(options: {
  workspaceRoot: string;
  job: GeminiConnectivityJob;
  approval: AiProviderApproval;
  environment?: Record<string, string | undefined>;
  argv?: readonly string[];
  fetchImpl?: typeof fetch;
  now?: () => string;
}): Promise<{ manifest: AiRunManifest; failure: AiFailure | null }> {
  const now = options.now ?? (() => new Date().toISOString());
  validateJob(options.job, options.approval, new Date(now()));
  assertExternalCallsAllowed({
    source: "manual_import",
    sourceApprovalStatus: options.approval.status,
    maxItems: 1,
    maxCost: 0,
    argv: options.argv,
    environment: options.environment,
  });
  const apiKey = options.environment?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API credential is missing.");

  const outputPath = validateRestrictedPath(options.workspaceRoot, options.job.outputPath, "data/intermediate/");
  const failurePath = validateRestrictedPath(options.workspaceRoot, options.job.failurePath, "data/intermediate/");
  const manifestPath = path.join(path.dirname(outputPath), `${options.job.jobId}.manifest.json`);
  const startedAt = now();
  let manifest = aiRunManifestSchema.parse({
    schemaVersion: "1.0.0",
    jobId: options.job.jobId,
    kind: "connectivity",
    approvalId: options.approval.approvalId,
    provider: "gemini",
    modelId: options.job.modelId,
    status: "running",
    inputChecksum: stableHash({ prompt: PROBE_TEXT, sourceDataSubmitted: false }),
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    externalCallsMade: false,
    requestCount: 0,
    estimatedCostUsd: 0,
    completedEvidenceIds: [],
    succeeded: 0,
    failed: 0,
  });
  const persist = async (failure: AiFailure | null): Promise<void> => {
    await writeJsonAtomically(manifestPath, manifest);
    await writeTextAtomically(failurePath, failure ? `${JSON.stringify(failure)}\n` : "");
  };
  await persist(null);

  manifest = aiRunManifestSchema.parse({ ...manifest, externalCallsMade: true, requestCount: 1, updatedAt: now() });
  await persist(null);
  try {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.job.modelId)}:generateContent`);
    const raw = await fetchJson(options.fetchImpl ?? fetch, url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROBE_TEXT }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 32,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            additionalProperties: false,
            required: ["status", "probe"],
            properties: {
              status: { type: "string", enum: ["ok"] },
              probe: { type: "string", enum: ["synthetic-connectivity"] },
            },
          },
        },
      }),
    });
    const response = probeResponseSchema.parse(raw);
    const text = response.candidates[0]?.content.parts.map((part) => part.text).join("") ?? "";
    probePayloadSchema.parse(JSON.parse(text) as unknown);
    const completedAt = now();
    await writeJsonAtomically(outputPath, {
      schemaVersion: "1.0.0",
      status: "ok",
      probe: "synthetic-connectivity",
      provider: "gemini",
      modelId: options.job.modelId,
      usedSyntheticPrompt: true,
      sourceDataSubmitted: false,
      paidServiceRequired: false,
      checkedAt: completedAt,
    });
    manifest = aiRunManifestSchema.parse({ ...manifest, status: "completed", completedAt, updatedAt: completedAt, completedEvidenceIds: ["synthetic-connectivity-probe"], succeeded: 1 });
    await persist(null);
    return { manifest, failure: null };
  } catch (error) {
    const completedAt = now();
    const failure = aiFailureSchema.parse({
      schemaVersion: "1.0.0",
      jobId: options.job.jobId,
      evidenceId: "synthetic-connectivity-probe",
      category: categorizeProviderFailure(error),
      message: safeMessage(error),
      occurredAt: completedAt,
    });
    manifest = aiRunManifestSchema.parse({ ...manifest, status: "failed", completedAt, updatedAt: completedAt, completedEvidenceIds: ["synthetic-connectivity-probe"], failed: 1 });
    await persist(failure);
    throw error;
  }
}
