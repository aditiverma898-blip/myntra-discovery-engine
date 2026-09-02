import { z } from "zod";

import type { CollectionPage, CollectionPageRequest, CollectionTransport, LiveProviderItem } from "../collection/contracts";
import { ExternalHttpError, fetchJson } from "./http";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: z.number().positive(),
}).passthrough();

const thingSchema = z.object({
  kind: z.string(),
  data: z.record(z.string(), z.unknown()),
}).passthrough();

const listingSchema = z.object({
  data: z.object({
    after: z.string().nullable().optional(),
    children: z.array(thingSchema),
  }).passthrough(),
}).passthrough();

const postSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  title: z.string(),
  selftext: z.string().optional().default(""),
  permalink: z.string().startsWith("/"),
  created_utc: z.number().optional(),
  over_18: z.boolean().optional().default(false),
  subreddit: z.string().min(1),
  score: z.number().optional(),
  num_comments: z.number().optional(),
}).passthrough();

const commentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  body: z.string(),
  permalink: z.string().startsWith("/").optional(),
  created_utc: z.number().optional(),
  subreddit: z.string().min(1).optional(),
  score: z.number().optional(),
  depth: z.number().int().nonnegative().optional(),
  link_id: z.string().optional(),
  replies: z.union([z.literal(""), listingSchema]).optional(),
}).passthrough();

interface OAuthToken {
  value: string;
  expiresAt: number;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/gu, " ").trim();
  return cleaned && !["[deleted]", "[removed]"].includes(cleaned.toLowerCase()) ? cleaned : null;
}

