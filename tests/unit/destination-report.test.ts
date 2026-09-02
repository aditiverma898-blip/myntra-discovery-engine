import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createDestinationOperationReport } from "../../data-pipeline/reporting/destination-report";

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "myntra-destination-report-"));
  await mkdir(path.join(root, "data/raw/sample-batch"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "0.9.0" }), "utf8");
  return root;
}

function collectionManifest(status: "completed" | "failed", failures: number) {
  return {
    schemaVersion: "1.0.0",
    batchId: "sample-batch",
    datasetVersion: "real-001",
    source: "youtube",
    approvalId: "youtube-approval",
    route: "youtube_data_api",
    routeIdentifier: "youtube-data-api-v3",
    configHash: "a".repeat(64),
    status,
    startedAt: "2026-08-22T10:00:00.000Z",
    updatedAt: "2026-08-22T10:01:00.000Z",
    completedAt: "2026-08-22T10:01:00.000Z",
    externalCallsMade: true,
    requestCount: 2,
    costUsd: 0,
    counts: { received: 2, valid: failures ? 1 : 2, quarantined: 0, failures },
    completedQueryIds: status === "completed" ? ["myntra-fit"] : [],
    queryCursors: { "myntra-fit": null },
    queryPageCounts: { "myntra-fit": 1 },
    providerRunIds: [],
    outputFiles: ["run-manifest.json", "failures.jsonl"],
    warnings: [],
    rawRetentionDeadline: "2026-09-21T10:00:00.000Z",
  };
}

