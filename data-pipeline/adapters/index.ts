import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";
import { assertExternalCallsAllowed } from "../../src/lib/external-access";
import type { CollectorAdapter } from "./types";
import { createProviderFixtureAdapter } from "./provider-fixture-adapter";

export const googlePlayAdapter = createProviderFixtureAdapter({ id: "google-play-myntra", source: "google_play", itemType: "review", selectionMethod: "organic_feed" });
export const appStoreAdapter = createProviderFixtureAdapter({ id: "app-store-myntra", source: "app_store", itemType: "review", selectionMethod: "organic_feed" });
export const youtubeAdapter = createProviderFixtureAdapter({ id: "youtube-myntra-comments", source: "youtube", itemType: "comment", selectionMethod: "video_query" });
export const redditApifyAdapter = createProviderFixtureAdapter({ id: "reddit-approved-route", source: "reddit", itemType: "post", selectionMethod: "thread_query" });
export const myntraProductReviewAdapter = createProviderFixtureAdapter({ id: "myntra-product-review-import", source: "myntra_product_review", itemType: "review", selectionMethod: "manual_sample" });

export const manualImportAdapter: CollectorAdapter<unknown[]> = {
  id: "manual-jsonl-import", version: "1.0.0", source: "manual_import",
  parseSavedFixture(payload) { return payload.map((value) => rawEvidenceSchema.parse(value)); },
  async collectExternal(options, transport): Promise<RawEvidence[]> {
    assertExternalCallsAllowed({ source: "manual_import", sourceApprovalStatus: options.sourceApprovalStatus, maxItems: options.maxItems, maxCost: options.maxCost, argv: options.argv, environment: options.environment });
    void transport;
    throw new Error("Fixture/manual adapter external transport is disabled. Use an approved destination import or collection runner.");
  },
};

export const COLLECTOR_ADAPTERS = { google_play: googlePlayAdapter, app_store: appStoreAdapter, youtube: youtubeAdapter, reddit: redditApifyAdapter, myntra_product_review: myntraProductReviewAdapter, manual_import: manualImportAdapter } as const;

export type { CollectorAdapter, ExternalCollectorOptions, ExternalCollectorTransport, SanitizedCollectionPlan } from "./types";
