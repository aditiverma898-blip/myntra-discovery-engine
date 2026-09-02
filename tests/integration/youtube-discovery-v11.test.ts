import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runYouTubeDiscoveryCollection, selectBalancedYouTubeCandidates } from "../../data-pipeline/collection/youtube-discovery-runner";
import { createYouTubeDiscoveryPlan, estimateYouTubeDiscoveryCapacity, validateYouTubeDiscoveryDryRun } from "../../data-pipeline/planning/youtube-discovery-plan";
import { durationSeconds, searchYouTubeDiscoveryPage } from "../../data-pipeline/transports/youtube-discovery-v11";
import { sourceApprovalSchema } from "../../src/lib/schemas/collection";
import { youtubeDiscoveryConfigSchema, youtubeVideoCandidateSchema } from "../../src/lib/schemas/youtube-discovery";

const NOW = "2026-08-22T12:00:00.000Z";

function config() {
  return youtubeDiscoveryConfigSchema.parse({
    schemaVersion: "1.1.0",
    batchId: "youtube-v11-test",
    datasetVersion: "youtube-v11-candidate",
    source: "youtube",
    approvalId: "youtube-v11-approval",
    discovery: { regionCode: "IN", relevanceLanguage: "en", safeSearch: "moderate", resultsPerPage: 2, maxPagesPerQuery: 1, queries: [{ queryId: "myntra-review", text: "Myntra review", order: "relevance" }] },
    eligibility: { requireMyntraInTitle: true, excludeAny: ["tutorial", "meesho"], minDurationSeconds: 90, minPublicCommentCount: 50, targetSelectedVideos: 2, maxVideosPerChannel: 3, commentsPerVideo: 2 },
    limits: { maxItems: 2, maxRequests: 4, maxSearchCalls: 1, maxGeneralQuotaUnits: 3, maxCostUsd: 0, maxAttempts: 2 },
    outputPath: "data/raw/youtube-v11-test",
    quarantinePath: "data/intermediate/quarantine/youtube-v11-test",
    rawRetentionDays: 30,
  });
}

function approval() {
  return sourceApprovalSchema.parse({ schemaVersion: "1.0.0", approvalId: "youtube-v11-approval", source: "youtube", status: "approved", route: "youtube_data_api", provider: "Official YouTube Data API", routeIdentifier: "youtube.googleapis.com/v3", reviewedAt: NOW, expiresAt: "2026-08-31T23:59:59.000Z", termsUrls: ["https://developers.google.com/youtube/terms/developer-policies"], allowedHosts: ["www.googleapis.com"], aiProcessingAllowed: false, maxItems: 2, maxRequests: 4, maxCostUsd: 0, rawRetentionDays: 30, notes: ["Mock-only integration approval."] });
}

function candidate(id: string, queryIds: string[], channelKey: string, score: number) {
  return youtubeVideoCandidateSchema.parse({ schemaVersion: "1.1.0", videoId: id, title: `Myntra review ${id}`, publishedAt: NOW, queryIds, channelKey, enriched: true, available: true, durationSeconds: 300, publicCommentCount: 100, selectionScore: score, selected: false });
}