describe("destination execution report", () => {
  it("accepts the batch-named sanitized plan emitted by the dry-run CLI", async () => {
    const root = await workspace();
    const planPath = "data/intermediate/plans/youtube-myntra-sample-20260822-001.json";
    await mkdir(path.dirname(path.join(root, planPath)), { recursive: true });
    await writeFile(path.join(root, planPath), JSON.stringify({ externalExecutionPerformed: false }), "utf8");

    const { report } = await createDestinationOperationReport({
      workspaceRoot: root,
      kind: "collection_dry_run",
      operationId: "youtube-myntra-sample-20260822-001-dry-run",
      reportedExitCode: 0,
      planPath,
      environment: { ALLOW_EXTERNAL_CALLS: "false", ENABLE_RUNTIME_LLM: "false", REDDIT_SOURCE_APPROVAL: "disabled" },
      now: () => "2026-08-22T10:02:00.000Z",
    });

    expect(report.outcome).toMatchObject({ state: "success", successCriteriaMet: true, externalCallsMade: false });
    expect(report.sourceArtifacts[0]).toMatchObject({ role: "plan", path: planPath, exists: true });
  });

  it("summarizes a successful bounded run without exposing credentials", async () => {
    const root = await workspace();
    const manifestPath = path.join(root, "data/raw/sample-batch/run-manifest.json");
    const failuresPath = path.join(root, "data/raw/sample-batch/failures.jsonl");
    await writeFile(manifestPath, JSON.stringify(collectionManifest("completed", 0)), "utf8");
    await writeFile(failuresPath, "", "utf8");

    const result = await createDestinationOperationReport({
      workspaceRoot: root,
      kind: "collection_external",
      operationId: "sample-batch",
      reportedExitCode: 0,
      manifestPath: "data/raw/sample-batch/run-manifest.json",
      failurePath: "data/raw/sample-batch/failures.jsonl",
      environment: { ALLOW_EXTERNAL_CALLS: "false", ENABLE_RUNTIME_LLM: "false", REDDIT_SOURCE_APPROVAL: "disabled" },
      now: () => "2026-08-22T10:02:00.000Z",
    });

    expect(result.report.outcome).toMatchObject({ state: "success", successCriteriaMet: true, externalCallsMade: true });
    expect(result.report.metrics).toMatchObject({ received: 2, succeeded: 2, failed: 0, requests: 2 });
    expect(result.report.safety).toMatchObject({ allowExternalCallsRestored: true, credentialValuesIncluded: false });
    expect(JSON.parse(await readFile(result.outputPath, "utf8"))).toEqual(result.report);
  });

  it("records a sanitized failure and tells the operator to stop", async () => {
    const root = await workspace();
    await writeFile(path.join(root, "data/raw/sample-batch/run-manifest.json"), JSON.stringify(collectionManifest("failed", 1)), "utf8");
    await writeFile(path.join(root, "data/raw/sample-batch/failures.jsonl"), `${JSON.stringify({ category: "authorization", code: "HTTP_401", message: "token=secret-value-that-must-not-appear" })}\n`, "utf8");

    const { report } = await createDestinationOperationReport({
      workspaceRoot: root,
      kind: "collection_external",
      operationId: "sample-batch",
      reportedExitCode: 1,
      manifestPath: "data/raw/sample-batch/run-manifest.json",
      failurePath: "data/raw/sample-batch/failures.jsonl",
      reportedError: "Provider returned token=secret-value-that-must-not-appear",
      environment: { ALLOW_EXTERNAL_CALLS: "false", ENABLE_RUNTIME_LLM: "false", REDDIT_SOURCE_APPROVAL: "disabled" },
      now: () => "2026-08-22T10:02:00.000Z",
    });

    expect(report.outcome.state).toBe("failed");
    expect(report.outcome.successCriteriaMet).toBe(false);
    expect(report.outcome.nextAction).toContain("Do not retry");
    expect(report.failureSummary.examples[0]?.message).toBe("[redacted]");
    expect(report.outcome.reportedError).toBe("Provider returned [redacted]");
    expect(JSON.stringify(report)).not.toContain("secret-value");
  });

  it("reports a completed discovery-first YouTube manifest", async () => {
    const root = await workspace();
    const manifestPath = "data/raw/sample-batch/run-manifest.json";
    const failuresPath = "data/raw/sample-batch/failures.jsonl";
    await writeFile(path.join(root, manifestPath), JSON.stringify({
      schemaVersion: "1.1.0", batchId: "sample-batch", datasetVersion: "candidate-v11", approvalId: "youtube-v11", configHash: "b".repeat(64), status: "completed", stage: "completed", startedAt: "2026-08-22T10:00:00.000Z", updatedAt: "2026-08-22T10:02:00.000Z", completedAt: "2026-08-22T10:02:00.000Z", externalCallsMade: true, requestCount: 4, quotaUsage: { searchCalls: 1, generalUnits: 3, videosListCalls: 1, commentCalls: 2 }, counts: { searchCandidates: 2, uniqueCandidates: 2, enrichedCandidates: 2, eligibleCandidates: 2, selectedVideos: 2, processedVideos: 2, videosWithComments: 2, received: 20, valid: 20, quarantined: 0, failures: 0 }, queryCursors: { "myntra-review": null }, queryPageCounts: { "myntra-review": 1 }, completedQueryIds: ["myntra-review"], completedVideoIds: ["one", "two"], outputFiles: ["run-manifest.json"], warnings: [], rawRetentionDeadline: "2026-09-21T10:00:00.000Z",
    }), "utf8");
    await writeFile(path.join(root, failuresPath), "", "utf8");
    const { report } = await createDestinationOperationReport({ workspaceRoot: root, kind: "collection_external", operationId: "youtube-v11", reportedExitCode: 0, manifestPath, failurePath: failuresPath, environment: { ALLOW_EXTERNAL_CALLS: "false", ENABLE_RUNTIME_LLM: "false", REDDIT_SOURCE_APPROVAL: "disabled" }, now: () => "2026-08-22T10:03:00.000Z" });
    expect(report.outcome).toMatchObject({ state: "success", successCriteriaMet: true });
    expect(report.metrics).toMatchObject({ received: 20, succeeded: 20, requests: 4, costUsd: 0 });
  });
});
