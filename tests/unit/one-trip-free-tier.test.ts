import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createDestinationCycleReport } from "../../data-pipeline/reporting/destination-cycle-report";
import { runGeminiConnectivityProbe } from "../../data-pipeline/providers/gemini-connectivity";
import { validateDestinationDryRunPlan } from "../../data-pipeline/planning/validate-dry-run-plan";
import { aiProviderApprovalSchema, geminiConnectivityJobSchema } from "../../src/lib/schemas/ai-run";
import { collectionBatchSchema } from "../../src/lib/schemas/collection";
import { destinationOperationReportSchema, type DestinationOperationKind } from "../../src/lib/schemas/destination-report";

const NOW = "2026-08-22T10:00:00.000Z";

function approval() {
  return aiProviderApprovalSchema.parse({
    schemaVersion: "1.0.0",
    approvalId: "gemini-synthetic-probe",
    status: "approved",
    provider: "gemini",
    allowedHost: "generativelanguage.googleapis.com",
    reviewedAt: NOW,
    expiresAt: "2026-08-29T23:59:59.000Z",
    termsUrls: ["https://ai.google.dev/gemini-api/terms"],
    allowedModelIds: ["gemini-2.5-flash-lite"],
    minimizedTextOnly: true,
    maxItems: 1,
    maxRequests: 1,
    maxCostUsd: 0,
  });
}

function job() {
  return geminiConnectivityJobSchema.parse({
    schemaVersion: "1.0.0",
    kind: "connectivity",
    jobId: "gemini-synthetic-probe",
    approvalId: "gemini-synthetic-probe",
    modelId: "gemini-2.5-flash-lite",
    outputPath: "data/intermediate/gemini-probe/result.sanitized.json",
    failurePath: "data/intermediate/gemini-probe/failures.jsonl",
    maxItems: 1,
    maxRequests: 1,
    maxCostUsd: 0,
  });
}

function youtubeBatch() {
  return collectionBatchSchema.parse({
    schemaVersion: "1.0.0",
    batchId: "youtube-sample",
    datasetVersion: "myntra-youtube-sample",
    source: "youtube",
    approvalId: "youtube-approval",
    routeConfig: { route: "youtube_data_api", regionCode: "IN", relevanceLanguage: "en", videosPerQueryPage: 1, commentsPerVideo: 10, order: "relevance" },
    queries: [{ queryId: "myntra-fit", text: "Myntra size fit review" }],
    limits: { maxItems: 10, maxItemsPerQuery: 10, maxPagesPerQuery: 1, maxRequests: 3, maxCostUsd: 0, maxAttempts: 2 },
    outputPath: "data/raw/youtube-sample",
    quarantinePath: "data/intermediate/quarantine/youtube-sample",
    rawRetentionDays: 30,
  });
}

function stageReport(kind: DestinationOperationKind, operationId: string) {
  return destinationOperationReportSchema.parse({
    schemaVersion: "1.0.0",
    reportId: `${operationId}-destination-report`,
    projectVersion: "0.9.2",
    generatedAt: NOW,
    operation: { kind, operationId, reportedExitCode: 0 },
    outcome: { state: "success", successCriteriaMet: true, externalCallsMade: true, summary: "Completed.", reportedError: null, nextAction: "Return artifacts." },
    metrics: { received: 1, succeeded: 1, failed: 0, quarantined: 0, requests: 1, costUsd: 0 },
    safety: { allowExternalCallsRestored: true, runtimeLlmDisabled: true, redditSourceApproval: "disabled", credentialValuesIncluded: false },
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    sourceArtifacts: [],
    failureSummary: { total: 0, byCategory: {}, examples: [] },
  });
}

describe("zero-cost one-trip execution", () => {
  it("sends only a fixed synthetic prompt to the Gemini free-tier probe", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-gemini-probe-"));
    const fetchImpl = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const body = String(init?.body);
      expect(body).toContain("This is synthetic test data");
      expect(body).toContain("No user, source, review, comment, or YouTube data is included");
      expect(body).not.toContain("Myntra wishlist");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ status: "ok", probe: "synthetic-connectivity" }) }] } }] }), { status: 200 });
    });
    const result = await runGeminiConnectivityProbe({
      workspaceRoot: root,
      job: job(),
      approval: approval(),
      environment: { ALLOW_EXTERNAL_CALLS: "true", GEMINI_API_KEY: "mock-key" },
      argv: ["--allow-external"],
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.manifest).toMatchObject({ status: "completed", requestCount: 1, succeeded: 1 });
    expect(JSON.parse(await readFile(path.join(root, job().outputPath), "utf8"))).toMatchObject({ sourceDataSubmitted: false, paidServiceRequired: false });
  });

  it("blocks Gemini before fetch construction when external calls are disabled", async () => {
    const fetchImpl = vi.fn();
    await expect(runGeminiConnectivityProbe({ workspaceRoot: await mkdtemp(path.join(os.tmpdir(), "myntra-gemini-blocked-")), job: job(), approval: approval(), environment: { ALLOW_EXTERNAL_CALLS: "false", GEMINI_API_KEY: "mock-key" }, argv: ["--allow-external"], fetchImpl: fetchImpl as typeof fetch, now: () => NOW })).rejects.toMatchObject({ code: "EXTERNAL_CALLS_DISABLED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requires the exact no-call collection plan before live execution", () => {
    const batch = youtubeBatch();
    expect(() => validateDestinationDryRunPlan({ batchId: batch.batchId, approvalId: batch.approvalId, approvalStatus: "approved", credentialsPresent: true, externalExecutionPerformed: false, limits: batch.limits, blockedReasons: ["External calls are disabled."] }, batch)).not.toThrow();
    expect(() => validateDestinationDryRunPlan({ batchId: batch.batchId, approvalId: batch.approvalId, approvalStatus: "approved", credentialsPresent: true, externalExecutionPerformed: false, limits: batch.limits, blockedReasons: [] }, batch)).toThrow(/Dry-run gate failed/u);
  });

  it("combines both zero-cost stages without claiming YouTube-to-Gemini transfer", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-cycle-report-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "0.9.2" }), "utf8");
    const youtubePath = "data/intermediate/operator-reports/youtube-run/DESTINATION_EXECUTION_REPORT.json";
    const geminiPath = "data/intermediate/operator-reports/gemini-run/DESTINATION_EXECUTION_REPORT.json";
    await mkdir(path.dirname(path.join(root, youtubePath)), { recursive: true });
    await mkdir(path.dirname(path.join(root, geminiPath)), { recursive: true });
    await writeFile(path.join(root, youtubePath), JSON.stringify(stageReport("collection_external", "youtube-run")), "utf8");
    await writeFile(path.join(root, geminiPath), JSON.stringify(stageReport("gemini_connectivity", "gemini-run")), "utf8");
    const { report } = await createDestinationCycleReport({ workspaceRoot: root, cycleId: "one-trip-cycle", youtubeReportPath: youtubePath, geminiReportPath: geminiPath, now: () => NOW });
    expect(report.outcome).toMatchObject({ state: "success", successCriteriaMet: true });
    expect(report.safety).toEqual({ allowExternalCallsRestoredForEveryStage: true, credentialValuesIncluded: false, youtubeDataSubmittedToGemini: false, paidServicesRequired: false });
    expect(report.metrics).toMatchObject({ requests: 2, costUsd: 0 });
  });
});
