import {
  evidenceClassificationSchema,
  type EvidenceClassification,
  type NormalizedEvidence,
} from "../../src/lib/schemas/pipeline";
import type { BarrierId, JourneyStage } from "../../src/lib/schemas/release";
import { classifyRelevance } from "./relevance";

interface MockSpec {
  journeys: JourneyStage[];
  barriers: BarrierId[];
  themes: string[];
  segments: string[];
  workarounds: string[];
  outcomes: string[];
  action: EvidenceClassification["explicitAction"];
  severity: 0 | 1 | 2 | 3;
  monetary: 0 | 1 | 2;
  solvability: 0 | 1 | 2 | 3;
  positive?: boolean;
  confidence: number;
}

const specs: Record<string, MockSpec> = {
  fit_wait: { journeys: ["revisit", "research", "decision"], barriers: ["fit_size_uncertainty"], themes: ["fit-confidence"], segments: ["active-confidence-seeker"], workarounds: ["Rechecks reviews"], outcomes: ["purchase_delay"], action: "wait", severity: 2, monetary: 0, solvability: 3, confidence: 0.93 },
  material_quality: { journeys: ["revisit", "decision"], barriers: ["material_quality_uncertainty"], themes: ["product-confidence"], segments: ["active-confidence-seeker"], workarounds: [], outcomes: ["bag_progression_delay"], action: "wait", severity: 2, monetary: 0, solvability: 3, confidence: 0.91 },
  color_mismatch: { journeys: ["research", "decision"], barriers: ["color_image_mismatch"], themes: ["product-confidence"], segments: ["risk-sensitive-decider"], workarounds: ["Compares creator videos with catalog photos"], outcomes: ["decision_delay"], action: "research", severity: 1, monetary: 0, solvability: 3, confidence: 0.88 },
  comparison_overload: { journeys: ["revisit", "comparison", "decision"], barriers: ["comparison_overload", "wishlist_clutter_forgetting"], themes: ["decision-resume"], segments: ["comparison-led-revisitor"], workarounds: ["Reopens every saved product"], outcomes: ["decision_delay"], action: "compare", severity: 2, monetary: 0, solvability: 3, confidence: 0.94 },
  return_risk: { journeys: ["revisit", "decision"], barriers: ["return_refund_risk"], themes: ["reversible-purchase"], segments: ["risk-sensitive-decider"], workarounds: [], outcomes: ["bag_progression_delay"], action: "wait", severity: 2, monetary: 0, solvability: 2, confidence: 0.91 },
  positive_fit: { journeys: ["wishlist_add", "decision", "bag"], barriers: ["fit_size_uncertainty"], themes: ["fit-confidence"], segments: ["active-confidence-seeker"], workarounds: ["Uses measurements and customer photos"], outcomes: ["purchase_progression"], action: "buy", severity: 0, monetary: 0, solvability: 3, positive: true, confidence: 0.96 },
  price_waiting: { journeys: ["revisit", "decision"], barriers: ["price_waiting"], themes: [], segments: [], workarounds: ["Waits for a price drop"], outcomes: ["purchase_delay"], action: "wait", severity: 2, monetary: 2, solvability: 0, confidence: 0.98 },
  passive_bookmark: { journeys: ["wishlist_add"], barriers: ["low_purchase_intent_bookmarking"], themes: [], segments: [], workarounds: [], outcomes: ["no_active_purchase_intent"], action: "unknown", severity: 0, monetary: 0, solvability: 0, confidence: 0.95 },
  generic_support: { journeys: ["unknown"], barriers: [], themes: [], segments: [], workarounds: [], outcomes: [], action: "unknown", severity: 1, monetary: 0, solvability: 0, confidence: 0.99 },
  irrelevant_spam: { journeys: ["unknown"], barriers: [], themes: [], segments: [], workarounds: [], outcomes: [], action: "unknown", severity: 0, monetary: 0, solvability: 0, confidence: 0.99 },
  stock_wait: { journeys: ["revisit", "decision"], barriers: ["stock_size_unavailability"], themes: ["availability-planning"], segments: ["active-confidence-seeker"], workarounds: ["Checks availability manually"], outcomes: ["purchase_delay"], action: "wait", severity: 2, monetary: 0, solvability: 3, confidence: 0.96 },
  occasion_uncertainty: { journeys: ["comparison", "decision"], barriers: ["styling_occasion_uncertainty", "social_validation_gap"], themes: ["occasion-confidence"], segments: ["risk-sensitive-decider"], workarounds: ["Asks friends"], outcomes: ["decision_delay"], action: "ask", severity: 1, monetary: 0, solvability: 2, confidence: 0.86 },
  review_trust: { journeys: ["research", "decision"], barriers: ["review_trust_gap", "fit_size_uncertainty"], themes: ["fit-confidence", "product-confidence"], segments: ["active-confidence-seeker"], workarounds: ["Looks for measurements"], outcomes: ["decision_delay"], action: "research", severity: 1, monetary: 0, solvability: 3, confidence: 0.9 },
};

export function mockClassify(record: NormalizedEvidence): EvidenceClassification {
  const relevance = classifyRelevance(record);
  if (!record.scenarioId) throw new Error("Mock classification requires a synthetic scenario ID.");
  const spec = specs[record.scenarioId];
  if (!spec) throw new Error(`No mocked classification for ${record.scenarioId}.`);
  return evidenceClassificationSchema.parse({
    schemaVersion: "1.0.0",
    evidenceId: record.evidenceId,
    relevance: relevance.relevance,
    relevanceReason: relevance.reason,
    wishlistExplicit: /\b(wishlist|wishlisted|saved|revisit)\b/u.test(record.normalizedText),
    journeyStages: spec.journeys,
    barriers: spec.barriers,
    primaryBarrier: spec.barriers[0] ?? null,
    themeIds: spec.themes,
    segmentIds: spec.segments,
    workarounds: spec.workarounds,
    desiredOutcomes: spec.outcomes,
    explicitAction: spec.action,
    severity: spec.severity,
    monetaryDependency: spec.monetary,
    nonMonetarySolvability: spec.solvability,
    contradictoryOrPositive: spec.positive ?? false,
    method: "model",
    modelId: "mock-structured-classifier-v1",
    promptVersion: "fixture-prompt-v1",
    taxonomyVersion: "fixture-taxonomy-v1",
    confidence: spec.confidence,
    confidenceReason: "Deterministic mocked fixture label; not an empirical or model-derived judgment.",
    classifiedAt: "2026-08-22T00:00:00.000Z",
    humanReviewStatus: "accepted",
  });
}

export function mockClassifyRecords(records: readonly NormalizedEvidence[]): EvidenceClassification[] {
  return records.map(mockClassify);
}
