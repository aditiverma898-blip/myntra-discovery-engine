import { performance } from "node:perf_hooks";

import { generateSyntheticLoad } from "../fixtures/generated-load";
import { buildFixtureAggregates } from "../stages/aggregate";
import { deduplicateRecordsScalable } from "../stages/deduplicate-scalable";
import { mockClassifyRecords } from "../stages/mock-classifier";
import { normalizeRecords } from "../stages/normalize";

export interface BenchmarkResult {
  count: number;
  canonicalCount: number;
  durationsMs: Record<"generate" | "normalize" | "deduplicate" | "classify" | "aggregate" | "total", number>;
  heapDeltaMb: number;
  externalCallsMade: false;
}

export function runGeneratedPerformanceBenchmark(count = 20_000): BenchmarkResult {
  const started = performance.now();
  const heapStart = process.memoryUsage().heapUsed;
  const raw = generateSyntheticLoad(count);
  const generated = performance.now();
  const normalized = normalizeRecords(raw);
  const normalizedAt = performance.now();
  const deduplicated = deduplicateRecordsScalable(normalized);
  const deduplicatedAt = performance.now();
  const classifications = mockClassifyRecords(deduplicated.canonical);
  const classifiedAt = performance.now();
  buildFixtureAggregates(deduplicated.canonical, classifications);
  const completed = performance.now();
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    count,
    canonicalCount: deduplicated.canonical.length,
    durationsMs: { generate: round(generated - started), normalize: round(normalizedAt - generated), deduplicate: round(deduplicatedAt - normalizedAt), classify: round(classifiedAt - deduplicatedAt), aggregate: round(completed - classifiedAt), total: round(completed - started) },
    heapDeltaMb: round((process.memoryUsage().heapUsed - heapStart) / 1024 / 1024),
    externalCallsMade: false,
  };
}
