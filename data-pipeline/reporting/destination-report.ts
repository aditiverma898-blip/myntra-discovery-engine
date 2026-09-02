import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { aiRunManifestSchema } from "../../src/lib/schemas/ai-run";
import { collectionRunManifestSchema } from "../../src/lib/schemas/collection";
import { destinationOperationReportSchema, type DestinationOperationKind, type DestinationOperationReport } from "../../src/lib/schemas/destination-report";
import { youtubeDiscoveryManifestSchema } from "../../src/lib/schemas/youtube-discovery";
import { writeJsonAtomically } from "../io/atomic";

const credentialPattern = /(?:AIza|apify_api_|sk-)[A-Za-z0-9_-]{12,}|(?:authorization|api[_-]?key|token)\s*[=:]\s*[^\s,;]+/giu;
const credentialScanPattern = /(?:AIza|apify_api_|sk-)[A-Za-z0-9_-]{12,}|(?:authorization|api[_-]?key|token)\s*[=:]\s*[^\s,;]+/iu;

interface ArtifactInput { role: "plan" | "manifest" | "failures"; file: string }
interface FailureExample { category: string; code: string | null; message: string }

function sanitize(value: string): string {
  return value.replace(credentialPattern, "[redacted]").slice(0, 500) || "No message supplied.";
}

function resolveOperationalArtifact(root: string, input: ArtifactInput): string {
  const candidate = input.file;
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (relative.startsWith("../") || path.isAbsolute(relative)) throw new Error("Destination report inputs must stay inside the project directory.");
  if (!relative.startsWith("data/raw/") && !relative.startsWith("data/intermediate/")) throw new Error("Destination report inputs must be operational artifacts under data/raw or data/intermediate.");
  const permitted = input.role === "plan"
    ? /^data\/intermediate\/plans\/[a-z0-9][a-z0-9-]*\.json$|\/collection-plan\.sanitized\.json$/u.test(relative)
    : input.role === "manifest"
      ? /\/(?:run-manifest|[a-z0-9][a-z0-9-]*\.manifest)\.json$/u.test(relative)
      : /\/failures\.jsonl$/u.test(relative);
  if (!permitted) throw new Error("Destination reports accept only role-matched sanitized plans, manifests, and failure ledgers.");
  return absolute;
}

async function inspectArtifact(root: string, input: ArtifactInput): Promise<{ descriptor: DestinationOperationReport["sourceArtifacts"][number]; text: string | null }> {
  const absolute = resolveOperationalArtifact(root, input);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  try {
    const content = await readFile(absolute);
    const info = await stat(absolute);
    return {
      descriptor: { role: input.role, path: relative, exists: true, bytes: info.size, sha256: createHash("sha256").update(content).digest("hex") },
      text: content.toString("utf8"),
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { descriptor: { role: input.role, path: relative, exists: false, bytes: null, sha256: null }, text: null };
    }
    throw error;
  }
}

function parseFailures(text: string | null): FailureExample[] {
  if (!text) return [];
  return text.split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    try {
      const value = JSON.parse(line) as Record<string, unknown>;
      return [{
        category: typeof value.category === "string" ? sanitize(value.category) : "unknown",
        code: typeof value.code === "string" ? sanitize(value.code) : null,
        message: typeof value.message === "string" ? sanitize(value.message) : "Failure record did not contain a message.",
      }];
    } catch {
      return [{ category: "invalid_failure_record", code: null, message: "A failure-ledger line was not valid JSON." }];
    }
  });
}

function statusFromManifest(manifest: unknown): {
  status: "completed" | "partial" | "failed" | "running" | "planned" | null;
  externalCallsMade: boolean;
  received: number;
  succeeded: number;
  failed: number;
  quarantined: number;
  requests: number;
  costUsd: number;
} {
  const collection = collectionRunManifestSchema.safeParse(manifest);
  if (collection.success) return {
    status: collection.data.status,
    externalCallsMade: collection.data.externalCallsMade,
    received: collection.data.counts.received,
    succeeded: collection.data.counts.valid,
    failed: collection.data.counts.failures,
    quarantined: collection.data.counts.quarantined,
    requests: collection.data.requestCount,
    costUsd: collection.data.costUsd,
  };
  const ai = aiRunManifestSchema.safeParse(manifest);
  if (ai.success) return {
    status: ai.data.status,
    externalCallsMade: ai.data.externalCallsMade,
    received: ai.data.succeeded + ai.data.failed,
    succeeded: ai.data.succeeded,
    failed: ai.data.failed,
    quarantined: 0,
    requests: ai.data.requestCount,
    costUsd: ai.data.estimatedCostUsd,
  };
  const youtube = youtubeDiscoveryManifestSchema.safeParse(manifest);
  if (youtube.success) return {
    status: youtube.data.status,
    externalCallsMade: youtube.data.externalCallsMade,
    received: youtube.data.counts.received,
    succeeded: youtube.data.counts.valid,
    failed: youtube.data.counts.failures,
    quarantined: youtube.data.counts.quarantined,
    requests: youtube.data.requestCount,
    costUsd: 0,
  };
  return { status: null, externalCallsMade: false, received: 0, succeeded: 0, failed: 0, quarantined: 0, requests: 0, costUsd: 0 };
}

