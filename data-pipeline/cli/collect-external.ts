import { readFile } from "node:fs/promises";
import path from "node:path";

import { collectionBatchSchema, sourceApprovalSchema } from "../../src/lib/schemas/collection";
import { runExternalCollection } from "../collection/runner";
import type { CollectionTransportFactory } from "../collection/contracts";
import { readNamedArgument } from "./arguments";

const retiredBatchIds = new Set([
  "reddit-myntra-apify-lite-v13-20260823-001",
  "reddit-myntra-apify-lite-v131-20260823-001",
  "reddit-myntra-apify-lite-v132-20260823-001",
]);

async function transportFactory(route: "youtube_data_api" | "google_play_scraper" | "apple_public_reviews" | "reddit_oauth_api" | "apify_actor"): Promise<CollectionTransportFactory> {
  if (route === "youtube_data_api") return async () => (await import("../transports/youtube-data-api")).collectYouTubePage;
  if (route === "google_play_scraper") return async () => (await import("../transports/google-play-reviews")).createGooglePlayReviewsTransport();
  if (route === "apple_public_reviews") return async () => (await import("../transports/app-store-reviews")).createAppStoreReviewsTransport();
  if (route === "reddit_oauth_api") return async () => (await import("../transports/reddit-oauth")).createRedditOAuthTransport();
  return async () => (await import("../transports/apify-actor")).collectApifyPage;
}

async function main(): Promise<void> {
  const batch = collectionBatchSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  if (retiredBatchIds.has(batch.batchId)) throw new Error(`Batch ${batch.batchId} is retired and cannot make external calls.`);
  const approval = sourceApprovalSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--approval")), "utf8")) as unknown);
  const result = await runExternalCollection({ workspaceRoot: process.cwd(), batch, approval, argv: process.argv.slice(2), transportFactory: await transportFactory(batch.routeConfig.route) });
  console.log(JSON.stringify({ status: result.manifest.status, batchId: result.manifest.batchId, valid: result.records.length, failures: result.failures.length, requests: result.manifest.requestCount, costUsd: result.manifest.costUsd }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
