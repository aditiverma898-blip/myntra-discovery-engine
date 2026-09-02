import path from "node:path";

import { readServerEnv } from "../../src/lib/env";
import type { SourceId } from "../../src/lib/schemas";
import { COLLECTOR_ADAPTERS, type SanitizedCollectionPlan } from "../adapters";

export interface CollectionBatchInput {
  source: Exclude<SourceId, "community">;
  approvalStatus: "approved" | "disabled" | "rejected";
  queryIds: string[];
  maxItems: number;
  maxRequests: number;
  maxCost: number;
  outputPath: string;
  quarantinePath: string;
  retentionDays: number;
  environment?: Record<string, string | undefined>;
}

function requireRestrictedPath(value: string, prefix: string): void {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (!normalized.startsWith(prefix) || normalized.includes("../")) throw new Error(`Path must remain under ${prefix}.`);
}

export function planCollection(input: CollectionBatchInput): SanitizedCollectionPlan {
  if (!Number.isSafeInteger(input.maxItems) || input.maxItems < 1 || input.maxItems > 22_000) throw new Error("maxItems must be a finite integer from 1 to 22,000.");
  if (!Number.isSafeInteger(input.maxRequests) || input.maxRequests < 1) throw new Error("maxRequests must be finite and positive.");
  if (!Number.isFinite(input.maxCost) || input.maxCost < 0) throw new Error("maxCost must be finite and non-negative.");
  if (!Number.isSafeInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 30) throw new Error("retentionDays must be between 1 and 30.");
  if (!input.queryIds.length || input.queryIds.some((query) => !query.trim())) throw new Error("At least one explicit query ID is required.");
  requireRestrictedPath(input.outputPath, "data/raw/");
  requireRestrictedPath(input.quarantinePath, "data/intermediate/quarantine/");
  const environment = readServerEnv(input.environment);
  const adapter = COLLECTOR_ADAPTERS[input.source];
  const credentialPresent = input.source === "youtube" ? Boolean(environment.YOUTUBE_API_KEY) : input.source === "reddit" ? Boolean(environment.APIFY_TOKEN) : false;
  const blockedReasons: string[] = [];
  if (!environment.ALLOW_EXTERNAL_CALLS) blockedReasons.push("External calls are disabled.");
  if (input.approvalStatus !== "approved") blockedReasons.push("Source approval is not active.");
  if (input.source === "reddit" && environment.REDDIT_SOURCE_APPROVAL !== "approved") blockedReasons.push("Reddit-specific approval is disabled.");
  if ((input.source === "youtube" || input.source === "reddit") && !credentialPresent) blockedReasons.push("Required destination credential is absent.");
  return { source: input.source, adapterId: adapter.id, adapterVersion: adapter.version, approvalStatus: input.approvalStatus, queryIds: [...new Set(input.queryIds)].sort(), maxItems: input.maxItems, maxRequests: input.maxRequests, maxCost: input.maxCost, credentialsPresent: credentialPresent, outputPath: input.outputPath, quarantinePath: input.quarantinePath, retentionDays: input.retentionDays, blockedReasons, externalExecutionPerformed: false };
}
