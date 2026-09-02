import { evidenceClassificationSchema, type EvidenceClassification } from "../../src/lib/schemas/pipeline";
import { reviewDecisionSchema, type ReviewDecision } from "../../src/lib/schemas/production-pipeline";

export function applyReviewDecisions(classifications: readonly EvidenceClassification[], rawDecisions: readonly unknown[]): EvidenceClassification[] {
  const decisions = rawDecisions.map((value) => reviewDecisionSchema.parse(value));
  const byEvidence = new Map<string, ReviewDecision>();
  for (const decision of decisions) {
    if (byEvidence.has(decision.evidenceId)) throw new Error(`Duplicate review decision for ${decision.evidenceId}.`);
    byEvidence.set(decision.evidenceId, decision);
  }
  return classifications.map((classification) => {
    const decision = byEvidence.get(classification.evidenceId);
    if (!decision) return classification;
    return evidenceClassificationSchema.parse({
      ...classification,
      relevance: decision.decision === "reject" ? "irrelevant" : decision.correctedRelevance ?? classification.relevance,
      barriers: decision.decision === "reject" ? [] : decision.correctedBarrierIds ?? classification.barriers,
      primaryBarrier: decision.decision === "reject" ? null : decision.correctedBarrierIds?.[0] ?? classification.primaryBarrier,
      journeyStages: decision.correctedJourneyStages ?? classification.journeyStages,
      themeIds: decision.decision === "reject" ? [] : classification.themeIds,
      segmentIds: decision.decision === "reject" ? [] : classification.segmentIds,
      severity: decision.decision === "reject" ? 0 : classification.severity,
      humanReviewStatus: decision.decision === "correct" ? "corrected" : decision.decision === "reject" ? "rejected" : "accepted",
      confidenceReason: `${classification.confidenceReason} Review decision: ${decision.decision}.`,
    });
  });
}
