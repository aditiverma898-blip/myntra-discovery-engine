import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { dashboardReleaseSchema, publicEvidenceItemSchema } from "../../src/lib/schemas";
import { evidenceClassificationSchema, normalizedEvidenceSchema, validationLedgerEntrySchema } from "../../src/lib/schemas/pipeline";
import { offlineRunStateSchema, pipelineQualityReportSchema, type OfflineRunState, type OfflineStage } from "../../src/lib/schemas/production-pipeline";
import { writeJsonAtomically, writeTextAtomically } from "../io/atomic";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { evaluatePipelineQuality } from "../quality/evaluate";
import { buildAggregates } from "../stages/aggregate";
import { deduplicateRecordsScalable } from "../stages/deduplicate-scalable";
import { mockClassifyRecords } from "../stages/mock-classifier";
import { normalizeRecords, validateRawRecords } from "../stages/normalize";
import { discoverLexicalThemes, type LexicalThemeCluster } from "../stages/theme-discovery";

const STAGES: readonly OfflineStage[] = ["validate_normalize", "deduplicate", "classify", "discover", "aggregate", "quality"];

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function stable(value: unknown): string { return JSON.stringify(value); }

export interface OfflinePipelineOptions {
  runId: string;
  datasetVersion: string;
  workspaceRoot: string;
  rawRecords: readonly unknown[];
  mode?: "synthetic" | "real";
  classifications?: readonly unknown[];
  stopAfterStage?: OfflineStage;
  retention?: { rawRetentionDeadline: string | null; restrictedRetentionDeadline: string | null; policyId: string };
  now?: () => string;
  failAtStage?: OfflineStage;
  allowUnreviewedForPartial?: boolean;
}

export interface OfflinePipelineResult {
  state: OfflineRunState;
  runDirectory: string;
  resumedStages: OfflineStage[];
}

