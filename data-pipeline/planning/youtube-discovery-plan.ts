import type { SourceApproval } from "../../src/lib/schemas/collection";
import type { YouTubeDiscoveryConfig } from "../../src/lib/schemas/youtube-discovery";

export interface YouTubeDiscoveryCapacity {
  maximumSearchCalls: number;
  maximumCandidatesBeforeDeduplication: number;
  maximumVideosListCalls: number;
  maximumCommentCalls: number;
  maximumTotalRequests: number;
  maximumGeneralQuotaUnits: number;
  maximumRawCommentCapacity: number;
  configuredItemCap: number;
  targetGuaranteed: false;
}

export interface YouTubeDiscoveryPlan {
  schemaVersion: "1.1.0";
  batchId: string;
  approvalId: string;
  approvalStatus: SourceApproval["status"];
  route: "youtube_data_api";
  credentialsPresent: boolean;
  limits: YouTubeDiscoveryConfig["limits"];
  capacity: YouTubeDiscoveryCapacity;
  blockedReasons: string[];
  externalExecutionPerformed: false;
}

export function estimateYouTubeDiscoveryCapacity(config: YouTubeDiscoveryConfig): YouTubeDiscoveryCapacity {
  const searchCalls = config.discovery.queries.length * config.discovery.maxPagesPerQuery;
  const candidates = searchCalls * config.discovery.resultsPerPage;
  const videosListCalls = Math.ceil(candidates / 50);
  const commentCalls = config.eligibility.targetSelectedVideos;
  return {
    maximumSearchCalls: searchCalls,
    maximumCandidatesBeforeDeduplication: candidates,
    maximumVideosListCalls: videosListCalls,
    maximumCommentCalls: commentCalls,
    maximumTotalRequests: searchCalls + videosListCalls + commentCalls,
    maximumGeneralQuotaUnits: videosListCalls + commentCalls,
    maximumRawCommentCapacity: commentCalls * config.eligibility.commentsPerVideo,
    configuredItemCap: config.limits.maxItems,
    targetGuaranteed: false,
  };
}

export function validateYouTubeDiscoveryApproval(config: YouTubeDiscoveryConfig, approval: SourceApproval, now = new Date()): void {
  if (approval.approvalId !== config.approvalId || approval.source !== "youtube" || approval.route !== "youtube_data_api") throw new Error("YouTube discovery approval does not match the configured batch.");
  if (approval.status !== "approved") throw new Error("YouTube source approval is not active.");
  if (new Date(approval.expiresAt).getTime() <= now.getTime()) throw new Error("YouTube source approval has expired.");
  if (approval.routeIdentifier !== "youtube.googleapis.com/v3" || !approval.allowedHosts.includes("www.googleapis.com")) throw new Error("YouTube approval does not allow the official API route and host.");
  if (config.limits.maxItems > approval.maxItems || config.limits.maxRequests > approval.maxRequests || config.rawRetentionDays > approval.rawRetentionDays) throw new Error("YouTube discovery limits exceed the approval record.");
}

export function createYouTubeDiscoveryPlan(options: { config: YouTubeDiscoveryConfig; approval: SourceApproval; environment?: Record<string, string | undefined>; now?: Date }): YouTubeDiscoveryPlan {
  const environment = options.environment ?? process.env;
  const blockedReasons: string[] = [];
  try { validateYouTubeDiscoveryApproval(options.config, options.approval, options.now); }
  catch (error) { blockedReasons.push(error instanceof Error ? error.message : "Approval validation failed."); }
  if (environment.ALLOW_EXTERNAL_CALLS !== "true") blockedReasons.push("External calls are disabled.");
  const credentialsPresent = Boolean(environment.YOUTUBE_API_KEY);
  if (!credentialsPresent) blockedReasons.push("Required destination credential is absent.");
  return {
    schemaVersion: "1.1.0",
    batchId: options.config.batchId,
    approvalId: options.config.approvalId,
    approvalStatus: options.approval.status,
    route: "youtube_data_api",
    credentialsPresent,
    limits: options.config.limits,
    capacity: estimateYouTubeDiscoveryCapacity(options.config),
    blockedReasons: [...new Set(blockedReasons)],
    externalExecutionPerformed: false,
  };
}

export function validateYouTubeDiscoveryDryRun(plan: YouTubeDiscoveryPlan, config: YouTubeDiscoveryConfig): void {
  const errors: string[] = [];
  if (plan.batchId !== config.batchId || plan.approvalId !== config.approvalId) errors.push("batch or approval ID differs from the execution pack");
  if (plan.approvalStatus !== "approved") errors.push("source approval is not active");
  if (!plan.credentialsPresent) errors.push("the destination YouTube credential was not detected");
  if (plan.externalExecutionPerformed) errors.push("the dry-run reports external execution");
  if (JSON.stringify(plan.blockedReasons) !== JSON.stringify(["External calls are disabled."])) errors.push("blocked reasons differ from the expected external-call guard");
  if (JSON.stringify(plan.limits) !== JSON.stringify(config.limits)) errors.push("limits differ from the reviewed config");
  if (errors.length) throw new Error(`YouTube v1.1 dry-run gate failed: ${errors.join("; ")}.`);
}
