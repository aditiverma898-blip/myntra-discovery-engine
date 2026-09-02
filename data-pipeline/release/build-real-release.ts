import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";

import { dashboardReleaseSchema, releaseManifestSchema, type ReleaseManifest } from "../../src/lib/schemas/release";
import { releaseReviewApprovalSchema, type ReleaseBuildConfig, type ReleaseReviewApproval } from "../../src/lib/schemas/release-build";
import { offlineRunStateSchema, pipelineQualityReportSchema } from "../../src/lib/schemas/production-pipeline";
import { reviewEvaluationReportSchema } from "../../src/lib/schemas/production-pipeline";
import { evidenceClassificationSchema, normalizedEvidenceSchema, validationLedgerEntrySchema } from "../../src/lib/schemas/pipeline";
import { publicEvidenceItemSchema } from "../../src/lib/schemas/api";
import { writeJsonAtomically } from "../io/atomic";
import { readJsonLines } from "../io/jsonl";
import { validateRestrictedPath } from "../collection/validation";
import { validateCandidateRelease } from "./validate-release";

function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }

async function mustNotExist(value: string): Promise<void> {
  try { await lstat(value); throw new Error(`Release destination already exists: ${value}`); }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return; throw error; }
}

export async function buildRealRelease(options: { workspaceRoot: string; config: ReleaseBuildConfig }): Promise<{ releaseDirectory: string; manifest: ReleaseManifest }> {
  const runDirectory = validateRestrictedPath(options.workspaceRoot, options.config.runDirectory, "data/intermediate/runs/");
  const state = offlineRunStateSchema.parse(JSON.parse(await readFile(path.join(runDirectory, "run-state.json"), "utf8")) as unknown);
  if (state.mode !== "real" || state.datasetVersion !== options.config.datasetVersion) throw new Error("Release config does not match a completed real pipeline run.");
  if (state.checkpoints.some((checkpoint) => checkpoint.status !== "completed")) throw new Error("Every real pipeline stage must complete before release construction.");
  const quality = pipelineQualityReportSchema.parse(JSON.parse(await readFile(path.join(runDirectory, "quality-report.json"), "utf8")) as unknown);
  if (quality.datasetVersion !== options.config.datasetVersion) throw new Error("Quality report dataset version mismatch.");
  let review: ReleaseReviewApproval | null = null;
  if (options.config.reviewApprovalPath) {
    const reviewPath = validateRestrictedPath(options.workspaceRoot, options.config.reviewApprovalPath, "data/intermediate/review/");
    review = releaseReviewApprovalSchema.parse(JSON.parse(await readFile(reviewPath, "utf8")) as unknown);
    if (review.datasetVersion !== options.config.datasetVersion) throw new Error("Review approval dataset version mismatch.");
    const evaluationPath = validateRestrictedPath(options.workspaceRoot, review.evaluationReportPath, "data/intermediate/review/");
    const evaluation = reviewEvaluationReportSchema.parse(JSON.parse(await readFile(evaluationPath, "utf8")) as unknown);
    if (evaluation.evaluationId !== review.humanEvaluationId || evaluation.datasetVersion !== review.datasetVersion || evaluation.reviewKind !== "human" || !evaluation.releaseEligible) throw new Error("Review approval must reference a release-eligible human evaluation for the same dataset.");
    if (evaluation.metrics.relevanceDirectPrecision !== review.relevanceDirectPrecision || evaluation.metrics.relevanceDirectAdjacentRecall !== review.relevanceDirectAdjacentRecall || evaluation.metrics.structuredSchemaSuccess !== review.structuredSchemaSuccess || evaluation.metrics.unsupportedInferenceCount !== review.unsupportedInferenceCount || evaluation.metrics.primaryBarrierAgreement !== review.primaryBarrierAgreement) throw new Error("Review approval metrics do not match its evaluation report.");
    if (evaluation.metrics.lowConfidenceDirectReviewed !== review.lowConfidenceDirectReviewed || evaluation.metrics.highSeverityDisplayedReviewed !== review.highSeverityDisplayedReviewed) throw new Error("Review approval coverage flags do not match its evaluation report.");
  }
  if (options.config.status === "ready" && (!review || quality.status === "failed")) throw new Error("Ready release requires review approval and non-failing pipeline quality.");
  if (options.config.status === "ready") {
    const taxonomyPath = validateRestrictedPath(options.workspaceRoot, options.config.taxonomyReviewPath ?? "", "data/intermediate/review/");
    const taxonomyReview = JSON.parse(await readFile(taxonomyPath, "utf8")) as { status?: unknown; humanReviewed?: unknown; taxonomyId?: unknown };
    if (taxonomyReview.status !== "reviewed" || taxonomyReview.humanReviewed !== true || taxonomyReview.taxonomyId !== options.config.taxonomyVersion) throw new Error("Ready release requires the matching human-reviewed taxonomy artifact.");
  }

  const dashboard = dashboardReleaseSchema.parse(JSON.parse(await readFile(path.join(runDirectory, "aggregates.json"), "utf8")) as unknown);
  const evidence = await readJsonLines(path.join(runDirectory, "evidence.server.jsonl"), publicEvidenceItemSchema);
  const canonical = await readJsonLines(path.join(runDirectory, "canonical.jsonl"), normalizedEvidenceSchema);
  const classifications = await readJsonLines(path.join(runDirectory, "classifications.jsonl"), evidenceClassificationSchema);
  const ledger = await readJsonLines(path.join(runDirectory, "validation-ledger.jsonl"), validationLedgerEntrySchema);
  if (canonical.some((record) => record.synthetic)) throw new Error("Real release cannot contain synthetic canonical evidence.");
  if (options.config.status === "ready" && classifications.some((item) => item.humanReviewStatus === "unreviewed")) throw new Error("Ready release cannot contain unreviewed classifications.");
  const releaseDashboard = dashboardReleaseSchema.parse({
    ...dashboard,
    status: options.config.status,
    quality: { status: quality.status, warnings: quality.gates.filter((gate) => !gate.passed).map((gate) => gate.message) },
    themes: options.config.status === "ready" && review ? dashboard.themes.map((theme) => ({ ...theme, status: "reviewed", reviewedBy: review.reviewedBy, reviewedAt: review.reviewedAt })) : dashboard.themes,
  });

  const releasesRoot = path.resolve(options.workspaceRoot, "data/releases");
  const destination = path.join(releasesRoot, options.config.releasePath);
  const staging = path.join(releasesRoot, `.${options.config.releasePath}.staging-${process.pid}`);
  await mustNotExist(destination);
  await mustNotExist(staging);
  await mkdir(staging, { recursive: true });
  await writeJsonAtomically(path.join(staging, "aggregates.json"), releaseDashboard);
  const copyMap = {
    "evidence.server.jsonl": "evidence.server.jsonl",
    "canonical.jsonl": "normalized.restricted.jsonl",
    "classifications.jsonl": "classifications.restricted.jsonl",
    "validation-ledger.jsonl": "validation-ledger.jsonl",
    "clusters.json": "lexical-clusters.json",
    "quality-report.json": "quality-report.json",
  } as const;
  await Promise.all(Object.entries(copyMap).map(([source, target]) => copyFile(path.join(runDirectory, source), path.join(staging, target))));
  await writeJsonAtomically(path.join(staging, "methodology.json"), {
    schemaVersion: "1.0.0", datasetVersion: options.config.datasetVersion, productScope: "myntra", pipelineVersion: state.pipelineVersion,
    inputChecksum: state.inputChecksum, externalCallsMadeByOfflinePipeline: false, humanEvaluationId: review?.humanEvaluationId ?? null,
    claimLimits: ["Corpus/source-specific evidence only.", "No population prevalence, causal conversion, revenue, demographic, or private-user inference."],
  });
  await writeJsonAtomically(path.join(staging, "taxonomy.json"), { schemaVersion: "1.0.0", datasetVersion: options.config.datasetVersion, taxonomyVersion: options.config.taxonomyVersion, status: options.config.status === "ready" ? "reviewed" : "candidate", themes: releaseDashboard.themes });

  const roleByFile: Record<string, { role: string; visibility: "client" | "server" | "restricted"; count: number | null }> = {
    "aggregates.json": { role: "dashboard_aggregates", visibility: "client", count: null },
    "evidence.server.jsonl": { role: "public_safe_evidence", visibility: "server", count: evidence.length },
    "normalized.restricted.jsonl": { role: "normalized_evidence", visibility: "restricted", count: canonical.length },
    "classifications.restricted.jsonl": { role: "classifications", visibility: "restricted", count: classifications.length },
    "validation-ledger.jsonl": { role: "validation_ledger", visibility: "restricted", count: ledger.length },
    "lexical-clusters.json": { role: "theme_discovery", visibility: "restricted", count: null },
    "quality-report.json": { role: "quality_report", visibility: "restricted", count: null },
    "methodology.json": { role: "methodology", visibility: "client", count: null },
    "taxonomy.json": { role: "taxonomy", visibility: "client", count: releaseDashboard.themes.length },
  };
  const files = await Promise.all(Object.entries(roleByFile).map(async ([filename, metadata]) => ({ role: metadata.role, path: filename, sha256: sha256(await readFile(path.join(staging, filename))), recordCount: metadata.count, visibility: metadata.visibility })));
  const validationCheckpoint = state.checkpoints.find((checkpoint) => checkpoint.stage === "validate_normalize");
  const counts = {
    raw: validationCheckpoint?.counts.received ?? canonical.length + ledger.length,
    normalized: validationCheckpoint?.counts.normalized ?? canonical.length,
    canonical: canonical.length,
    direct: classifications.filter((item) => item.relevance === "direct_wishlist").length,
    adjacent: classifications.filter((item) => item.relevance === "journey_adjacent").length,
    general: classifications.filter((item) => item.relevance === "general").length,
    irrelevant: classifications.filter((item) => item.relevance === "irrelevant").length,
    reviewed: classifications.filter((item) => item.humanReviewStatus === "accepted" || item.humanReviewStatus === "corrected").length,
  };
  const sources = [...new Set(canonical.map((item) => item.source))].sort();
  const manifest = releaseManifestSchema.parse({
    schemaVersion: "1.0.0", datasetVersion: options.config.datasetVersion, status: options.config.status, generatedAt: options.config.generatedAt,
    scope: { product: "myntra", targetRawRecords: 20_000, acceptableRawMinimum: 18_000, acceptableRawMaximum: 22_000, otherShoppingPlatformsIncluded: false },
    codeCommit: options.config.codeCommit, taxonomyVersion: options.config.taxonomyVersion, promptVersion: options.config.promptVersion,
    classifier: options.config.classifier, embedding: options.config.embedding,
    coverage: sources.map((source) => { const records = canonical.filter((item) => item.source === source); const dates = records.map((item) => item.publishedAt).filter((value): value is string => value !== null).sort(); return { source, runIds: [...new Set(records.map((item) => item.collectionRunId))].sort(), from: dates[0] ?? null, to: dates.at(-1) ?? null, queries: [...new Set(records.flatMap((item) => item.queryIds))].sort() }; }),
    counts, files, qualityStatus: quality.status, limitations: options.config.limitations,
  });
  await writeJsonAtomically(path.join(staging, "manifest.json"), manifest);
  await validateCandidateRelease(staging);
  await rename(staging, destination);
  return { releaseDirectory: destination, manifest };
}
