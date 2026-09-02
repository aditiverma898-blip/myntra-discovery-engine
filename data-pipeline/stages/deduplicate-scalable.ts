import type { NormalizedEvidence } from "../../src/lib/schemas/pipeline";
import { mergeDuplicateRecord } from "./deduplicate";

const NEAR_DUPLICATE_THRESHOLD = 0.78;
const MAX_POSTING_ABSOLUTE = 512;
const MAX_POSTING_FRACTION = 0.01;

function tokens(text: string): string[] {
  return [...new Set(text.match(/[\p{L}\p{N}]{3,}/gu) ?? [])];
}

function prefixTokens(recordTokens: readonly string[], frequencies: ReadonlyMap<string, number>): string[] {
  if (!recordTokens.length) return [];
  const ordered = [...recordTokens].sort((left, right) => (frequencies.get(left) ?? 0) - (frequencies.get(right) ?? 0) || left.localeCompare(right));
  const prefixLength = ordered.length - Math.ceil(NEAR_DUPLICATE_THRESHOLD * ordered.length) + 1;
  return ordered.slice(0, Math.max(1, prefixLength));
}

function jaccardTokenSimilarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  let intersection = 0;
  for (const token of smaller) if (larger.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateRecordsScalable(records: readonly NormalizedEvidence[]): { canonical: NormalizedEvidence[]; duplicateCount: number } {
  const recordTokens = records.map((record) => tokens(record.normalizedText));
  const recordTokenSets = recordTokens.map((values) => new Set(values));
  const frequencies = new Map<string, number>();
  for (const values of recordTokens) for (const token of values) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  const maximumPostingFrequency = Math.max(64, Math.min(MAX_POSTING_ABSOLUTE, Math.ceil(records.length * MAX_POSTING_FRACTION)));
  const exactCanonicalIndex = new Map<string, number>();
  const prefixIndex = new Map<string, number[]>();
  const canonical: NormalizedEvidence[] = [];
  const canonicalTokenSets: Set<string>[] = [];
  let duplicateCount = 0;

  for (const [recordIndex, record] of records.entries()) {
    const exactKey = `${record.source}:${record.contentHash}`;
    const exactIndex = exactCanonicalIndex.get(exactKey);
    if (exactIndex !== undefined) {
      const existing = canonical[exactIndex];
      if (!existing) throw new Error("Exact duplicate index is unavailable.");
      canonical[exactIndex] = mergeDuplicateRecord(existing, record);
      duplicateCount += 1;
      continue;
    }

    // Corpus-wide boilerplate creates enormous posting lists without adding useful
    // candidate selectivity. Exact duplicates are already handled above; near
    // duplicates enter through bounded, rarer prefix tokens.
    const prefix = prefixTokens(recordTokens[recordIndex] ?? [], frequencies)
      .filter((token) => (frequencies.get(token) ?? 0) <= maximumPostingFrequency);
    const candidates = new Set<number>();
    for (const token of prefix) for (const candidate of prefixIndex.get(`${record.source}:${token}`) ?? []) candidates.add(candidate);
    const currentTokens = recordTokenSets[recordIndex] ?? new Set<string>();
    let nearIndex: number | undefined;
    for (const candidateIndex of candidates) {
      const candidate = canonical[candidateIndex];
      const candidateTokens = canonicalTokenSets[candidateIndex];
      if (!candidate || !candidateTokens) continue;
      const smallerSize = Math.min(currentTokens.size, candidateTokens.size);
      const largerSize = Math.max(currentTokens.size, candidateTokens.size);
      if (largerSize === 0 || smallerSize / largerSize < NEAR_DUPLICATE_THRESHOLD) continue;
      if (jaccardTokenSimilarity(candidateTokens, currentTokens) >= NEAR_DUPLICATE_THRESHOLD) {
        nearIndex = candidateIndex;
        break;
      }
    }
    if (nearIndex !== undefined) {
      const existing = canonical[nearIndex];
      if (!existing) throw new Error("Near-duplicate index is unavailable.");
      canonical[nearIndex] = mergeDuplicateRecord(existing, record);
      exactCanonicalIndex.set(exactKey, nearIndex);
      duplicateCount += 1;
      continue;
    }

    const index = canonical.length;
    canonical.push(record);
    canonicalTokenSets.push(currentTokens);
    exactCanonicalIndex.set(exactKey, index);
    for (const token of prefix) {
      const postingKey = `${record.source}:${token}`;
      const postings = prefixIndex.get(postingKey) ?? [];
      postings.push(index);
      prefixIndex.set(postingKey, postings);
    }
  }

  return { canonical, duplicateCount };
}
