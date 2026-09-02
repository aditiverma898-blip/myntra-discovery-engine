import { createHash } from "node:crypto";

import {
  reviewDecisionSchema,
  reviewEvaluationReportSchema,
  reviewSampleItemSchema,
  type ReviewDecision,
  type ReviewEvaluationReport,
  type ReviewSampleItem,
} from "../../src/lib/schemas/production-pipeline";
import type { EvidenceClassification, NormalizedEvidence } from "../../src/lib/schemas/pipeline";

function stableRank(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function balancedPick(items: readonly ReviewSampleItem[], count: number): ReviewSampleItem[] {
  const bySource = new Map<string, ReviewSampleItem[]>();
  for (const item of items) {
    const group = bySource.get(item.source) ?? [];
    group.push(item);
    bySource.set(item.source, group);
  }
  for (const group of bySource.values()) group.sort((a, b) => stableRank(a.evidenceId).localeCompare(stableRank(b.evidenceId)));
  const sources = [...bySource.keys()].sort();
  const selected: ReviewSampleItem[] = [];
  while (selected.length < count) {
    let progressed = false;
    for (const source of sources) {
      const next = bySource.get(source)?.shift();
      if (next) { selected.push(next); progressed = true; }
      if (selected.length === count) break;
    }
    if (!progressed) break;
  }
  return selected;
}

export function createReviewSample(options: {
  reviewId: string;
  records: readonly NormalizedEvidence[];
  classifications: readonly EvidenceClassification[];
  sampleSize: number;
}): ReviewSampleItem[] {
  const classificationById = new Map(options.classifications.map((item) => [item.evidenceId, item]));
  if (classificationById.size !== options.classifications.length) throw new Error("Candidate classifications contain duplicate evidence IDs.");
  const items = options.records.map((record) => {
    const classification = classificationById.get(record.evidenceId);
    if (!classification) throw new Error(`Missing candidate classification for ${record.evidenceId}.`);
    return reviewSampleItemSchema.parse({
      schemaVersion: "1.0.0",
      reviewId: options.reviewId,
      evidenceId: record.evidenceId,
      source: record.source,
      sourceStratum: record.sourceStratum,
      queryIds: record.queryIds,
      publishedAt: record.publishedAt,
      rating: record.rating,
      language: record.language,
      text: record.originalText,
      predictedRelevance: classification.relevance,
      predictedBarrierIds: classification.barriers,
      predictedJourneyStages: classification.journeyStages,
      predictedConfidence: classification.confidence,
      predictedSeverity: classification.severity,
      contradictoryOrPositive: classification.contradictoryOrPositive,
    });
  });
  const target = Math.min(options.sampleSize, items.length);
  const directQuota = Math.min(100, Math.ceil(target / 3));
  const adjacentQuota = Math.min(100, Math.ceil(target / 3));
  const otherQuota = Math.min(100, target - directQuota - adjacentQuota);
  const selected = [
    ...balancedPick(items.filter((item) => item.predictedRelevance === "direct_wishlist"), directQuota),
    ...balancedPick(items.filter((item) => item.predictedRelevance === "journey_adjacent"), adjacentQuota),
    ...balancedPick(items.filter((item) => item.predictedRelevance === "general" || item.predictedRelevance === "irrelevant"), otherQuota),
  ];
  const selectedIds = new Set(selected.map((item) => item.evidenceId));
  if (selected.length < target) {
    selected.push(...balancedPick(items.filter((item) => !selectedIds.has(item.evidenceId)), target - selected.length));
  }
  return selected.sort((a, b) => a.predictedRelevance.localeCompare(b.predictedRelevance) || a.source.localeCompare(b.source) || stableRank(a.evidenceId).localeCompare(stableRank(b.evidenceId)));
}

export function createSimulatedReviewDecisions(sample: readonly ReviewSampleItem[], reviewedAt: string): ReviewDecision[] {
  return sample.map((item) => reviewDecisionSchema.parse({
    schemaVersion: "1.0.0",
    evidenceId: item.evidenceId,
    decision: "accept",
    unsupportedInference: false,
    reviewerType: "simulated",
    reviewerId: "simulated-workflow-review-v1",
    reviewedAt,
    notes: "SIMULATED workflow-only decision copied from the candidate label; it is not independent human validation and is not release-eligible.",
  }));
}

function ratio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 1;
}

