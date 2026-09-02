import { createHash } from "node:crypto";

import {
  normalizedEvidenceSchema,
  rawEvidenceSchema,
  type NormalizedEvidence,
  type RawEvidence,
  type ValidationLedgerEntry,
} from "../../src/lib/schemas/pipeline";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function minimizeText(value: string): { text: string; redacted: boolean } {
  let redacted = false;
  const text = value
    .replace(/&#(x[0-9a-f]+|\d+);/giu, (entity, code: string) => {
      const radix = code.toLowerCase().startsWith("x") ? 16 : 10;
      const numeric = Number.parseInt(radix === 16 ? code.slice(1) : code, radix);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 0x10ffff) return entity;
      try { return String.fromCodePoint(numeric); } catch { return entity; }
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/giu, (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[name.toLowerCase()] ?? " ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, () => { redacted = true; return "[redacted]"; })
    .replace(/(^|\s)@[A-Za-z0-9_]+/gu, (_, prefix: string) => { redacted = true; return `${prefix}[redacted]`; })
    .replace(/\s+/gu, " ")
    .trim();
  return { text, redacted };
}

export function validateRawRecords(values: readonly unknown[]): {
  valid: RawEvidence[];
  ledger: ValidationLedgerEntry[];
} {
  const valid: RawEvidence[] = [];
  const ledger: ValidationLedgerEntry[] = [];

  values.forEach((value, index) => {
    const parsed = rawEvidenceSchema.safeParse(value);
    if (parsed.success) valid.push(parsed.data);
    else {
      const rawId = typeof value === "object" && value !== null && "rawId" in value && typeof value.rawId === "string" ? value.rawId : `row-${index + 1}`;
      ledger.push({
        rawId,
        stage: "raw_validation",
        code: "RAW_SCHEMA_INVALID",
        message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
        disposition: "quarantined",
      });
    }
  });

  return { valid, ledger };
}

export function normalizeRecord(raw: RawEvidence): NormalizedEvidence {
  const minimized = minimizeText(raw.text);
  const normalizedText = minimized.text.toLocaleLowerCase("en-IN");
  const identityMetadataReceived = ["userName", "profileUrl", "author", "avatar"].some((key) => key in raw.sourceMetadata);
  const youtubeVideoId = raw.source === "youtube" && typeof raw.sourceMetadata.videoId === "string" && raw.sourceMetadata.videoId.trim()
    ? raw.sourceMetadata.videoId.trim()
    : null;
  const parentThreadId = youtubeVideoId ?? raw.parentSourceItemId;
  const validationWarnings: string[] = raw.language ? [] : ["Language was missing and remains unknown."];
  if (youtubeVideoId && raw.parentSourceItemId !== youtubeVideoId) validationWarnings.push("YouTube parent grouping was normalized to the minimized video ID.");
  return normalizedEvidenceSchema.parse({
    schemaVersion: "1.0.0",
    synthetic: raw.synthetic,
    scenarioId: raw.scenarioId,
    evidenceId: `ev-${sha256(`${raw.source}:${raw.sourceItemId ?? raw.rawId}`).slice(0, 16)}`,
    rawId: raw.rawId,
    collectionRunId: raw.collectionRunId,
    source: raw.source,
    sourceItemType: raw.sourceItemType,
    sourceItemId: raw.sourceItemId,
    parentThreadId,
    canonicalUrl: raw.canonicalUrl,
    sourceStratum: raw.sourceStratum,
    selectionMethod: raw.selectionMethod,
    queryIds: [...new Set(raw.queryIds)].sort(),
    collectedAt: raw.collectedAt,
    publishedAt: raw.publishedAt,
    rating: raw.rating,
    title: raw.title?.trim() || null,
    originalText: minimized.text,
    normalizedText,
    language: raw.language ?? "unknown",
    contentHash: sha256(normalizedText),
    duplicateGroupId: null,
    isCanonicalDuplicate: true,
    piiReview: minimized.redacted || identityMetadataReceived ? "redacted" : "not_required",
    validationWarnings,
  });
}

export function normalizeRecords(records: readonly RawEvidence[]): NormalizedEvidence[] {
  return records.map(normalizeRecord);
}
