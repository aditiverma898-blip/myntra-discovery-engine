import {
  dashboardReleaseSchema,
  opportunitySchema,
  type BehavioralSegment,
  type DashboardRelease,
  type Opportunity,
  type ThemeDefinition,
} from "../../src/lib/schemas/release";
import type { EvidenceClassification, NormalizedEvidence } from "../../src/lib/schemas/pipeline";
import { publicEvidenceItemSchema } from "../../src/lib/schemas/api";
import { EMPTY_DASHBOARD_RELEASE } from "../../src/lib/data/empty-release";
import { buildReleaseAnalytics } from "../../src/lib/data/evidence-analytics";

const GENERATED_AT = "2026-08-22T00:00:00.000Z";

const themeCatalog: Record<string, Omit<ThemeDefinition, "representativeEvidenceIds" | "contradictoryEvidenceIds" | "confidence">> = {
  "fit-confidence": { themeId: "fit-confidence", taxonomyVersion: "fixture-taxonomy-v1", name: "Fit and size confidence", status: "discovered", userGoal: "Choose a suitable size with enough confidence to progress.", barrierOrNeed: "Size and silhouette evidence is not personally diagnostic.", journeyStages: ["research", "revisit", "decision"], inclusionCriteria: ["Explicit fit or size uncertainty tied to a decision."], exclusionCriteria: ["Post-purchase sizing with no future decision link."], relatedBarrierIds: ["fit_size_uncertainty", "review_trust_gap"], typicalWorkarounds: ["Rechecking reviews", "Looking for measurements"], reviewedBy: "synthetic-fixture-review", reviewedAt: GENERATED_AT },
  "product-confidence": { themeId: "product-confidence", taxonomyVersion: "fixture-taxonomy-v1", name: "Product evidence confidence", status: "discovered", userGoal: "Understand likely material and visual reality before purchase.", barrierOrNeed: "Catalog evidence does not resolve material, colour, or review conflict.", journeyStages: ["research", "decision"], inclusionCriteria: ["Material, colour, image, or review diagnosticity affects a decision."], exclusionCriteria: ["Actual fulfillment failures without pre-purchase uncertainty."], relatedBarrierIds: ["material_quality_uncertainty", "color_image_mismatch", "review_trust_gap"], typicalWorkarounds: ["Comparing external photos", "Looking for measurements"], reviewedBy: "synthetic-fixture-review", reviewedAt: GENERATED_AT },
  "decision-resume": { themeId: "decision-resume", taxonomyVersion: "fixture-taxonomy-v1", name: "Comparison and decision-resume effort", status: "discovered", userGoal: "Resume a saved-item comparison without reconstructing prior reasoning.", barrierOrNeed: "Saved options lose context and require repeated comparison.", journeyStages: ["revisit", "comparison", "decision"], inclusionCriteria: ["Repeated comparison or forgotten shortlist rationale is explicit."], exclusionCriteria: ["Passive inspiration with no active decision."], relatedBarrierIds: ["comparison_overload", "wishlist_clutter_forgetting"], typicalWorkarounds: ["Reopening every product"], reviewedBy: "synthetic-fixture-review", reviewedAt: GENERATED_AT },
  "reversible-purchase": { themeId: "reversible-purchase", taxonomyVersion: "fixture-taxonomy-v1", name: "Reversible purchase confidence", status: "discovered", userGoal: "Understand the effort and timing required if a choice is wrong.", barrierOrNeed: "Return and refund uncertainty delays an otherwise active choice.", journeyStages: ["revisit", "decision"], inclusionCriteria: ["Return or refund uncertainty is linked to pre-purchase delay."], exclusionCriteria: ["Resolved post-purchase support complaints."], relatedBarrierIds: ["return_refund_risk"], typicalWorkarounds: [], reviewedBy: "synthetic-fixture-review", reviewedAt: GENERATED_AT },
  "availability-planning": { themeId: "availability-planning", taxonomyVersion: "fixture-taxonomy-v1", name: "Preferred-variant availability", status: "discovered", userGoal: "Know when a required saved variant becomes available.", barrierOrNeed: "Manual stock checking interrupts an active decision.", journeyStages: ["revisit", "decision"], inclusionCriteria: ["A required variant is unavailable and purchase intent remains."], exclusionCriteria: ["General browsing without a preferred variant."], relatedBarrierIds: ["stock_size_unavailability"], typicalWorkarounds: ["Checking availability manually"], reviewedBy: "synthetic-fixture-review", reviewedAt: GENERATED_AT },
  "occasion-confidence": { themeId: "occasion-confidence", taxonomyVersion: "fixture-taxonomy-v1", name: "Occasion and styling confidence", status: "discovered", userGoal: "Judge whether a product suits a specific context.", barrierOrNeed: "Styling context is insufficient for an occasion decision.", journeyStages: ["comparison", "decision"], inclusionCriteria: ["A named occasion or styling requirement affects choice."], exclusionCriteria: ["General aesthetic preference."], relatedBarrierIds: ["styling_occasion_uncertainty", "social_validation_gap"], typicalWorkarounds: ["Asking friends"], reviewedBy: "synthetic-fixture-review", reviewedAt: GENERATED_AT },
};

