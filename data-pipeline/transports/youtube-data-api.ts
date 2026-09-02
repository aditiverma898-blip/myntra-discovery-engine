import { z } from "zod";

import type { CollectionPage, CollectionPageRequest, LiveProviderItem } from "../collection/contracts";
import { ExternalHttpError, fetchJson } from "./http";
import { evaluateYouTubeVideoEligibility } from "./youtube-video-eligibility";

const searchResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(z.object({
    id: z.object({ videoId: z.string().min(1) }).passthrough(),
    snippet: z.object({ title: z.string(), description: z.string().default(""), publishedAt: z.string().optional() }).passthrough(),
  }).passthrough()),
}).passthrough();

const commentResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    snippet: z.object({
      videoId: z.string().min(1),
      topLevelComment: z.object({
        id: z.string().min(1),
        snippet: z.object({ textDisplay: z.string().min(1), publishedAt: z.string().optional() }).passthrough(),
      }).passthrough(),
    }).passthrough(),
  }).passthrough()),
}).passthrough();

function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { searchPageToken?: unknown };
  if (typeof parsed.searchPageToken !== "string") throw new Error("Invalid YouTube resume cursor.");
  return parsed.searchPageToken;
}

function encodeCursor(searchPageToken: string | undefined): string | null {
  return searchPageToken ? Buffer.from(JSON.stringify({ searchPageToken }), "utf8").toString("base64url") : null;
}

export async function collectYouTubePage(request: CollectionPageRequest, fetchImpl: typeof fetch = fetch): Promise<CollectionPage> {
  if (request.batch.routeConfig.route !== "youtube_data_api") throw new Error("YouTube transport received a non-YouTube route.");
  const route = request.batch.routeConfig;
  const key = request.environment.YOUTUBE_API_KEY;
  if (!key) throw new Error("YouTube API authorization credential is missing.");
  if (request.remainingRequests < 2) throw new Error("At least two remaining requests are required for a YouTube search/comment page.");
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  const candidateLimit = route.searchResultsPerPage ?? route.videosPerQueryPage;
  const eligibleVideoLimit = route.eligibleVideosPerQueryPage ?? route.videosPerQueryPage;
  searchUrl.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: request.query.text,
    regionCode: route.regionCode,
    relevanceLanguage: route.relevanceLanguage,
    order: request.query.searchOrder ?? route.order,
    safeSearch: route.safeSearch,
    maxResults: String(candidateLimit),
    key,
  }).toString();
  if (route.publishedAfter) searchUrl.searchParams.set("publishedAfter", route.publishedAfter);
  const pageToken = decodeCursor(request.cursor);
  if (pageToken) searchUrl.searchParams.set("pageToken", pageToken);
  const search = searchResponseSchema.parse(await fetchJson(fetchImpl, searchUrl));
  let requestCount = 1;
  const warnings: string[] = [];
  const items: LiveProviderItem[] = [];
  const alreadyProcessed = new Set(request.processedParentIds ?? []);
  const skippedReasonCounts = new Map<string, number>();
  const eligibleVideos = search.items.filter((video) => {
    if (alreadyProcessed.has(video.id.videoId)) {
      skippedReasonCounts.set("already_processed", (skippedReasonCounts.get("already_processed") ?? 0) + 1);
      return false;
    }
    const decision = evaluateYouTubeVideoEligibility({ title: video.snippet.title, description: video.snippet.description, query: request.query, route });
    for (const reason of decision.reasons) skippedReasonCounts.set(reason, (skippedReasonCounts.get(reason) ?? 0) + 1);
    return decision.eligible;
  }).slice(0, eligibleVideoLimit);
  const processedParentIds: string[] = [];
  let videosWithComments = 0;
  for (const video of eligibleVideos) {
    if (requestCount >= request.remainingRequests || items.length >= request.remainingItems) break;
    const commentUrl = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
    commentUrl.search = new URLSearchParams({ part: "snippet", videoId: video.id.videoId, maxResults: String(Math.min(route.commentsPerVideo, request.remainingItems - items.length)), order: request.query.commentOrder ?? route.commentOrder, textFormat: "plainText", key }).toString();
    requestCount += 1;
    processedParentIds.push(video.id.videoId);
    try {
      const comments = commentResponseSchema.parse(await fetchJson(fetchImpl, commentUrl));
      if (comments.items.length > 0) videosWithComments += 1;
      for (const thread of comments.items) {
        const comment = thread.snippet.topLevelComment;
        items.push({
          id: comment.id,
          parentId: thread.snippet.videoId,
          url: `https://www.youtube.com/watch?v=${encodeURIComponent(thread.snippet.videoId)}&lc=${encodeURIComponent(comment.id)}`,
          title: video.snippet.title,
          text: comment.snippet.textDisplay,
          publishedAt: comment.snippet.publishedAt ?? null,
          rating: null,
          language: null,
          resultPosition: items.length + 1,
          metadata: { videoId: thread.snippet.videoId, queryRoute: "youtube_search_comments" },
        });
        if (items.length >= request.remainingItems) break;
      }
    } catch (error) {
      if (error instanceof ExternalHttpError && error.message.includes("commentsDisabled")) warnings.push("Comments were disabled for one selected video.");
      else if (error instanceof ExternalHttpError) throw new ExternalHttpError(error.status, error.message, requestCount);
      else throw error;
    }
  }
  for (const [reason, count] of skippedReasonCounts) warnings.push(`YouTube candidate filter skipped ${count} video(s): ${reason}.`);
  return {
    items,
    nextCursor: encodeCursor(search.nextPageToken),
    requestCount,
    costUsd: 0,
    providerRunId: null,
    warnings,
    diagnostics: {
      searchedVideos: search.items.length,
      eligibleVideos: eligibleVideos.length,
      skippedVideos: search.items.length - eligibleVideos.length,
      processedVideos: processedParentIds.length,
      videosWithComments,
      processedParentIds,
    },
  };
}
