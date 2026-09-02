import { z } from "zod";

import type { CollectionPage, CollectionPageRequest, LiveProviderItem } from "../collection/contracts";
import { ExternalHttpError, fetchJson } from "./http";

const actorRunSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    defaultDatasetId: z.string().min(1).nullable().optional(),
    usageTotalUsd: z.number().nonnegative().optional(),
    buildId: z.string().min(1).optional(),
    buildNumber: z.string().min(1).nullable().optional(),
  }).passthrough(),
}).passthrough();

interface ApifyCursor { runId: string; reportedCostUsd: number; }

class AmbiguousApifyStartError extends Error {
  readonly requestsMade = 1;

  constructor() {
    super("Apify Actor start outcome is unknown because no run response was received. Do not automatically repeat the start request; inspect Apify Console for a possible run.");
    this.name = "AmbiguousApifyStartError";
  }
}

function decodeCursor(cursor: string): ApifyCursor {
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<ApifyCursor>;
  if (typeof parsed.runId !== "string" || typeof parsed.reportedCostUsd !== "number") throw new Error("Invalid Apify resume cursor.");
  return { runId: parsed.runId, reportedCostUsd: parsed.reportedCostUsd };
}

function encodeCursor(value: ApifyCursor): string { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url"); }

function substitute(value: unknown, replacements: Record<string, string | number>): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{([A-Za-z0-9_]+)\}\}$/u);
    if (exact?.[1] && exact[1] in replacements) return replacements[exact[1]];
    return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/gu, (match, key: string) => String(replacements[key] ?? match));
  }
  if (Array.isArray(value)) return value.map((item) => substitute(item, replacements));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, replacements)]));
  return value;
}

function getPath(value: unknown, path: string | null): unknown {
  if (!path) return null;
  return path.split(".").reduce<unknown>((current, segment) => current && typeof current === "object" ? (current as Record<string, unknown>)[segment] : undefined, value);
}

function optionalString(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }
function requiredString(value: unknown, name: string): string { const result = optionalString(value); if (!result) throw new Error(`Apify item field ${name} is missing.`); return result; }

function mapItem(item: unknown, mapping: Extract<CollectionPageRequest["batch"]["routeConfig"], { route: "apify_actor" }>["fieldMapping"], index: number, defaultItemType: string | null = null): LiveProviderItem {
  const ratingValue = getPath(item, mapping.rating);
  const rating = typeof ratingValue === "number" ? ratingValue : typeof ratingValue === "string" && ratingValue.trim() ? Number(ratingValue) : null;
  const itemType = optionalString(getPath(item, mapping.itemType ?? null))?.toLowerCase() ?? defaultItemType;
  return {
    id: requiredString(getPath(item, mapping.id), "id"),
    parentId: optionalString(getPath(item, mapping.parentId)),
    url: requiredString(getPath(item, mapping.url), "url"),
    title: optionalString(getPath(item, mapping.title)),
    text: requiredString(getPath(item, mapping.text), "text"),
    publishedAt: optionalString(getPath(item, mapping.publishedAt)),
    rating: rating !== null && Number.isFinite(rating) ? rating : null,
    language: optionalString(getPath(item, mapping.language)),
    resultPosition: index + 1,
    metadata: {
      provider: "apify",
      actorItemMapped: true,
      ...(itemType === "comment" || itemType === "post" ? { redditItemType: itemType } : {}),
    },
  };
}

const terminalSuccess = new Set(["SUCCEEDED"]);
const terminalFailure = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