function deriveOutcome(options: {
  kind: DestinationOperationKind;
  exitCode: number;
  status: ReturnType<typeof statusFromManifest>["status"];
  externalCallsMade: boolean;
  failedCount: number;
  allowExternalCallsRestored: boolean;
  planExists: boolean;
}): Pick<DestinationOperationReport["outcome"], "state" | "summary" | "nextAction"> {
  if (!options.allowExternalCallsRestored) return { state: "unsafe_incomplete", summary: "The operation report was generated while external calls were still enabled.", nextAction: "Restore ALLOW_EXTERNAL_CALLS=false, rerun this report command, and do not start another operation." };
  if (options.kind === "collection_dry_run") {
    if (options.exitCode === 0 && options.planExists && !options.externalCallsMade) return { state: "success", summary: "The dry-run produced a sanitized no-call plan.", nextAction: "Return the report and plan to the primary agent and wait for approval of the exact batch." };
    return { state: "blocked", summary: "The dry-run did not produce its expected sanitized no-call plan.", nextAction: "Stop and return this report plus console output to the primary agent." };
  }
  if (options.kind === "offline_baseline" && options.exitCode === 0) return { state: "success", summary: "The destination offline baseline was reported as passing.", nextAction: "Return this report and wait for the reviewed execution pack." };
  if (options.status === "partial" || (options.exitCode === 0 && options.failedCount > 0)) return { state: "partial", summary: "The operation produced some output but also recorded failures or an incomplete run.", nextAction: "Do not retry or scale. Return the report, manifest, and failure ledger to the primary agent." };
  if (options.status === "completed" && options.exitCode === 0) return { state: "success", summary: "The bounded operation completed according to its manifest.", nextAction: "Do not scale or publish. Return the report and referenced artifacts to the primary agent for review." };
  if (options.exitCode !== 0 && !options.externalCallsMade) return { state: "blocked", summary: "The operation stopped before any external request was recorded.", nextAction: "Do not change the configuration. Return the report and console output to the primary agent." };
  return { state: "failed", summary: "The operation failed or did not produce a completed manifest.", nextAction: "Do not retry. Return the report, any manifest, and failure ledger to the primary agent." };
}

export async function createDestinationOperationReport(options: {
  workspaceRoot: string;
  kind: DestinationOperationKind;
  operationId: string;
  reportedExitCode: number;
  manifestPath?: string;
  failurePath?: string;
  planPath?: string;
  reportedError?: string;
  outputPath?: string;
  environment?: Record<string, string | undefined>;
  now?: () => string;
}): Promise<{ report: DestinationOperationReport; outputPath: string }> {
  const inputs: ArtifactInput[] = [];
  if (options.planPath) inputs.push({ role: "plan", file: options.planPath });
  if (options.manifestPath) inputs.push({ role: "manifest", file: options.manifestPath });
  if (options.failurePath) inputs.push({ role: "failures", file: options.failurePath });
  const inspected = await Promise.all(inputs.map((input) => inspectArtifact(options.workspaceRoot, input)));
  const manifestText = inspected.find((item) => item.descriptor.role === "manifest")?.text ?? null;
  let manifest: unknown = null;
  if (manifestText) {
    try { manifest = JSON.parse(manifestText) as unknown; }
    catch { manifest = null; }
  }
  const status = statusFromManifest(manifest);
  const failures = parseFailures(inspected.find((item) => item.descriptor.role === "failures")?.text ?? null);
  const byCategory = Object.fromEntries([...new Set(failures.map((failure) => failure.category))].sort().map((category) => [category, failures.filter((failure) => failure.category === category).length]));
  const environment = options.environment ?? process.env;
  const allowExternalCallsRestored = environment.ALLOW_EXTERNAL_CALLS !== "true";
  const outcome = deriveOutcome({ kind: options.kind, exitCode: options.reportedExitCode, status: status.status, externalCallsMade: status.externalCallsMade, failedCount: Math.max(status.failed, failures.length), allowExternalCallsRestored, planExists: inspected.some((item) => item.descriptor.role === "plan" && item.descriptor.exists) });
  const report = destinationOperationReportSchema.parse({
    schemaVersion: "1.0.0",
    reportId: `${options.operationId}-destination-report`,
    projectVersion: (JSON.parse(await readFile(path.join(options.workspaceRoot, "package.json"), "utf8")) as { version: string }).version,
    generatedAt: (options.now ?? (() => new Date().toISOString()))(),
    operation: { kind: options.kind, operationId: options.operationId, reportedExitCode: options.reportedExitCode },
    outcome: { ...outcome, successCriteriaMet: outcome.state === "success", externalCallsMade: status.externalCallsMade, reportedError: options.reportedError ? sanitize(options.reportedError) : null },
    metrics: { received: status.received, succeeded: status.succeeded, failed: Math.max(status.failed, failures.length), quarantined: status.quarantined, requests: status.requests, costUsd: status.costUsd },
    safety: {
      allowExternalCallsRestored,
      runtimeLlmDisabled: environment.ENABLE_RUNTIME_LLM !== "true",
      redditSourceApproval: environment.REDDIT_SOURCE_APPROVAL === "approved" ? "approved" : "disabled",
      credentialValuesIncluded: false,
    },
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    sourceArtifacts: inspected.map((item) => item.descriptor),
    failureSummary: { total: Math.max(status.failed, failures.length), byCategory, examples: failures.slice(0, 10) },
  });
  const serialized = JSON.stringify(report);
  if (credentialScanPattern.test(serialized)) throw new Error("The destination report failed its credential-value scan.");
  const outputPath = path.resolve(options.workspaceRoot, options.outputPath ?? `data/intermediate/operator-reports/${options.operationId}/DESTINATION_EXECUTION_REPORT.json`);
  const relativeOutput = path.relative(options.workspaceRoot, outputPath).split(path.sep).join("/");
  if (!relativeOutput.startsWith("data/intermediate/operator-reports/") || path.basename(outputPath) !== "DESTINATION_EXECUTION_REPORT.json") throw new Error("Destination reports must be written under data/intermediate/operator-reports/<id>/DESTINATION_EXECUTION_REPORT.json.");
  await writeJsonAtomically(outputPath, report);
  return { report, outputPath };
}