async function readState(statePath: string): Promise<OfflineRunState | null> {
  try { return offlineRunStateSchema.parse(JSON.parse(await readFile(statePath, "utf8")) as unknown); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function runOfflinePipeline(options: OfflinePipelineOptions): Promise<OfflinePipelineResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const runDirectory = path.join(options.workspaceRoot, options.runId);
  const statePath = path.join(runDirectory, "run-state.json");
  await mkdir(runDirectory, { recursive: true });
  const existing = await readState(statePath);
  if (existing && existing.datasetVersion !== options.datasetVersion) throw new Error("A run ID cannot resume with a different dataset version.");
  const sourceInputChecksum = sha256(stable(options.rawRecords));
  if (existing && existing.inputChecksum !== sourceInputChecksum) throw new Error("A run ID cannot resume with changed raw input.");
  const mode = options.mode ?? "synthetic";
  if (existing && existing.mode !== mode) throw new Error("A run ID cannot resume in a different data mode.");
  let state: OfflineRunState = existing ?? offlineRunStateSchema.parse({
    schemaVersion: "1.0.0", runId: options.runId, datasetVersion: options.datasetVersion, mode,
    createdAt: now(), updatedAt: now(), pipelineVersion: "offline-pipeline-v2", externalCallsMade: false, inputChecksum: sourceInputChecksum,
    checkpoints: STAGES.map((stage) => ({ stage, status: "pending", startedAt: null, completedAt: null, inputChecksum: null, outputChecksum: null, outputFiles: [], counts: {}, error: null })),
    retention: options.retention ?? (mode === "synthetic" ? { rawRetentionDeadline: null, restrictedRetentionDeadline: null, policyId: "synthetic-no-retention-required" } : (() => { throw new Error("Real pipeline runs require explicit retention metadata."); })()),
  });
  const resumedStages: OfflineStage[] = [];
  let normalized = existing?.checkpoints.find((item) => item.stage === "validate_normalize")?.status === "completed" ? await readJsonLines(path.join(runDirectory, "normalized.jsonl"), normalizedEvidenceSchema) : [];
  let ledger = existing?.checkpoints.find((item) => item.stage === "validate_normalize")?.status === "completed" ? await readJsonLines(path.join(runDirectory, "validation-ledger.jsonl"), validationLedgerEntrySchema) : [];
  let canonical = existing?.checkpoints.find((item) => item.stage === "deduplicate")?.status === "completed" ? await readJsonLines(path.join(runDirectory, "canonical.jsonl"), normalizedEvidenceSchema) : [];
  let classifications = existing?.checkpoints.find((item) => item.stage === "classify")?.status === "completed" ? await readJsonLines(path.join(runDirectory, "classifications.jsonl"), evidenceClassificationSchema) : [];
  let clusters: LexicalThemeCluster[] = existing?.checkpoints.find((item) => item.stage === "discover")?.status === "completed" ? JSON.parse(await readFile(path.join(runDirectory, "clusters.json"), "utf8")) as LexicalThemeCluster[] : [];

  for (const stage of STAGES) {
    const index = state.checkpoints.findIndex((item) => item.stage === stage);
    const checkpoint = state.checkpoints[index];
    if (!checkpoint) throw new Error(`Missing checkpoint ${stage}.`);
    if (checkpoint.status === "completed") { resumedStages.push(stage); continue; }
    state.checkpoints[index] = { ...checkpoint, status: "running", startedAt: now(), completedAt: null, error: null };
    state = offlineRunStateSchema.parse({ ...state, updatedAt: now() });
    await writeJsonAtomically(statePath, state);
    try {
      if (options.failAtStage === stage) throw new Error(`Injected synthetic failure at ${stage}.`);
      let outputFiles: string[] = [];
      let counts: Record<string, number> = {};
      let inputChecksum = sha256(stable(options.rawRecords));
      let outputChecksum = "";
      if (stage === "validate_normalize") {
        const validated = validateRawRecords(options.rawRecords);
        normalized = normalizeRecords(validated.valid);
        ledger = validated.ledger;
        await writeTextAtomically(path.join(runDirectory, "normalized.jsonl"), serializeJsonLines(normalized));
        await writeTextAtomically(path.join(runDirectory, "validation-ledger.jsonl"), serializeJsonLines(ledger));
        outputFiles = ["normalized.jsonl", "validation-ledger.jsonl"];
        counts = { received: options.rawRecords.length, normalized: normalized.length, quarantined: ledger.length };
        outputChecksum = sha256(stable([normalized, ledger]));
      } else if (stage === "deduplicate") {
        inputChecksum = sha256(stable(normalized));
        const result = deduplicateRecordsScalable(normalized);
        canonical = result.canonical;
        await writeTextAtomically(path.join(runDirectory, "canonical.jsonl"), serializeJsonLines(canonical));
        outputFiles = ["canonical.jsonl"];
        counts = { canonical: canonical.length, duplicates: result.duplicateCount };
        outputChecksum = sha256(stable(canonical));
      } else if (stage === "classify") {
        inputChecksum = sha256(stable(canonical));
        if (mode === "real") {
          if (!options.classifications) throw new Error("Real pipeline completion requires a reviewed classification artifact; mock labels are prohibited.");
          classifications = options.classifications.map((value) => evidenceClassificationSchema.parse(value));
          const classificationIds = new Set(classifications.map((item) => item.evidenceId));
          const canonicalIds = new Set(canonical.map((item) => item.evidenceId));
          if (classificationIds.size !== classifications.length || classificationIds.size !== canonicalIds.size || [...classificationIds].some((id) => !canonicalIds.has(id))) throw new Error("Real classifications must contain exactly one row for every canonical evidence ID.");
          if (classifications.some((value) => value.humanReviewStatus === "unreviewed") && !options.allowUnreviewedForPartial) throw new Error("Real pipeline completion refuses unreviewed candidate classifications unless --allow-unreviewed-partial is explicit.");
        } else classifications = mockClassifyRecords(canonical);
        await writeTextAtomically(path.join(runDirectory, "classifications.jsonl"), serializeJsonLines(classifications));
        outputFiles = ["classifications.jsonl"];
        counts = { classified: classifications.length, reviewed: classifications.filter((item) => item.humanReviewStatus !== "unreviewed").length, unreviewed: classifications.filter((item) => item.humanReviewStatus === "unreviewed").length };
        outputChecksum = sha256(stable(classifications));
      } else if (stage === "discover") {
        inputChecksum = sha256(stable([canonical, classifications]));
        clusters = discoverLexicalThemes(canonical, classifications);
        await writeJsonAtomically(path.join(runDirectory, "clusters.json"), clusters);
        outputFiles = ["clusters.json"];
        counts = { clusters: clusters.length };
        outputChecksum = sha256(stable(clusters));
      } else if (stage === "aggregate") {
        inputChecksum = sha256(stable([canonical, classifications, clusters]));
        const aggregate = buildAggregates(canonical, classifications, { datasetVersion: options.datasetVersion, generatedAt: now(), synthetic: mode === "synthetic", releaseStatus: mode === "synthetic" ? "ready" : "partial" });
        await writeJsonAtomically(path.join(runDirectory, "aggregates.json"), aggregate.dashboard);
        await writeTextAtomically(path.join(runDirectory, "evidence.server.jsonl"), serializeJsonLines(aggregate.publicEvidence));
        outputFiles = ["aggregates.json", "evidence.server.jsonl"];
        counts = { evidence: canonical.length, opportunities: aggregate.dashboard.opportunities.length };
        outputChecksum = sha256(stable(aggregate));
      } else {
        inputChecksum = sha256(stable([canonical, classifications, ledger]));
        const quality = evaluatePipelineQuality({ datasetVersion: options.datasetVersion, records: canonical, classifications, ledger, generatedAt: now(), rawRecordCount: options.rawRecords.length });
        await writeJsonAtomically(path.join(runDirectory, "quality-report.json"), quality);
        outputFiles = ["quality-report.json"];
        counts = { gates: quality.gates.length, failedGates: quality.gates.filter((gate) => !gate.passed).length };
        outputChecksum = sha256(stable(quality));
      }
      state.checkpoints[index] = { stage, status: "completed", startedAt: state.checkpoints[index]?.startedAt ?? now(), completedAt: now(), inputChecksum, outputChecksum, outputFiles, counts, error: null };
      state = offlineRunStateSchema.parse({ ...state, updatedAt: now() });
      await writeJsonAtomically(statePath, state);
      if (options.stopAfterStage === stage) return { state, runDirectory, resumedStages };
    } catch (error) {
      state.checkpoints[index] = { ...state.checkpoints[index]!, status: "failed", completedAt: now(), error: { code: "STAGE_FAILED", message: error instanceof Error ? error.message : "Unknown stage failure." } };
      state = offlineRunStateSchema.parse({ ...state, updatedAt: now() });
      await writeJsonAtomically(statePath, state);
      throw error;
    }
  }

  // Final read validates that artifacts remain compatible with the application contracts.
  dashboardReleaseSchema.parse(JSON.parse(await readFile(path.join(runDirectory, "aggregates.json"), "utf8")) as unknown);
  pipelineQualityReportSchema.parse(JSON.parse(await readFile(path.join(runDirectory, "quality-report.json"), "utf8")) as unknown);
  await readJsonLines(path.join(runDirectory, "evidence.server.jsonl"), publicEvidenceItemSchema);
  return { state, runDirectory, resumedStages };
}
