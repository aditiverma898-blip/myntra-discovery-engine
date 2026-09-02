import { describe, expect, it, vi } from "vitest";

import { mapLiveProviderItem } from "../../data-pipeline/collection/live-mapper";
import { createDestinationCollectionPlan } from "../../data-pipeline/collection/plan";
import { validateBatchAgainstApproval } from "../../data-pipeline/collection/validation";
import { createRedditOAuthTransport } from "../../data-pipeline/transports/reddit-oauth";
import { collectionBatchSchema, sourceApprovalSchema } from "../../src/lib/schemas/collection";

const NOW = "2026-08-23T00:00:00.000Z";
const ENVIRONMENT = {
  REDDIT_CLIENT_ID: "mock-client-id",
  REDDIT_CLIENT_SECRET: "mock-client-secret",
  REDDIT_USER_AGENT: "script:myntra-decision-intelligence:test (by /u/test-owner)",
};

function batch() {
  return collectionBatchSchema.parse({
    schemaVersion: "1.0.0",
    batchId: "reddit-myntra-test",
    datasetVersion: "myntra-reddit-test",
    source: "reddit",
    approvalId: "reddit-official-test-approval",
    routeConfig: {
      route: "reddit_oauth_api",
      publishedAfter: "2023-01-01T00:00:00.000Z",
      minTextLength: 10,
      postsPerPage: 25,
      maxCommentDepth: 1,
      requestDelayMs: 0,
      excludeNsfw: true,
    },
    queries: [{
      queryId: "myntra-indian-fashion",
      text: "Myntra return quality",
      redditFilters: {
        subreddit: "IndianFashionAddicts",
        sort: "relevance",
        time: "all",
        commentsPerPost: 25,
        commentSort: "top",
      },
    }],
    limits: { maxItems: 100, maxItemsPerQuery: 100, maxPagesPerQuery: 2, maxRequests: 10, maxCostUsd: 0, maxAttempts: 2 },
    outputPath: "data/raw/reddit-myntra-test",
    quarantinePath: "data/intermediate/quarantine/reddit-myntra-test",
    rawRetentionDays: 14,
  });
}

function approval(authorizationReference: string | null = "reddit-approval-ticket-test") {
  return sourceApprovalSchema.parse({
    schemaVersion: "1.0.0",
    approvalId: "reddit-official-test-approval",
    source: "reddit",
    status: "approved",
    route: "reddit_oauth_api",
    provider: "Official Reddit Data API",
    routeIdentifier: "oauth.reddit.com",
    authorizationReference,
    reviewedAt: NOW,
    expiresAt: "2026-09-22T00:00:00.000Z",
    termsUrls: ["https://redditinc.com/policies/data-api-terms"],
    allowedHosts: ["www.reddit.com", "oauth.reddit.com"],
    aiProcessingAllowed: false,
    maxItems: 100,
    maxRequests: 10,
    maxCostUsd: 0,
    rawRetentionDays: 14,
    notes: ["Mock-only test approval."],
  });
}

function responseSequence() {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.includes("/api/v1/access_token")) {
      return new Response(JSON.stringify({ access_token: "mock-token", token_type: "bearer", expires_in: 3_600 }), { status: 200 });
    }
    if (url.includes("/search")) {
      return new Response(JSON.stringify({ data: { after: "t3_next", children: [
        { kind: "t3", data: { id: "post1", name: "t3_post1", title: "Myntra return quality has declined", selftext: "The delivered item did not match the listing.", permalink: "/r/IndianFashionAddicts/comments/post1/myntra_return_quality/", created_utc: 1_786_924_800, over_18: false, subreddit: "IndianFashionAddicts", score: 42, num_comments: 3, author: "must-not-be-retained" } },
        { kind: "t3", data: { id: "post2", name: "t3_post2", title: "General fashion question", selftext: "No target brand is mentioned here.", permalink: "/r/IndianFashionAddicts/comments/post2/general/", created_utc: 1_786_924_800, over_18: false, subreddit: "IndianFashionAddicts", score: 2, num_comments: 1 } },
      ] } }), { status: 200 });
    }
    if (url.includes("/comments/post1")) {
      return new Response(JSON.stringify([
        { data: { after: null, children: [] } },
        { data: { after: null, children: [
          { kind: "t1", data: { id: "comment1", name: "t1_comment1", body: "The pickup failed twice and support closed my ticket.", permalink: "/r/IndianFashionAddicts/comments/post1/myntra_return_quality/comment1/", created_utc: 1_786_925_000, subreddit: "IndianFashionAddicts", score: 9, depth: 0, link_id: "t3_post1", author: "must-not-be-retained" } },
        ] } },
      ]), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("official Reddit OAuth transport", () => {
  it("searches Myntra posts, fetches bounded comments, and drops identity fields", async () => {
    const config = batch();
    const fetchMock = responseSequence();
    const page = await createRedditOAuthTransport(fetchMock as typeof fetch)({
      batch: config,
      query: config.queries[0]!,
      cursor: null,
      remainingItems: 100,
      remainingRequests: 10,
      remainingCostUsd: 0,
      environment: ENVIRONMENT,
      processedParentIds: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("oauth.reddit.com/r/IndianFashionAddicts/search");
    expect(page).toMatchObject({ requestCount: 3, costUsd: 0, processedParentIds: ["t3_post1"] });
    expect(page.nextCursor).not.toBeNull();
    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.metadata.redditItemType)).toEqual(["post", "comment"]);
    expect(JSON.stringify(page)).not.toContain("must-not-be-retained");
    const comment = mapLiveProviderItem({ batch: config, queryId: config.queries[0]!.queryId, item: page.items[1]!, collectedAt: NOW });
    expect(comment).toMatchObject({ source: "reddit", sourceItemType: "comment", parentSourceItemId: "t3_post1", selectionMethod: "thread_query" });
  });

  it("does not fetch a comment tree twice when a resumed or overlapping query already processed the post", async () => {
    const config = batch();
    const fetchMock = responseSequence();
    const page = await createRedditOAuthTransport(fetchMock as typeof fetch)({
      batch: config,
      query: config.queries[0]!,
      cursor: null,
      remainingItems: 100,
      remainingRequests: 10,
      remainingCostUsd: 0,
      environment: ENVIRONMENT,
      processedParentIds: ["t3_post1"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(page.items).toHaveLength(1);
    expect(page.warnings.join(" ")).toContain("previously processed post");
  });

  it("requires an authorization reference and all three OAuth credential fields", () => {
    expect(() => validateBatchAgainstApproval(batch(), approval(null), new Date(NOW))).toThrow("authorization reference");
    const plan = createDestinationCollectionPlan({
      batch: batch(),
      approval: approval(),
      environment: { ALLOW_EXTERNAL_CALLS: "false", REDDIT_SOURCE_APPROVAL: "disabled" },
      now: new Date(NOW),
    });
    expect(plan.credentialsPresent).toBe(false);
    expect(plan.blockedReasons).toEqual(expect.arrayContaining([
      "External calls are disabled.",
      "Reddit-specific approval is disabled.",
      "Required destination credential is absent.",
    ]));
  });
});
