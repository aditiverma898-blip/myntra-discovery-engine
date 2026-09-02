export interface VectorDescriptor { provider: string; model: string; dimensions: number; }
export interface VectorItem extends VectorDescriptor { evidenceId: string; vector: number[]; }

export function assertCompatibleVectors(query: VectorDescriptor & { vector: number[] }, item: VectorItem): void {
  if (query.provider !== item.provider || query.model !== item.model || query.dimensions !== item.dimensions || query.vector.length !== query.dimensions || item.vector.length !== item.dimensions) {
    throw new Error("VECTOR_CONFIGURATION_MISMATCH");
  }
}

export function cosineSimilarity(query: VectorDescriptor & { vector: number[] }, item: VectorItem): number {
  assertCompatibleVectors(query, item);
  const dot = query.vector.reduce((sum, value, index) => sum + value * (item.vector[index] ?? 0), 0);
  const left = Math.sqrt(query.vector.reduce((sum, value) => sum + value * value, 0));
  const right = Math.sqrt(item.vector.reduce((sum, value) => sum + value * value, 0));
  return left && right ? dot / (left * right) : 0;
}