const segmentCatalog: Record<string, Omit<BehavioralSegment, "evidenceIds" | "topBarrierIds" | "confidence">> = {
  "active-confidence-seeker": { segmentId: "active-confidence-seeker", name: "Active confidence seeker", status: "evidence_supported", definition: "Revisits or researches a specific product but lacks enough fit, material, or stock confidence to progress.", qualifyingBehaviors: ["Explicit active interest", "Repeated evidence seeking", "Decision remains open"], exclusionRules: ["Passive inspiration only", "Price-only waiting"], unknowns: ["Commercial value", "Demographics", "Internal purchase history"], interviewRecruitmentRule: "Recruit people who revisited a Myntra saved item at least twice and sought product evidence before deciding." },
  "comparison-led-revisitor": { segmentId: "comparison-led-revisitor", name: "Comparison-led revisitor", status: "evidence_supported", definition: "Maintains multiple live options and reconstructs trade-offs on revisit.", qualifyingBehaviors: ["Multiple saved alternatives", "Repeated comparison"], exclusionRules: ["Single passive bookmark"], unknowns: ["Shortlist duration", "Final purchase outcome"], interviewRecruitmentRule: "Recruit people who compared three or more Myntra saved items during their latest active decision." },
  "risk-sensitive-decider": { segmentId: "risk-sensitive-decider", name: "Risk-sensitive decider", status: "evidence_supported", definition: "Seeks visual, occasion, or reversibility evidence before committing.", qualifyingBehaviors: ["Explicit downside uncertainty", "Uses a verification workaround"], exclusionRules: ["Resolved operational complaint only"], unknowns: ["Risk tolerance outside this decision", "Purchase frequency"], interviewRecruitmentRule: "Recruit people who delayed a Myntra fashion decision while checking mismatch, occasion, or return risk." },
};

const opportunityDefinitions = [
  { id: "fit-decision-support", name: "Make saved-item fit decisions easier to resume", description: "Preserve and surface personally diagnostic size evidence when an interested shopper revisits a saved item.", themes: ["fit-confidence"], segments: ["active-confidence-seeker"] },
  { id: "product-evidence-clarity", name: "Increase product-evidence diagnosticity", description: "Help shoppers reconcile material, visual, and review evidence before committing.", themes: ["product-confidence"], segments: ["active-confidence-seeker", "risk-sensitive-decider"] },
  { id: "shortlist-memory", name: "Preserve shortlist comparison context", description: "Reduce the work required to reconstruct why similar products were saved and how they differ.", themes: ["decision-resume"], segments: ["comparison-led-revisitor"] },
  { id: "reversibility-clarity", name: "Clarify purchase reversibility at decision time", description: "Make relevant return and refund expectations easier to understand before bag progression.", themes: ["reversible-purchase"], segments: ["risk-sensitive-decider"] },
  { id: "preferred-variant-availability", name: "Make preferred variants easier to track", description: "Help an interested shopper monitor and resume a saved-item decision when their preferred size or variant is unavailable.", themes: ["availability-planning"], segments: ["active-confidence-seeker"], interviewQuestions: ["Tell me about the last time your preferred size or variant was unavailable on Myntra.", "What did you do after discovering it was unavailable?", "How often did you return to check it?", "What information or notification would have been useful?", "When would availability monitoring become annoying or no longer useful?", "Did you continue waiting, choose another product, or abandon the decision?"] },
] as const;

const proximity: Record<string, number> = { unknown: 0, wishlist_add: 35, active_intent: 50, revisit: 60, research: 55, comparison: 70, decision: 85, bag: 95, checkout: 100, post_purchase: 20 };

