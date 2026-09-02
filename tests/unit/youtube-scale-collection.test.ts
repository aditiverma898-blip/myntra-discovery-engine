import { describe, expect, it, vi } from "vitest";

import { estimateYouTubeCapacity } from "../../data-pipeline/planning/youtube-capacity";
import { collectYouTubePage } from "../../data-pipeline/transports/youtube-data-api";
import { evaluateYouTubeVideoEligibility } from "../../data-pipeline/transports/youtube-video-eligibility";
import { collectionBatchSchema } from "../../src/lib/schemas/collection";

function scaleBatch() {
  return collectionBatchSchema.parse({
    schemaVersion: "1.0.0",
    batchId: "youtube-myntra-20k",
    datasetVersion: "myntra-youtube-candidate-001",
    source: "youtube",
    approvalId: "youtube-official-20k",
    routeConfig: {
      route: "youtube_data_api",
      regionCode: "IN",
      relevanceLanguage: "en",
      collectionStrategy: "video_balanced_v2",
      videosPerQueryPage: 10,
      searchResultsPerPage: 50,
      eligibleVideosPerQueryPage: 20,
      commentsPerVideo: 20,
      order: "relevance",
      commentOrder: "relevance",
      safeSearch: "moderate",
      videoEligibility: {
        requireMyntraTerm: true,
        includeAny: ["wishlist", "review", "size", "fit", "quality", "return"],
        excludeAny: ["tutorial", "meesho", "ai tool"],
      },
    },
    queries: Array.from({ length: 10 }, (_, index) => ({ queryId: `myntra-topic-${index + 1}`, text: "Myntra review", videoEligibility: { includeAny: ["review"], excludeAny: [] } })),
    limits: { maxItems: 20_000, maxItemsPerQuery: 2_000, maxPagesPerQuery: 5, maxRequests: 1_100, maxCostUsd: 0, maxAttempts: 2 },
    outputPath: "data/raw/youtube-myntra-20k",
    quarantinePath: "data/intermediate/quarantine/youtube-myntra-20k",
    rawRetentionDays: 30,
  });
}

describe("YouTube video-balanced scale collection", () => {
  it("computes a 20K theoretical ceiling across separate search and general quota buckets", () => {
    expect(estimateYouTubeCapacity(scaleBatch())).toMatchObject({
      maximumSearchCalls: 50,
      maximumEligibleVideos: 1_000,
      maximumCommentCalls: 1_000,
      maximumHttpRequests: 1_050,
      maximumGeneralQuotaUnits: 1_000,
      maximumRawRecords: 20_000,
      isRecordTargetGuaranteed: false,
      warnings: [],
    });
  });

  it("keeps only Myntra research videos and rejects tutorials and competitor comparisons", () => {
    const batch = scaleBatch();
    const route = batch.routeConfig;
    if (route.route !== "youtube_data_api") throw new Error("Unexpected route");
    const query = batch.queries[0]!;
    expect(evaluateYouTubeVideoEligibility({ title: "Myntra size and fit review", description: "What I bought", query, route }).eligible).toBe(true);
    expect(evaluateYouTubeVideoEligibility({ title: "Myntra size and fit", description: "haul", query, route }).eligible).toBe(false);
    expect(evaluateYouTubeVideoEligibility({ title: "Myntra app tutorial", description: "How to change settings", query, route }).eligible).toBe(false);
    expect(evaluateYouTubeVideoEligibility({ title: "Meesho vs Myntra review", description: "comparison", query, route }).eligible).toBe(false);
    expect(evaluateYouTubeVideoEligibility({ title: "Summer fashion review", description: "no brand", query, route }).eligible).toBe(false);
  });

  it("over-fetches candidates, avoids previously processed videos, and stores correct minimized provenance", async () => {
    const batch = scaleBatch();
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) {
        expect(url.searchParams.get("maxResults")).toBe("50");
        return new Response(JSON.stringify({ items: [
          { id: { videoId: "seen-video" }, snippet: { title: "Myntra review", description: "review" } },
          { id: { videoId: "tutorial-video" }, snippet: { title: "Myntra tutorial", description: "settings" } },
          { id: { videoId: "eligible-video" }, snippet: { title: "Myntra review", description: "fit review" } },
        ] }), { status: 200 });
      }
      expect(url.searchParams.get("videoId")).toBe("eligible-video");
      return new Response(JSON.stringify({ items: [{ id: "thread-1", snippet: { videoId: "eligible-video", topLevelComment: { id: "comment-1", snippet: { textDisplay: "The size review helped my decision.", publishedAt: "2026-08-22T00:00:00.000Z" } } } }] }), { status: 200 });
    });
    const page = await collectYouTubePage({ batch, query: batch.queries[0]!, cursor: null, remainingItems: 2_000, remainingRequests: 1_100, remainingCostUsd: 0, environment: { YOUTUBE_API_KEY: "mock" }, processedParentIds: ["seen-video"] }, fetchImpl as typeof fetch);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ parentId: "eligible-video", language: null, metadata: { videoId: "eligible-video" } });
    expect(page.diagnostics).toEqual({ searchedVideos: 3, eligibleVideos: 1, skippedVideos: 2, processedVideos: 1, videosWithComments: 1, processedParentIds: ["eligible-video"] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
