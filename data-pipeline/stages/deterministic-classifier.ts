import { evidenceClassificationSchema, type EvidenceClassification, type NormalizedEvidence } from "../../src/lib/schemas/pipeline";
import type { BarrierId, JourneyStage } from "../../src/lib/schemas/release";

const wishlistTerms = /\b(wishlist|wishlisted|wish list|saved item|saved product|revisit(?:ed|ing)?)\b/iu;
const decisionTerms = /\b(wait(?:ing)?|buy|bought|purchase|purchased|order(?:ed|ing)?|bag|cart|decid\w*|choos\w*|remove|abandon|return)\b/iu;
const uncertaintyTerms = /\b(how|which|what|why|confus\w*|unsure|uncertain|issue|problem|wrong|different|mismatch|trust|safe|not|cannot|can't|tight|loose|small|large|fake|farzi)\b/iu;
const competitorTerms = /\b(amazon|flipkart|ajio|meesho|messho|nykaa)\b/iu;
const genericReactionTerms = /\b(thanks?|lovely|awesome|awsome|wow|beautiful|classy|aura|collection|look|fashion sense|hit different)\b/iu;
const shoppingMechanismTerms = /\b(size|sizing|fit|material|fabric|quality|colour|color|review|authentic|price|stock|available|delivery|return|refund|order|buy|purchase)\w*/iu;
const strongNegativeTerms = /\b(worst|bad|broken|wrong|fake|farzi|fraud|cheat|unusable|waste|never|cannot|can't|not)\b/iu;
const strongPositiveTerms = /\b(love|loved|good|great|helpful|perfect|best|thanks?|classy|lovely|awesome|awsome)\b/iu;

function actionFor(text: string): EvidenceClassification["explicitAction"] {
  if (/\breturn(?:ed|ing)?\b/iu.test(text)) return "return";
  if (/\babandon|give up|not buy|won't buy|remove\b/iu.test(text)) return "abandon";
  if (/\bcompare|difference|versus|\bvs\b/iu.test(text)) return "compare";
  if (/\bwait|waiting|postpone|later\b/iu.test(text)) return "wait";
  if (/\bask|which|what|how|please tell|batao\b/iu.test(text)) return "ask";
  if (/\bbag|cart\b/iu.test(text)) return "bag";
  if (/\bbuy|bought|purchase|purchased|order|ordered\b/iu.test(text)) return "buy";
  if (/\bresearch|check reviews?|verify\b/iu.test(text)) return "research";
  return "unknown";
}

function barrierLabels(text: string): BarrierId[] {
  const barriers: BarrierId[] = [];
  const uncertain = uncertaintyTerms.test(text) || strongNegativeTerms.test(text);
  if (/\b(size|sizing|fit|tight|loose|small|large)\b/iu.test(text) && uncertain) barriers.push("fit_size_uncertainty");
  if (/\b(material|fabric|quality|stitch)\w*/iu.test(text) && uncertain) barriers.push("material_quality_uncertainty");
  if (/\b(colour|color|image|photo|looks?)\b/iu.test(text) && /\b(different|mismatch|wrong|not same)\b/iu.test(text)) barriers.push("color_image_mismatch");
  if (/\breview\w*/iu.test(text) && /\b(fake|trust|wrong|mislead)\w*/iu.test(text)) barriers.push("review_trust_gap");
  if (/\b(fake|farzi|authentic|original|replica)\w*/iu.test(text)) barriers.push("authenticity_trust_gap");
  if (/\b(compare|difference|versus|\bvs\b)\w*/iu.test(text)) barriers.push("comparison_overload");
  if (/\b(price|cost|expensive|discount)\w*/iu.test(text) && /\b(wait|matter|high|drop|sale)\w*/iu.test(text)) barriers.push("price_waiting");
  if (/\b(out of stock|unavailable|size not available)\b/iu.test(text)) barriers.push("stock_size_unavailability");
  if (/\b(return|refund)\w*/iu.test(text) && uncertaintyTerms.test(text)) barriers.push("return_refund_risk");
  if (/\b(payment|checkout|upi|card failed)\w*/iu.test(text)) barriers.push("checkout_or_payment_friction");
  return [...new Set(barriers)];
}

function themeIdsFor(barriers: readonly BarrierId[]): string[] {
  const themes = new Set<string>();
  if (barriers.includes("fit_size_uncertainty")) themes.add("fit-confidence");
  if (barriers.some((value) => ["material_quality_uncertainty", "color_image_mismatch", "review_trust_gap", "authenticity_trust_gap"].includes(value))) themes.add("product-confidence");
  if (barriers.some((value) => ["comparison_overload", "wishlist_clutter_forgetting"].includes(value))) themes.add("decision-resume");
  if (barriers.includes("return_refund_risk")) themes.add("reversible-purchase");
  if (barriers.includes("stock_size_unavailability")) themes.add("availability-planning");
  return [...themes];
}

function journeyFor(text: string, direct: boolean, relevant: boolean): JourneyStage[] {
  if (!relevant) return ["unknown"];
  const stages = new Set<JourneyStage>();
  if (direct) { stages.add("wishlist_add"); stages.add("revisit"); }
  if (/\b(review|check|verify|how|which|what|size|fit|material|quality)\w*/iu.test(text)) stages.add("research");
  if (/\b(compare|difference|versus|\bvs\b)\w*/iu.test(text)) stages.add("comparison");
  if (decisionTerms.test(text)) stages.add("decision");
  if (/\bbag|cart\b/iu.test(text)) stages.add("bag");
  if (/\breturn|refund|bought|ordered|received\b/iu.test(text)) stages.add("post_purchase");
  if (!stages.size) stages.add("unknown");
  return [...stages];
}

export function deterministicClassify(record: NormalizedEvidence, now = () => new Date().toISOString()): EvidenceClassification {
  const text = record.normalizedText;
  const context = `${record.title ?? ""} ${record.originalText}`.toLocaleLowerCase("en-IN");
  const competitor = competitorTerms.test(context);
  const wishlistExplicit = wishlistTerms.test(text);
  const direct = wishlistExplicit && decisionTerms.test(text);
  const mechanism = shoppingMechanismTerms.test(text);
  const candidateBarriers = barrierLabels(text);
  const explicitIntent = /\b(i|i'm|i am|my|we)\b.{0,80}\b(need|want|plan|trying|decid|choos|buy|order|return)\w*|\b(before i|should i|can i)\b/iu.test(text);
  const adjacent = !direct && mechanism && (candidateBarriers.length > 0 || explicitIntent);
  const shortOrReaction = text.length < 12 || (genericReactionTerms.test(text) && !mechanism && !decisionTerms.test(text));
  const toolDiscussion = /\b(code|seed|site|ai tool|virtual try|revachiai)\b/iu.test(text) && /\b(virtual|ai tool)\b/iu.test(record.title ?? "");
  const relevance = competitor || shortOrReaction || toolDiscussion ? "irrelevant" : direct ? "direct_wishlist" : adjacent ? "journey_adjacent" : "general";
  const relevanceReason = competitor
    ? "The evidence discusses another shopping platform and is excluded from the Myntra-only analysis scope."
    : shortOrReaction
      ? "The comment is too short or is a generic creator reaction without a usable shopping-decision mechanism."
      : toolDiscussion
        ? "The comment concerns the creator's technical tool rather than a Myntra shopping decision."
        : direct
          ? "The comment explicitly connects a saved or wishlisted item with a decision or progression action."
          : adjacent
            ? "The comment contains a Myntra-context shopping mechanism and an explicit uncertainty or action, without saved-item evidence."
            : "The comment is Myntra-context feedback but does not contain a qualifying saved-item or shopping-decision mechanism.";
  const relevant = relevance === "direct_wishlist" || relevance === "journey_adjacent";
  const barriers = relevant ? candidateBarriers : [];
  const action = relevant ? actionFor(text) : "unknown";
  const positive = strongPositiveTerms.test(text) && !strongNegativeTerms.test(text);
  const negative = strongNegativeTerms.test(text);
  const severity: 0 | 1 | 2 | 3 = !relevant ? 0 : /\b(abandon|never|fraud|cheat|worst)\b/iu.test(text) ? 3 : negative ? 2 : barriers.length ? 1 : 0;
  const confidence = competitor ? 0.98 : shortOrReaction ? 0.9 : direct ? 0.86 : adjacent ? 0.74 : 0.68;
  return evidenceClassificationSchema.parse({
    schemaVersion: "1.0.0",
    evidenceId: record.evidenceId,
    relevance,
    relevanceReason,
    wishlistExplicit,
    journeyStages: journeyFor(text, direct, relevant),
    barriers,
    primaryBarrier: barriers[0] ?? null,
    themeIds: themeIdsFor(barriers),
    segmentIds: relevant && barriers.length ? ["active-confidence-seeker"] : [],
    workarounds: /\b(check reviews?|verify|watch(?:ed|ing)? video)\b/iu.test(text) ? ["Seeks additional product evidence"] : [],
    desiredOutcomes: barriers.includes("fit_size_uncertainty") ? ["choose_size_with_confidence"] : barriers.length ? ["reduce_purchase_uncertainty"] : [],
    explicitAction: action,
    severity,
    monetaryDependency: barriers.includes("price_waiting") ? 2 : 0,
    nonMonetarySolvability: barriers.includes("price_waiting") ? 0 : barriers.length ? 3 : 0,
    contradictoryOrPositive: relevant && positive,
    method: "rule",
    modelId: "local-deterministic-rules-v1",
    promptVersion: "not-applicable-rule-v1",
    taxonomyVersion: "candidate-taxonomy-v1",
    confidence,
    confidenceReason: "Deterministic candidate label from explicit text patterns; title/query context never establishes user intent and human review is still required.",
    classifiedAt: now(),
    humanReviewStatus: "unreviewed",
  });
}

export function deterministicClassifyRecords(records: readonly NormalizedEvidence[], now?: () => string): EvidenceClassification[] {
  return records.map((record) => deterministicClassify(record, now));
}