describe("YouTube discovery-first v1.1", () => {
  it("models search and general quota buckets separately", () => {
    const full = youtubeDiscoveryConfigSchema.parse({ ...config(), batchId: "youtube-v11-capacity", discovery: { ...config().discovery, resultsPerPage: 50, maxPagesPerQuery: 10, queries: Array.from({ length: 10 }, (_, index) => ({ queryId: `myntra-${index}`, text: "Myntra", order: "relevance" })) }, eligibility: { ...config().eligibility, targetSelectedVideos: 600, commentsPerVideo: 50 }, limits: { ...config().limits, maxItems: 20_000, maxRequests: 850, maxSearchCalls: 100, maxGeneralQuotaUnits: 700 } });
    expect(estimateYouTubeDiscoveryCapacity(full)).toEqual({ maximumSearchCalls: 100, maximumCandidatesBeforeDeduplication: 5_000, maximumVideosListCalls: 100, maximumCommentCalls: 600, maximumTotalRequests: 800, maximumGeneralQuotaUnits: 700, maximumRawCommentCapacity: 30_000, configuredItemCap: 20_000, targetGuaranteed: false });
  });

  it("requires Myntra in the title and rejects excluded descriptions", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ items: [
      { id: { videoId: "good" }, snippet: { title: "Myntra honest review", description: "Long-form sizing", channelId: "channel-a", publishedAt: NOW } },
      { id: { videoId: "description-only" }, snippet: { title: "Honest fashion review", description: "Myntra haul", channelId: "channel-b", publishedAt: NOW } },
      { id: { videoId: "excluded" }, snippet: { title: "Myntra review", description: "Meesho comparison", channelId: "channel-c", publishedAt: NOW } },
    ] }), { status: 200 }));
    const result = await searchYouTubeDiscoveryPage({ config: config(), query: config().discovery.queries[0]!, pageToken: null, apiKey: "mock", fetchImpl: fetchImpl as typeof fetch });
    expect(result.candidates.map((value) => value.videoId)).toEqual(["good"]);
    expect(result).toMatchObject({ searchedCount: 3, rejectedCount: 2, nextPageToken: null });
  });

  it("balances query strata and enforces the hashed-channel cap", () => {
    const configured = youtubeDiscoveryConfigSchema.parse({ ...config(), discovery: { ...config().discovery, queries: [{ queryId: "myntra-a", text: "Myntra review" }, { queryId: "myntra-b", text: "Myntra haul" }] }, eligibility: { ...config().eligibility, targetSelectedVideos: 3, maxVideosPerChannel: 1 }, limits: { ...config().limits, maxSearchCalls: 2, maxRequests: 6 } });
    const selected = selectBalancedYouTubeCandidates([candidate("a1", ["myntra-a"], "a".repeat(16), 100), candidate("a2", ["myntra-a"], "a".repeat(16), 90), candidate("b1", ["myntra-b"], "b".repeat(16), 80), candidate("b2", ["myntra-b"], "c".repeat(16), 70)], configured).filter((value) => value.selected);
    expect(selected.map((value) => value.videoId).sort()).toEqual(["a1", "b1", "b2"]);
  });

  it("runs discovery, batched enrichment and comments end to end with mocked responses", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) return new Response(JSON.stringify({ items: [
        { id: { videoId: "video-1" }, snippet: { title: "Myntra fit review", description: "Honest long-form review", channelId: "channel-a", publishedAt: NOW } },
        { id: { videoId: "video-2" }, snippet: { title: "Myntra quality review", description: "Material evidence", channelId: "channel-b", publishedAt: NOW } },
      ] }), { status: 200 });
      if (url.pathname.endsWith("/videos")) return new Response(JSON.stringify({ items: [
        { id: "video-1", contentDetails: { duration: "PT8M30S" }, statistics: { commentCount: "120" }, status: { privacyStatus: "public", uploadStatus: "processed" } },
        { id: "video-2", contentDetails: { duration: "PT3M" }, statistics: { commentCount: "80" }, status: { privacyStatus: "public", uploadStatus: "processed" } },
      ] }), { status: 200 });
      const videoId = url.searchParams.get("videoId");
      return new Response(JSON.stringify({ items: [
        { snippet: { videoId, topLevelComment: { id: `${videoId}-comment-1`, snippet: { textDisplay: "What size should I order?", publishedAt: NOW } } } },
        { snippet: { videoId, topLevelComment: { id: `${videoId}-comment-2`, snippet: { textDisplay: "The material quality looks useful.", publishedAt: NOW } } } },
      ] }), { status: 200 });
    });
    const root = await mkdtemp(path.join(os.tmpdir(), "youtube-v11-run-"));
    const result = await runYouTubeDiscoveryCollection({ workspaceRoot: root, config: config(), approval: approval(), environment: { ALLOW_EXTERNAL_CALLS: "true", YOUTUBE_API_KEY: "mock-key" }, argv: ["--allow-external"], fetchImpl: fetchImpl as typeof fetch, now: () => NOW });
    expect(result.manifest).toMatchObject({ status: "completed", stage: "completed", requestCount: 3, quotaUsage: { searchCalls: 1, generalUnits: 2, videosListCalls: 1, commentCalls: 1 }, counts: { uniqueCandidates: 2, selectedVideos: 2, processedVideos: 1, received: 2, valid: 2, failures: 0 } });
    expect(result.records).toHaveLength(2);
    expect(result.records.every((record) => record.language === null && record.parentSourceItemId === record.sourceMetadata.videoId)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("mock-key");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("produces an exact no-call plan gate and parses ISO 8601 durations", () => {
    const plan = createYouTubeDiscoveryPlan({ config: config(), approval: approval(), environment: { ALLOW_EXTERNAL_CALLS: "false", YOUTUBE_API_KEY: "present" }, now: new Date(NOW) });
    expect(() => validateYouTubeDiscoveryDryRun(plan, config())).not.toThrow();
    expect(plan.capacity).toMatchObject({ maximumSearchCalls: 1, maximumVideosListCalls: 1, maximumCommentCalls: 2, maximumTotalRequests: 4 });
    expect(durationSeconds("P1DT2H3M4S")).toBe(93_784);
  });
});
