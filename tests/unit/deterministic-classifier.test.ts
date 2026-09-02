import { describe, expect, it } from "vitest";

import { deterministicClassify } from "../../data-pipeline/stages/deterministic-classifier";
import { normalizeRecord } from "../../data-pipeline/stages/normalize";
import { rawEvidenceSchema } from "../../src/lib/schemas/pipeline";

const NOW = "2026-08-22T00:00:00.000Z";

function record(text: string, title = "Myntra customer discussion", metadata: Record<string, string> = {}) {
  return normalizeRecord(rawEvidenceSchema.parse({
    schemaVersion: "1.0.0",
    synthetic: false,
    scenarioId: null,
    rawId: `raw-${text.length}-${Object.keys(metadata).length}`,
    collectionRunId: "youtube-sample",
    source: "youtube",
    sourceItemType: "comment",
    sourceItemId: `comment-${text.length}-${Object.keys(metadata).length}`,
    parentSourceItemId: "thread-id",
    canonicalUrl: "https://www.youtube.com/watch?v=video-1",
    sourceScope: "myntra_specific",
    sourceStratum: "myntra_app_or_external_feedback",
    selectionMethod: "video_query",
    queryIds: ["myntra-query"],
    resultPosition: 1,
    collectedAt: NOW,
    publishedAt: NOW,
    rating: null,
    title,
    text,
    language: "en",
    region: "IN",
    sourceMetadata: metadata,
  }));
}

describe("deterministic real-data candidate classifier", () => {
  it("requires explicit comment text for wishlist intent and labels supported uncertainty", () => {
    const result = deterministicClassify(record("I revisited my wishlist but cannot decide which size will fit, so I am waiting."), () => NOW);
    expect(result).toMatchObject({ relevance: "direct_wishlist", wishlistExplicit: true, method: "rule", humanReviewStatus: "unreviewed", primaryBarrier: "fit_size_uncertainty", explicitAction: "wait" });
    expect(result.journeyStages).toEqual(expect.arrayContaining(["wishlist_add", "revisit", "research", "decision"]));
  });

  it("does not turn a wishlist video title into user wishlist evidence", () => {
    const result = deterministicClassify(record("Thank you", "How to see your Myntra wishlist"), () => NOW);
    expect(result).toMatchObject({ relevance: "irrelevant", wishlistExplicit: false, barriers: [], journeyStages: ["unknown"] });
  });

  it("retains an explicit non-wishlist decision mechanism as journey adjacent", () => {
    const result = deterministicClassify(record("I cannot decide which size will fit before I order this Myntra shirt."), () => NOW);
    expect(result).toMatchObject({ relevance: "journey_adjacent", wishlistExplicit: false, primaryBarrier: "fit_size_uncertainty" });
  });

  it("excludes accidental competitor-comparison evidence from Myntra-only analysis", () => {
    const result = deterministicClassify(record("Myntra material is better than Meesho material."), () => NOW);
    expect(result.relevance).toBe("irrelevant");
    expect(result.relevanceReason).toContain("another shopping platform");
  });

  it("normalizes YouTube grouping to video ID without changing the raw record", () => {
    const normalized = record("I need help choosing the right size before I order.", "Myntra size guide", { videoId: "video-1" });
    expect(normalized.parentThreadId).toBe("video-1");
    expect(normalized.validationWarnings).toContain("YouTube parent grouping was normalized to the minimized video ID.");
  });
});
