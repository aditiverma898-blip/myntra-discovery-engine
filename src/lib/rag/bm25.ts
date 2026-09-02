export interface RankedDocument<T> { item: T; score: number; }

export function tokenize(value: string): string[] {
  return value.toLocaleLowerCase("en-IN").match(/[a-z0-9]{2,}/gu) ?? [];
}

export function rankBm25<T>(query: string, documents: readonly T[], text: (document: T) => string): RankedDocument<T>[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length || !documents.length) return [];
  const tokenized = documents.map((document) => tokenize(text(document)));
  const averageLength = tokenized.reduce((sum, words) => sum + words.length, 0) / tokenized.length || 1;
  const documentFrequency = new Map<string, number>();
  for (const words of tokenized) {
    const vocabulary = new Set(words);
    for (const term of queryTerms) if (vocabulary.has(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const k1 = 1.2;
  const b = 0.75;
  return documents.map((item, index) => {
    const words = tokenized[index] ?? [];
    const frequencies = new Map<string, number>();
    for (const word of words) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const containing = documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(1 + (documents.length - containing + 0.5) / (containing + 0.5));
      const frequency = frequencies.get(term) ?? 0;
      score += inverseDocumentFrequency * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * (words.length / averageLength))));
    }
    return { item, score: Math.round(score * 1_000_000) / 1_000_000 };
  }).filter((result) => result.score > 0).sort((left, right) => right.score - left.score);
}
