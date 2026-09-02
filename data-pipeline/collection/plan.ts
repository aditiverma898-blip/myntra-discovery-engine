import type { CollectionBatch, SourceApproval } from "../../src/lib/schemas/collection";
import { readServerEnv } from "../../src/lib/env";
import { validateBatchAgainstApproval } from "./validation";
import { estimateYouTubeCapacity, type YouTubeCapacityEstimate } from "../planning/youtube-capacity";

export interface DestinationCollectionPlan {
  schemaVersion: "1.0.0";
  batchId: string;
  datasetVersion: string;
  source: CollectionBatch["source"];
  approvalId: string;
  approvalStatus: SourceApproval["status"];
  route: CollectionBatch["routeConfig"]["route"];
  routeIdentifier: string;
  queryIds: string[];
  limits: CollectionBatch["limits"];
  outputPath: string;
  quarantinePath: string;
  rawRetentionDays: number;
  credentialsPresent: boolean;
  blockedReasons: string[];
  externalExecutionPerformed: false;
  youtubeCapacity: YouTubeCapacityEstimate | null;
}

export function createDestinationCollectionPlan(options: { batch: CollectionBatch; approval: SourceApproval; environment?: Record<string, string | undefined>; now?: Date }): DestinationCollectionPlan {
  const environment = readServerEnv(options.environment);
  const blockedReasons: string[] = [];
  try { validateBatchAgainstApproval(options.batch, options.approval, options.now); }
  catch (error) { blockedReasons.push(error instanceof Error ? error.message : "Approval validation failed."); }
  if (!environment.ALLOW_EXTERNAL_CALLS) blockedReasons.push("External calls are disabled.");
  if (options.batch.source === "reddit" && environment.REDDIT_SOURCE_APPROVAL !== "approved") blockedReasons.push("Reddit-specific approval is disabled.");
  const credentialsPresent = options.batch.routeConfig.route === "youtube_data_api"
    ? Boolean(environment.YOUTUBE_API_KEY)
    : options.batch.routeConfig.route === "reddit_oauth_api"
      ? Boolean(environment.REDDIT_CLIENT_ID && environment.REDDIT_CLIENT_SECRET && environment.REDDIT_USER_AGENT)
    : options.batch.routeConfig.route === "apify_actor"
      ? Boolean(environment.APIFY_TOKEN)
      : true;
  if (!credentialsPresent) blockedReasons.push("Required destination credential is absent.");
  return {
    schemaVersion: "1.0.0",
    batchId: options.batch.batchId,
    datasetVersion: options.batch.datasetVersion,
    source: options.batch.source,
    approvalId: options.approval.approvalId,
    approvalStatus: options.approval.status,
    route: options.batch.routeConfig.route,
    routeIdentifier: options.approval.routeIdentifier,
    queryIds: options.batch.queries.map((query) => query.queryId),
    limits: options.batch.limits,
    outputPath: options.batch.outputPath,
    quarantinePath: options.batch.quarantinePath,
    rawRetentionDays: options.batch.rawRetentionDays,
    credentialsPresent,
    blockedReasons: [...new Set(blockedReasons)],
    externalExecutionPerformed: false,
    youtubeCapacity: estimateYouTubeCapacity(options.batch),
  };
}
