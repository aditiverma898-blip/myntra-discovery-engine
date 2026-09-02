import type { SourceId } from "../src/lib/schemas";

export const MYNTRA_KEYWORD_GROUPS = {
  direct_wishlist: ["Myntra wishlist buy later", "Myntra wishlist saved item bought", "Myntra wishlist saved item did not buy", "Myntra wishlist forgot", "Myntra wishlist revisit", "Myntra wishlist remove", "Myntra wishlist clutter", "Myntra wishlist limit", "Myntra wishlist move to bag", "Myntra wishlist size", "Myntra wishlist out of stock", "Myntra wishlist waiting", "Myntra wishlist deciding", "Myntra wishlist confused", "Myntra wishlist compare"],
  fit_product_confidence: ["Myntra size chart accurate", "Myntra fit review", "Myntra material quality", "Myntra colour different from photo", "Myntra customer photos", "Myntra review trust"],
  risk_availability: ["Myntra return before buying", "Myntra refund risk", "Myntra wishlisted size out of stock", "Myntra wishlist restock", "Myntra delivery before occasion"],
  comparison_context: ["Myntra compare saved items", "Myntra wishlist too many items", "Myntra outfit advice", "Myntra wishlist useful"],
  monetary_control: ["Myntra wishlist price", "Myntra waiting for sale", "Myntra payday wishlist"],
  positive_disconfirming: ["Myntra bought from wishlist", "Myntra size guide helped", "Myntra review helped decide", "Myntra wishlist easy to use"],
} as const;

export const PREFERRED_COLLECTION_MATRIX: ReadonlyArray<{ source: SourceId; target: number; approvalRequired: boolean }> = [
  { source: "google_play", target: 8_000, approvalRequired: true },
  { source: "app_store", target: 3_000, approvalRequired: true },
  { source: "youtube", target: 5_000, approvalRequired: true },
  { source: "reddit", target: 2_000, approvalRequired: true },
  { source: "myntra_product_review", target: 2_000, approvalRequired: true },
];

export const FALLBACK_COLLECTION_MATRIX: ReadonlyArray<{ source: SourceId; target: number }> = [
  { source: "google_play", target: 10_000 },
  { source: "app_store", target: 3_000 },
  { source: "youtube", target: 7_000 },
];

const forbiddenCompetitors = /\b(amazon|flipkart|ajio|meesho|nykaa)\b/iu;

export function validateMyntraOnlyKeywords(groups = MYNTRA_KEYWORD_GROUPS): string[] {
  const values = Object.values(groups).flat();
  if (values.some((query) => !/\bmyntra\b/iu.test(query))) throw new Error("Every collection query must be explicitly Myntra-specific.");
  if (values.some((query) => forbiddenCompetitors.test(query))) throw new Error("Other shopping platforms are prohibited from collection queries.");
  return [...new Set(values)];
}