export function evaluateReview(options: {
  evaluationId: string;
  datasetVersion: string;
  generatedAt: string;
  sample: readonly ReviewSampleItem[];
  rawDecisions: readonly unknown[];
}): ReviewEvaluationReport {
  const decisions = options.rawDecisions.map((value) => reviewDecisionSchema.parse(value));
  const sampleIds = new Set(options.sample.map((item) => item.evidenceId));
  if (sampleIds.size !== options.sample.length) throw new Error("Review sample contains duplicate evidence IDs.");
  const byId = new Map<string, ReviewDecision>();
  for (const decision of decisions) {
    if (!sampleIds.has(decision.evidenceId)) throw new Error(`Decision references evidence outside the sample: ${decision.evidenceId}.`);
    if (byId.has(decision.evidenceId)) throw new Error(`Duplicate review decision for ${decision.evidenceId}.`);
    byId.set(decision.evidenceId, decision);
  }
  const missing = options.sample.filter((item) => !byId.has(item.evidenceId));
  if (missing.length) throw new Error(`Review is incomplete: ${missing.length} sampled evidence IDs have no decision.`);
  const truth = options.sample.map((item) => {
    const decision = byId.get(item.evidenceId)!;
    return {
      item,
      decision,
      relevance: decision.decision === "reject" ? "irrelevant" : decision.correctedRelevance ?? item.predictedRelevance,
      barriers: decision.decision === "reject" ? [] : decision.correctedBarrierIds ?? item.predictedBarrierIds,
    };
  });
  const predictedDirect = truth.filter(({ item }) => item.predictedRelevance === "direct_wishlist");
  const truthRelevant = truth.filter(({ relevance }) => relevance === "direct_wishlist" || relevance === "journey_adjacent");
  const barrierRows = truth.filter(({ relevance, barriers }) => (relevance === "direct_wishlist" || relevance === "journey_adjacent") && barriers.length > 0);
  const metrics = {
    relevanceDirectPrecision: ratio(predictedDirect.filter(({ relevance }) => relevance === "direct_wishlist").length, predictedDirect.length),
    relevanceDirectAdjacentRecall: ratio(truthRelevant.filter(({ item }) => item.predictedRelevance === "direct_wishlist" || item.predictedRelevance === "journey_adjacent").length, truthRelevant.length),
    structuredSchemaSuccess: ratio(decisions.length, options.sample.length),
    unsupportedInferenceCount: decisions.filter((decision) => decision.unsupportedInference).length,
    primaryBarrierAgreement: ratio(barrierRows.filter(({ item, barriers }) => item.predictedBarrierIds[0] === barriers[0]).length, barrierRows.length),
    lowConfidenceDirectReviewed: options.sample.filter((item) => item.predictedRelevance === "direct_wishlist" && item.predictedConfidence < 0.75).every((item) => byId.has(item.evidenceId)),
    highSeverityDisplayedReviewed: options.sample.filter((item) => item.predictedSeverity >= 3).every((item) => byId.has(item.evidenceId)),
  };
  const reviewKind = decisions.every((decision) => decision.reviewerType === "human") ? "human" : "simulated";
  const thresholdPass = metrics.relevanceDirectPrecision >= 0.85 && metrics.relevanceDirectAdjacentRecall >= 0.8 && metrics.structuredSchemaSuccess >= 0.98 && metrics.unsupportedInferenceCount === 0 && metrics.primaryBarrierAgreement >= 0.75 && metrics.lowConfidenceDirectReviewed && metrics.highSeverityDisplayedReviewed;
  return reviewEvaluationReportSchema.parse({
    schemaVersion: "1.0.0",
    evaluationId: options.evaluationId,
    datasetVersion: options.datasetVersion,
    generatedAt: options.generatedAt,
    reviewKind,
    releaseEligible: reviewKind === "human" && thresholdPass,
    sampleSize: options.sample.length,
    decisionCounts: Object.fromEntries(["accept", "correct", "reject"].map((key) => [key, decisions.filter((decision) => decision.decision === key).length])),
    metrics,
    thresholds: { relevanceDirectPrecision: 0.85, relevanceDirectAdjacentRecall: 0.8, structuredSchemaSuccess: 0.98, unsupportedInferenceCount: 0, primaryBarrierAgreement: 0.75 },
    thresholdPass,
    limitations: reviewKind === "simulated"
      ? ["SIMULATED workflow-only review; metrics are not independent model-quality evidence.", "This report cannot authorize a ready release."]
      : ["Metrics apply to the documented, query-targeted review sample and do not establish population prevalence."],
  });
}
