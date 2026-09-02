import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SYNTHETIC_RAW_RECORDS } from "../../data-pipeline/fixtures/synthetic-raw";
import { mergeRawIntake } from "../../data-pipeline/intake/merge-raw";
import { serializeJsonLines } from "../../data-pipeline/io/jsonl";
import type { RawIntakeConfig } from "../../src/lib/schemas/intake";
import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";

function realRecord(index: number, overrides: Partial<RawEvidence> = {}): RawEvidence {
  const fixture = SYNTHETIC_RAW_RECORDS[index];
  if (!fixture) throw new Error("Missing fixture record.");
  return rawEvidenceSchema.parse({ ...fixture, synthetic: false, scenarioId: null, ...overrides });
}

function config(): RawIntakeConfig {
  return {
    schemaVersion: "1.0.0",
    intakeId: "intake-test-001",
    datasetVersion: "dataset-test-001",
    createdAt: "2026-08-23T06:00:00.000Z",
    inputs: [
      { label: "source-a", path: "data/raw/imports/a/raw.jsonl" },
      { label: "source-b", path: "data/raw/imports/b/raw.jsonl" },
    ],
    outputDirectory: "data/raw/combined/intake-test-001",
    retention: { rawRetentionDeadline: null, policyId: "owner-retained-research-corpus-v1" },
  };
}

describe("restricted raw intake", () => {
  it("validates, de-duplicates identity, unions queries, and preserves duplicate provenance", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-intake-"));
    await mkdir(path.join(root, "data/raw/imports/a"), { recursive: true });
    await mkdir(path.join(root, "data/raw/imports/b"), { recursive: true });
    const first = realRecord(0, { collectionRunId: "run-a", queryIds: ["query-a"] });
    const duplicate = { ...first, rawId: "duplicate-raw", collectionRunId: "run-b", queryIds: ["query-b"] };
    const second = realRecord(1, { collectionRunId: "run-b" });
    await writeFile(path.join(root, "data/raw/imports/a/raw.jsonl"), serializeJsonLines([first]), "utf8");
    await writeFile(path.join(root, "data/raw/imports/b/raw.jsonl"), serializeJsonLines([duplicate, second]), "utf8");

    const result = await mergeRawIntake({ workspaceRoot: root, config: config() });
    const rows = (await readFile(result.outputPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
    const duplicateRows = (await readFile(path.join(result.outputDirectory, "duplicate-identities.jsonl"), "utf8")).trim().split("\n").filter(Boolean);
    expect(rows).toHaveLength(2);
    expect(rows[0].queryIds).toEqual(["query-a", "query-b"]);
    expect(manifest.counts).toMatchObject({ received: 3, retained: 2, duplicateIdentities: 1, conflictingIdentities: 0 });
    expect(manifest.externalCallsMade).toBe(false);
    expect(duplicateRows).toHaveLength(1);
    await expect(mergeRawIntake({ workspaceRoot: root, config: config() })).rejects.toThrow("immutable");
  });

  it("refuses changed content for a repeated source identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-intake-conflict-"));
    await mkdir(path.join(root, "data/raw/imports/a"), { recursive: true });
    await mkdir(path.join(root, "data/raw/imports/b"), { recursive: true });
    const first = realRecord(0, { collectionRunId: "run-a" });
    const changed = { ...first, rawId: "changed-raw", collectionRunId: "run-b", text: `${first.text} changed` };
    await writeFile(path.join(root, "data/raw/imports/a/raw.jsonl"), serializeJsonLines([first]), "utf8");
    await writeFile(path.join(root, "data/raw/imports/b/raw.jsonl"), serializeJsonLines([changed]), "utf8");
    await expect(mergeRawIntake({ workspaceRoot: root, config: config() })).rejects.toThrow("conflicting repeated source identities");
    const report = JSON.parse(await readFile(path.join(root, "data/intermediate/intake-failures/intake-test-001.conflicts.json"), "utf8"));
    expect(report).toMatchObject({ status: "blocked_by_identity_conflicts", conflictCount: 1, externalCallsMade: false });
  });
});
