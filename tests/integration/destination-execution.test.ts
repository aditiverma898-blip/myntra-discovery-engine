import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runExternalCollection } from "../../data-pipeline/collection/runner";
import type { CollectionPage, LiveProviderItem } from "../../data-pipeline/collection/contracts";
import { createDestinationCollectionPlan } from "../../data-pipeline/collection/plan";
import { writeTextAtomically } from "../../data-pipeline/io/atomic";
import { readJsonLines, serializeJsonLines } from "../../data-pipeline/io/jsonl";
import { runOfflinePipeline } from "../../data-pipeline/orchestration/offline-pipeline";
import { runExternalAiJob } from "../../data-pipeline/providers/external-ai-runner";
import { buildRealRelease } from "../../data-pipeline/release/build-real-release";
import { promoteValidatedRelease } from "../../data-pipeline/release/validate-release";
import { normalizeRecords } from "../../data-pipeline/stages/normalize";
import { collectApifyPage } from "../../data-pipeline/transports/apify-actor";
import { collectYouTubePage } from "../../data-pipeline/transports/youtube-data-api";
import { aiProviderApprovalSchema, classificationJobSchema } from "../../src/lib/schemas/ai-run";
import { collectionBatchSchema, sourceApprovalSchema } from "../../src/lib/schemas/collection";
import { evidenceClassificationSchema, normalizedEvidenceSchema, rawEvidenceSchema, type EvidenceClassification, type NormalizedEvidence, type RawEvidence } from "../../src/lib/schemas/pipeline";
import { releaseBuildConfigSchema } from "../../src/lib/schemas/release-build";

const NOW = "2026-08-22T00:00:00.000Z";

function apifyBatch() {
  return collectionBatchSchema.parse({
    schemaVersion: "1.0.0", batchId: "product-review-sample-001", datasetVersion: "myntra-candidate-001", source: "myntra_product_review", approvalId: "product-review-approved-001",
    routeConfig: { route: "apify_actor", actorId: "owner~actor", build: "reviewed-v1", inputTemplate: { query: "{{query}}", maxItems: "{{maxItems}}" }, fieldMapping: { id: "reviewId", parentId: null, url: "url", title: "title", text: "text", publishedAt: "publishedAt", rating: "rating", language: "language" }, timeoutSeconds: 600 },
    queries: [{ queryId: "myntra-fit", text: "Myntra wishlist fit review" }], limits: { maxItems: 10, maxRequests: 10, maxCostUsd: 2, maxAttempts: 2 }, outputPath: "data/raw/google-play-sample-001", quarantinePath: "data/intermediate/quarantine/google-play-sample-001", rawRetentionDays: 2,
  });
}

function sourceApproval() {
  return sourceApprovalSchema.parse({ schemaVersion: "1.0.0", approvalId: "product-review-approved-001", source: "myntra_product_review", status: "approved", route: "apify_actor", provider: "Reviewed Apify actor", routeIdentifier: "owner~actor", reviewedAt: NOW, expiresAt: "2026-09-22T00:00:00.000Z", termsUrls: ["https://docs.apify.com/api/v2"], allowedHosts: ["api.apify.com"], aiProcessingAllowed: false, maxItems: 100, maxRequests: 100, maxCostUsd: 5, rawRetentionDays: 2, notes: ["Synthetic test approval only."] });
}

function item(id: string): LiveProviderItem {
  return { id, parentId: null, url: `https://play.google.com/store/apps/details?id=myntra&reviewId=${id}`, title: "Myntra review", text: "I revisited my Myntra wishlist but need more size confidence.", publishedAt: NOW, rating: 3, language: "en", resultPosition: 1, metadata: { providerPage: 1, author: "must-not-pass" } };
}

function realRaw(id: string): RawEvidence {
  return rawEvidenceSchema.parse({ schemaVersion: "1.0.0", synthetic: false, scenarioId: null, rawId: `raw-${id}`, collectionRunId: "real-batch-001", source: "google_play", sourceItemType: "review", sourceItemId: id, parentSourceItemId: null, canonicalUrl: `https://play.google.com/store/apps/details?id=myntra&reviewId=${id}`, sourceScope: "myntra_specific", sourceStratum: "myntra_app_or_external_feedback", selectionMethod: "keyword_query", queryIds: ["myntra-fit"], resultPosition: 1, collectedAt: NOW, publishedAt: NOW, rating: 3, title: "Myntra review", text: "I revisited my Myntra wishlist and need fit information before buying.", language: "en", region: "IN", sourceMetadata: {} });
}

