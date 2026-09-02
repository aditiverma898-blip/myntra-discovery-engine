import type { CollectionPage, CollectionPageRequest, CollectionTransport, LiveProviderItem } from "../collection/contracts";

interface GooglePlayReview {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  text?: unknown;
  date?: unknown;
  score?: unknown;
  version?: unknown;
  thumbsUp?: unknown;
}

interface GooglePlayReviewPage {
  data: GooglePlayReview[];
  nextPaginationToken?: string;
}

export interface GooglePlayReviewsClient {
  sort: { NEWEST: unknown; RATING: unknown; HELPFULNESS: unknown };
  reviews(options: {
    appId: string;
    lang: string;
    country: string;
    sort: unknown;
    num: 150;
    paginate: true;
    nextPaginationToken?: string;
  }): Promise<GooglePlayReviewPage | GooglePlayReview[]>;
}

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

function decodeCursor(cursor: string | null): { paginationToken: string | undefined; page: number } {
  if (!cursor) return { paginationToken: undefined, page: 1 };
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { paginationToken?: unknown; page?: unknown };
  if (typeof parsed.paginationToken !== "string" || !parsed.paginationToken) throw new Error("Invalid Google Play review cursor.");
  return { paginationToken: parsed.paginationToken, page: Number.isSafeInteger(parsed.page) && Number(parsed.page) >= 2 ? Number(parsed.page) : 1 };
}

function encodeCursor(token: string | undefined, page: number): string | null {
  return token ? Buffer.from(JSON.stringify({ paginationToken: token, page }), "utf8").toString("base64url") : null;
}

function requiredFilters(request: CollectionPageRequest): NonNullable<CollectionPageRequest["query"]["storeReviewFilters"]> & { language: string } {
  const filters = request.query.storeReviewFilters;
  if (!filters) throw new Error("Google Play review collection requires explicit store filters.");
  if (!filters.language) throw new Error("Google Play review collection requires an explicit language.");
  return { ...filters, language: filters.language };
}

function mapSort(client: GooglePlayReviewsClient, sort: string): unknown {
  if (sort === "newest") return client.sort.NEWEST;
  if (sort === "rating") return client.sort.RATING;
  if (sort === "helpfulness") return client.sort.HELPFULNESS;
  throw new Error(`Unsupported Google Play review sort ${sort}.`);
}

function stableId(review: GooglePlayReview, text: string, country: string, index: number): string {
  const direct = cleanText(review.id) ?? cleanText(review.url);
  return direct ?? `${country}:${index}:${text}`;
}

export function collectGooglePlayReviewsPage(client: GooglePlayReviewsClient): CollectionTransport {
  return async (request): Promise<CollectionPage> => {
    if (request.batch.routeConfig.route !== "google_play_scraper") throw new Error("Google Play transport received an incompatible route.");
    const route = request.batch.routeConfig;
    const filters = requiredFilters(request);
    const cursor = decodeCursor(request.cursor);
    const response = await client.reviews({
      appId: route.appId,
      lang: filters.language.slice(0, 2).toLowerCase(),
      country: filters.country.toLowerCase(),
      sort: mapSort(client, filters.sort),
      num: route.pageSize,
      paginate: true,
      nextPaginationToken: cursor.paginationToken,
    });
    const reviews = Array.isArray(response) ? response : response.data;
    const nextToken = Array.isArray(response) ? undefined : response.nextPaginationToken;
    const ratingFilter = filters.ratings ? new Set(filters.ratings) : null;
    const publishedFloor = route.publishedAfter ? new Date(route.publishedAfter).getTime() : null;
    let skippedShort = 0;
    let skippedRating = 0;
    let skippedDate = 0;
    let reachedDateFloor = false;
    const items: LiveProviderItem[] = [];
    for (const [index, review] of reviews.entries()) {
      if (cursor.page <= (filters.skipPages ?? 0)) continue;
      const text = cleanText(review.text);
      if (!text || text.length < route.minTextLength) { skippedShort += 1; continue; }
      const rating = typeof review.score === "number" && review.score >= 1 && review.score <= 5 ? review.score : null;
      if (ratingFilter && (rating === null || !ratingFilter.has(rating))) { skippedRating += 1; continue; }
      const publishedAt = isoDate(review.date);
      if (publishedFloor !== null && (!publishedAt || new Date(publishedAt).getTime() < publishedFloor)) {
        skippedDate += 1;
        if (filters.sort === "newest") reachedDateFloor = true;
        continue;
      }
      const id = stableId(review, text, filters.country, index);
      items.push({
        id,
        parentId: null,
        url: cleanText(review.url) ?? `https://play.google.com/store/apps/details?id=${encodeURIComponent(route.appId)}&reviewId=${encodeURIComponent(id)}`,
        title: cleanText(review.title),
        text,
        publishedAt,
        rating,
        language: filters.language,
        resultPosition: index + 1,
        metadata: {
          provider: "google-play-scraper",
          providerRoute: "public_store_surface",
          appId: route.appId,
          country: filters.country,
          requestedLanguage: filters.language,
          sort: filters.sort,
          appVersion: cleanText(review.version),
          thumbsUp: typeof review.thumbsUp === "number" ? review.thumbsUp : null,
        },
      });
    }
    const warnings = [
      ...(skippedShort ? [`Google Play filter removed ${skippedShort} short or empty review(s).`] : []),
      ...(skippedRating ? [`Google Play rating stratum removed ${skippedRating} review(s).`] : []),
      ...(skippedDate ? [`Google Play date floor removed ${skippedDate} review(s).`] : []),
      ...(reachedDateFloor ? ["Google Play newest pagination stopped after reaching the configured publication floor."] : []),
      ...(cursor.page <= (filters.skipPages ?? 0) ? [`Google Play continuation skipped the first ${filters.skipPages ?? 0} previously collected page(s).`] : []),
    ];
    return {
      items: items.slice(0, request.remainingItems),
      nextCursor: reachedDateFloor ? null : encodeCursor(nextToken, cursor.page + 1),
      requestCount: 1,
      costUsd: 0,
      providerRunId: null,
      warnings,
    };
  };
}

export function createGooglePlayReviewsTransport(): CollectionTransport {
  let clientPromise: Promise<GooglePlayReviewsClient> | null = null;
  let lastRequestStartedAt = 0;
  const getClient = async (): Promise<GooglePlayReviewsClient> => {
    clientPromise ??= import("google-play-scraper").then((module) => (module.default ?? module) as unknown as GooglePlayReviewsClient);
    return clientPromise;
  };
  return async (request) => {
    if (request.batch.routeConfig.route !== "google_play_scraper") throw new Error("Google Play transport received an incompatible route.");
    const waitMs = Math.max(0, request.batch.routeConfig.requestDelayMs - (Date.now() - lastRequestStartedAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestStartedAt = Date.now();
    return collectGooglePlayReviewsPage(await getClient())(request);
  };
}
