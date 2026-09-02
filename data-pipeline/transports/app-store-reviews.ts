import { z } from "zod";

import type { CollectionPage, CollectionPageRequest, CollectionTransport, LiveProviderItem } from "../collection/contracts";
import { ExternalHttpError, fetchJson } from "./http";

const labelSchema = z.object({ label: z.string() }).passthrough();
const reviewEntrySchema = z.object({
  id: labelSchema,
  "im:version": labelSchema.optional(),
  "im:rating": labelSchema,
  title: labelSchema.optional(),
  content: labelSchema,
  updated: labelSchema,
  link: z.object({ attributes: z.object({ href: z.string() }).passthrough() }).passthrough(),
}).passthrough();

const feedResponseSchema = z.object({
  feed: z.object({ entry: z.union([reviewEntrySchema, z.array(reviewEntrySchema)]).optional() }).passthrough(),
}).passthrough();

type AppStoreReview = z.infer<typeof reviewEntrySchema>;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/gu, " ").trim();
  return cleaned || null;
}

function isoDate(value: unknown): string | null {
  if (!(typeof value === "string" || typeof value === "number" || value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function decodePage(cursor: string | null): number {
  if (!cursor) return 1;
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { page?: unknown };
  if (!Number.isSafeInteger(parsed.page) || Number(parsed.page) < 1) throw new Error("Invalid App Store review cursor.");
  return Number(parsed.page);
}

function encodePage(page: number): string {
  return Buffer.from(JSON.stringify({ page }), "utf8").toString("base64url");
}

function requiredFilters(request: CollectionPageRequest) {
  const filters = request.query.storeReviewFilters;
  if (!filters) throw new Error("App Store review collection requires explicit store filters.");
  return filters;
}

function mapSort(sort: string): string {
  if (sort === "recent") return "mostRecent";
  if (sort === "most_helpful") return "mostHelpful";
  throw new Error(`Unsupported App Store review sort ${sort}.`);
}

function stableId(review: AppStoreReview, text: string, country: string, index: number): string {
  const direct = cleanText(review.id.label) ?? cleanText(review.link.attributes.href);
  return direct ?? `${country}:${index}:${text}`;
}

export async function collectAppStoreReviewsPage(request: CollectionPageRequest, fetchImpl: typeof fetch = fetch): Promise<CollectionPage> {
    if (request.batch.routeConfig.route !== "apple_public_reviews") throw new Error("App Store transport received an incompatible route.");
    const route = request.batch.routeConfig;
    const filters = requiredFilters(request);
    const page = decodePage(request.cursor);
    const url = new URL(`https://itunes.apple.com/${filters.country.toLowerCase()}/rss/customerreviews/page=${page}/id=${route.appId}/sortby=${mapSort(filters.sort)}/json`);
    let rawPayload: unknown;
    try {
      rawPayload = await fetchJson(fetchImpl, url);
    } catch (error) {
      if (error instanceof ExternalHttpError && error.status === 404) {
        return { items: [], nextCursor: null, requestCount: 1, costUsd: 0, providerRunId: null, warnings: [`App Store storefront ${filters.country} did not expose a public review feed for the exact Myntra app ID.`] };
      }
      throw error;
    }
    const payload = feedResponseSchema.parse(rawPayload);
    const reviews = payload.feed.entry ? (Array.isArray(payload.feed.entry) ? payload.feed.entry : [payload.feed.entry]) : [];
    const ratingFilter = filters.ratings ? new Set(filters.ratings) : null;
    const publishedFloor = route.publishedAfter ? new Date(route.publishedAfter).getTime() : null;
    let skippedShort = 0;
    let skippedRating = 0;
    let skippedDate = 0;
    let reachedDateFloor = false;
    const items: LiveProviderItem[] = [];
    for (const [index, review] of reviews.entries()) {
      const text = cleanText(review.content.label);
      if (!text || text.length < route.minTextLength) { skippedShort += 1; continue; }
      const parsedRating = Number(review["im:rating"].label);
      const rating = Number.isInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 5 ? parsedRating : null;
      if (ratingFilter && (rating === null || !ratingFilter.has(rating))) { skippedRating += 1; continue; }
      const publishedAt = isoDate(review.updated.label);
      if (publishedFloor !== null && (!publishedAt || new Date(publishedAt).getTime() < publishedFloor)) {
        skippedDate += 1;
        if (filters.sort === "recent") reachedDateFloor = true;
        continue;
      }
      const id = stableId(review, text, filters.country, index);
      items.push({
        id,
        parentId: null,
        url: cleanText(review.link.attributes.href) ?? `https://apps.apple.com/${filters.country.toLowerCase()}/app/id${route.appId}?see-all=reviews`,
        title: cleanText(review.title?.label),
        text,
        publishedAt,
        rating,
        language: null,
        resultPosition: index + 1,
        metadata: {
          provider: "apple-public-customer-reviews",
          providerRoute: "apple_public_customer_review_feed",
          appId: route.appId,
          country: filters.country,
          sort: filters.sort,
          appVersion: cleanText(review["im:version"]?.label),
        },
      });
    }
    const exhausted = reviews.length === 0 || page >= route.maximumFeedPage || reachedDateFloor;
    const warnings = [
      ...(skippedShort ? [`App Store filter removed ${skippedShort} short or empty review(s).`] : []),
      ...(skippedRating ? [`App Store rating stratum removed ${skippedRating} review(s).`] : []),
      ...(skippedDate ? [`App Store date floor removed ${skippedDate} review(s).`] : []),
      ...(page >= route.maximumFeedPage && reviews.length > 0 ? ["App Store public feed reached its configured ten-page ceiling."] : []),
      ...(reachedDateFloor ? ["App Store recent pagination stopped after reaching the configured publication floor."] : []),
    ];
    return {
      items: items.slice(0, request.remainingItems),
      nextCursor: exhausted ? null : encodePage(page + 1),
      requestCount: 1,
      costUsd: 0,
      providerRunId: null,
      warnings,
    };
}

export function createAppStoreReviewsTransport(fetchImpl: typeof fetch = fetch): CollectionTransport {
  let lastRequestStartedAt = 0;
  return async (request) => {
    if (request.batch.routeConfig.route !== "apple_public_reviews") throw new Error("App Store transport received an incompatible route.");
    const waitMs = Math.max(0, request.batch.routeConfig.requestDelayMs - (Date.now() - lastRequestStartedAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestStartedAt = Date.now();
    return collectAppStoreReviewsPage(request, fetchImpl);
  };
}