function round(value: number): number { return Math.round(value * 10) / 10; }
function average(values: readonly number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

export function calculateOpportunityScore(inputs: Opportunity["scoreInputs"]): { baseScore: number; adjustedScore: number } {
  const baseScore = 0.25 * inputs.corpusFrequency + 0.2 * inputs.severity + 0.2 * inputs.conversionProximity + 0.15 * inputs.nonMonetarySolvability + 0.1 * inputs.targetSegmentValue + 0.1 * inputs.evidenceConfidence;
  return { baseScore: round(baseScore), adjustedScore: round(baseScore * (1 - 0.5 * inputs.monetaryDependency)) };
}

export function buildAggregates(records: readonly NormalizedEvidence[], classifications: readonly EvidenceClassification[], options?: { datasetVersion?: string; generatedAt?: string; synthetic?: boolean; releaseStatus?: "partial" | "ready" }): {
  dashboard: DashboardRelease;
  publicEvidence: ReturnType<typeof publicEvidenceItemSchema.parse>[];
} {
  const datasetVersion = options?.datasetVersion ?? "fixture-001";
  const generatedAt = options?.generatedAt ?? GENERATED_AT;
  const synthetic = options?.synthetic ?? true;
  const independentlyReviewed = classifications.every((item) => item.humanReviewStatus !== "unreviewed");
  const taxonomyVersions = [...new Set(classifications.map((item) => item.taxonomyVersion))];
  const taxonomyVersion = synthetic ? "fixture-taxonomy-v1" : taxonomyVersions.length === 1 ? taxonomyVersions[0]! : "mixed-candidate-taxonomy";
  const byId = new Map(records.map((record) => [record.evidenceId, record]));
  const classificationById = new Map(classifications.map((classification) => [classification.evidenceId, classification]));
  const relevant = classifications.filter((item) => item.relevance === "direct_wishlist" || item.relevance === "journey_adjacent");
  const themes = Object.keys(themeCatalog).sort().map((themeId): ThemeDefinition => {
    const support = classifications.filter((item) => item.themeIds.includes(themeId));
    const catalog = themeCatalog[themeId];
    if (!catalog) throw new Error(`Missing theme catalog entry ${themeId}.`);
    return { ...catalog, taxonomyVersion, reviewedBy: synthetic ? catalog.reviewedBy : null, reviewedAt: synthetic ? catalog.reviewedAt : null, representativeEvidenceIds: support.slice(0, 3).map((item) => item.evidenceId), contradictoryEvidenceIds: support.filter((item) => item.contradictoryOrPositive).map((item) => item.evidenceId), confidence: round(average(support.map((item) => item.confidence))) };
  });
  const segments = Object.keys(segmentCatalog).sort().map((segmentId): BehavioralSegment => {
    const support = classifications.filter((item) => item.segmentIds.includes(segmentId));
    const catalog = segmentCatalog[segmentId];
    if (!catalog) throw new Error(`Missing segment catalog entry ${segmentId}.`);
    const barriers = [...new Set(support.flatMap((item) => item.barriers))];
    return { ...catalog, status: synthetic || independentlyReviewed ? catalog.status : "hypothesis", evidenceIds: support.map((item) => item.evidenceId), topBarrierIds: barriers, confidence: round(average(support.map((item) => item.confidence))) };
  });
  const opportunities = opportunityDefinitions.map((definition): Opportunity => {
    const support = classifications.filter((item) => item.themeIds.some((themeId) => definition.themes.includes(themeId as never)));
    const evidenceIds = support.map((item) => item.evidenceId);
    const sourceDistribution: Record<string, number> = {};
    for (const id of evidenceIds) { const source = byId.get(id)?.source; if (source) sourceDistribution[source] = (sourceDistribution[source] ?? 0) + 1; }
    const scoreInputs = {
      corpusFrequency: round((support.length / relevant.length) * 100),
      severity: round((average(support.map((item) => item.severity)) / 3) * 100),
      conversionProximity: round(average(support.map((item) => Math.max(...item.journeyStages.map((stage) => proximity[stage] ?? 0))))),
      nonMonetarySolvability: round((average(support.map((item) => item.nonMonetarySolvability)) / 3) * 100),
      targetSegmentValue: support.length ? round((support.filter((item) => item.segmentIds.some((id) => definition.segments.includes(id as never))).length / support.length) * 100) : 0,
      evidenceConfidence: round(average(support.map((item) => item.confidence)) * 100),
      monetaryDependency: round(average(support.map((item) => item.monetaryDependency)) / 2),
    };
    const scores = calculateOpportunityScore(scoreInputs);
    return opportunitySchema.parse({
      opportunityId: definition.id, name: definition.name, description: definition.description, status: "engine_candidate",
      affectedProductOutcomes: ["wishlist_to_bag_progression", "purchase_within_30_days_hypothesis"], themeIds: [...definition.themes], segmentIds: [...definition.segments], evidenceIds,
      directEvidenceCount: support.filter((item) => item.relevance === "direct_wishlist").length, adjacentEvidenceCount: support.filter((item) => item.relevance === "journey_adjacent").length,
      sourceDistribution, workaroundSummary: [...new Set(support.flatMap((item) => item.workarounds))], scoreInputs, ...scores,
      confidenceBand: support.length >= 3 ? "high" : "medium",
      limitations: synthetic
        ? ["Synthetic fixture output only; it is not a finding about Myntra shoppers.", `Denominator is ${relevant.length} synthetic relevant evidence units.`]
        : independentlyReviewed
          ? ["Corpus-derived candidate only; it does not establish population prevalence or causal conversion impact.", `Denominator is ${relevant.length} reviewed relevant corpus evidence units.`]
          : ["PROVISIONAL: labels and opportunity support are deterministic candidates without independent human review.", "This candidate does not establish population prevalence or causal conversion impact.", `Denominator is ${relevant.length} unreviewed candidate-relevant corpus evidence units.`],
      interviewQuestions: "interviewQuestions" in definition ? [...definition.interviewQuestions] : ["What evidence did you need when you revisited the saved item?", "What would have helped you progress without a discount?"],
    });
  }).sort((a, b) => b.adjustedScore - a.adjustedScore);

  const publicEvidence = records.map((record) => {
    const classification = classificationById.get(record.evidenceId);
    if (!classification) throw new Error(`Missing classification for ${record.evidenceId}.`);
    return publicEvidenceItemSchema.parse({ evidenceId: record.evidenceId, source: record.source, sourceItemType: record.sourceItemType, parentThreadId: record.parentThreadId, canonicalUrl: null, publishedAt: record.publishedAt, excerpt: record.originalText, relevance: classification.relevance, themeIds: classification.themeIds, segmentIds: classification.segmentIds, barrierIds: classification.barriers, journeyStages: classification.journeyStages, confidence: classification.confidence, rating: record.rating, severity: classification.severity, primaryBarrier: classification.primaryBarrier, explicitAction: classification.explicitAction, contradictoryOrPositive: classification.contradictoryOrPositive, labelMethod: classification.method === "human" ? "human" : classification.method === "rule" ? "heuristic" : "model", humanReviewStatus: classification.humanReviewStatus });
  });
  const sources = [...new Set(records.map((record) => record.source))].sort();
  const relevanceKeys = ["direct_wishlist", "journey_adjacent", "general", "irrelevant"] as const;
  const dashboard = dashboardReleaseSchema.parse({
    status: options?.releaseStatus ?? (synthetic ? "ready" : "partial"), datasetVersion, generatedAt, productScope: "myntra",
    sources: { configured: sources, collected: sources },
    totals: { evidence: records.length, themes: themes.length, segments: segments.length, opportunities: opportunities.length },
    relevanceDistribution: relevanceKeys.map((key) => ({ key, count: classifications.filter((item) => item.relevance === key).length, denominator: records.length })),
    sourceStats: sources.map((source) => {
      const items = records.filter((record) => record.source === source);
      const ids = new Set(items.map((record) => record.evidenceId));
      const dates = items.map((item) => item.publishedAt).filter((value): value is string => value !== null).sort();
      return { source, count: items.length, directCount: classifications.filter((item) => ids.has(item.evidenceId) && item.relevance === "direct_wishlist").length, coverageFrom: dates[0] ?? null, coverageTo: dates.at(-1) ?? null, warnings: synthetic ? ["Synthetic fixture source; no source request occurred."] : independentlyReviewed ? [] : ["Source counts use unreviewed deterministic candidate labels."] };
    }),
    analytics: buildReleaseAnalytics(publicEvidence, themes, opportunities),
    themes, segments, opportunities, hypotheses: EMPTY_DASHBOARD_RELEASE.hypotheses,
    quality: { status: "passed_with_warnings", warnings: synthetic ? ["All records and labels are synthetic.", "Fixture volume is intentionally small and does not satisfy the 20,000-record production target."] : independentlyReviewed ? ["Real corpus output remains partial until taxonomy review, claim review, and release approval pass."] : ["All evidence labels, themes, segments, and opportunity rankings are unreviewed candidates.", "Real corpus output remains partial until human evaluation, taxonomy review, claim review, and release approval pass."] },
  });
  return { dashboard, publicEvidence };
}

export function buildFixtureAggregates(records: readonly NormalizedEvidence[], classifications: readonly EvidenceClassification[], options?: { datasetVersion?: string; generatedAt?: string }): ReturnType<typeof buildAggregates> {
  return buildAggregates(records, classifications, { ...options, synthetic: true, releaseStatus: "ready" });
}
