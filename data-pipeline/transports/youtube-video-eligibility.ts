import type { CollectionBatch } from "../../src/lib/schemas/collection";

type YouTubeQuery = CollectionBatch["queries"][number];
type YouTubeRoute = Extract<CollectionBatch["routeConfig"], { route: "youtube_data_api" }>;

function normalized(value: string): string {
  return value.toLocaleLowerCase("en-IN").replace(/&(?:amp|quot|#39);/gu, " ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function matchesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(normalized(term)));
}

export interface YouTubeVideoEligibility {
  eligible: boolean;
  reasons: string[];
}

export function evaluateYouTubeVideoEligibility(options: {
  title: string;
  description: string;
  query: YouTubeQuery;
  route: YouTubeRoute;
}): YouTubeVideoEligibility {
  if (options.route.collectionStrategy === "legacy") return { eligible: true, reasons: [] };
  const rules = options.route.videoEligibility;
  if (!rules) return { eligible: false, reasons: ["missing_global_rules"] };
  const text = normalized(`${options.title} ${options.description}`);
  const reasons: string[] = [];
  if (rules.requireMyntraTerm && !text.includes("myntra")) reasons.push("missing_myntra_term");
  if (!matchesAny(text, rules.includeAny)) reasons.push("missing_research_signal");
  const queryIncludes = options.query.videoEligibility?.includeAny ?? [];
  if (queryIncludes.length > 0 && !matchesAny(text, queryIncludes)) reasons.push("missing_query_signal");
  const excludes = [...rules.excludeAny, ...(options.query.videoEligibility?.excludeAny ?? [])];
  if (matchesAny(text, excludes)) reasons.push("excluded_topic_signal");
  return { eligible: reasons.length === 0, reasons };
}
