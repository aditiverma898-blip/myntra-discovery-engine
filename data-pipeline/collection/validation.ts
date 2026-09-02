import { createHash } from "node:crypto";
import path from "node:path";

import type { CollectionBatch, SourceApproval } from "../../src/lib/schemas/collection";

const competitorPattern = /\b(amazon|flipkart|ajio|meesho|nykaa)\b/iu;

export function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateRestrictedPath(root: string, relativePath: string, requiredPrefix: string): string {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (!normalized.startsWith(requiredPrefix) || normalized.includes("../")) throw new Error(`Path must remain under ${requiredPrefix}.`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, normalized);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Configured output path escapes the workspace root.");
  return resolved;
}

export function validateBatchAgainstApproval(batch: CollectionBatch, approval: SourceApproval, now = new Date()): void {
  if (approval.approvalId !== batch.approvalId) throw new Error("Batch approval ID does not match the loaded approval record.");
  if (approval.source !== batch.source) throw new Error("Batch source does not match the approval record.");
  if (approval.route !== batch.routeConfig.route) throw new Error("Batch route does not match the approved route.");
  if (approval.status !== "approved") throw new Error("Source approval is not active.");
  if (new Date(approval.expiresAt).getTime() <= now.getTime()) throw new Error("Source approval has expired.");
  if (batch.limits.maxItems > approval.maxItems || batch.limits.maxRequests > approval.maxRequests || batch.limits.maxCostUsd > approval.maxCostUsd) throw new Error("Batch limits exceed the approved source limits.");
  if (batch.rawRetentionDays > approval.rawRetentionDays) throw new Error("Batch retention exceeds the approved source retention.");
  if (batch.source === "reddit" && !approval.authorizationReference) {
    throw new Error("Reddit collection requires a recorded Reddit authorization reference for the exact route.");
  }
  const expectedIdentifier = batch.routeConfig.route === "apify_actor"
    ? batch.routeConfig.actorId
    : batch.routeConfig.route === "youtube_data_api"
      ? "youtube.googleapis.com/v3"
      : batch.routeConfig.route === "google_play_scraper"
        ? "google-play-scraper"
        : batch.routeConfig.route === "apple_public_reviews"
          ? "apple-public-customer-reviews"
          : "oauth.reddit.com";
  if (approval.routeIdentifier !== expectedIdentifier) throw new Error("Configured route identifier does not match the approval record.");
  const requiredHosts = batch.routeConfig.route === "apify_actor"
    ? ["api.apify.com"]
    : batch.routeConfig.route === "youtube_data_api"
      ? ["www.googleapis.com"]
      : batch.routeConfig.route === "google_play_scraper"
        ? ["play.google.com"]
        : batch.routeConfig.route === "apple_public_reviews"
          ? ["itunes.apple.com"]
          : ["www.reddit.com", "oauth.reddit.com"];
  for (const requiredHost of requiredHosts) {
    if (!approval.allowedHosts.includes(requiredHost)) throw new Error(`Approval does not allow required host ${requiredHost}.`);
  }
  for (const query of batch.queries) {
    if (!/\bmyntra\b/iu.test(query.text)) throw new Error(`Query ${query.queryId} is not explicitly Myntra-specific.`);
    const positiveQueryText = query.text.replace(/-(?:amazon|flipkart|ajio|meesho|nykaa)\b/giu, "");
    if (competitorPattern.test(positiveQueryText)) throw new Error(`Query ${query.queryId} contains a prohibited shopping-platform name outside an explicit negative search token.`);
  }
}
