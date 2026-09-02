import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readActiveRelease } from "@/lib/data/release-loader";

describe("active release loader", () => {
  it("loads and cross-validates the canonical empty release", async () => {
    const result = await readActiveRelease();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.release.status).toBe("empty");
      expect(result.release.datasetVersion).toBe("empty-001");
      expect(result.manifest.counts.raw).toBeNull();
    }
  });

  it("loads the immutable fixture pointer only when fixture mode is selected", async () => {
    const result = await readActiveRelease({ dataMode: "fixtures" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe("fixtures");
      expect(result.release.datasetVersion).toBe("fixture-001");
      expect(result.release.totals.evidence).toBe(13);
      expect(result.manifest.classifier?.provider).toBe("mock");
    }
  });

  it("returns a controlled error when the pointer is unavailable", async () => {
    const missingRoot = path.join(os.tmpdir(), "myntra-release-does-not-exist");
    const result = await readActiveRelease({ releasesRoot: missingRoot });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ACTIVE_POINTER_UNAVAILABLE",
        message: "The active release pointer is unavailable.",
      },
    });
  });

  it("rejects an unsafe release path before reading artifacts", async () => {
    const releasesRoot = await mkdtemp(path.join(os.tmpdir(), "myntra-release-"));
    await writeFile(
      path.join(releasesRoot, "active.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        datasetVersion: "unsafe",
        releasePath: "../outside",
      }),
    );

    const result = await readActiveRelease({ releasesRoot });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ACTIVE_POINTER_INVALID");
  });
});