function classification(record: NormalizedEvidence): EvidenceClassification {
  return evidenceClassificationSchema.parse({ schemaVersion: "1.0.0", evidenceId: record.evidenceId, relevance: "direct_wishlist", relevanceReason: "Explicit wishlist revisit and open decision.", wishlistExplicit: true, journeyStages: ["revisit", "research", "decision"], barriers: ["fit_size_uncertainty"], primaryBarrier: "fit_size_uncertainty", themeIds: ["fit-confidence"], segmentIds: ["active-confidence-seeker"], workarounds: [], desiredOutcomes: ["buy_with_confidence"], explicitAction: "research", severity: 2, monetaryDependency: 0, nonMonetarySolvability: 3, contradictoryOrPositive: false, method: "model", modelId: "mocked-destination-provider", promptVersion: "test-v1", taxonomyVersion: "candidate-v1", confidence: 0.9, confidenceReason: "Mocked structured response.", classifiedAt: NOW, humanReviewStatus: "unreviewed" });
}

describe("operator-ready destination execution", () => {
  it("keeps the dry-run sanitized and blocks transport construction before double opt-in", async () => {
    const batch = apifyBatch();
    const approval = sourceApproval();
    const plan = createDestinationCollectionPlan({ batch, approval, environment: { ALLOW_EXTERNAL_CALLS: "false", APIFY_TOKEN: "" }, now: new Date(NOW) });
    expect(plan.externalExecutionPerformed).toBe(false);
    expect(plan.blockedReasons).toEqual(expect.arrayContaining(["External calls are disabled.", "Required destination credential is absent."]));
    expect(JSON.stringify(plan)).not.toContain("APIFY_TOKEN");
    const factory = vi.fn();
    await expect(runExternalCollection({ workspaceRoot: await mkdtemp(path.join(os.tmpdir(), "myntra-denied-")), batch, approval, environment: { ALLOW_EXTERNAL_CALLS: "false", APIFY_TOKEN: "secret" }, argv: ["--allow-external"], transportFactory: factory, now: () => NOW })).rejects.toMatchObject({ code: "EXTERNAL_CALLS_DISABLED" });
    expect(factory).not.toHaveBeenCalled();
  });

  it("checkpoints mocked pages and creates non-synthetic minimized-provenance raw records", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-live-run-"));
    let pages = 0;
    const result = await runExternalCollection({
      workspaceRoot: root, batch: apifyBatch(), approval: sourceApproval(), environment: { ALLOW_EXTERNAL_CALLS: "true", APIFY_TOKEN: "mock-secret" }, argv: ["--allow-external"], now: () => NOW,
      transportFactory: async () => async (): Promise<CollectionPage> => { pages += 1; return pages === 1 ? { items: [item("one")], nextCursor: "next", requestCount: 1, costUsd: 0.1, providerRunId: "actor-run-1", warnings: [] } : { items: [item("one"), item("two")], nextCursor: null, requestCount: 1, costUsd: 0.1, providerRunId: "actor-run-1", warnings: [] }; },
    });
    expect(result.manifest).toMatchObject({ status: "completed", externalCallsMade: true, requestCount: 2, costUsd: 0.2 });
    expect(result.records).toHaveLength(2);
    expect(result.records.every((record) => !record.synthetic && record.scenarioId === null)).toBe(true);
    expect(result.records[0]?.sourceMetadata).not.toHaveProperty("author");
    expect(JSON.stringify(result.manifest)).not.toContain("mock-secret");
  });

  it("enforces per-query item and page caps so one query cannot dominate a bounded sample", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-query-caps-"));
    const batch = collectionBatchSchema.parse({
      ...apifyBatch(),
      batchId: "query-balanced-sample-001",
      queries: [
        { queryId: "myntra-broad", text: "Myntra review haul" },
        { queryId: "myntra-fit", text: "Myntra size fit review" },
      ],
      limits: { maxItems: 4, maxItemsPerQuery: 2, maxPagesPerQuery: 1, maxRequests: 4, maxCostUsd: 2, maxAttempts: 2 },
      outputPath: "data/raw/query-balanced-sample-001",
      quarantinePath: "data/intermediate/quarantine/query-balanced-sample-001",
    });
    const result = await runExternalCollection({
      workspaceRoot: root,
      batch,
      approval: sourceApproval(),
      environment: { ALLOW_EXTERNAL_CALLS: "true", APIFY_TOKEN: "mock-secret" },
      argv: ["--allow-external"],
      now: () => NOW,
      transportFactory: async () => async (request): Promise<CollectionPage> => ({
        items: [item(`${request.query.queryId}-one`), item(`${request.query.queryId}-two`)],
        nextCursor: "source-has-more",
        requestCount: 1,
        costUsd: 0,
        providerRunId: null,
        warnings: [],
      }),
    });

    expect(result.manifest.status).toBe("completed");
    expect(result.manifest.queryPageCounts).toEqual({ "myntra-broad": 1, "myntra-fit": 1 });
    expect(result.records.filter((record) => record.queryIds.includes("myntra-broad"))).toHaveLength(2);
    expect(result.records.filter((record) => record.queryIds.includes("myntra-fit"))).toHaveLength(2);
    expect(result.manifest.warnings).toHaveLength(2);
  });

  it("maps official YouTube and approved Apify response shapes through injected fetch mocks", async () => {
    const youtubeBatch = collectionBatchSchema.parse({ ...apifyBatch(), batchId: "youtube-sample-001", source: "youtube", approvalId: "youtube-approved-001", routeConfig: { route: "youtube_data_api", regionCode: "IN", relevanceLanguage: "en", videosPerQueryPage: 3, commentsPerVideo: 20, order: "relevance" }, outputPath: "data/raw/youtube-sample-001", quarantinePath: "data/intermediate/quarantine/youtube-sample-001" });
    const youtubeFetch = vi.fn(async (input: URL | RequestInfo) => String(input).includes("/search") ? new Response(JSON.stringify({ items: [{ id: { videoId: "video-1" }, snippet: { title: "Myntra fit review" } }] }), { status: 200 }) : new Response(JSON.stringify({ items: [{ id: "thread-1", snippet: { videoId: "video-1", topLevelComment: { id: "comment-1", snippet: { textDisplay: "Myntra wishlist sizing was confusing", publishedAt: NOW } } } }] }), { status: 200 }));
    const youtube = await collectYouTubePage({ batch: youtubeBatch, query: youtubeBatch.queries[0]!, cursor: null, remainingItems: 10, remainingRequests: 10, remainingCostUsd: 0, environment: { YOUTUBE_API_KEY: "mock" } }, youtubeFetch as typeof fetch);
    expect(youtube).toMatchObject({ requestCount: 2, nextCursor: null });
    expect(youtube.items[0]).toMatchObject({ id: "comment-1", metadata: { videoId: "video-1" } });

    const apifyFetch = vi.fn(async (input: URL | RequestInfo) => String(input).includes("/datasets/") ? new Response(JSON.stringify([{ reviewId: "review-1", url: "https://play.google.com/store/apps/details?id=myntra", title: "Review", text: "Myntra wishlist fit", publishedAt: NOW, rating: 4, language: "en" }]), { status: 200 }) : new Response(JSON.stringify({ data: { id: "run-1", status: "SUCCEEDED", defaultDatasetId: "dataset-1", usageTotalUsd: 0.2 } }), { status: 200 }));
    const batch = apifyBatch();
    const apify = await collectApifyPage({ batch, query: batch.queries[0]!, cursor: null, remainingItems: 10, remainingRequests: 10, remainingCostUsd: 1, environment: { APIFY_TOKEN: "mock" } }, apifyFetch as typeof fetch);
    expect(apify).toMatchObject({ requestCount: 2, costUsd: 0.2, providerRunId: "run-1" });
    expect(apify.items[0]?.id).toBe("review-1");
  });

  it("persists an Apify run checkpoint, retries only polling, and counts one completed source page", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-apify-checkpoint-"));
    const batch = collectionBatchSchema.parse({
      ...apifyBatch(),
      batchId: "product-review-async-001",
      limits: { maxItems: 10, maxItemsPerQuery: 10, maxPagesPerQuery: 1, maxRequests: 10, maxCostUsd: 2, maxAttempts: 2 },
      outputPath: "data/raw/product-review-async-001",
      quarantinePath: "data/intermediate/quarantine/product-review-async-001",
    });
    let starts = 0;
    let polls = 0;
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/datasets/")) return new Response(JSON.stringify([{ reviewId: "review-async", url: "https://play.google.com/store/apps/details?id=myntra", title: "Review", text: "Myntra wishlist fit", publishedAt: NOW, rating: 4, language: "en" }]), { status: 200 });
      if (url.includes("/actor-runs/")) {
        polls += 1;
        if (polls === 1) throw new DOMException("The operation was aborted", "TimeoutError");
        return new Response(JSON.stringify({ data: { id: "run-async", status: "SUCCEEDED", defaultDatasetId: "dataset-async", usageTotalUsd: 0.2, buildNumber: "5.7.9" } }), { status: 200 });
      }
      starts += 1;
      return new Response(JSON.stringify({ data: { id: "run-async", status: "RUNNING", defaultDatasetId: "dataset-async", usageTotalUsd: 0 } }), { status: 201 });
    });

    const result = await runExternalCollection({
      workspaceRoot: root,
      batch,
      approval: sourceApproval(),
      environment: { ALLOW_EXTERNAL_CALLS: "true", APIFY_TOKEN: "mock-secret" },
      argv: ["--allow-external"],
      transportFactory: async () => (request) => collectApifyPage(request, fetchMock as typeof fetch),
      now: () => NOW,
    });

    expect(result.manifest).toMatchObject({ status: "completed", requestCount: 4, queryPageCounts: { "myntra-fit": 1 }, providerRunIds: ["run-async"] });
    expect(result.records).toHaveLength(1);
    expect(starts).toBe(1);
    expect(polls).toBe(2);
  });

  it("recovers only a checkpointed Apify query, records rejected rows, and stops before another run", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-apify-recovery-"));
    const batch = collectionBatchSchema.parse({
      ...apifyBatch(),
      batchId: "product-review-recovery-001",
      queries: [
        { queryId: "myntra-fit", text: "Myntra wishlist fit review" },
        { queryId: "myntra-quality", text: "Myntra wishlist quality review" },
      ],
      outputPath: "data/raw/product-review-recovery-001",
      quarantinePath: "data/intermediate/quarantine/product-review-recovery-001",
    });
    let initialCalls = 0;
    await expect(runExternalCollection({
      workspaceRoot: root,
      batch,
      approval: sourceApproval(),
      environment: { ALLOW_EXTERNAL_CALLS: "true", APIFY_TOKEN: "mock-secret" },
      argv: ["--allow-external"],
      now: () => NOW,
      transportFactory: async () => async (): Promise<CollectionPage> => {
        initialCalls += 1;
        if (initialCalls === 1) return { items: [], nextCursor: "saved-cursor", checkpointOnly: true, requestCount: 1, costUsd: 0.2, providerRunId: "saved-run", warnings: [] };
        throw new Error("Apify item field text is missing.");
      },
    })).rejects.toThrow("Apify item field text is missing.");

    const recoveryTransport = vi.fn(async (request): Promise<CollectionPage> => {
      expect(request.query.queryId).toBe("myntra-fit");
      expect(request.cursor).toBe("saved-cursor");
      expect(request.forbidNewProviderRun).toBe(true);
      return {
        items: [item("recovered")],
        rejectedItems: [{ code: "APIFY_ITEM_MAPPING_FAILED", message: "Apify dataset row 2 was missing a required mapped field and was skipped." }],
        nextCursor: null,
        requestCount: 2,
        costUsd: 0,
        providerRunId: "saved-run",
        warnings: ["Recovered the checkpointed dataset."],
      };
    });
    const recovered = await runExternalCollection({
      workspaceRoot: root,
      batch,
      approval: sourceApproval(),
      environment: { ALLOW_EXTERNAL_CALLS: "true", APIFY_TOKEN: "mock-secret" },
      argv: ["--allow-external"],
      now: () => NOW,
      recoveryOnlyQueryId: "myntra-fit",
      transportFactory: async () => recoveryTransport,
    });

    expect(recoveryTransport).toHaveBeenCalledOnce();
    expect(recovered.records).toHaveLength(1);
    expect(recovered.failures.map((failure) => failure.code)).toEqual(expect.arrayContaining(["Error", "APIFY_ITEM_MAPPING_FAILED"]));
    expect(recovered.manifest).toMatchObject({
      status: "partial",
      completedQueryIds: ["myntra-fit"],
      providerRunIds: ["saved-run"],
      counts: { valid: 1, quarantined: 1, failures: 2 },
    });
    expect(recovered.manifest.completedQueryIds).not.toContain("myntra-quality");
    expect(recovered.manifest.warnings).toContain("Recovery-only execution completed query myntra-fit and stopped before starting another provider run.");
  });

  it("prepares and completes a real pipeline without invoking the mock classifier", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-real-pipeline-"));
    const raw = [realRaw("one"), realRaw("two")];
    const options = { runId: "real-run-001", datasetVersion: "myntra-candidate-001", workspaceRoot: path.join(root, "data/intermediate/runs"), rawRecords: raw, mode: "real" as const, retention: { rawRetentionDeadline: "2026-08-24T00:00:00.000Z", restrictedRetentionDeadline: "2026-09-21T00:00:00.000Z", policyId: "destination-policy-v1" }, now: () => NOW };
    const prepared = await runOfflinePipeline({ ...options, stopAfterStage: "deduplicate" });
    const canonical = await readJsonLines(path.join(prepared.runDirectory, "canonical.jsonl"), normalizedEvidenceSchema);
    expect(canonical.every((record) => !record.synthetic)).toBe(true);
    const completed = await runOfflinePipeline({ ...options, classifications: canonical.map((record) => ({ ...classification(record), humanReviewStatus: "accepted" as const })) });
    expect(completed.state.mode).toBe("real");
    const dashboard = JSON.parse(await readFile(path.join(completed.runDirectory, "aggregates.json"), "utf8"));
    expect(dashboard.status).toBe("partial");
    const stored = await readJsonLines(path.join(completed.runDirectory, "classifications.jsonl"), evidenceClassificationSchema);
    expect(stored.every((value) => value.modelId === "mocked-destination-provider")).toBe(true);
    const release = await buildRealRelease({ workspaceRoot: root, config: releaseBuildConfigSchema.parse({ schemaVersion: "1.0.0", datasetVersion: "myntra-candidate-001", releasePath: "myntra-candidate-001", runDirectory: "data/intermediate/runs/real-run-001", status: "partial", generatedAt: NOW, codeCommit: null, taxonomyVersion: "candidate-v1", promptVersion: "test-v1", classifier: { provider: "mocked-test-transport", model: "mocked-destination-provider" }, embedding: null, reviewApprovalPath: null, limitations: ["Mocked real-mode contract test only."] }) });
    expect(release.manifest).toMatchObject({ status: "partial", datasetVersion: "myntra-candidate-001" });
    expect(JSON.parse(await readFile(path.join(release.releaseDirectory, "aggregates.json"), "utf8"))).toMatchObject({ status: "partial" });
    await expect(promoteValidatedRelease({ releasesRoot: path.join(root, "data/releases"), releasePath: "myntra-candidate-001" })).rejects.toThrow("Only a quality-passing ready release");
  });

  it("runs a mocked external AI job only after guards and writes resumable outputs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-ai-job-"));
    const normalized = normalizeRecords([realRaw("ai-one")]);
    await writeTextAtomically(path.join(root, "data/intermediate/canonical.jsonl"), serializeJsonLines(normalized));
    const approval = aiProviderApprovalSchema.parse({ schemaVersion: "1.0.0", approvalId: "gemini-approved-001", status: "approved", provider: "gemini", allowedHost: "generativelanguage.googleapis.com", reviewedAt: NOW, expiresAt: "2026-09-22T00:00:00.000Z", termsUrls: ["https://ai.google.dev/gemini-api/terms"], allowedModelIds: ["reviewed-model"], minimizedTextOnly: true, maxItems: 10, maxRequests: 20, maxCostUsd: 1 });
    const job = classificationJobSchema.parse({ schemaVersion: "1.0.0", kind: "classification", jobId: "classification-job-001", approvalId: approval.approvalId, modelId: "reviewed-model", inputPath: "data/intermediate/canonical.jsonl", outputPath: "data/intermediate/classification/output.jsonl", failurePath: "data/intermediate/classification/failures.jsonl", maxItems: 1, maxRequests: 3, maxCostUsd: 1, estimatedCostPerRequestUsd: 0.1, maxAttempts: 2, promptVersion: "test-v1", taxonomyVersion: "candidate-v1" });
    const factory = vi.fn(async () => async (record: NormalizedEvidence) => classification(record));
    const result = await runExternalAiJob({ workspaceRoot: root, job, approval, environment: { ALLOW_EXTERNAL_CALLS: "true", GEMINI_API_KEY: "mock-secret" }, argv: ["--allow-external"], operationFactory: factory, now: () => NOW });
    expect(factory).toHaveBeenCalledOnce();
    expect(result.manifest).toMatchObject({ status: "completed", externalCallsMade: true, requestCount: 1, succeeded: 1 });
    expect(result.outputs[0]).toMatchObject({ evidenceId: normalized[0]?.evidenceId });
    expect(JSON.stringify(result.manifest)).not.toContain("mock-secret");
  });
});
