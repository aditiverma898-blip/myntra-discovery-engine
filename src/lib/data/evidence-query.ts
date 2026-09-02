import type { EvidenceActiveFilters, EvidenceQuery } from "@/lib/schemas";

const repeatedKeys = new Set(["source", "relevance", "theme", "barrier", "journey", "segment", "rating", "id"]);
const scalarKeys = new Set(["q", "confidence", "from", "to", "sort", "cursor", "limit"]);

export function evidenceQueryRecord(searchParams: URLSearchParams): {
  raw: Record<string, string | string[]>;
  unknownKeys: string[];
} {
  const raw: Record<string, string | string[]> = {};
  const unknownKeys = [...new Set([...searchParams.keys()].filter((key) => !repeatedKeys.has(key) && !scalarKeys.has(key)))].sort();

  for (const key of repeatedKeys) {
    const values = [...new Set(searchParams.getAll(key).filter(Boolean))].sort();
    if (values.length) raw[key] = values;
  }
  for (const key of scalarKeys) {
    const values = searchParams.getAll(key);
    if (values.length === 1) raw[key] = values[0]!;
    else if (values.length > 1) raw[key] = values;
  }
  return { raw, unknownKeys };
}

export function activeEvidenceFilters(query: EvidenceQuery): EvidenceActiveFilters {
  return {
    q: query.q,
    source: query.source,
    relevance: query.relevance,
    theme: query.theme,
    barrier: query.barrier,
    journey: query.journey,
    segment: query.segment,
    confidence: query.confidence,
    rating: query.rating,
    from: query.from,
    to: query.to,
    sort: query.sort,
    id: query.id,
  };
}
