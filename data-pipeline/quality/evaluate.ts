import { pipelineQualityReportSchema, type PipelineQualityReport } from "../../src/lib/schemas/production-pipeline";
import type { EvidenceClassification, NormalizedEvidence, ValidationLedgerEntry } from "../../src/lib/schemas/pipeline";

export function evaluatePipelineQuality(options: {
  datasetVersion: string;
  records: readonly NormalizedEvidence[];
  classifications: readonly EvidenceClassification[];
  ledger: readonly ValidationLedgerEntry[];
  generatedAt: string;
  rawRecordCount?: number;
}): PipelineQualityReport {
  const evidenceIds = new Set(options.records.map((record) => record.evidenceId));
  const classificationIds = new Set(options.classifications.map((item) => item.evidenceId));
  const brokenReferences = options.classifications.filter((item) => !evidenceIds.has(item.evidenceId));
  const missingClassifications = options.records.filter((item) => !classificationIds.has(item.evidenceId));
  const duplicateClassificationCount = options.classifications.length - classificationIds.size;
  const sourceQuery = new Map<string, { source: NormalizedEvidence["source"]; queryId: string; canonicalCount: number; directCount: number }>();
  const classificationById = new Map(options.classifications.map((item) => [item.evidenceId, item]));
  for (const record of options.records) {
    for (const queryId of record.queryIds) {
      const key = `${record.source}:${queryId}`;
      const current = sourceQuery.get(key) ?? { source: record.source, queryId, canonicalCount: 0, directCount: 0 };
      current.canonicalCount += 1;
      if (classificationById.get(record.evidenceId)?.relevance === "direct_wishlist") current.directCount += 1;
      sourceQuery.set(key, current);
    }
  }
  const sourceCounts = new Map<string, number>();
  for (const record of options.records) sourceCounts.set(record.source, (sourceCounts.get(record.source) ?? 0) + 1);
  const maximumSourceShare = Math.max(0, ...sourceCounts.values()) / Math.max(options.records.length, 1);
  const gates = [
    { id: "referential_integrity", passed: brokenReferences.length === 0, severity: "error" as const, message: brokenReferences.length ? `${brokenReferences.length} classifications reference missing evidence.` : "Every classification references canonical evidence." },
    { id: "classification_coverage", passed: missingClassifications.length === 0 && duplicateClassificationCount === 0, severity: "error" as const, message: `${classificationIds.size}/${options.records.length} canonical records have unique classifications; ${duplicateClassificationCount} duplicate classification IDs.` },
    { id: "human_review_coverage", passed: options.classifications.every((item) => item.humanReviewStatus !== "unreviewed"), severity: "warning" as const, message: `${options.classifications.filter((item) => item.humanReviewStatus !== "unreviewed").length}/${options.classifications.length} classifications have human decisions.` },
    { id: "raw_volume_target", passed: (options.rawRecordCount ?? options.records.length) >= 18_000, severity: "warning" as const, message: `${options.rawRecordCount ?? options.records.length} raw records were supplied; the documented acceptable minimum is 18,000.` },
    { id: "quarantine_visible", passed: true, severity: "warning" as const, message: `${options.ledger.length} invalid inputs are recorded in the validation ledger.` },
    { id: "source_concentration", passed: maximumSourceShare <= 0.6, severity: "warning" as const, message: `Largest source share is ${Math.round(maximumSourceShare * 100)}%.` },
  ];
  const failed = gates.some((gate) => !gate.passed && gate.severity === "error");
  const warned = gates.some((gate) => !gate.passed && gate.severity === "warning") || options.ledger.length > 0;
  return pipelineQualityReportSchema.parse({
    schemaVersion: "1.0.0",
    datasetVersion: options.datasetVersion,
    status: failed ? "failed" : warned ? "passed_with_warnings" : "passed",
    gates,
    sourceQueryStats: [...sourceQuery.values()].sort((a, b) => a.source.localeCompare(b.source) || a.queryId.localeCompare(b.queryId)),
    contradictionCount: options.classifications.filter((item) => item.contradictoryOrPositive).length,
    generatedAt: options.generatedAt,
  });
}
