import type { EvidenceClassification, NormalizedEvidence } from "../../src/lib/schemas/pipeline";

export interface LexicalThemeCluster {
  clusterId: string;
  label: string;
  evidenceIds: string[];
  topTerms: string[];
}

const stopWords = new Set(["this", "that", "with", "from", "have", "will", "myntra", "because", "before", "each", "still", "want", "saved"]);

export function discoverLexicalThemes(
  records: readonly NormalizedEvidence[],
  classifications: readonly EvidenceClassification[],
): LexicalThemeCluster[] {
  const byEvidence = new Map(records.map((record) => [record.evidenceId, record]));
  const themeIds = [...new Set(classifications.flatMap((classification) => classification.themeIds))].sort();
  return themeIds.map((themeId) => {
    const evidenceIds = classifications.filter((item) => item.themeIds.includes(themeId)).map((item) => item.evidenceId).sort();
    const frequencies = new Map<string, number>();
    for (const evidenceId of evidenceIds) {
      const words = byEvidence.get(evidenceId)?.normalizedText.match(/[a-z]{4,}/gu) ?? [];
      for (const word of new Set(words.filter((candidate) => !stopWords.has(candidate)))) {
        frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
      }
    }
    const topTerms = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([word]) => word);
    return { clusterId: `lexical-${themeId}`, label: themeId, evidenceIds, topTerms };
  });
}
