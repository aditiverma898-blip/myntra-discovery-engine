import { createHash } from "node:crypto";

import { assertExternalCallsAllowed } from "../../src/lib/external-access";
import { embeddingRecordSchema, evidenceClassificationSchema, type EmbeddingRecord, type EvidenceClassification, type NormalizedEvidence } from "../../src/lib/schemas/pipeline";
import type { SourceId } from "../../src/lib/schemas/release";
import { mockClassify } from "../stages/mock-classifier";

function vectorFromText(text: string): number[] {
  const bytes = createHash("sha256").update(text).digest();
  const values = Array.from({ length: 8 }, (_, index) => ((bytes[index] ?? 0) - 127.5) / 127.5);
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => Math.round((value / norm) * 1_000_000) / 1_000_000);
}

export function classifyWithMock(record: NormalizedEvidence): EvidenceClassification { return mockClassify(record); }
export function embedWithMock(record: NormalizedEvidence): EmbeddingRecord { return embeddingRecordSchema.parse({ schemaVersion: "1.0.0", evidenceId: record.evidenceId, provider: "mock", model: "deterministic-hash-embedding-v1", dimensions: 8, vector: vectorFromText(record.normalizedText), textHash: record.contentHash, embeddedAt: "2026-08-22T00:00:00.000Z" }); }

interface ExternalAiOptions {
  source: SourceId;
  sourceApprovalStatus: "approved" | "disabled" | "rejected";
  maxItems: number;
  maxCost: number;
  argv?: readonly string[];
  environment?: Record<string, string | undefined>;
}

export async function classifyWithExternalProvider(record: NormalizedEvidence, options: ExternalAiOptions, transport: (text: string) => Promise<unknown>): Promise<EvidenceClassification> {
  assertExternalCallsAllowed({ ...options });
  return evidenceClassificationSchema.parse(await transport(record.normalizedText));
}

export async function embedWithExternalProvider(record: NormalizedEvidence, options: ExternalAiOptions, transport: (text: string) => Promise<unknown>): Promise<EmbeddingRecord> {
  assertExternalCallsAllowed({ ...options });
  return embeddingRecordSchema.parse(await transport(record.normalizedText));
}
