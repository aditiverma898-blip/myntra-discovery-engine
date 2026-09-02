import { describe, expect, it } from "vitest";

import {
  EMPTY_DASHBOARD_RELEASE,
  EMPTY_RELEASE_MANIFEST,
} from "@/lib/data/empty-release";
import {
  dashboardReleaseSchema,
  releaseManifestSchema,
} from "@/lib/schemas";

describe("canonical empty release", () => {
  it("validates the manifest without fabricated counts", () => {
    const manifest = releaseManifestSchema.parse(EMPTY_RELEASE_MANIFEST);

    expect(manifest.status).toBe("empty");
    expect(manifest.scope.product).toBe("myntra");
    expect(manifest.scope.targetRawRecords).toBe(20_000);
    expect(Object.values(manifest.counts)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("rejects zero as a fake empty-release count", () => {
    expect(() =>
      releaseManifestSchema.parse({
        ...EMPTY_RELEASE_MANIFEST,
        counts: { ...EMPTY_RELEASE_MANIFEST.counts, raw: 0 },
      }),
    ).toThrow("Empty-release counts must be null, not zero.");
  });

  it("keeps hypotheses separate from evidence-derived output", () => {
    const release = dashboardReleaseSchema.parse(EMPTY_DASHBOARD_RELEASE);

    expect(release.totals.evidence).toBeNull();
    expect(release.themes).toEqual([]);
    expect(release.opportunities).toEqual([]);
    expect(release.hypotheses.themes.length).toBeGreaterThan(0);
    expect(release.hypotheses.themes[0]?.status).toBe("hypothesis");
  });
});
