import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/u);
const positiveInt = z.number().int().positive();

export const youtubeDiscoveryQuerySchema = z.object({
  queryId: slugSchema,
  text: z.string().trim().min(1).max(120),
  order: z.enum(["relevance", "date"]).default("relevance"),
}).strict();

export const youtubeDiscoveryConfigSchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  batchId: slugSchema,
  datasetVersion: slugSchema,
  source: z.literal("youtube"),
  approvalId: slugSchema,
  discovery: z.object({
    regionCode: z.string().regex(/^[A-Z]{2}$/u).default("IN"),
    relevanceLanguage: z.string().min(2).max(10).default("en"),
    safeSearch: z.enum(["none", "moderate", "strict"]).default("moderate"),
    publishedAfter: z.iso.datetime().optional(),
    resultsPerPage: z.number().int().min(1).max(50).default(50),
    maxPagesPerQuery: z.number().int().min(1).max(10),
    queries: z.array(youtubeDiscoveryQuerySchema).min(1).max(20),
  }).strict(),
  eligibility: z.object({
    requireMyntraInTitle: z.boolean().default(true),
    excludeAny: z.array(z.string().trim().min(2).max(80)).max(50).default([]),
    minDurationSeconds: z.number().int().min(0).max(86_400),
    minPublicCommentCount: z.number().int().min(0),
    targetSelectedVideos: z.number().int().min(1).max(1_000),
    maxVideosPerChannel: z.number().int().min(1).max(20),
    commentsPerVideo: z.number().int().min(1).max(100),
  }).strict(),
  limits: z.object({
    maxItems: positiveInt.max(22_000),
    maxRequests: positiveInt.max(10_000),
    maxSearchCalls: positiveInt.max(100),
    maxGeneralQuotaUnits: positiveInt.max(10_000),
    maxCostUsd: z.literal(0),
    maxAttempts: z.number().int().min(1).max(5).default(2),
  }).strict(),
  outputPath: z.string().startsWith("data/raw/"),
  quarantinePath: z.string().startsWith("data/intermediate/quarantine/"),
  rawRetentionDays: positiveInt.max(30),
}).strict().superRefine((value, context) => {
  const ids = value.discovery.queries.map((query) => query.queryId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["discovery", "queries"], message: "Discovery query IDs must be unique." });
  for (const [index, query] of value.discovery.queries.entries()) {
    if (!/\bmyntra\b/iu.test(query.text)) context.addIssue({ code: "custom", path: ["discovery", "queries", index, "text"], message: "Every discovery query must be explicitly Myntra-specific." });
  }
  const possibleSearchCalls = value.discovery.queries.length * value.discovery.maxPagesPerQuery;
  if (possibleSearchCalls > value.limits.maxSearchCalls) context.addIssue({ code: "custom", path: ["limits", "maxSearchCalls"], message: "Search-call cap is lower than the configured query/page plan." });
  const possibleRequests = possibleSearchCalls + Math.ceil(value.discovery.queries.length * value.discovery.maxPagesPerQuery * value.discovery.resultsPerPage / 50) + value.eligibility.targetSelectedVideos;
  if (possibleRequests > value.limits.maxRequests) context.addIssue({ code: "custom", path: ["limits", "maxRequests"], message: "Request cap is lower than discovery, enrichment and selected-video capacity." });
});

export const youtubeVideoCandidateSchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  videoId: z.string().min(1),
  title: z.string(),
  publishedAt: z.string().nullable(),
  queryIds: z.array(slugSchema).min(1),
  channelKey: z.string().regex(/^[a-f0-9]{16}$/u),
  enriched: z.boolean(),
  available: z.boolean(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  publicCommentCount: z.number().int().nonnegative().nullable(),
  selectionScore: z.number().finite().nullable(),
  selected: z.boolean(),
}).strict();

export const youtubeDiscoveryManifestSchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  batchId: slugSchema,
  datasetVersion: slugSchema,
  approvalId: slugSchema,
  configHash: z.string().regex(/^[a-f0-9]{64}$/u),
  status: z.enum(["planned", "running", "completed", "partial", "failed"]),
  stage: z.enum(["discovery", "enrichment", "selection", "comments", "completed"]),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  externalCallsMade: z.boolean(),
  requestCount: z.number().int().nonnegative(),
  quotaUsage: z.object({
    searchCalls: z.number().int().nonnegative(),
    generalUnits: z.number().int().nonnegative(),
    videosListCalls: z.number().int().nonnegative(),
    commentCalls: z.number().int().nonnegative(),
  }).strict(),
  counts: z.object({
    searchCandidates: z.number().int().nonnegative(),
    uniqueCandidates: z.number().int().nonnegative(),
    enrichedCandidates: z.number().int().nonnegative(),
    eligibleCandidates: z.number().int().nonnegative(),
    selectedVideos: z.number().int().nonnegative(),
    processedVideos: z.number().int().nonnegative(),
    videosWithComments: z.number().int().nonnegative(),
    received: z.number().int().nonnegative(),
    valid: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative(),
  }).strict(),
  queryCursors: z.record(slugSchema, z.string().nullable()),
  queryPageCounts: z.record(slugSchema, z.number().int().nonnegative()),
  completedQueryIds: z.array(slugSchema),
  completedVideoIds: z.array(z.string().min(1)),
  outputFiles: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)),
  rawRetentionDeadline: z.iso.datetime(),
}).strict();

export type YouTubeDiscoveryConfig = z.infer<typeof youtubeDiscoveryConfigSchema>;
export type YouTubeDiscoveryManifest = z.infer<typeof youtubeDiscoveryManifestSchema>;
export type YouTubeVideoCandidate = z.infer<typeof youtubeVideoCandidateSchema>;
