import { createHash } from "node:crypto";

import { z } from "zod";

import type { YouTubeDiscoveryConfig, YouTubeVideoCandidate } from "../../src/lib/schemas/youtube-discovery";
import type { LiveProviderItem } from "../collection/contracts";
import { fetchJson } from "./http";

const searchResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(z.object({
    id: z.object({ videoId: z.string().min(1) }).passthrough(),
    snippet: z.object({
      title: z.string(),
      description: z.string().default(""),
      channelId: z.string().min(1),
      publishedAt: z.string().optional(),
    }).passthrough(),
  }).passthrough()),
}).passthrough();

const videosResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    contentDetails: z.object({ duration: z.string() }).passthrough(),
    statistics: z.object({ commentCount: z.string().regex(/^\d+$/u).optional() }).passthrough(),
    status: z.object({ privacyStatus: z.string(), uploadStatus: z.string().optional() }).passthrough(),
  }).passthrough()),
}).passthrough();

const commentResponseSchema = z.object({
  items: z.array(z.object({
    snippet: z.object({
      videoId: z.string().min(1),
      topLevelComment: z.object({
        id: z.string().min(1),
        snippet: z.object({ textDisplay: z.string().min(1), publishedAt: z.string().optional() }).passthrough(),
      }).passthrough(),
    }).passthrough(),
  }).passthrough()),
}).passthrough();

function normalized(value: string): string {
  return value.toLocaleLowerCase("en-IN").replace(/&(?:amp|quot|#39);/gu, " ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function matchesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(normalized(term)));
}

export function durationSeconds(value: string): number {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/u.exec(value);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 86_400 + Number(match[2] ?? 0) * 3_600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

export function scoreYouTubeCandidate(candidate: YouTubeVideoCandidate): number {
  const comments = candidate.publicCommentCount ?? 0;
  const duration = candidate.durationSeconds ?? 0;
  const researchSignals = (normalized(candidate.title).match(/\b(review|haul|size|fit|quality|fabric|material|return|refund|exchange|delivery|order|wishlist|restock|sale|compare|authenticity|finds)\b/gu) ?? []).length;
  return Math.round((Math.log10(comments + 1) * 100 + Math.min(duration, 3_600) / 60 + researchSignals * 20) * 1_000) / 1_000;
}

export function candidatePassesMetadata(candidate: YouTubeVideoCandidate, config: YouTubeDiscoveryConfig): boolean {
  return candidate.enriched && candidate.available && (candidate.durationSeconds ?? 0) >= config.eligibility.minDurationSeconds && (candidate.publicCommentCount ?? 0) >= config.eligibility.minPublicCommentCount;
}

export async function searchYouTubeDiscoveryPage(options: {
  config: YouTubeDiscoveryConfig;
  query: YouTubeDiscoveryConfig["discovery"]["queries"][number];
  pageToken: string | null;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ candidates: YouTubeVideoCandidate[]; nextPageToken: string | null; searchedCount: number; rejectedCount: number }> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: options.query.text,
    regionCode: options.config.discovery.regionCode,
    relevanceLanguage: options.config.discovery.relevanceLanguage,
    safeSearch: options.config.discovery.safeSearch,
    order: options.query.order,
    maxResults: String(options.config.discovery.resultsPerPage),
    key: options.apiKey,
  }).toString();
  if (options.config.discovery.publishedAfter) url.searchParams.set("publishedAfter", options.config.discovery.publishedAfter);
  if (options.pageToken) url.searchParams.set("pageToken", options.pageToken);
  const response = searchResponseSchema.parse(await fetchJson(options.fetchImpl ?? fetch, url));
  let rejectedCount = 0;
  const candidates = response.items.flatMap((item): YouTubeVideoCandidate[] => {
    const title = normalized(item.snippet.title);
    const context = normalized(`${item.snippet.title} ${item.snippet.description}`);
    if ((options.config.eligibility.requireMyntraInTitle && !title.includes("myntra")) || matchesAny(context, options.config.eligibility.excludeAny)) {
      rejectedCount += 1;
      return [];
    }
    return [{
      schemaVersion: "1.1.0",
      videoId: item.id.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt ?? null,
      queryIds: [options.query.queryId],
      channelKey: createHash("sha256").update(item.snippet.channelId).digest("hex").slice(0, 16),
      enriched: false,
      available: false,
      durationSeconds: null,
      publicCommentCount: null,
      selectionScore: null,
      selected: false,
    }];
  });
  return { candidates, nextPageToken: response.nextPageToken ?? null, searchedCount: response.items.length, rejectedCount };
}

export async function enrichYouTubeCandidates(options: {
  candidates: readonly YouTubeVideoCandidate[];
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<YouTubeVideoCandidate[]> {
  if (options.candidates.length < 1 || options.candidates.length > 50) throw new Error("videos.list enrichment requires 1 to 50 candidates.");
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({ part: "contentDetails,statistics,status", id: options.candidates.map((candidate) => candidate.videoId).join(","), key: options.apiKey }).toString();
  const response = videosResponseSchema.parse(await fetchJson(options.fetchImpl ?? fetch, url));
  const byId = new Map(response.items.map((item) => [item.id, item]));
  return options.candidates.map((candidate) => {
    const item = byId.get(candidate.videoId);
    const updated: YouTubeVideoCandidate = item ? {
      ...candidate,
      enriched: true,
      available: item.status.privacyStatus === "public" && (item.status.uploadStatus === undefined || item.status.uploadStatus === "processed"),
      durationSeconds: durationSeconds(item.contentDetails.duration),
      publicCommentCount: Number(item.statistics.commentCount ?? 0),
    } : { ...candidate, enriched: true, available: false, durationSeconds: 0, publicCommentCount: 0 };
    return { ...updated, selectionScore: scoreYouTubeCandidate(updated) };
  });
}

export async function collectYouTubeCandidateComments(options: {
  candidate: YouTubeVideoCandidate;
  maxResults: number;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<LiveProviderItem[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  url.search = new URLSearchParams({ part: "snippet", videoId: options.candidate.videoId, maxResults: String(options.maxResults), order: "relevance", textFormat: "plainText", key: options.apiKey }).toString();
  const response = commentResponseSchema.parse(await fetchJson(options.fetchImpl ?? fetch, url));
  return response.items.map((thread, index) => {
    const comment = thread.snippet.topLevelComment;
    return {
      id: comment.id,
      parentId: thread.snippet.videoId,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(thread.snippet.videoId)}&lc=${encodeURIComponent(comment.id)}`,
      title: options.candidate.title,
      text: comment.snippet.textDisplay,
      publishedAt: comment.snippet.publishedAt ?? null,
      rating: null,
      language: null,
      resultPosition: index + 1,
      metadata: { videoId: thread.snippet.videoId, queryRoute: "youtube_discovery_ranked_comments_v11" },
    };
  });
}
