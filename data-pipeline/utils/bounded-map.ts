export async function boundedMap<T, R>(values: readonly T[], concurrency: number, operation: (value: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 20) throw new Error("Concurrency must be a finite integer from 1 to 20.");
  const output = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor++;
      const value = values[index];
      if (value !== undefined) output[index] = await operation(value, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return output;
}
