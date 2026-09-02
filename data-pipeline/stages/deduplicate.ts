import { normalizedEvidenceSchema, type NormalizedEvidence } from "../../src/lib/schemas/pipeline";
import { sha256 } from "./normalize";

function tokens(text: string): Set<string> {
  return new Set(text.match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

export function mergeDuplicateRecord(match: NormalizedEvidence, record: NormalizedEvidence): NormalizedEvidence {
  const groupId = `dup-${sha256([match.contentHash, record.contentHash].sort().join(":" )).slice(0, 12)}`;
  return normalizedEvidenceSchema.parse({
    ...match,
    queryIds: [...new Set([...match.queryIds, ...record.queryIds])].sort(),
    duplicateGroupId: match.duplicateGroupId ?? groupId,
    validationWarnings: [...new Set([...match.validationWarnings, `Merged duplicate ${record.rawId}.`])],
  });
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateRecords(records: readonly NormalizedEvidence[]): {
  canonical: NormalizedEvidence[];
  duplicateCount: number;
} {
  const canonical: NormalizedEvidence[] = [];

  for (const record of records) {
    const match = canonical.find(
      (candidate) => candidate.source === record.source && (candidate.contentHash === record.contentHash || jaccardSimilarity(candidate.normalizedText, record.normalizedText) >= 0.78),
    );
    if (!match) {
      canonical.push(record);
      continue;
    }

    const index = canonical.indexOf(match);
    canonical[index] = mergeDuplicateRecord(match, record);
  }

  return { canonical, duplicateCount: records.length - canonical.length };
}
