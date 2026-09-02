import { z } from "zod";

import { sourceIdSchema } from "./release";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const finiteLimitSchema = z.number().int().positive();

export const externalRouteSchema = z.enum([
  "youtube_data_api",
  "google_play_scraper",
  "apple_public_reviews",
  "reddit_oauth_api",
  "apify_actor",
]);

export const sourceApprovalSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  approvalId: slugSchema,
  source: sourceIdSchema.exclude(["community"]),
  status: z.enum(["approved", "disabled", "rejected"]),
  route: externalRouteSchema,
  provider: z.string().min(1),
  routeIdentifier: z.string().min(1),
  authorizationReference: z.string().trim().min(1).nullable().optional(),
  reviewedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  termsUrls: z.array(z.url()).min(1),
  allowedHosts: z.array(z.string().regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/iu)).min(1),
  aiProcessingAllowed: z.boolean(),
  maxItems: finiteLimitSchema.max(22_000),
  maxRequests: finiteLimitSchema,
  maxCostUsd: z.number().finite().nonnegative(),
  rawRetentionDays: finiteLimitSchema.max(30),
  notes: z.array(z.string().min(1)),
}).strict();

const querySchema = z.object({
  queryId: slugSchema,
  text: z.string().trim().min(1).max(300),
  searchOrder: z.enum(["relevance", "date"]).optional(),
  commentOrder: z.enum(["relevance", "time"]).optional(),
  videoEligibility: z.object({
    includeAny: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
    excludeAny: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  }).strict().optional(),
  storeReviewFilters: z.object({
    country: z.string().regex(/^[A-Z]{2}$/u),
    language: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/u).optional(),
    sort: z.enum(["newest", "rating", "helpfulness", "recent", "most_helpful"]),
    ratings: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional(),
    skipPages: z.number().int().min(0).max(99).optional(),
  }).strict().optional(),
  redditFilters: z.object({
    subreddit: z.string().regex(/^[A-Za-z0-9_]{2,21}$/u),
    sort: z.enum(["relevance", "new", "top", "comments"]),
    time: z.enum(["all", "year", "month", "week"]),
    commentsPerPost: z.number().int().min(0).max(100),
    commentSort: z.enum(["confidence", "top", "new", "controversial", "old", "qa"]),
  }).strict().optional(),
}).strict();

const fieldMappingSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  url: z.string().min(1),
  title: z.string().min(1).nullable(),
  text: z.string().min(1),
  publishedAt: z.string().min(1).nullable(),
  rating: z.string().min(1).nullable(),
  language: z.string().min(1).nullable(),
  itemType: z.string().min(1).nullable().optional(),
}).strict();

const youtubeRouteConfigSchema = z.object({
  route: z.literal("youtube_data_api"),
  regionCode: z.string().regex(/^[A-Z]{2}$/).default("IN"),
  relevanceLanguage: z.string().min(2).max(10).default("en"),
  collectionStrategy: z.enum(["legacy", "video_balanced_v2"]).default("legacy"),
  videosPerQueryPage: z.number().int().min(1).max(10).default(5),
  searchResultsPerPage: z.number().int().min(1).max(50).optional(),
  eligibleVideosPerQueryPage: z.number().int().min(1).max(20).optional(),
  commentsPerVideo: z.number().int().min(1).max(100).default(100),
  order: z.enum(["relevance", "date"]).default("relevance"),
  commentOrder: z.enum(["relevance", "time"]).default("relevance"),
  safeSearch: z.enum(["none", "moderate", "strict"]).default("moderate"),
  publishedAfter: z.iso.datetime().optional(),
  videoEligibility: z.object({
    requireMyntraTerm: z.boolean().default(true),
    includeAny: z.array(z.string().trim().min(2).max(80)).min(1).max(50),
    excludeAny: z.array(z.string().trim().min(2).max(80)).max(50).default([]),
  }).strict().optional(),
}).strict();

const apifyRouteConfigSchema = z.object({
  route: z.literal("apify_actor"),
  actorId: z.string().regex(/^[A-Za-z0-9_-]+(?:~[A-Za-z0-9_-]+)?$/),
  build: z.string().refine(
    (value) => /^(?:[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,5}|[A-Za-z][A-Za-z0-9._-]*)$/u.test(value),
    "Apify build must be a three-part build number such as 5.7.9 or a named tag such as latest.",
  ),
  inputTemplate: z.record(z.string(), z.unknown()),
  fieldMapping: fieldMappingSchema,
  memoryMbytes: z.number().int().min(128).max(32_768).optional(),
  timeoutSeconds: z.number().int().min(30).max(86_400).default(3_600),
}).strict();

