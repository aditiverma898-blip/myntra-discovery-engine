import type { CollectionBatch } from "../../src/lib/schemas/collection";

export interface YouTubeCapacityEstimate {
  strategy: "legacy" | "video_balanced_v2";
  queryCount: number;
  searchPagesPerQuery: number;
  maximumSearchCalls: number;
  maximumEligibleVideos: number;
  maximumCommentCalls: number;
  maximumHttpRequests: number;
  maximumGeneralQuotaUnits: number;
  maximumRawRecords: number;
  configuredItemCap: number;
  configuredRequestCap: number;
  isRecordTargetGuaranteed: false;
  assumptions: string[];
  warnings: string[];
}

export function estimateYouTubeCapacity(batch: CollectionBatch): YouTubeCapacityEstimate | null {
  if (batch.routeConfig.route !== "youtube_data_api") return null;
  const pages = batch.limits.maxPagesPerQuery ?? 100;
  const eligiblePerPage = batch.routeConfig.eligibleVideosPerQueryPage ?? batch.routeConfig.videosPerQueryPage;
  const searchCalls = batch.queries.length * pages;
  const eligibleVideos = searchCalls * eligiblePerPage;
  const commentCalls = eligibleVideos;
  const maximumRawRecords = eligibleVideos * batch.routeConfig.commentsPerVideo;
  const maximumHttpRequests = searchCalls + commentCalls;
  const maximumGeneralQuotaUnits = commentCalls;
  const warnings: string[] = [];
  if (maximumHttpRequests > batch.limits.maxRequests) warnings.push("The configured request cap is lower than the theoretical request requirement.");
  if (maximumRawRecords < batch.limits.maxItems) warnings.push("The page/video/comment settings cannot theoretically reach the configured item cap.");
  if (searchCalls > 100) warnings.push("The theoretical run exceeds the default daily search.list call bucket; verify the destination project's actual quota.");
  if (maximumGeneralQuotaUnits > 10_000) warnings.push("The theoretical run exceeds the default daily general YouTube API quota; verify the destination project's actual quota.");
  return {
    strategy: batch.routeConfig.collectionStrategy,
    queryCount: batch.queries.length,
    searchPagesPerQuery: pages,
    maximumSearchCalls: searchCalls,
    maximumEligibleVideos: eligibleVideos,
    maximumCommentCalls: commentCalls,
    maximumHttpRequests,
    maximumGeneralQuotaUnits,
    maximumRawRecords,
    configuredItemCap: batch.limits.maxItems,
    configuredRequestCap: batch.limits.maxRequests,
    isRecordTargetGuaranteed: false,
    assumptions: [
      "Every search page supplies the configured number of new eligible Myntra videos.",
      "Every selected video has comments enabled and supplies the configured number of top-level comments.",
      "Cross-query video/comment deduplication and source sparsity do not reduce yield.",
      "Current default quota documentation places search.list in a separate 100-calls/day bucket; commentThreads.list uses one general quota unit per call. Retries are excluded.",
    ],
    warnings,
  };
}
