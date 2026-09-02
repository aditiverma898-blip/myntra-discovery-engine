import { describe, expect, it, vi } from "vitest";

import { createDestinationCollectionPlan } from "../../data-pipeline/collection/plan";
import { mapLiveProviderItem } from "../../data-pipeline/collection/live-mapper";
import { collectAppStoreReviewsPage } from "../../data-pipeline/transports/app-store-reviews";
import { collectGooglePlayReviewsPage, type GooglePlayReviewsClient } from "../../data-pipeline/transports/google-play-reviews";
import { collectionBatchSchema, sourceApprovalSchema } from "../../src/lib/schemas/collection";

const NOW = "2026-08-23T00:00:00.000Z";

function googlePlayBatch() {
  return collectionBatchSchema.parse({
    schemaVersion: "1.0.0",
    batchId: "google-play-myntra-test",
    datasetVersion: "myntra-store-test",
    source: "google_play",
    approvalId: "google-play-test-approval",
    routeConfig: { route: "google_play_scraper", appId: "com.myntra.android", publishedAfter: "2023-01-01T00:00:00.000Z", minTextLength: 8, pageSize: 150 },
    queries: [{ queryId: "myntra-in-en-low", text: "Myntra Google Play India English low ratings", storeReviewFilters: { country: "IN", language: "en", sort: "newest", ratings: [1, 2] } }],
    limits: { maxItems: 100, maxItemsPerQuery: 100, maxPagesPerQuery: 2, maxRequests: 2, maxCostUsd: 0, maxAttempts: 2 },
    outputPath: "data/raw/google-play-myntra-test",
    quarantinePath: "data/intermediate/quarantine/google-play-myntra-test",
    rawRetentionDays: 30,
  });
}

function appStoreBatch() {
  return collectionBatchSchema.parse({
    schemaVersion: "1.0.0",
    batchId: "app-store-myntra-test",
    datasetVersion: "myntra-store-test",
    source: "app_store",
    approvalId: "app-store-test-approval",
    routeConfig: { route: "apple_public_reviews", appId: 907394059, publishedAfter: "2023-01-01T00:00:00.000Z", minTextLength: 8, maximumFeedPage: 10 },
    queries: [{ queryId: "myntra-app-store-in-low", text: "Myntra Apple App Store India low ratings", storeReviewFilters: { country: "IN", sort: "recent", ratings: [1, 2] } }],
    limits: { maxItems: 100, maxItemsPerQuery: 100, maxPagesPerQuery: 2, maxRequests: 2, maxCostUsd: 0, maxAttempts: 2 },
    outputPath: "data/raw/app-store-myntra-test",
    quarantinePath: "data/intermediate/quarantine/app-store-myntra-test",
    rawRetentionDays: 30,
  });
}