const googlePlayRouteConfigSchema = z.object({
  route: z.literal("google_play_scraper"),
  appId: z.string().min(1),
  publishedAfter: z.iso.datetime().optional(),
  minTextLength: z.number().int().min(1).max(1_000).default(8),
  pageSize: z.literal(150).default(150),
  requestDelayMs: z.number().int().min(0).max(5_000).default(750),
}).strict();

const appStoreRouteConfigSchema = z.object({
  route: z.literal("apple_public_reviews"),
  appId: z.number().int().positive(),
  publishedAfter: z.iso.datetime().optional(),
  minTextLength: z.number().int().min(1).max(1_000).default(8),
  maximumFeedPage: z.number().int().min(1).max(10).default(10),
  requestDelayMs: z.number().int().min(0).max(5_000).default(750),
}).strict();

const redditOAuthRouteConfigSchema = z.object({
  route: z.literal("reddit_oauth_api"),
  publishedAfter: z.iso.datetime().optional(),
  minTextLength: z.number().int().min(1).max(1_000).default(20),
  postsPerPage: z.number().int().min(1).max(100).default(25),
  maxCommentDepth: z.number().int().min(1).max(3).default(1),
  requestDelayMs: z.number().int().min(0).max(5_000).default(1_200),
  excludeNsfw: z.literal(true).default(true),
}).strict();

export const collectionBatchSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  batchId: slugSchema,
  datasetVersion: slugSchema,
  source: sourceIdSchema.exclude(["community", "manual_import"]),
  approvalId: slugSchema,
  routeConfig: z.discriminatedUnion("route", [youtubeRouteConfigSchema, googlePlayRouteConfigSchema, appStoreRouteConfigSchema, redditOAuthRouteConfigSchema, apifyRouteConfigSchema]),
  queries: z.array(querySchema).min(1),
  limits: z.object({
    maxItems: finiteLimitSchema.max(22_000),
    maxItemsPerQuery: finiteLimitSchema.max(22_000).optional(),
    maxPagesPerQuery: finiteLimitSchema.max(100).optional(),
    maxRequests: finiteLimitSchema,
    maxCostUsd: z.number().finite().nonnegative(),
    maxAttempts: z.number().int().min(1).max(5).default(3),
  }).strict(),
  outputPath: z.string().startsWith("data/raw/"),
  quarantinePath: z.string().startsWith("data/intermediate/quarantine/"),
  rawRetentionDays: finiteLimitSchema.max(30),
}).strict().superRefine((value, context) => {
  if (value.limits.maxItemsPerQuery && value.limits.maxItemsPerQuery > value.limits.maxItems) {
    context.addIssue({ code: "custom", path: ["limits", "maxItemsPerQuery"], message: "Per-query item limit cannot exceed the batch item limit." });
  }
  if (value.source === "youtube" && value.routeConfig.route !== "youtube_data_api") {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "YouTube batches must use the official YouTube Data API route." });
  }
  if (value.source !== "youtube" && value.routeConfig.route === "youtube_data_api") {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "The YouTube Data API route is valid only for YouTube." });
  }
  if (value.source === "google_play" && value.routeConfig.route !== "google_play_scraper") {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "Google Play batches must use the reviewed Google Play scraper route." });
  }
  if (value.source !== "google_play" && value.routeConfig.route === "google_play_scraper") {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "The Google Play scraper route is valid only for Google Play." });
  }
  if (value.source === "app_store" && value.routeConfig.route !== "apple_public_reviews") {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "App Store batches must use the reviewed App Store public-feed scraper route." });
  }
  if (value.source !== "app_store" && value.routeConfig.route === "apple_public_reviews") {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "The App Store scraper route is valid only for App Store." });
  }
  if (value.source === "reddit" && !["reddit_oauth_api", "apify_actor"].includes(value.routeConfig.route)) {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "Reddit batches must use the official Reddit OAuth API or an independently reviewed provider route." });
  }
  if (value.source !== "reddit" && value.routeConfig.route === "reddit_oauth_api") {
    context.addIssue({ code: "custom", path: ["routeConfig", "route"], message: "The Reddit OAuth API route is valid only for Reddit." });
  }
  if (value.source === "google_play" && value.routeConfig.route === "google_play_scraper" && value.routeConfig.appId !== "com.myntra.android") {
    context.addIssue({ code: "custom", path: ["routeConfig", "appId"], message: "Google Play collection is locked to Myntra package com.myntra.android." });
  }
  if (value.source === "app_store" && value.routeConfig.route === "apple_public_reviews" && value.routeConfig.appId !== 907394059) {
    context.addIssue({ code: "custom", path: ["routeConfig", "appId"], message: "App Store collection is locked to Myntra app ID 907394059." });
  }
  for (const [index, query] of value.queries.entries()) {
    if ((value.source === "google_play" || value.source === "app_store") && !query.storeReviewFilters) {
      context.addIssue({ code: "custom", path: ["queries", index, "storeReviewFilters"], message: "Store review queries require explicit country, sort, and optional rating filters." });
    }
    if (value.source === "google_play" && query.storeReviewFilters && !["newest", "rating", "helpfulness"].includes(query.storeReviewFilters.sort)) {
      context.addIssue({ code: "custom", path: ["queries", index, "storeReviewFilters", "sort"], message: "Google Play supports newest, rating, or helpfulness sorting." });
    }
    if (value.source === "app_store" && query.storeReviewFilters && !["recent", "most_helpful"].includes(query.storeReviewFilters.sort)) {
      context.addIssue({ code: "custom", path: ["queries", index, "storeReviewFilters", "sort"], message: "App Store supports recent or most_helpful sorting." });
    }
    if (value.source === "reddit" && value.routeConfig.route === "reddit_oauth_api" && !query.redditFilters) {
      context.addIssue({ code: "custom", path: ["queries", index, "redditFilters"], message: "Official Reddit queries require an explicit subreddit, search sort, time window, and comment limits." });
    }
    if (value.source !== "reddit" && query.redditFilters) {
      context.addIssue({ code: "custom", path: ["queries", index, "redditFilters"], message: "Reddit filters are valid only for Reddit batches." });
    }
  }
  if (value.routeConfig.route === "youtube_data_api" && value.routeConfig.collectionStrategy === "video_balanced_v2" && !value.routeConfig.videoEligibility) {
    context.addIssue({ code: "custom", path: ["routeConfig", "videoEligibility"], message: "The video-balanced strategy requires explicit video eligibility rules." });
  }
});

