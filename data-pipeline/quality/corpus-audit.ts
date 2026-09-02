import type { EvidenceClassification, NormalizedEvidence, RawEvidence } from "../../src/lib/schemas/pipeline";

function countBy(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function percent(numerator: number, denominator: number): number {
  return denominator ? Math.round((numerator / denominator) * 10_000) / 100 : 0;
}

export function buildCorpusAudit(options: {
  datasetVersion: string;
  generatedAt: string;
  raw: readonly RawEvidence[];
  canonical: readonly NormalizedEvidence[];
  classifications: readonly EvidenceClassification[];
}): Record<string, unknown> {
  const classificationById = new Map(options.classifications.map((item) => [item.evidenceId, item]));
  const sources = [...new Set(options.raw.map((item) => item.source))].sort();
  const sourceRows = sources.map((source) => {
    const raw = options.raw.filter((item) => item.source === source);
    const canonical = options.canonical.filter((item) => item.source === source);
    const labels = canonical.map((item) => classificationById.get(item.evidenceId)).filter((item): item is EvidenceClassification => Boolean(item));
    const relevant = labels.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent");
    return {
      source,
      raw: raw.length,
      canonical: canonical.length,
      duplicatesRemoved: raw.length - canonical.length,
      duplicateRatePercent: percent(raw.length - canonical.length, raw.length),
      direct: labels.filter((item) => item.relevance === "direct_wishlist").length,
      adjacent: labels.filter((item) => item.relevance === "journey_adjacent").length,
      general: labels.filter((item) => item.relevance === "general").length,
      irrelevant: labels.filter((item) => item.relevance === "irrelevant").length,
      candidateRelevantYieldPercent: percent(relevant.length, labels.length),
      missingLanguageRaw: raw.filter((item) => !item.language).length,
      missingPublishedAtRaw: raw.filter((item) => !item.publishedAt).length,
      ratings: countBy(raw.map((item) => item.rating === null ? "unknown" : String(item.rating))),
      languages: countBy(raw.map((item) => item.language ?? "unknown")),
      collectionRuns: [...new Set(raw.map((item) => item.collectionRunId))].sort(),
    };
  });
  const queryRows = [...new Set(options.canonical.flatMap((item) => item.queryIds))].sort().map((queryId) => {
    const canonical = options.canonical.filter((item) => item.queryIds.includes(queryId));
    const labels = canonical.map((item) => classificationById.get(item.evidenceId)).filter((item): item is EvidenceClassification => Boolean(item));
    const relevant = labels.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent");
    return { queryId, canonical: canonical.length, direct: labels.filter((item) => item.relevance === "direct_wishlist").length, adjacent: labels.filter((item) => item.relevance === "journey_adjacent").length, candidateRelevantYieldPercent: percent(relevant.length, labels.length), sources: [...new Set(canonical.map((item) => item.source))].sort() };
  });
  return {
    schemaVersion: "1.0.0",
    datasetVersion: options.datasetVersion,
    generatedAt: options.generatedAt,
    externalCallsMade: false,
    reviewStatus: "candidate_labels_only",
    totals: {
      raw: options.raw.length,
      canonical: options.canonical.length,
      duplicatesRemoved: options.raw.length - options.canonical.length,
      duplicateRatePercent: percent(options.raw.length - options.canonical.length, options.raw.length),
      classifications: options.classifications.length,
      reviewedClassifications: options.classifications.filter((item) => item.humanReviewStatus !== "unreviewed").length,
      classificationDistribution: countBy(options.classifications.map((item) => item.relevance)),
    },
    sources: sourceRows,
    queries: queryRows,
    warnings: [
      ...(options.raw.length < 18_000 ? [`Raw corpus is ${18_000 - options.raw.length} below the documented acceptable minimum of 18,000.`] : []),
      ...(options.classifications.some((item) => item.humanReviewStatus === "unreviewed") ? ["Candidate labels have not been independently human-reviewed; yield and rankings are provisional."] : []),
      ...(options.classifications.filter((item) => item.relevance === "direct_wishlist").length < 100 ? ["Direct-wishlist candidate volume is too small to fill the intended 100-row direct evaluation stratum."] : []),
    ],
    claimLimits: [
      "Counts and yields describe this query-targeted corpus only.",
      "Cross-source counts are not population estimates and do not establish causal conversion impact.",
      "Candidate relevance labels cannot be treated as findings until independent review passes.",
    ],
  };
}
