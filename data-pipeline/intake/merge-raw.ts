import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";

import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";
import type { RawIntakeConfig } from "../../src/lib/schemas/intake";
import { validateRestrictedPath } from "../collection/validation";
import { writeJsonAtomically, writeTextAtomically } from "../io/atomic";
import { serializeJsonLines } from "../io/jsonl";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function identity(record: RawEvidence): string {
  return `${record.source}:${record.sourceItemId ?? record.rawId}`;
}

function coreFingerprint(record: RawEvidence): string {
  return sha256(JSON.stringify({
    source: record.source,
    sourceItemType: record.sourceItemType,
    sourceItemId: record.sourceItemId,
    parentSourceItemId: record.parentSourceItemId,
    canonicalUrl: record.canonicalUrl,
    sourceScope: record.sourceScope,
    sourceStratum: record.sourceStratum,
    publishedAt: record.publishedAt,
    rating: record.rating,
    title: record.title,
    text: record.text,
    language: record.language,
    region: record.region,
  }));
}

async function assertMissing(candidate: string): Promise<void> {
  try {
    await lstat(candidate);
    throw new Error(`Intake output already exists and is immutable: ${candidate}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

export interface RawIntakeResult {
  outputDirectory: string;
  outputPath: string;
  manifestPath: string;
  manifest: Record<string, unknown>;
}

export async function mergeRawIntake(options: {
  workspaceRoot: string;
  config: RawIntakeConfig;
}): Promise<RawIntakeResult> {
  const outputDirectory = validateRestrictedPath(options.workspaceRoot, options.config.outputDirectory, "data/raw/combined/");
  await assertMissing(outputDirectory);

  const canonicalByIdentity = new Map<string, RawEvidence>();
  const fingerprintByIdentity = new Map<string, string>();
  const duplicates: Array<Record<string, unknown>> = [];
  const conflicts: Array<Record<string, unknown>> = [];
  const inputReports: Array<Record<string, unknown>> = [];
  const sourceCounts = new Map<string, number>();
  const runCounts = new Map<string, number>();
  const queryCounts = new Map<string, number>();
  let received = 0;

  for (const input of options.config.inputs) {
    const inputPath = validateRestrictedPath(options.workspaceRoot, input.path, "data/raw/imports/");
    const text = await readFile(inputPath, "utf8");
    const lines = text.split(/\r?\n/u).filter(Boolean);
    const records = lines.map((line, index) => {
      let parsedJson: unknown;
      try { parsedJson = JSON.parse(line) as unknown; }
      catch { throw new Error(`${input.label} line ${index + 1} is not valid JSON.`); }
      const parsed = rawEvidenceSchema.safeParse(parsedJson);
      if (!parsed.success) throw new Error(`${input.label} line ${index + 1} failed rawEvidenceSchema: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
      if (parsed.data.synthetic) throw new Error(`${input.label} line ${index + 1} is synthetic; real intake refuses it.`);
      return parsed.data;
    });
    received += records.length;
    inputReports.push({
      label: input.label,
      path: input.path,
      sha256: sha256(text),
      rows: records.length,
      sources: [...new Set(records.map((record) => record.source))].sort(),
      collectionRunIds: [...new Set(records.map((record) => record.collectionRunId))].sort(),
    });

    for (const record of records) {
      const key = identity(record);
      const fingerprint = coreFingerprint(record);
      const existing = canonicalByIdentity.get(key);
      if (!existing) {
        canonicalByIdentity.set(key, record);
        fingerprintByIdentity.set(key, fingerprint);
        continue;
      }
      if (fingerprintByIdentity.get(key) !== fingerprint) {
        conflicts.push({
          identity: key,
          retainedRawId: existing.rawId,
          retainedCollectionRunId: existing.collectionRunId,
          conflictingRawId: record.rawId,
          conflictingCollectionRunId: record.collectionRunId,
        });
        continue;
      }
      canonicalByIdentity.set(key, rawEvidenceSchema.parse({
        ...existing,
        queryIds: [...new Set([...existing.queryIds, ...record.queryIds])].sort(),
      }));
      duplicates.push({
        identity: key,
        retainedRawId: existing.rawId,
        retainedCollectionRunId: existing.collectionRunId,
        duplicateRawId: record.rawId,
        duplicateCollectionRunId: record.collectionRunId,
      });
    }
  }

  if (conflicts.length) {
    await writeJsonAtomically(path.join(options.workspaceRoot, "data/intermediate/intake-failures", `${options.config.intakeId}.conflicts.json`), {
      schemaVersion: "1.0.0",
      intakeId: options.config.intakeId,
      datasetVersion: options.config.datasetVersion,
      createdAt: options.config.createdAt,
      externalCallsMade: false,
      status: "blocked_by_identity_conflicts",
      conflictCount: conflicts.length,
      conflicts,
    });
    throw new Error(`Intake found ${conflicts.length} conflicting repeated source identities; resolve them explicitly before merge. First: ${JSON.stringify(conflicts[0])}`);
  }

  const records = [...canonicalByIdentity.values()];
  for (const record of records) {
    sourceCounts.set(record.source, (sourceCounts.get(record.source) ?? 0) + 1);
    runCounts.set(record.collectionRunId, (runCounts.get(record.collectionRunId) ?? 0) + 1);
    for (const queryId of record.queryIds) queryCounts.set(queryId, (queryCounts.get(queryId) ?? 0) + 1);
  }
  const outputText = serializeJsonLines(records);
  const manifest = {
    schemaVersion: "1.0.0",
    intakeId: options.config.intakeId,
    datasetVersion: options.config.datasetVersion,
    createdAt: options.config.createdAt,
    externalCallsMade: false,
    immutable: true,
    inputs: inputReports,
    counts: {
      received,
      retained: records.length,
      duplicateIdentities: duplicates.length,
      conflictingIdentities: 0,
      bySource: Object.fromEntries([...sourceCounts.entries()].sort()),
      byCollectionRun: Object.fromEntries([...runCounts.entries()].sort()),
      byQuery: Object.fromEntries([...queryCounts.entries()].sort()),
    },
    retention: options.config.retention,
    output: { path: `${options.config.outputDirectory}/raw-records.jsonl`, sha256: sha256(outputText) },
    limitations: [
      "Identity de-duplication is source plus sourceItemId, falling back to rawId.",
      "Repeated identical identities retain the first record and union query IDs; duplicate provenance is preserved separately.",
      "This intake does not imply population representativeness or collection completeness.",
    ],
  };

  const staging = `${outputDirectory}.staging-${process.pid}`;
  await assertMissing(staging);
  await mkdir(staging, { recursive: true });
  await writeTextAtomically(path.join(staging, "raw-records.jsonl"), outputText);
  await writeTextAtomically(path.join(staging, "duplicate-identities.jsonl"), serializeJsonLines(duplicates));
  await writeJsonAtomically(path.join(staging, "intake-manifest.json"), manifest);
  await rename(staging, outputDirectory);
  return {
    outputDirectory,
    outputPath: path.join(outputDirectory, "raw-records.jsonl"),
    manifestPath: path.join(outputDirectory, "intake-manifest.json"),
    manifest,
  };
}
