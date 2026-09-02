import { cp, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SYNTHETIC_RAW_RECORDS } from "../../data-pipeline/fixtures/synthetic-raw";
import { runOfflinePipeline } from "../../data-pipeline/orchestration/offline-pipeline";
import { promoteValidatedRelease } from "../../data-pipeline/release/validate-release";

describe("resumable offline production pipeline", () => {
  it("records a failed stage and resumes from completed checkpoints", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "myntra-offline-run-"));
    const options = { runId: "synthetic-resume-001", datasetVersion: "synthetic-production-001", workspaceRoot, rawRecords: SYNTHETIC_RAW_RECORDS, now: () => "2026-08-22T00:00:00.000Z" } as const;
    await expect(runOfflinePipeline({ ...options, failAtStage: "classify" })).rejects.toThrow("Injected synthetic failure");
    const failed = JSON.parse(await readFile(path.join(workspaceRoot, options.runId, "run-state.json"), "utf8"));
    expect(failed.checkpoints.find((item: { stage: string }) => item.stage === "classify").status).toBe("failed");

    const resumed = await runOfflinePipeline(options);
    expect(resumed.resumedStages).toEqual(["validate_normalize", "deduplicate"]);
    expect(resumed.state.checkpoints.every((checkpoint) => checkpoint.status === "completed")).toBe(true);
    expect(resumed.state.externalCallsMade).toBe(false);
    const quality = JSON.parse(await readFile(path.join(resumed.runDirectory, "quality-report.json"), "utf8"));
    expect(quality.status).toBe("passed_with_warnings");
    expect(quality.contradictionCount).toBeGreaterThan(0);
  });

  it("promotes a validated ready release through an atomic pointer", async () => {
    const releasesRoot = await mkdtemp(path.join(os.tmpdir(), "myntra-release-promotion-"));
    await cp(path.join(process.cwd(), "data", "releases", "fixture-001"), path.join(releasesRoot, "fixture-001"), { recursive: true });
    const pointer = await promoteValidatedRelease({ releasesRoot, releasePath: "fixture-001" });
    expect(pointer).toMatchObject({ datasetVersion: "fixture-001", releasePath: "fixture-001" });
    expect(JSON.parse(await readFile(path.join(releasesRoot, "active.json"), "utf8"))).toEqual(pointer);
  });
});
