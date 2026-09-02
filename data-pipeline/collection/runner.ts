import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertExternalCallsAllowed } from "../../src/lib/external-access";
import { collectionFailureSchema, collectionRunManifestSchema, type CollectionBatch, type CollectionFailure, type CollectionRunManifest, type SourceApproval } from "../../src/lib/schemas/collection";
import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";
import { writeJsonAtomically, writeTextAtomically } from "../io/atomic";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { categorizeProviderFailure } from "../utils/execution-policy";
import type { CollectionPage, CollectionTransportFactory } from "./contracts";
import { mapLiveProviderItem } from "./live-mapper";
import { createDestinationCollectionPlan } from "./plan";
import { stableHash, validateBatchAgainstApproval, validateRestrictedPath } from "./validation";

function roundCost(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }

async function readManifest(file: string): Promise<CollectionRunManifest | null> {
  try { return collectionRunManifestSchema.parse(JSON.parse(await readFile(file, "utf8")) as unknown); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function validatePage(page: CollectionPage): CollectionPage {
  if (!Number.isSafeInteger(page.requestCount) || page.requestCount < 1) throw new Error("Transport page must report at least one request.");
  if (!Number.isFinite(page.costUsd) || page.costUsd < 0) throw new Error("Transport page reported an invalid cost.");
  if (!Array.isArray(page.items) || !Array.isArray(page.warnings) || (page.rejectedItems !== undefined && !Array.isArray(page.rejectedItems))) throw new Error("Transport page returned an invalid shape.");
  if (page.checkpointOnly && (page.items.length > 0 || page.nextCursor === null)) throw new Error("A checkpoint-only transport result must contain no items and must provide a resume cursor.");
  return page;
}

function rejectedItemFailure(options: { batchId: string; queryId: string; code: string; message: string; occurredAt: string }): CollectionFailure {
  return collectionFailureSchema.parse({
    schemaVersion: "1.0.0",
    batchId: options.batchId,
    queryId: options.queryId,
    category: "schema",
    code: options.code,
    message: options.message,
    occurredAt: options.occurredAt,
    retryable: false,
  });
}

function failureFor(options: { batchId: string; queryId: string | null; error: unknown; occurredAt: string }): CollectionFailure {
  const category = categorizeProviderFailure(options.error);
  return collectionFailureSchema.parse({
    schemaVersion: "1.0.0",
    batchId: options.batchId,
    queryId: options.queryId,
    category,
    code: options.error instanceof Error && options.error.name ? options.error.name : "COLLECTION_ERROR",
    message: options.error instanceof Error ? options.error.message.replace(/(?:AIza|apify_api_)[A-Za-z0-9_-]+/gu, "[redacted]") : "Unknown collection failure.",
    occurredAt: options.occurredAt,
    retryable: ["rate_limit", "transient"].includes(category),
  });
}

export async function runExternalCollection(options: {
  workspaceRoot: string;
  batch: CollectionBatch;
  approval: SourceApproval;
  environment?: Record<string, string | undefined>;
  argv?: readonly string[];
  transportFactory: CollectionTransportFactory;
  now?: () => string;
  recoveryOnlyQueryId?: string;
}): Promise<{ manifest: CollectionRunManifest; records: RawEvidence[]; failures: CollectionFailure[] }> {
  const now = options.now ?? (() => new Date().toISOString());
  validateBatchAgainstApproval(options.batch, options.approval, new Date(now()));
  assertExternalCallsAllowed({ source: options.batch.source, sourceApprovalStatus: options.approval.status, maxItems: options.batch.limits.maxItems, maxCost: options.batch.limits.maxCostUsd, argv: options.argv, environment: options.environment });
  const outputDirectory = validateRestrictedPath(options.workspaceRoot, options.batch.outputPath, "data/raw/");
  validateRestrictedPath(options.workspaceRoot, options.batch.quarantinePath, "data/intermediate/quarantine/");
  const manifestPath = path.join(outputDirectory, "run-manifest.json");
  const recordsPath = path.join(outputDirectory, "raw-records.jsonl");
  const failuresPath = path.join(outputDirectory, "failures.jsonl");
  const planPath = path.join(outputDirectory, "collection-plan.sanitized.json");
  const configHash = stableHash(options.batch);
  const existing = await readManifest(manifestPath);
  if (existing && existing.configHash !== configHash) throw new Error("A batch cannot resume with changed configuration.");
  if (options.recoveryOnlyQueryId) {
    if (options.batch.routeConfig.route !== "apify_actor") throw new Error("Recovery-only execution is supported only for an Apify Actor route.");
    if (!options.batch.queries.some((query) => query.queryId === options.recoveryOnlyQueryId)) throw new Error("Recovery-only query is not present in the batch configuration.");
    if (!existing) throw new Error("Recovery-only execution requires an existing run manifest.");
    if (existing.completedQueryIds.includes(options.recoveryOnlyQueryId)) throw new Error("Recovery-only query is already completed.");
    if (!existing.queryCursors[options.recoveryOnlyQueryId]) throw new Error("Recovery-only execution requires a saved cursor for the selected query.");
    if (existing.providerRunIds.length === 0) throw new Error("Recovery-only execution requires a checkpointed provider run ID.");
  }
  if (existing?.status === "completed") {
    return { manifest: existing, records: await readJsonLines(recordsPath, rawEvidenceSchema), failures: await readJsonLines(failuresPath, collectionFailureSchema) };
  }
  const startedAt = existing?.startedAt ?? now();
  let manifest = existing ?? collectionRunManifestSchema.parse({
    schemaVersion: "1.0.0",
    batchId: options.batch.batchId,
    datasetVersion: options.batch.datasetVersion,
    source: options.batch.source,
    approvalId: options.approval.approvalId,
    route: options.batch.routeConfig.route,
    routeIdentifier: options.approval.routeIdentifier,
    configHash,
    status: "planned",
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    externalCallsMade: false,
    requestCount: 0,
    costUsd: 0,
    counts: { received: 0, valid: 0, quarantined: 0, failures: 0 },
    completedQueryIds: [],
    queryCursors: {},
    queryPageCounts: {},
    processedParentIds: [],
    queryDiagnostics: {},
    providerRunIds: [],
    outputFiles: ["collection-plan.sanitized.json", "run-manifest.json", "raw-records.jsonl", "failures.jsonl"],
    warnings: [],
    rawRetentionDeadline: new Date(new Date(startedAt).getTime() + options.batch.rawRetentionDays * 86_400_000).toISOString(),
  });
  const records = existing ? await readJsonLines(recordsPath, rawEvidenceSchema) : [];
  const failures = existing ? await readJsonLines(failuresPath, collectionFailureSchema) : [];
  await writeJsonAtomically(planPath, createDestinationCollectionPlan({ batch: options.batch, approval: options.approval, environment: options.environment, now: new Date(startedAt) }));
  await writeTextAtomically(recordsPath, serializeJsonLines(records));
  await writeTextAtomically(failuresPath, serializeJsonLines(failures));
  const transport = await options.transportFactory();

  const persist = async (): Promise<void> => {
    manifest = collectionRunManifestSchema.parse({ ...manifest, updatedAt: now(), counts: { received: records.length + failures.length, valid: records.length, quarantined: failures.filter((failure) => failure.category === "schema").length, failures: failures.length } });
    await writeTextAtomically(recordsPath, serializeJsonLines(records));
    await writeTextAtomically(failuresPath, serializeJsonLines(failures));
    await writeJsonAtomically(manifestPath, manifest);
  };

  try {
    manifest = collectionRunManifestSchema.parse({ ...manifest, status: "running", updatedAt: now(), completedAt: null });
    await persist();
    const selectedQueries = options.recoveryOnlyQueryId
      ? options.batch.queries.filter((query) => query.queryId === options.recoveryOnlyQueryId)
      : options.batch.queries;
    for (const query of selectedQueries) {
      if (manifest.completedQueryIds.includes(query.queryId)) continue;
      let cursor = manifest.queryCursors[query.queryId] ?? null;
      do {
        const maxItemsPerQuery = options.batch.limits.maxItemsPerQuery ?? options.batch.limits.maxItems;
        const maxPagesPerQuery = options.batch.limits.maxPagesPerQuery ?? 100;
        const queryItemCount = records.filter((record) => record.queryIds.includes(query.queryId)).length;
        const remainingBatchItems = options.batch.limits.maxItems - records.length;
        const remainingQueryItems = maxItemsPerQuery - queryItemCount;
        const remainingItems = Math.min(remainingBatchItems, remainingQueryItems);
        const remainingRequests = options.batch.limits.maxRequests - manifest.requestCount;
        const remainingCostUsd = roundCost(options.batch.limits.maxCostUsd - manifest.costUsd);
        if (remainingBatchItems <= 0) {
          manifest = collectionRunManifestSchema.parse({ ...manifest, status: "partial", warnings: [...new Set([...manifest.warnings, "The configured batch item cap stopped collection before every query completed."])] });
          await persist();
          return { manifest, records, failures };
        }
        if (remainingQueryItems <= 0 || (manifest.queryPageCounts[query.queryId] ?? 0) >= maxPagesPerQuery) {
          manifest = collectionRunManifestSchema.parse({
            ...manifest,
            completedQueryIds: [...new Set([...manifest.completedQueryIds, query.queryId])].sort(),
            queryCursors: { ...manifest.queryCursors, [query.queryId]: null },
            warnings: [...new Set([...manifest.warnings, `Query ${query.queryId} reached its configured item or page cap.`])],
          });
          await persist();
          break;
        }
        if (remainingRequests <= 0 || remainingCostUsd < 0) {
          manifest = collectionRunManifestSchema.parse({ ...manifest, status: "partial", warnings: [...new Set([...manifest.warnings, "A configured item, request, or cost cap stopped collection before every query completed."])] });
          await persist();
          return { manifest, records, failures };
        }
        manifest = collectionRunManifestSchema.parse({ ...manifest, externalCallsMade: true });
        await persist();
        let page: CollectionPage | null = null;
        for (let attempt = 1; attempt <= options.batch.limits.maxAttempts; attempt += 1) {
          try {
            page = validatePage(await transport({ batch: options.batch, query, cursor, remainingItems, remainingRequests: options.batch.limits.maxRequests - manifest.requestCount, remainingCostUsd, environment: options.environment ?? process.env, processedParentIds: manifest.processedParentIds, forbidNewProviderRun: Boolean(options.recoveryOnlyQueryId) }));
            break;
          } catch (error) {
            const requestsMade = error && typeof error === "object" && "requestsMade" in error && Number.isSafeInteger(error.requestsMade) ? Number(error.requestsMade) : 1;
            manifest = collectionRunManifestSchema.parse({ ...manifest, requestCount: manifest.requestCount + requestsMade });
            await persist();
            const category = categorizeProviderFailure(error);
            if (attempt === options.batch.limits.maxAttempts || !["rate_limit", "transient"].includes(category) || manifest.requestCount >= options.batch.limits.maxRequests) throw error;
          }
        }
        if (!page) throw new Error("Collection transport exhausted retries without a result.");
        if (manifest.requestCount + page.requestCount > options.batch.limits.maxRequests) throw new Error("Transport exceeded the configured request cap.");
        if (manifest.costUsd + page.costUsd > options.batch.limits.maxCostUsd + Number.EPSILON) throw new Error("Transport exceeded the configured cost cap.");
        const limitedItems = page.items.slice(0, remainingItems);
        for (const item of limitedItems) {
          try {
            const mapped = mapLiveProviderItem({ batch: options.batch, queryId: query.queryId, item, collectedAt: now() });
            const existingIndex = records.findIndex((record) => record.rawId === mapped.rawId);
            if (existingIndex >= 0) {
              const prior = records[existingIndex];
              if (prior) records[existingIndex] = rawEvidenceSchema.parse({ ...prior, queryIds: [...new Set([...prior.queryIds, query.queryId])].sort() });
            } else records.push(mapped);
          } catch (error) {
            failures.push(failureFor({ batchId: options.batch.batchId, queryId: query.queryId, error, occurredAt: now() }));
          }
        }
        for (const rejected of page.rejectedItems ?? []) {
          failures.push(rejectedItemFailure({ batchId: options.batch.batchId, queryId: query.queryId, code: rejected.code, message: rejected.message, occurredAt: now() }));
        }
        const queryPageCount = (manifest.queryPageCounts[query.queryId] ?? 0) + (page.checkpointOnly ? 0 : 1);
        const queryItemsAfterPage = records.filter((record) => record.queryIds.includes(query.queryId)).length;
        const stoppedByQueryCap = !page.checkpointOnly && (queryPageCount >= maxPagesPerQuery || queryItemsAfterPage >= maxItemsPerQuery);
        cursor = stoppedByQueryCap ? null : page.nextCursor;
        const previousDiagnostics = manifest.queryDiagnostics[query.queryId] ?? { searchedVideos: 0, eligibleVideos: 0, skippedVideos: 0, processedVideos: 0, videosWithComments: 0 };
        const pageDiagnostics = page.diagnostics;
        manifest = collectionRunManifestSchema.parse({
          ...manifest,
          requestCount: manifest.requestCount + page.requestCount,
          costUsd: roundCost(manifest.costUsd + page.costUsd),
          queryCursors: { ...manifest.queryCursors, [query.queryId]: cursor },
          queryPageCounts: { ...manifest.queryPageCounts, [query.queryId]: queryPageCount },
          processedParentIds: [...new Set([
            ...manifest.processedParentIds,
            ...(page.processedParentIds ?? []),
            ...(pageDiagnostics?.processedParentIds ?? []),
          ])].sort(),
          queryDiagnostics: pageDiagnostics ? {
            ...manifest.queryDiagnostics,
            [query.queryId]: {
              searchedVideos: previousDiagnostics.searchedVideos + pageDiagnostics.searchedVideos,
              eligibleVideos: previousDiagnostics.eligibleVideos + pageDiagnostics.eligibleVideos,
              skippedVideos: previousDiagnostics.skippedVideos + pageDiagnostics.skippedVideos,
              processedVideos: previousDiagnostics.processedVideos + pageDiagnostics.processedVideos,
              videosWithComments: previousDiagnostics.videosWithComments + pageDiagnostics.videosWithComments,
            },
          } : manifest.queryDiagnostics,
          providerRunIds: page.providerRunId ? [...new Set([...manifest.providerRunIds, page.providerRunId])] : manifest.providerRunIds,
          warnings: [...new Set([...manifest.warnings, ...page.warnings, ...(stoppedByQueryCap && page.nextCursor ? [`Query ${query.queryId} stopped at its configured item or page cap before source pagination was exhausted.`] : [])])],
        });
        if (cursor === null) manifest = collectionRunManifestSchema.parse({ ...manifest, completedQueryIds: [...new Set([...manifest.completedQueryIds, query.queryId])].sort() });
        await persist();
      } while (cursor !== null);
      if (options.recoveryOnlyQueryId) {
        manifest = collectionRunManifestSchema.parse({
          ...manifest,
          status: "partial",
          completedAt: now(),
          warnings: [...new Set([...manifest.warnings, `Recovery-only execution completed query ${query.queryId} and stopped before starting another provider run.`])],
        });
        await persist();
        return { manifest, records, failures };
      }
    }
    manifest = collectionRunManifestSchema.parse({ ...manifest, status: "completed", completedAt: now() });
    await persist();
    return { manifest, records, failures };
  } catch (error) {
    failures.push(failureFor({ batchId: options.batch.batchId, queryId: null, error, occurredAt: now() }));
    manifest = collectionRunManifestSchema.parse({ ...manifest, status: records.length ? "partial" : "failed", completedAt: now() });
    await persist();
    throw error;
  }
}