export const collectionFailureSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  batchId: slugSchema,
  queryId: slugSchema.nullable(),
  category: z.enum(["authorization", "quota", "rate_limit", "transient", "schema", "permanent"]),
  code: z.string().min(1),
  message: z.string().min(1),
  occurredAt: z.iso.datetime(),
  retryable: z.boolean(),
}).strict();

export const collectionRunManifestSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  batchId: slugSchema,
  datasetVersion: slugSchema,
  source: sourceIdSchema,
  approvalId: slugSchema,
  route: externalRouteSchema,
  routeIdentifier: z.string().min(1),
  configHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["planned", "running", "completed", "partial", "failed"]),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  externalCallsMade: z.boolean(),
  requestCount: z.number().int().nonnegative(),
  costUsd: z.number().finite().nonnegative(),
  counts: z.object({ received: z.number().int().nonnegative(), valid: z.number().int().nonnegative(), quarantined: z.number().int().nonnegative(), failures: z.number().int().nonnegative() }).strict(),
  completedQueryIds: z.array(slugSchema),
  queryCursors: z.record(slugSchema, z.string().nullable()),
  queryPageCounts: z.record(slugSchema, z.number().int().nonnegative()).default({}),
  processedParentIds: z.array(z.string().min(1)).default([]),
  queryDiagnostics: z.record(slugSchema, z.object({
    searchedVideos: z.number().int().nonnegative(),
    eligibleVideos: z.number().int().nonnegative(),
    skippedVideos: z.number().int().nonnegative(),
    processedVideos: z.number().int().nonnegative(),
    videosWithComments: z.number().int().nonnegative(),
  }).strict()).default({}),
  providerRunIds: z.array(z.string().min(1)),
  outputFiles: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)),
  rawRetentionDeadline: z.iso.datetime(),
}).strict();

export type ExternalRoute = z.infer<typeof externalRouteSchema>;
export type SourceApproval = z.infer<typeof sourceApprovalSchema>;
export type CollectionBatch = z.infer<typeof collectionBatchSchema>;
export type CollectionFailure = z.infer<typeof collectionFailureSchema>;
export type CollectionRunManifest = z.infer<typeof collectionRunManifestSchema>;
