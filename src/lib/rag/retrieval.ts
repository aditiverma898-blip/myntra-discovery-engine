import { filterPublicEvidence, type PublicEvidenceItem } from "@/lib/data/public-evidence";
import type { CopilotRequest } from "@/lib/schemas";
import { rankBm25 } from "./bm25";

const domainVocabulary = /\b(myntra|wishlist|wishlisted|save|saved|intent|uncertainty|fit|size|material|quality|colour|color|review|compare|comparison|return|refund|stock|availability|occasion|segment|cohort|behaviour|behavior|pattern|barrier|decision|journey|action|workaround|purchase|checkout|bag|price|trust|interview|opportunity|evidence)\b/iu;

export interface RetrievalResult { items: PublicEvidenceItem[]; scores: number[]; relevant: boolean; }

export function retrieveEvidence(request: CopilotRequest, evidence: readonly PublicEvidenceItem[], limit = 6): RetrievalResult {
  if (!domainVocabulary.test(request.question)) return { items: [], scores: [], relevant: false };
  const candidates = filterPublicEvidence(evidence, { ...request.filters, limit: 100 });
  const ranked = rankBm25(request.question, candidates, (item) => `${item.excerpt} ${item.themeIds.join(" ")} ${item.segmentIds.join(" ")} ${item.barrierIds.join(" ")} ${item.journeyStages.join(" ")}`);
  const selected: PublicEvidenceItem[] = [];
  const scores: number[] = [];
  const sourceCounts = new Map<string, number>();
  const parentIds = new Set<string>();
  for (const result of ranked) {
    if (selected.length >= limit) break;
    if ((sourceCounts.get(result.item.source) ?? 0) >= 2) continue;
    if (result.item.parentThreadId && parentIds.has(result.item.parentThreadId)) continue;
    selected.push(result.item);
    scores.push(result.score);
    sourceCounts.set(result.item.source, (sourceCounts.get(result.item.source) ?? 0) + 1);
    if (result.item.parentThreadId) parentIds.add(result.item.parentThreadId);
  }
  return { items: selected, scores, relevant: selected.length > 0 };
}
