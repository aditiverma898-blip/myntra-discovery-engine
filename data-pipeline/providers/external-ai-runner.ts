import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertExternalCallsAllowed } from "../../src/lib/external-access";
import { aiFailureSchema, aiRunManifestSchema, type AiFailure, type AiProviderApproval, type AiRunManifest, type ClassificationJob, type EmbeddingJob } from "../../src/lib/schemas/ai-run";
import { embeddingRecordSchema, evidenceClassificationSchema, normalizedEvidenceSchema, type EmbeddingRecord, type EvidenceClassification, type NormalizedEvidence } from "../../src/lib/schemas/pipeline";
import { writeJsonAtomically, writeTextAtomically } from "../io/atomic";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { categorizeProviderFailure } from "../utils/execution-policy";
import { stableHash, validateRestrictedPath } from "../collection/validation";

type Job = ClassificationJob | EmbeddingJob;
type Output = EvidenceClassification | EmbeddingRecord;
type ExternalAiOperation = (record: NormalizedEvidence) => Promise<Output>;

function validateJob(job: Job, approval: AiProviderApproval, now: Date): void {
  if (approval.approvalId !== job.approvalId || approval.status !== "approved") throw new Error("AI provider approval is not active for this job.");
  if (new Date(approval.expiresAt).getTime() <= now.getTime()) throw new Error("AI provider approval has expired.");
  if (!approval.allowedModelIds.includes(job.modelId)) throw new Error("Job model is not included in the provider approval.");
  if (job.maxItems > approval.maxItems || job.maxRequests > approval.maxRequests || job.maxCostUsd > approval.maxCostUsd) throw new Error("AI job limits exceed provider approval.");
  if (job.maxItems > job.maxRequests) throw new Error("AI job requires at least one request allowance per item.");
  if (job.estimatedCostPerRequestUsd * job.maxItems > job.maxCostUsd + Number.EPSILON) throw new Error("Estimated job cost exceeds the configured cap.");
}

async function readManifest(file: string): Promise<AiRunManifest | null> {
  try { return aiRunManifestSchema.parse(JSON.parse(await readFile(file, "utf8")) as unknown); }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return null; throw error; }
}

export async function runExternalAiJob(options: { workspaceRoot: string; job: Job; approval: AiProviderApproval; environment?: Record<string, string | undefined>; argv?: readonly string[]; operationFactory: (apiKey: string) => Promise<ExternalAiOperation>; now?: () => string }): Promise<{ manifest: AiRunManifest; outputs: Output[]; failures: AiFailure[] }> {
  const now = options.now ?? (() => new Date().toISOString());
  validateJob(options.job, options.approval, new Date(now()));
  assertExternalCallsAllowed({ source: "manual_import", sourceApprovalStatus: options.approval.status, maxItems: options.job.maxItems, maxCost: options.job.maxCostUsd, argv: options.argv, environment: options.environment });
  const apiKey = options.environment?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API credential is missing.");
  const inputPath = validateRestrictedPath(options.workspaceRoot, options.job.inputPath, "data/intermediate/");
  const outputPath = validateRestrictedPath(options.workspaceRoot, options.job.outputPath, "data/intermediate/");
  const failurePath = validateRestrictedPath(options.workspaceRoot, options.job.failurePath, "data/intermediate/");
  const manifestPath = path.join(path.dirname(outputPath), `${options.job.jobId}.manifest.json`);
  const input = await readJsonLines(inputPath, normalizedEvidenceSchema);
  if (input.some((record) => record.synthetic)) throw new Error("External AI jobs refuse synthetic fixture evidence.");
  const selected = input.slice(0, options.job.maxItems);
  const inputChecksum = stableHash(selected);
  const existing = await readManifest(manifestPath);
  if (existing && existing.inputChecksum !== inputChecksum) throw new Error("AI job cannot resume with changed input.");
  const outputs: Output[] = existing ? options.job.kind === "classification" ? await readJsonLines(outputPath, evidenceClassificationSchema) : await readJsonLines(outputPath, embeddingRecordSchema) : [];
  const failures: AiFailure[] = existing ? await readJsonLines(failurePath, aiFailureSchema) : [];
  let manifest = existing ?? aiRunManifestSchema.parse({ schemaVersion: "1.0.0", jobId: options.job.jobId, kind: options.job.kind, approvalId: options.approval.approvalId, provider: "gemini", modelId: options.job.modelId, status: "running", inputChecksum, startedAt: now(), updatedAt: now(), completedAt: null, externalCallsMade: false, requestCount: 0, estimatedCostUsd: 0, completedEvidenceIds: [], succeeded: 0, failed: 0 });
  const persist = async (): Promise<void> => {
    manifest = aiRunManifestSchema.parse({ ...manifest, updatedAt: now(), succeeded: outputs.length, failed: failures.length });
    await writeTextAtomically(outputPath, serializeJsonLines(outputs));
    await writeTextAtomically(failurePath, serializeJsonLines(failures));
    await writeJsonAtomically(manifestPath, manifest);
  };
  await persist();
  const operation = await options.operationFactory(apiKey);
  try {
    for (const record of selected) {
      if (manifest.completedEvidenceIds.includes(record.evidenceId)) continue;
      if (manifest.requestCount >= options.job.maxRequests || manifest.estimatedCostUsd + options.job.estimatedCostPerRequestUsd > options.job.maxCostUsd + Number.EPSILON) {
        manifest = aiRunManifestSchema.parse({ ...manifest, status: "partial" });
        await persist();
        return { manifest, outputs, failures };
      }
      let completed = false;
      for (let attempt = 1; attempt <= options.job.maxAttempts; attempt += 1) {
        manifest = aiRunManifestSchema.parse({ ...manifest, externalCallsMade: true, requestCount: manifest.requestCount + 1, estimatedCostUsd: Math.round((manifest.estimatedCostUsd + options.job.estimatedCostPerRequestUsd) * 1_000_000) / 1_000_000 });
        await persist();
        try {
          outputs.push(await operation(record));
          completed = true;
          break;
        } catch (error) {
          const category = categorizeProviderFailure(error);
          if (attempt === options.job.maxAttempts || !["rate_limit", "transient"].includes(category)) {
            failures.push(aiFailureSchema.parse({ schemaVersion: "1.0.0", jobId: options.job.jobId, evidenceId: record.evidenceId, category, message: error instanceof Error ? error.message.replace(/(?:AIza|apify_api_)[A-Za-z0-9_-]+/gu, "[redacted]") : "Unknown provider failure.", occurredAt: now() }));
            break;
          }
        }
      }
      manifest = aiRunManifestSchema.parse({ ...manifest, completedEvidenceIds: [...manifest.completedEvidenceIds, record.evidenceId] });
      await persist();
      if (!completed && manifest.requestCount >= options.job.maxRequests) break;
    }
    manifest = aiRunManifestSchema.parse({ ...manifest, status: failures.length ? "partial" : "completed", completedAt: now() });
    await persist();
    return { manifest, outputs, failures };
  } catch (error) {
    manifest = aiRunManifestSchema.parse({ ...manifest, status: outputs.length ? "partial" : "failed", completedAt: now() });
    await persist();
    throw error;
  }
}