export async function collectApifyPage(request: CollectionPageRequest, fetchImpl: typeof fetch = fetch): Promise<CollectionPage> {
  if (request.batch.routeConfig.route !== "apify_actor") throw new Error("Apify transport received a non-Apify route.");
  const routeConfig = request.batch.routeConfig;
  const token = request.environment.APIFY_TOKEN;
  if (!token) throw new Error("Apify API authorization credential is missing.");
  const headers = { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" };
  let requestCount = 0;
  let cursor = request.cursor ? decodeCursor(request.cursor) : null;
  let run;
  if (!cursor) {
    if (request.forbidNewProviderRun) throw new Error("Recovery mode requires a saved Apify cursor and forbids starting a new Actor run.");
    const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(routeConfig.actorId)}/runs`);
    url.searchParams.set("waitForFinish", "0");
    url.searchParams.set("build", routeConfig.build);
    url.searchParams.set("timeout", String(routeConfig.timeoutSeconds));
    url.searchParams.set("maxItems", String(request.remainingItems));
    if (routeConfig.memoryMbytes) url.searchParams.set("memory", String(routeConfig.memoryMbytes));
    if (request.remainingCostUsd > 0) url.searchParams.set("maxTotalChargeUsd", String(request.remainingCostUsd));
    const input = substitute(routeConfig.inputTemplate, {
      query: request.query.text,
      queryId: request.query.queryId,
      maxItems: request.remainingItems,
      subreddit: request.query.redditFilters?.subreddit ?? "",
    });
    try {
      run = actorRunSchema.parse(await fetchJson(fetchImpl, url, { method: "POST", headers, body: JSON.stringify(input) }, 30_000)).data;
    } catch (error) {
      if (error instanceof ExternalHttpError || error instanceof z.ZodError) throw error;
      throw new AmbiguousApifyStartError();
    }
    requestCount += 1;
    cursor = { runId: run.id, reportedCostUsd: 0 };
  } else {
    const url = new URL(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(cursor.runId)}`);
    url.searchParams.set("waitForFinish", "30");
    run = actorRunSchema.parse(await fetchJson(fetchImpl, url, { headers }, 45_000)).data;
    requestCount += 1;
  }
  const totalCost = run.usageTotalUsd ?? cursor.reportedCostUsd;
  const costDelta = Math.max(0, totalCost - cursor.reportedCostUsd);
  if (terminalFailure.has(run.status)) throw new Error(`Apify Actor run ended with status ${run.status}.`);
  if (!terminalSuccess.has(run.status)) return { items: [], nextCursor: encodeCursor({ runId: run.id, reportedCostUsd: totalCost }), checkpointOnly: true, requestCount, costUsd: costDelta, providerRunId: run.id, warnings: [`Apify Actor run remains ${run.status}; polling will continue using the checkpointed run ID.`] };
  if (!run.defaultDatasetId) throw new Error("Completed Apify Actor run did not provide a default dataset ID.");
  if (requestCount >= request.remainingRequests) throw new Error("No request budget remains to fetch the completed Apify dataset.");
  const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${encodeURIComponent(run.defaultDatasetId)}/items`);
  datasetUrl.search = new URLSearchParams({ clean: "true", format: "json", limit: String(request.remainingItems) }).toString();
  const payload = await fetchJson(fetchImpl, datasetUrl, { headers });
  requestCount += 1;
  if (!Array.isArray(payload)) throw new Error("Apify dataset response is not an array.");
  const items: LiveProviderItem[] = [];
  const rejectedItems: NonNullable<CollectionPage["rejectedItems"]> = [];
  for (const [index, item] of payload.entries()) {
    const itemType = optionalString(getPath(item, routeConfig.fieldMapping.itemType ?? null))?.toLowerCase() ?? null;
    if (request.batch.source === "reddit" && itemType !== null && itemType !== "comment") {
      rejectedItems.push({ code: "APIFY_REDDIT_NON_COMMENT_SKIPPED", message: `Apify dataset row ${index + 1} was not a Reddit comment and was skipped.` });
      continue;
    }
    try {
      items.push(mapItem(item, routeConfig.fieldMapping, index, request.batch.source === "reddit" ? "comment" : null));
    } catch {
      rejectedItems.push({ code: "APIFY_ITEM_MAPPING_FAILED", message: `Apify dataset row ${index + 1} was missing a required mapped field and was skipped.` });
    }
  }
  const buildIdentity = run.buildNumber ?? run.buildId;
  const mappingWarning = `Apify dataset returned ${payload.length} row(s): ${items.length} mapped and ${rejectedItems.length} rejected.`;
  return {
    items,
    rejectedItems,
    nextCursor: null,
    requestCount,
    costUsd: costDelta,
    providerRunId: run.id,
    warnings: [
      buildIdentity ? `Apify Actor used build ${buildIdentity}${run.buildId && run.buildNumber ? ` (build ID ${run.buildId})` : ""}.` : "Apify Actor response did not report its resolved build identity.",
      mappingWarning,
    ],
  };
}
