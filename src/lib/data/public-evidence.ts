import {
  evidenceQuerySchema,
  evidenceFacetsSchema,
  publicEvidenceItemSchema,
  type EvidenceFacets,
  type EvidenceQuery,
  type EvidenceQueryInput,
} from "@/lib/schemas";

export type PublicEvidenceItem = ReturnType<typeof publicEvidenceItemSchema.parse>;
export type EvidenceFacet = keyof EvidenceFacets;

function confidenceBand(value: number): "low" | "medium" | "high" {
  return value >= 0.85 ? "high" : value >= 0.65 ? "medium" : "low";
}

function includesAny<T>(values: readonly T[], selected: readonly T[]): boolean {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

function normalizeFilterInput(input: EvidenceQueryInput | Record<string, unknown>): EvidenceQuery {
  const raw: Record<string, unknown> = { ...input };
  for (const key of ["source", "relevance", "theme", "barrier", "journey", "segment", "rating", "id"] as const) {
    const value = raw[key];
    if (value !== undefined && !Array.isArray(value)) raw[key] = [value];
  }
  return evidenceQuerySchema.parse(raw);
}

function matchesPublicEvidence(
  item: PublicEvidenceItem,
  query: EvidenceQuery,
  excludedFacet?: EvidenceFacet,
): boolean {
  const term = query.q?.toLocaleLowerCase("en-IN");
  const publishedDate = item.publishedAt?.slice(0, 10) ?? null;

  return (
    (!term || item.excerpt.toLocaleLowerCase("en-IN").includes(term)) &&
    (excludedFacet === "source" || includesAny([item.source], query.source)) &&
    (excludedFacet === "relevance" || includesAny([item.relevance], query.relevance)) &&
    (excludedFacet === "theme" || includesAny(item.themeIds, query.theme)) &&
    (excludedFacet === "barrier" || includesAny(item.barrierIds, query.barrier)) &&
    (excludedFacet === "journey" || includesAny(item.journeyStages, query.journey)) &&
    (excludedFacet === "segment" || includesAny(item.segmentIds, query.segment)) &&
    (excludedFacet === "confidence" || !query.confidence || confidenceBand(item.confidence) === query.confidence) &&
    (excludedFacet === "rating" || query.rating.length === 0 || (item.rating !== null && query.rating.includes(item.rating))) &&
    (query.id.length === 0 || query.id.includes(item.evidenceId)) &&
    (!query.from || (publishedDate !== null && publishedDate >= query.from)) &&
    (!query.to || (publishedDate !== null && publishedDate <= query.to))
  );
}

function compareNullableNumber(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export function sortPublicEvidence(items: readonly PublicEvidenceItem[], sort: EvidenceQuery["sort"]): PublicEvidenceItem[] {
  return [...items].sort((a, b) => {
    let comparison = 0;
    if (sort === "confidence_desc") comparison = b.confidence - a.confidence;
    else if (sort === "rating_asc") comparison = compareNullableNumber(a.rating, b.rating, 1);
    else if (sort === "rating_desc") comparison = compareNullableNumber(a.rating, b.rating, -1);
    else {
      const left = a.publishedAt ?? "";
      const right = b.publishedAt ?? "";
      comparison = sort === "oldest" ? left.localeCompare(right) : right.localeCompare(left);
      if (!left && right) comparison = 1;
      if (left && !right) comparison = -1;
    }
    return comparison || a.evidenceId.localeCompare(b.evidenceId);
  });
}

export function filterPublicEvidence(items: readonly PublicEvidenceItem[], input: EvidenceQueryInput | Record<string, unknown>): PublicEvidenceItem[] {
  const query = normalizeFilterInput(input);
  return sortPublicEvidence(items.filter((item) => matchesPublicEvidence(item, query)), query.sort);
}

function countValues(values: readonly string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Contextual facets apply every active filter except their own selection. */
export function buildEvidenceFacets(items: readonly PublicEvidenceItem[], input: EvidenceQueryInput | Record<string, unknown>): EvidenceFacets {
  const query = normalizeFilterInput(input);
  const contextual = (facet: EvidenceFacet) => items.filter((item) => matchesPublicEvidence(item, query, facet));
  return evidenceFacetsSchema.parse({
    source: countValues(contextual("source").map((item) => item.source)),
    relevance: countValues(contextual("relevance").map((item) => item.relevance)),
    theme: countValues(contextual("theme").flatMap((item) => item.themeIds)),
    barrier: countValues(contextual("barrier").flatMap((item) => item.barrierIds)),
    journey: countValues(contextual("journey").flatMap((item) => item.journeyStages)),
    segment: countValues(contextual("segment").flatMap((item) => item.segmentIds)),
    confidence: countValues(contextual("confidence").map((item) => confidenceBand(item.confidence))),
    rating: countValues(contextual("rating").flatMap((item) => item.rating === null ? [] : [String(item.rating)])),
  });
}
