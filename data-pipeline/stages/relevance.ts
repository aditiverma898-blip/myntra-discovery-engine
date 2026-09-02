import type { NormalizedEvidence } from "../../src/lib/schemas/pipeline";
import type { Relevance } from "../../src/lib/schemas/release";

const wishlistTerms = /\b(wishlist|wishlisted|saved|revisit)\b/u;
const decisionTerms = /\b(wait|waiting|buy|bought|purchase|bag|decid|choos|postpone|plan|remove)\w*/u;
const adjacentTerms = /\b(order|ordering|purchase|buy|decid|compar|fit|size|material|colour|color|return|review)\w*/u;
const spamTerms = /\b(install now|bonus|promotional template)\b/u;

export function classifyRelevance(record: NormalizedEvidence): {
  relevance: Relevance;
  reason: string;
} {
  const text = record.normalizedText;
  if (spamTerms.test(text)) return { relevance: "irrelevant", reason: "Promotional or unrelated template content." };
  if (wishlistTerms.test(text) && decisionTerms.test(text)) {
    return { relevance: "direct_wishlist", reason: "A saved item and an explicit decision or progression outcome are both present." };
  }
  if (adjacentTerms.test(text) && /\bmyntra\b/u.test(text)) {
    return { relevance: "journey_adjacent", reason: "A Myntra fashion decision mechanism is explicit without a saved-item outcome." };
  }
  return { relevance: "general", reason: "Myntra feedback is present without a qualifying saved-item decision mechanism." };
}
