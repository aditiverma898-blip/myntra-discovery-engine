import { createHash } from "node:crypto";

import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";
import type { CollectionBatch } from "../../src/lib/schemas/collection";
import type { LiveProviderItem } from "./contracts";

const identityKeys = new Set(["author", "authorChannelId", "avatar", "profileUrl", "userName", "username"]);

function itemType(source: CollectionBatch["source"], metadata: LiveProviderItem["metadata"]): RawEvidence["sourceItemType"] {
  if (source === "youtube") return "comment";
  if (source === "reddit") return metadata.redditItemType === "comment" ? "comment" : "post";
  return "review";
}

function selectionMethod(source: CollectionBatch["source"]): RawEvidence["selectionMethod"] {
  if (source === "youtube") return "video_query";
  if (source === "reddit") return "thread_query";
  if (source === "myntra_product_review") return "manual_sample";
  return "organic_feed";
}

function sourceStratum(source: CollectionBatch["source"]): string {
  return source === "myntra_product_review" ? "product_decision_evidence" : "myntra_app_or_external_feedback";
}

function minimizedMetadata(metadata: LiveProviderItem["metadata"]): LiveProviderItem["metadata"] {
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !identityKeys.has(key)));
}

export function mapLiveProviderItem(options: { batch: CollectionBatch; queryId: string; item: LiveProviderItem; collectedAt: string }): RawEvidence {
  const stableId = options.item.id.trim();
  const region = typeof options.item.metadata.country === "string" && /^[A-Z]{2}$/u.test(options.item.metadata.country)
    ? options.item.metadata.country
    : "IN";
  return rawEvidenceSchema.parse({
    schemaVersion: "1.0.0",
    synthetic: false,
    scenarioId: null,
    rawId: `raw-${createHash("sha256").update(`${options.batch.batchId}:${options.batch.source}:${stableId}`).digest("hex").slice(0, 20)}`,
    collectionRunId: options.batch.batchId,
    source: options.batch.source,
    sourceItemType: itemType(options.batch.source, options.item.metadata),
    sourceItemId: stableId,
    parentSourceItemId: options.item.parentId,
    canonicalUrl: options.item.url,
    sourceScope: "myntra_specific",
    sourceStratum: sourceStratum(options.batch.source),
    selectionMethod: selectionMethod(options.batch.source),
    queryIds: [options.queryId],
    resultPosition: options.item.resultPosition,
    collectedAt: options.collectedAt,
    publishedAt: options.item.publishedAt,
    rating: options.item.rating,
    title: options.item.title,
    text: options.item.text,
    language: options.item.language,
    region,
    sourceMetadata: minimizedMetadata(options.item.metadata),
  });
}