describe("free Myntra store review transports", () => {
  it("maps and filters a mocked Google Play page without retaining identity", async () => {
    const client: GooglePlayReviewsClient = {
      sort: { NEWEST: 2, RATING: 3, HELPFULNESS: 1 },
      reviews: vi.fn(async () => ({
        data: [
          { id: "gp-one", url: "https://play.google.com/store/apps/details?id=com.myntra.android&reviewId=gp-one", title: "Size issue", text: "The Myntra size chart did not help me decide.", date: NOW, score: 2, version: "4.2601.0", thumbsUp: 7 },
          { id: "gp-high", text: "This high-rated review belongs in another rating stratum.", date: NOW, score: 5 },
          { id: "gp-short", text: "short", date: NOW, score: 1 },
        ],
        nextPaginationToken: "next-page",
      })),
    };
    const batch = googlePlayBatch();
    const page = await collectGooglePlayReviewsPage(client)({ batch, query: batch.queries[0]!, cursor: null, remainingItems: 100, remainingRequests: 2, remainingCostUsd: 0, environment: {} });
    expect(page).toMatchObject({ requestCount: 1, costUsd: 0 });
    expect(page.nextCursor).not.toBeNull();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ id: "gp-one", rating: 2, language: "en", metadata: { country: "IN", appVersion: "4.2601.0" } });
    expect(JSON.stringify(page)).not.toContain("userName");
    const mapped = mapLiveProviderItem({ batch, queryId: batch.queries[0]!.queryId, item: page.items[0]!, collectedAt: NOW });
    expect(mapped).toMatchObject({ source: "google_play", region: "IN", selectionMethod: "organic_feed", synthetic: false });
  });

  it("supports bounded Google Play continuation past previously collected pages", async () => {
    const client: GooglePlayReviewsClient = {
      sort: { NEWEST: 2, RATING: 3, HELPFULNESS: 1 },
      reviews: vi.fn(async () => ({
        data: [{ id: "already-collected", text: "Previously collected Myntra review text.", date: NOW, score: 1 }],
        nextPaginationToken: "next-page",
      })),
    };
    const original = googlePlayBatch();
    const batch = collectionBatchSchema.parse({
      ...original,
      queries: original.queries.map((query) => ({ ...query, storeReviewFilters: { ...query.storeReviewFilters, skipPages: 1 } })),
    });
    const page = await collectGooglePlayReviewsPage(client)({ batch, query: batch.queries[0]!, cursor: null, remainingItems: 100, remainingRequests: 2, remainingCostUsd: 0, environment: {} });
    expect(page.items).toHaveLength(0);
    expect(page.nextCursor).not.toBeNull();
    expect(page.warnings).toContain("Google Play continuation skipped the first 1 previously collected page(s).");
  });

  it("maps and filters Apple's mocked public review feed with bounded pagination", async () => {
    const batch = appStoreBatch();
    let requestedUrl: URL | RequestInfo | null = null;
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      requestedUrl = input;
      return new Response(JSON.stringify({
        feed: {
          entry: [
            { id: { label: "as-one" }, "im:version": { label: "4.2601.0" }, "im:rating": { label: "1" }, title: { label: "Wishlist" }, content: { label: "My Myntra wishlist items disappear after an update." }, updated: { label: NOW }, link: { attributes: { href: "https://apps.apple.com/in/app/id907394059?see-all=reviews" } } },
            { id: { label: "as-high" }, "im:rating": { label: "5" }, content: { label: "This belongs in the positive rating stratum." }, updated: { label: NOW }, link: { attributes: { href: "https://apps.apple.com/in/app/id907394059?see-all=reviews" } } },
          ],
        },
      }), { status: 200 });
    });
    const page = await collectAppStoreReviewsPage({ batch, query: batch.queries[0]!, cursor: null, remainingItems: 100, remainingRequests: 2, remainingCostUsd: 0, environment: {} }, fetchMock as typeof fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(requestedUrl)).toContain("itunes.apple.com/in/rss/customerreviews/page=1/id=907394059/sortby=mostRecent/json");
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ id: "as-one", rating: 1, language: null, metadata: { provider: "apple-public-customer-reviews", country: "IN" } });
    expect(page.nextCursor).not.toBeNull();
  });

  it("treats an unavailable Apple storefront feed as exhausted instead of failing the batch", async () => {
    const batch = appStoreBatch();
    const fetchMock = vi.fn(async () => new Response("not found", { status: 404 }));
    const page = await collectAppStoreReviewsPage({ batch, query: batch.queries[0]!, cursor: null, remainingItems: 100, remainingRequests: 2, remainingCostUsd: 0, environment: {} }, fetchMock as typeof fetch);
    expect(page).toMatchObject({ items: [], nextCursor: null, requestCount: 1, costUsd: 0 });
    expect(page.warnings[0]).toContain("did not expose a public review feed");
  });

  it("locks both routes to Myntra's exact official listing identifiers", () => {
    expect(() => collectionBatchSchema.parse({ ...googlePlayBatch(), routeConfig: { ...googlePlayBatch().routeConfig, appId: "com.example.other" } })).toThrow("com.myntra.android");
    expect(() => collectionBatchSchema.parse({ ...appStoreBatch(), routeConfig: { ...appStoreBatch().routeConfig, appId: 123 } })).toThrow("907394059");
  });

  it("treats public store routes as credential-free while keeping approval and external-call gates", () => {
    const batch = googlePlayBatch();
    const approval = sourceApprovalSchema.parse({
      schemaVersion: "1.0.0", approvalId: batch.approvalId, source: "google_play", status: "disabled", route: "google_play_scraper", provider: "Pinned public-store scraper", routeIdentifier: "google-play-scraper", reviewedAt: NOW, expiresAt: "2026-09-22T00:00:00.000Z", termsUrls: ["https://play.google.com/about/play-terms/"], allowedHosts: ["play.google.com"], aiProcessingAllowed: false, maxItems: 100, maxRequests: 2, maxCostUsd: 0, rawRetentionDays: 30, notes: ["Mock test only."],
    });
    const plan = createDestinationCollectionPlan({ batch, approval, environment: { ALLOW_EXTERNAL_CALLS: "false" }, now: new Date(NOW) });
    expect(plan.credentialsPresent).toBe(true);
    expect(plan.blockedReasons).toEqual(expect.arrayContaining(["External calls are disabled.", "Source approval is not active."]));
  });
});