function isoFromEpoch(value: number | undefined): string | null {
  if (value === undefined) return null;
  const date = new Date(value * 1_000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { after?: unknown };
  if (typeof parsed.after !== "string" || !parsed.after) throw new Error("Invalid Reddit search cursor.");
  return parsed.after;
}

function encodeCursor(after: string | null | undefined): string | null {
  return after ? Buffer.from(JSON.stringify({ after }), "utf8").toString("base64url") : null;
}

function requiredCredentials(environment: Record<string, string | undefined>): { clientId: string; clientSecret: string; userAgent: string } {
  const clientId = environment.REDDIT_CLIENT_ID?.trim();
  const clientSecret = environment.REDDIT_CLIENT_SECRET?.trim();
  const userAgent = environment.REDDIT_USER_AGENT?.trim();
  if (!clientId || !clientSecret || !userAgent) throw new Error("Reddit OAuth collection requires REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT.");
  return { clientId, clientSecret, userAgent };
}

function redditFilters(request: CollectionPageRequest): NonNullable<CollectionPageRequest["query"]["redditFilters"]> {
  const filters = request.query.redditFilters;
  if (!filters) throw new Error("Reddit OAuth collection requires explicit query filters.");
  return filters;
}

function flattenComments(listing: z.infer<typeof listingSchema>, maxDepth: number): Array<z.infer<typeof commentSchema>> {
  const output: Array<z.infer<typeof commentSchema>> = [];
  const visit = (node: z.infer<typeof thingSchema>, depth: number): void => {
    if (node.kind !== "t1" || depth > maxDepth) return;
    const parsed = commentSchema.safeParse(node.data);
    if (!parsed.success) return;
    output.push(parsed.data);
    if (depth < maxDepth && parsed.data.replies) {
      for (const child of parsed.data.replies.data.children) visit(child, depth + 1);
    }
  };
  for (const child of listing.data.children) visit(child, 1);
  return output;
}

function postItem(post: z.infer<typeof postSchema>, resultPosition: number): LiveProviderItem | null {
  const title = cleanText(post.title);
  const body = cleanText(post.selftext);
  if (!title) return null;
  const text = body ? `${title}\n\n${body}` : title;
  return {
    id: post.name ?? `t3_${post.id}`,
    parentId: null,
    url: `https://www.reddit.com${post.permalink}`,
    title,
    text,
    publishedAt: isoFromEpoch(post.created_utc),
    rating: null,
    language: null,
    resultPosition,
    metadata: {
      provider: "reddit-data-api",
      providerRoute: "official_oauth",
      redditItemType: "post",
      subreddit: post.subreddit,
      score: post.score ?? null,
      commentCount: post.num_comments ?? null,
    },
  };
}

function commentItem(comment: z.infer<typeof commentSchema>, post: z.infer<typeof postSchema>, resultPosition: number): LiveProviderItem | null {
  const text = cleanText(comment.body);
  if (!text) return null;
  const id = comment.name ?? `t1_${comment.id}`;
  return {
    id,
    parentId: post.name ?? `t3_${post.id}`,
    url: `https://www.reddit.com${comment.permalink ?? `${post.permalink}${comment.id}/`}`,
    title: post.title,
    text,
    publishedAt: isoFromEpoch(comment.created_utc),
    rating: null,
    language: null,
    resultPosition,
    metadata: {
      provider: "reddit-data-api",
      providerRoute: "official_oauth",
      redditItemType: "comment",
      subreddit: comment.subreddit ?? post.subreddit,
      postId: post.name ?? `t3_${post.id}`,
      score: comment.score ?? null,
      depth: comment.depth ?? null,
    },
  };
}

export function createRedditOAuthTransport(fetchImpl: typeof fetch = fetch): CollectionTransport {
  let token: OAuthToken | null = null;
  let lastRequestStartedAt = 0;

  return async (request): Promise<CollectionPage> => {
    if (request.batch.routeConfig.route !== "reddit_oauth_api") throw new Error("Reddit transport received an incompatible route.");
    const route = request.batch.routeConfig;
    const filters = redditFilters(request);
    const credentials = requiredCredentials(request.environment);
    let requestCount = 0;

    const pacedJson = async (url: URL, init?: RequestInit): Promise<unknown> => {
      if (requestCount >= request.remainingRequests) throw new Error("Reddit transport reached the batch request budget.");
      const waitMs = Math.max(0, route.requestDelayMs - (Date.now() - lastRequestStartedAt));
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      lastRequestStartedAt = Date.now();
      try {
        const payload = await fetchJson(fetchImpl, url, init);
        requestCount += 1;
        return payload;
      } catch (error) {
        requestCount += 1;
        if (error instanceof ExternalHttpError) throw new ExternalHttpError(error.status, error.message, requestCount);
        throw error;
      }
    };

    if (!token || token.expiresAt <= Date.now() + 60_000) {
      if (request.remainingRequests < 2) throw new Error("Reddit OAuth collection needs at least two remaining requests for token acquisition and search.");
      const tokenPayload = tokenSchema.parse(await pacedJson(new URL("https://www.reddit.com/api/v1/access_token"), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`, "utf8").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": credentials.userAgent,
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      }));
      token = { value: tokenPayload.access_token, expiresAt: Date.now() + tokenPayload.expires_in * 1_000 };
    }

    const searchUrl = new URL(`https://oauth.reddit.com/r/${encodeURIComponent(filters.subreddit)}/search`);
    searchUrl.searchParams.set("q", request.query.text);
    searchUrl.searchParams.set("restrict_sr", "on");
    searchUrl.searchParams.set("sort", filters.sort);
    searchUrl.searchParams.set("t", filters.time);
    searchUrl.searchParams.set("type", "link");
    searchUrl.searchParams.set("limit", String(route.postsPerPage));
    searchUrl.searchParams.set("raw_json", "1");
    const after = decodeCursor(request.cursor);
    if (after) searchUrl.searchParams.set("after", after);
    const search = listingSchema.parse(await pacedJson(searchUrl, {
      headers: { Authorization: `Bearer ${token.value}`, "User-Agent": credentials.userAgent },
    }));

    const publishedFloor = route.publishedAfter ? new Date(route.publishedAfter).getTime() : null;
    const processedBefore = new Set(request.processedParentIds ?? []);
    const processedNow: string[] = [];
    const items: LiveProviderItem[] = [];
    const warnings: string[] = [];
    let skippedIrrelevant = 0;
    let skippedDate = 0;
    let skippedNsfw = 0;
    let skippedPreviouslyProcessed = 0;
    let commentBudgetReached = false;
    let reachedDateFloor = false;

    for (const [postIndex, child] of search.data.children.entries()) {
      if (items.length >= request.remainingItems) break;
      if (child.kind !== "t3") continue;
      const parsedPost = postSchema.safeParse(child.data);
      if (!parsedPost.success) continue;
      const post = parsedPost.data;
      const combined = `${post.title} ${post.selftext}`;
      if (!/\bmyntra\b/iu.test(combined)) { skippedIrrelevant += 1; continue; }
      if (route.excludeNsfw && post.over_18) { skippedNsfw += 1; continue; }
      const publishedAt = isoFromEpoch(post.created_utc);
      if (publishedFloor !== null && (!publishedAt || new Date(publishedAt).getTime() < publishedFloor)) {
        skippedDate += 1;
        if (filters.sort === "new") reachedDateFloor = true;
        continue;
      }
      const mappedPost = postItem(post, postIndex + 1);
      if (!mappedPost || mappedPost.text.length < route.minTextLength) { skippedIrrelevant += 1; continue; }
      items.push(mappedPost);
      const postFullname = post.name ?? `t3_${post.id}`;
      if (processedBefore.has(postFullname)) { skippedPreviouslyProcessed += 1; continue; }
      if (filters.commentsPerPost === 0) { processedNow.push(postFullname); continue; }
      if (requestCount >= request.remainingRequests || items.length >= request.remainingItems) {
        commentBudgetReached = true;
        continue;
      }

      const commentsUrl = new URL(`https://oauth.reddit.com/comments/${encodeURIComponent(post.id)}`);
      commentsUrl.searchParams.set("limit", String(filters.commentsPerPost));
      commentsUrl.searchParams.set("depth", String(route.maxCommentDepth));
      commentsUrl.searchParams.set("sort", filters.commentSort);
      commentsUrl.searchParams.set("raw_json", "1");
      const commentPayload = z.array(listingSchema).min(2).parse(await pacedJson(commentsUrl, {
        headers: { Authorization: `Bearer ${token.value}`, "User-Agent": credentials.userAgent },
      }));
      processedNow.push(postFullname);
      const comments = flattenComments(commentPayload[1]!, route.maxCommentDepth).slice(0, filters.commentsPerPost);
      for (const [commentIndex, comment] of comments.entries()) {
        if (items.length >= request.remainingItems) break;
        const mappedComment = commentItem(comment, post, commentIndex + 1);
        if (mappedComment && mappedComment.text.length >= route.minTextLength) items.push(mappedComment);
      }
    }

    if (skippedIrrelevant) warnings.push(`Reddit relevance and minimum-text filters removed ${skippedIrrelevant} post(s).`);
    if (skippedNsfw) warnings.push(`Reddit safety filter removed ${skippedNsfw} NSFW post(s).`);
    if (skippedDate) warnings.push(`Reddit publication floor removed ${skippedDate} post(s).`);
    if (skippedPreviouslyProcessed) warnings.push(`Reddit cross-query deduplication skipped comment re-fetch for ${skippedPreviouslyProcessed} previously processed post(s).`);
    if (commentBudgetReached) warnings.push("Reddit request or item budget prevented comment retrieval for one or more matching posts.");
    if (reachedDateFloor) warnings.push("Reddit newest pagination stopped after reaching the configured publication floor.");

    return {
      items,
      nextCursor: reachedDateFloor ? null : encodeCursor(search.data.after),
      requestCount,
      costUsd: 0,
      providerRunId: null,
      warnings,
      processedParentIds: processedNow,
    };
  };
}
