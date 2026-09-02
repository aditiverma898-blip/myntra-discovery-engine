import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { SYNTHETIC_RAW_RECORDS } from "../fixtures/synthetic-raw";
import { serializeJsonLines, writeJsonLinesAtomically } from "../io/jsonl";
import { buildFixtureAggregates } from "../stages/aggregate";
import { deduplicateRecords } from "../stages/deduplicate";
import { mockClassifyRecords } from "../stages/mock-classifier";
import { normalizeRecords, validateRawRecords } from "../stages/normalize";
import { discoverLexicalThemes } from "../stages/theme-discovery";
import { dashboardReleaseSchema, releaseManifestSchema, type ReleaseManifest } from "../../src/lib/schemas/release";
import { evidenceClassificationSchema, normalizedEvidenceSchema, validationLedgerEntrySchema } from "../../src/lib/schemas/pipeline";
import { publicEvidenceItemSchema } from "../../src/lib/schemas/api";

export const FIXTURE_RELEASE_DIRECTORY = path.join(process.cwd(), "data", "releases", "fixture-001");
const generatedAt = "2026-08-22T00:00:00.000Z";

function checksum(text: string): string { return createHash("sha256").update(text).digest("hex"); }
async function writeJsonAtomically(destination: string, value: unknown): Promise<void> {
  const temporaryPath = `${destination}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, destination);
}

export async function buildAndWriteFixtureRelease(): Promise<ReleaseManifest> {
  const validated = validateRawRecords(SYNTHETIC_RAW_RECORDS);
  const normalized = normalizeRecords(validated.valid);
  const { canonical, duplicateCount } = deduplicateRecords(normalized);
  const classifications = mockClassifyRecords(canonical);
  const clusters = discoverLexicalThemes(canonical, classifications);
  const { dashboard, publicEvidence } = buildFixtureAggregates(canonical, classifications);
  await mkdir(FIXTURE_RELEASE_DIRECTORY, { recursive: true });

  const artifacts = {
    "aggregates.json": `${JSON.stringify(dashboard, null, 2)}\n`,
    "evidence.server.jsonl": serializeJsonLines(publicEvidence),
    "normalized.restricted.jsonl": serializeJsonLines(canonical),
    "classifications.restricted.jsonl": serializeJsonLines(classifications),
    "validation-ledger.jsonl": serializeJsonLines(validated.ledger),
    "lexical-clusters.json": `${JSON.stringify(clusters, null, 2)}\n`,
  };
  await Promise.all(Object.entries(artifacts).map(async ([filename, content]) => {
    if (filename.endsWith(".jsonl")) await writeJsonLinesAtomically(path.join(FIXTURE_RELEASE_DIRECTORY, filename), content.split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as unknown));
    else await writeFile(path.join(FIXTURE_RELEASE_DIRECTORY, filename), content, "utf8");
  }));

  const roleByFile: Record<string, { role: string; visibility: "client" | "server" | "restricted"; count: number | null }> = {
    "aggregates.json": { role: "dashboard_aggregates", visibility: "client", count: null },
    "evidence.server.jsonl": { role: "public_safe_evidence", visibility: "server", count: publicEvidence.length },
    "normalized.restricted.jsonl": { role: "normalized_evidence", visibility: "restricted", count: canonical.length },
    "classifications.restricted.jsonl": { role: "classifications", visibility: "restricted", count: classifications.length },
    "validation-ledger.jsonl": { role: "validation_ledger", visibility: "restricted", count: validated.ledger.length },
    "lexical-clusters.json": { role: "theme_discovery", visibility: "restricted", count: clusters.length },
  };
  const files = await Promise.all(Object.entries(roleByFile).map(async ([filename, meta]) => ({ role: meta.role, path: filename, sha256: checksum(await readFile(path.join(FIXTURE_RELEASE_DIRECTORY, filename), "utf8")), recordCount: meta.count, visibility: meta.visibility })));
  const counts = {
    raw: SYNTHETIC_RAW_RECORDS.length, normalized: normalized.length, canonical: canonical.length,
    direct: classifications.filter((item) => item.relevance === "direct_wishlist").length,
    adjacent: classifications.filter((item) => item.relevance === "journey_adjacent").length,
    general: classifications.filter((item) => item.relevance === "general").length,
    irrelevant: classifications.filter((item) => item.relevance === "irrelevant").length,
    reviewed: classifications.filter((item) => item.humanReviewStatus === "accepted").length,
  };
  const sources = [...new Set(canonical.map((item) => item.source))].sort();
  const manifest = releaseManifestSchema.parse({
    schemaVersion: "1.0.0", datasetVersion: "fixture-001", status: "ready", generatedAt,
    scope: { product: "myntra", targetRawRecords: 20_000, acceptableRawMinimum: 18_000, acceptableRawMaximum: 22_000, otherShoppingPlatformsIncluded: false },
    codeCommit: null, taxonomyVersion: "fixture-taxonomy-v1", promptVersion: "fixture-prompt-v1",
    classifier: { provider: "mock", model: "mock-structured-classifier-v1" }, embedding: null,
    coverage: sources.map((source) => ({ source, runIds: [`fixture-${source}-001`], from: null, to: null, queries: [...new Set(canonical.filter((item) => item.source === source).flatMap((item) => item.queryIds))].sort() })),
    counts, files, qualityStatus: "passed_with_warnings",
    limitations: ["This immutable release contains fictional synthetic fixtures only; no source or model call occurred.", "Its small record count is for workflow testing and cannot support claims about Myntra shoppers.", `${normalized.length} valid records were normalized; deduplication grouped ${duplicateCount} records; ${validated.ledger.length} malformed record was quarantined.`],
  });
  await writeJsonAtomically(path.join(FIXTURE_RELEASE_DIRECTORY, "manifest.json"), manifest);
  return manifest;
}

export async function validateFixtureRelease(): Promise<void> {
  const manifest = releaseManifestSchema.parse(JSON.parse(await readFile(path.join(FIXTURE_RELEASE_DIRECTORY, "manifest.json"), "utf8")) as unknown);
  dashboardReleaseSchema.parse(JSON.parse(await readFile(path.join(FIXTURE_RELEASE_DIRECTORY, "aggregates.json"), "utf8")) as unknown);
  const schemas: Record<string, { parse(value: unknown): unknown }> = {
    "evidence.server.jsonl": publicEvidenceItemSchema,
    "normalized.restricted.jsonl": normalizedEvidenceSchema,
    "classifications.restricted.jsonl": evidenceClassificationSchema,
    "validation-ledger.jsonl": validationLedgerEntrySchema,
  };
  for (const file of manifest.files) {
    const text = await readFile(path.join(FIXTURE_RELEASE_DIRECTORY, file.path), "utf8");
    if (checksum(text) !== file.sha256) throw new Error(`Checksum mismatch for ${file.path}.`);
    const schema = schemas[file.path];
    if (schema) for (const line of text.split(/\n/u).filter(Boolean)) schema.parse(JSON.parse(line) as never);
  }
  const classifications = (await readFile(path.join(FIXTURE_RELEASE_DIRECTORY, "classifications.restricted.jsonl"), "utf8")).split(/\n/u).filter(Boolean).map((line) => evidenceClassificationSchema.parse(JSON.parse(line) as unknown));
  const evidenceIds = new Set((await readFile(path.join(FIXTURE_RELEASE_DIRECTORY, "evidence.server.jsonl"), "utf8")).split(/\n/u).filter(Boolean).map((line) => publicEvidenceItemSchema.parse(JSON.parse(line) as unknown).evidenceId));
  if (classifications.some((item) => !evidenceIds.has(item.evidenceId))) throw new Error("Classification referential integrity failed.");
}

export async function writeFixtureReleasePointer(): Promise<void> {
  await writeJsonAtomically(path.join(process.cwd(), "data", "releases", "fixture.json"), { schemaVersion: "1.0.0", datasetVersion: "fixture-001", releasePath: "fixture-001" });
}
