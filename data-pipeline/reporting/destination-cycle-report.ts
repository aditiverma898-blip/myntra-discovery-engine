import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { destinationCycleReportSchema, type DestinationCycleReport } from "../../src/lib/schemas/destination-cycle-report";
import { destinationOperationReportSchema, type DestinationOperationReport } from "../../src/lib/schemas/destination-report";
import { writeJsonAtomically } from "../io/atomic";

function safeReportPath(root: string, candidate: string): string {
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (!relative.startsWith("data/intermediate/operator-reports/") || path.basename(absolute) !== "DESTINATION_EXECUTION_REPORT.json") throw new Error("Cycle stage reports must be destination reports under data/intermediate/operator-reports/.");
  return absolute;
}

async function readStage(root: string, candidate: string): Promise<{ report: DestinationOperationReport; path: string; sha256: string }> {
  const absolute = safeReportPath(root, candidate);
  const content = await readFile(absolute);
  return {
    report: destinationOperationReportSchema.parse(JSON.parse(content.toString("utf8")) as unknown),
    path: path.relative(root, absolute).split(path.sep).join("/"),
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

export async function createDestinationCycleReport(options: {
  workspaceRoot: string;
  cycleId: string;
  youtubeReportPath: string;
  geminiReportPath: string;
  now?: () => string;
}): Promise<{ report: DestinationCycleReport; outputPath: string }> {
  const [youtube, gemini] = await Promise.all([
    readStage(options.workspaceRoot, options.youtubeReportPath),
    readStage(options.workspaceRoot, options.geminiReportPath),
  ]);
  if (youtube.report.operation.kind !== "collection_external") throw new Error("YouTube stage must reference a collection_external report.");
  if (gemini.report.operation.kind !== "gemini_connectivity") throw new Error("Gemini stage must reference a gemini_connectivity report.");
  const inputs = [
    { name: "youtube_collection" as const, ...youtube },
    { name: "gemini_synthetic_connectivity" as const, ...gemini },
  ];
  const unsafe = inputs.some(({ report }) => report.outcome.state === "unsafe_incomplete" || !report.safety.allowExternalCallsRestored);
  const successfulStages = inputs.filter(({ report }) => report.outcome.successCriteriaMet).length;
  const state = unsafe ? "unsafe_incomplete" : successfulStages === inputs.length ? "success" : successfulStages > 0 ? "partial" : inputs.some(({ report }) => report.outcome.state === "blocked") ? "blocked" : "failed";
  const projectVersion = (JSON.parse(await readFile(path.join(options.workspaceRoot, "package.json"), "utf8")) as { version: string }).version;
  const report = destinationCycleReportSchema.parse({
    schemaVersion: "1.0.0",
    cycleId: options.cycleId,
    projectVersion,
    generatedAt: (options.now ?? (() => new Date().toISOString()))(),
    outcome: {
      state,
      successCriteriaMet: state === "success",
      summary: state === "success" ? "The bounded official YouTube collection and synthetic-only Gemini connectivity check both completed." : "The one-trip cycle did not complete every stage successfully; collected output, if any, is preserved for review.",
      nextAction: unsafe ? "Restore ALLOW_EXTERNAL_CALLS=false before transferring the return bundle." : "Do not retry or scale. Transfer the generated return ZIP to the implementation computer for review.",
    },
    metrics: {
      stages: inputs.length,
      successfulStages,
      externalCallsMade: inputs.some(({ report: value }) => value.outcome.externalCallsMade),
      requests: inputs.reduce((sum, { report: value }) => sum + value.metrics.requests, 0),
      costUsd: inputs.reduce((sum, { report: value }) => sum + value.metrics.costUsd, 0),
    },
    safety: {
      allowExternalCallsRestoredForEveryStage: inputs.every(({ report: value }) => value.safety.allowExternalCallsRestored),
      credentialValuesIncluded: false,
      youtubeDataSubmittedToGemini: false,
      paidServicesRequired: false,
    },
    stages: inputs.map(({ name, report: value, path: reportPath, sha256 }) => ({
      name,
      reportId: value.reportId,
      state: value.outcome.state,
      successCriteriaMet: value.outcome.successCriteriaMet,
      externalCallsMade: value.outcome.externalCallsMade,
      requests: value.metrics.requests,
      costUsd: value.metrics.costUsd,
      reportPath,
      sha256,
    })),
  });
  const outputPath = path.join(options.workspaceRoot, "data/intermediate/operator-reports", options.cycleId, "DESTINATION_CYCLE_REPORT.json");
  await writeJsonAtomically(outputPath, report);
  return { report, outputPath };
}
