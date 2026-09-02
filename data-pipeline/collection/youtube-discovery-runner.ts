import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertExternalCallsAllowed } from "../../src/lib/external-access";
import { collectionFailureSchema, type CollectionFailure, type SourceApproval } from "../../src/lib/schemas/collection";
import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";
import { youtubeDiscoveryManifestSchema, youtubeVideoCandidateSchema, type YouTubeDiscoveryConfig, type YouTubeDiscoveryManifest, type YouTubeVideoCandidate } from "../../src/lib/schemas/youtube-discovery";
import { writeJsonAtomically, writeTextAtomically } from "../io/atomic";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { createYouTubeDiscoveryPlan, validateYouTubeDiscoveryApproval } from "../planning/youtube-discovery-plan";
import { candidatePassesMetadata, collectYouTubeCandidateComments, enrichYouTubeCandidates, searchYouTubeDiscoveryPage } from "../transports/youtube-discovery-v11";
import { ExternalHttpError } from "../transports/http";
import { categorizeProviderFailure } from "../utils/execution-policy";
import { stableHash, validateRestrictedPath } from "./validation";

type FetchImpl = typeof fetch;

async function readOptionalJson<T>(file: string, parse: (value: unknown) => T): Promise<T | null> {
  try { return parse(JSON.parse(await readFile(file, "utf8")) as unknown); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function selectionOrder(candidates: readonly YouTubeVideoCandidate[], config: YouTubeDiscoveryConfig): YouTubeVideoCandidate[] {
  const eligible = candidates.filter((candidate) => candidatePassesMetadata(candidate, config)).sort((left, right) => (right.selectionScore ?? 0) - (left.selectionScore ?? 0) || left.videoId.localeCompare(right.videoId));
  const queryIds = config.discovery.queries.map((query) => query.queryId);
  const queues = new Map(queryIds.map((queryId) => [queryId, eligible.filter((candidate) => candidate.queryIds.includes(queryId))]));
  const selected: YouTubeVideoCandidate[] = [];
  const selectedIds = new Set<string>();
  const channelCounts = new Map<string, number>();
  while (selected.length < config.eligibility.targetSelectedVideos) {
    let progressed = false;
    for (const queryId of queryIds) {
      const queue = queues.get(queryId) ?? [];
      let next: YouTubeVideoCandidate | undefined;
      while ((next = queue.shift())) {
        if (selectedIds.has(next.videoId)) continue;
        if ((channelCounts.get(next.channelKey) ?? 0) >= config.eligibility.maxVideosPerChannel) continue;
        break;
      }
      if (!next) continue;
      selected.push(next);
      selectedIds.add(next.videoId);
      channelCounts.set(next.channelKey, (channelCounts.get(next.channelKey) ?? 0) + 1);
      progressed = true;
      if (selected.length >= config.eligibility.targetSelectedVideos) break;
    }
    if (!progressed) break;
  }
  return selected;
}

export function selectBalancedYouTubeCandidates(candidates: readonly YouTubeVideoCandidate[], config: YouTubeDiscoveryConfig): YouTubeVideoCandidate[] {
  const selectedIds = new Set(selectionOrder(candidates, config).map((candidate) => candidate.videoId));
  return candidates.map((candidate) => youtubeVideoCandidateSchema.parse({ ...candidate, selected: selectedIds.has(candidate.videoId) }));
}

function mapComment(config: YouTubeDiscoveryConfig, candidate: YouTubeVideoCandidate, item: Awaited<ReturnType<typeof collectYouTubeCandidateComments>>[number], collectedAt: string): RawEvidence {
  return rawEvidenceSchema.parse({
    schemaVersion: "1.0.0",
    synthetic: false,
    scenarioId: null,
    rawId: `raw-${createHash("sha256").update(`${config.batchId}:youtube:${item.id}`).digest("hex").slice(0, 20)}`,
    collectionRunId: config.batchId,
    source: "youtube",
    sourceItemType: "comment",
    sourceItemId: item.id,
    parentSourceItemId: item.parentId,
    canonicalUrl: item.url,
    sourceScope: "myntra_specific",
    sourceStratum: "myntra_app_or_external_feedback",
    selectionMethod: "video_query",
    queryIds: [...new Set(candidate.queryIds)].sort(),
    resultPosition: item.resultPosition,
    collectedAt,
    publishedAt: item.publishedAt,
    rating: null,
    title: item.title,
    text: item.text,
    language: null,
    region: "IN",
    sourceMetadata: item.metadata,
  });
}

function failureFor(config: YouTubeDiscoveryConfig, queryId: string | null, error: unknown, occurredAt: string): CollectionFailure {
  const category = categorizeProviderFailure(error);
  return collectionFailureSchema.parse({
    schemaVersion: "1.0.0",
    batchId: config.batchId,
    queryId,
    category,
    code: error instanceof Error && error.name ? error.name : "YOUTUBE_DISCOVERY_ERROR",
    message: error instanceof Error ? error.message.replace(/AIza[A-Za-z0-9_-]+/gu, "[redacted]") : "Unknown YouTube discovery failure.",
    occurredAt,
    retryable: ["rate_limit", "transient"].includes(category),
  });
}

export async function runYouTubeDiscoveryCollection(options: {
  workspaceRoot: string;
  config: YouTubeDiscoveryConfig;
  approval: SourceApproval;
  environment?: Record<string, string | undefined>;
  argv?: readonly string[];
  fetchImpl?: FetchImpl;
  now?: () => string;
}): Promise<{ manifest: YouTubeDiscoveryManifest; candidates: YouTubeVideoCandidate[]; records: RawEvidence[]; failures: CollectionFailure[] }> {
  const now = options.now ?? (() => new Date().toISOString());
  const environment = options.environment ?? process.env;
  validateYouTubeDiscoveryApproval(options.config, options.approval, new Date(now()));
  assertExternalCallsAllowed({ source: "youtube", sourceApprovalStatus: options.approval.status, maxItems: options.config.limits.maxItems, maxCost: 0, argv: options.argv, environment });
  const apiKey = environment.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YouTube API authorization credential is missing.");
  const outputDirectory = validateRestrictedPath(options.workspaceRoot, options.config.outputPath, "data/raw/");
  validateRestrictedPath(options.workspaceRoot, options.config.quarantinePath, "data/intermediate/quarantine/");
  const files = {
    manifest: path.join(outputDirectory, "run-manifest.json"),
    candidates: path.join(outputDirectory, "video-candidates.jsonl"),
    records: path.join(outputDirectory, "raw-records.jsonl"),
    failures: path.join(outputDirectory, "failures.jsonl"),
    plan: path.join(outputDirectory, "collection-plan.sanitized.json"),
  };
  const configHash = stableHash(options.config);
  const existing = await readOptionalJson(files.manifest, (value) => youtubeDiscoveryManifestSchema.parse(value));
  if (existing && existing.configHash !== configHash) throw new Error("A YouTube discovery batch cannot resume with changed configuration.");
  let candidates = existing ? await readJsonLines(files.candidates, youtubeVideoCandidateSchema) : [];
  const records = existing ? await readJsonLines(files.records, rawEvidenceSchema) : [];
  const failures = existing ? await readJsonLines(files.failures, collectionFailureSchema) : [];
  if (existing?.status === "completed") return { manifest: existing, candidates, records, failures };
  const startedAt = existing?.startedAt ?? now();
  let manifest = existing ?? youtubeDiscoveryManifestSchema.parse({
    schemaVersion: "1.1.0",
    batchId: options.config.batchId,
    datasetVersion: options.config.datasetVersion,
    approvalId: options.config.approvalId,
    configHash,
    status: "planned",
    stage: "discovery",
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    externalCallsMade: false,
    requestCount: 0,
    quotaUsage: { searchCalls: 0, generalUnits: 0, videosListCalls: 0, commentCalls: 0 },
    counts: { searchCandidates: 0, uniqueCandidates: 0, enrichedCandidates: 0, eligibleCandidates: 0, selectedVideos: 0, processedVideos: 0, videosWithComments: 0, received: 0, valid: 0, quarantined: 0, failures: 0 },
    queryCursors: {},
    queryPageCounts: {},
    completedQueryIds: [],
    completedVideoIds: [],
    outputFiles: ["collection-plan.sanitized.json", "run-manifest.json", "video-candidates.jsonl", "raw-records.jsonl", "failures.jsonl"],
    warnings: [],
    rawRetentionDeadline: new Date(new Date(startedAt).getTime() + options.config.rawRetentionDays * 86_400_000).toISOString(),
  });
  const fetchImpl = options.fetchImpl ?? fetch;

  const persist = async (): Promise<void> => {
    const eligibleCandidates = candidates.filter((candidate) => candidatePassesMetadata(candidate, options.config)).length;
    manifest = youtubeDiscoveryManifestSchema.parse({
      ...manifest,
      updatedAt: now(),
      requestCount: manifest.quotaUsage.searchCalls + manifest.quotaUsage.videosListCalls + manifest.quotaUsage.commentCalls,
      counts: {
        ...manifest.counts,
        uniqueCandidates: candidates.length,
        enrichedCandidates: candidates.filter((candidate) => candidate.enriched).length,
        eligibleCandidates,
        selectedVideos: candidates.filter((candidate) => candidate.selected).length,
        processedVideos: manifest.completedVideoIds.length,
        received: records.length + failures.length,
        valid: records.length,
        failures: failures.length,
      },
    });
    await writeJsonAtomically(files.plan, createYouTubeDiscoveryPlan({ config: options.config, approval: options.approval, environment: { ...environment, ALLOW_EXTERNAL_CALLS: "false" }, now: new Date(startedAt) }));
    await writeTextAtomically(files.candidates, serializeJsonLines(candidates));
    await writeTextAtomically(files.records, serializeJsonLines(records));
    await writeTextAtomically(files.failures, serializeJsonLines(failures));
    await writeJsonAtomically(files.manifest, manifest);
  };

  const ensureBudgets = (kind: "search" | "general"): void => {
    if (manifest.requestCount >= options.config.limits.maxRequests) throw new Error("YouTube v1.1 request cap reached.");
    if (kind === "search" && manifest.quotaUsage.searchCalls >= options.config.limits.maxSearchCalls) throw new Error("YouTube search-call cap reached.");
    if (kind === "general" && manifest.quotaUsage.generalUnits >= options.config.limits.maxGeneralQuotaUnits) throw new Error("YouTube general quota-unit cap reached.");
  };

  const callWithRetry = async <T>(kind: "search" | "videos" | "comments", queryId: string | null, operation: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= options.config.limits.maxAttempts; attempt += 1) {
      ensureBudgets(kind === "search" ? "search" : "general");
      manifest = youtubeDiscoveryManifestSchema.parse({
        ...manifest,
        externalCallsMade: true,
        quotaUsage: {
          ...manifest.quotaUsage,
          searchCalls: manifest.quotaUsage.searchCalls + (kind === "search" ? 1 : 0),
          generalUnits: manifest.quotaUsage.generalUnits + (kind === "search" ? 0 : 1),
          videosListCalls: manifest.quotaUsage.videosListCalls + (kind === "videos" ? 1 : 0),
          commentCalls: manifest.quotaUsage.commentCalls + (kind === "comments" ? 1 : 0),
        },
      });
      await persist();
      try { return await operation(); }
      catch (error) {
        lastError = error;
        const category = categorizeProviderFailure(error);
        if (attempt === options.config.limits.maxAttempts || !["rate_limit", "transient"].includes(category)) break;
      }
    }
    throw lastError ?? new Error(`YouTube ${kind} call failed.`);
  };

  try {
    manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, status: "running" });
    await persist();
    if (manifest.stage === "discovery") {
      for (const query of options.config.discovery.queries) {
        if (manifest.completedQueryIds.includes(query.queryId)) continue;
        let cursor = manifest.queryCursors[query.queryId] ?? null;
        do {
          const pageCount = manifest.queryPageCounts[query.queryId] ?? 0;
          if (pageCount >= options.config.discovery.maxPagesPerQuery) break;
          const page = await callWithRetry("search", query.queryId, () => searchYouTubeDiscoveryPage({ config: options.config, query, pageToken: cursor, apiKey, fetchImpl }));
          manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, counts: { ...manifest.counts, searchCandidates: manifest.counts.searchCandidates + page.searchedCount }, warnings: page.rejectedCount ? [...new Set([...manifest.warnings, `Query ${query.queryId} rejected ${page.rejectedCount} non-Myntra or excluded candidate(s).`])] : manifest.warnings });
          const byId = new Map(candidates.map((candidate) => [candidate.videoId, candidate]));
          for (const candidate of page.candidates) {
            const prior = byId.get(candidate.videoId);
            byId.set(candidate.videoId, prior ? youtubeVideoCandidateSchema.parse({ ...prior, queryIds: [...new Set([...prior.queryIds, ...candidate.queryIds])].sort() }) : youtubeVideoCandidateSchema.parse(candidate));
          }
          candidates = [...byId.values()].sort((left, right) => left.videoId.localeCompare(right.videoId));
          const nextPageCount = pageCount + 1;
          cursor = nextPageCount >= options.config.discovery.maxPagesPerQuery ? null : page.nextPageToken;
          manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, queryCursors: { ...manifest.queryCursors, [query.queryId]: cursor }, queryPageCounts: { ...manifest.queryPageCounts, [query.queryId]: nextPageCount } });
          await persist();
        } while (cursor !== null);
        manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, completedQueryIds: [...new Set([...manifest.completedQueryIds, query.queryId])].sort(), queryCursors: { ...manifest.queryCursors, [query.queryId]: null } });
        await persist();
      }
      manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, stage: "enrichment" });
      await persist();
    }

    if (manifest.stage === "enrichment") {
      while (candidates.some((candidate) => !candidate.enriched)) {
        const batch = candidates.filter((candidate) => !candidate.enriched).slice(0, 50);
        const enriched = await callWithRetry("videos", null, () => enrichYouTubeCandidates({ candidates: batch, apiKey, fetchImpl }));
        const replacements = new Map(enriched.map((candidate) => [candidate.videoId, candidate]));
        candidates = candidates.map((candidate) => replacements.get(candidate.videoId) ?? candidate);
        await persist();
      }
      manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, stage: "selection" });
      await persist();
    }

    if (manifest.stage === "selection") {
      candidates = selectBalancedYouTubeCandidates(candidates, options.config);
      if (!candidates.some((candidate) => candidate.selected)) throw new Error("No enriched video met the v1.1 selection requirements.");
      manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, stage: "comments" });
      await persist();
    }

    if (manifest.stage === "comments") {
      for (const candidate of selectionOrder(candidates, options.config)) {
        if (manifest.completedVideoIds.includes(candidate.videoId)) continue;
        if (records.length >= options.config.limits.maxItems) break;
        let comments: Awaited<ReturnType<typeof collectYouTubeCandidateComments>> = [];
        try {
          comments = await callWithRetry("comments", null, () => collectYouTubeCandidateComments({ candidate, maxResults: Math.min(options.config.eligibility.commentsPerVideo, options.config.limits.maxItems - records.length), apiKey, fetchImpl }));
        } catch (error) {
          if (error instanceof ExternalHttpError && error.message.includes("commentsDisabled")) manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, warnings: [...new Set([...manifest.warnings, `Comments disabled for selected video ${candidate.videoId}.`])] });
          else throw error;
        }
        const existingIds = new Set(records.map((record) => record.sourceItemId));
        for (const item of comments) {
          if (!existingIds.has(item.id)) { records.push(mapComment(options.config, candidate, item, now())); existingIds.add(item.id); }
        }
        manifest = youtubeDiscoveryManifestSchema.parse({
          ...manifest,
          completedVideoIds: [...new Set([...manifest.completedVideoIds, candidate.videoId])].sort(),
          counts: { ...manifest.counts, videosWithComments: manifest.counts.videosWithComments + (comments.length > 0 ? 1 : 0) },
        });
        await persist();
      }
    }
    const targetReached = records.length >= options.config.limits.maxItems;
    const selectedExhausted = candidates.filter((candidate) => candidate.selected).every((candidate) => manifest.completedVideoIds.includes(candidate.videoId));
    const warnings = !targetReached && selectedExhausted ? [...new Set([...manifest.warnings, `Selected video pool was exhausted at ${records.length} records before the ${options.config.limits.maxItems} target.`])] : manifest.warnings;
    manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, stage: "completed", status: targetReached ? "completed" : "partial", completedAt: now(), warnings });
    await persist();
    return { manifest, candidates, records, failures };
  } catch (error) {
    failures.push(failureFor(options.config, null, error, now()));
    manifest = youtubeDiscoveryManifestSchema.parse({ ...manifest, status: records.length ? "partial" : "failed", completedAt: now() });
    await persist();
    throw error;
  }
}
