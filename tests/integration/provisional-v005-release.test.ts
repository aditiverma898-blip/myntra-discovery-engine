import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { candidateSupportLabel } from "@/app/opportunities/page";
import { publicEvidenceItemSchema, dashboardReleaseSchema } from "@/lib/schemas";
import { validateCandidateRelease } from "../../data-pipeline/release/validate-release";

const releaseDirectory = path.resolve("data/releases/myntra-provisional-20260823-005");
const available = existsSync(path.join(releaseDirectory, "manifest.json"));

describe.runIf(available)("immutable provisional v005 release", () => {
  it("adds the fifth evidence-derived opportunity without changing the existing IDs", async () => {
    const { evidenceIds } = await validateCandidateRelease(releaseDirectory);
    const dashboard = dashboardReleaseSchema.parse(JSON.parse(await readFile(path.join(releaseDirectory, "aggregates.json"), "utf8")) as unknown);
    const evidence = (await readFile(path.join(releaseDirectory, "evidence.server.jsonl"), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => publicEvidenceItemSchema.parse(JSON.parse(line) as unknown));
    const opportunities = [...dashboard.opportunities].sort((left, right) => right.adjustedScore - left.adjustedScore);
    const ids = opportunities.map((item) => item.opportunityId);
    expect(ids).toEqual(expect.arrayContaining(["fit-decision-support", "product-evidence-clarity", "shortlist-memory", "reversibility-clarity", "preferred-variant-availability"]));
    expect(dashboard.totals.opportunities).toBe(5);

    const target = opportunities.find((item) => item.opportunityId === "preferred-variant-availability");
    expect(target).toBeDefined();
    if (!target) return;
    const targetItems = evidence.filter((item) => target.evidenceIds.includes(item.evidenceId));
    const sourceDistribution = Object.fromEntries([...new Set(targetItems.map((item) => item.source))].map((source) => [source, targetItems.filter((item) => item.source === source).length]));
    expect(target.themeIds).toEqual(["availability-planning"]);
    expect(target.segmentIds).toEqual(["active-confidence-seeker"]);
    expect(target.directEvidenceCount).toBe(targetItems.filter((item) => item.relevance === "direct_wishlist").length);
    expect(target.adjacentEvidenceCount).toBe(targetItems.filter((item) => item.relevance === "journey_adjacent").length);
    expect(target.directEvidenceCount).toBe(0);
    expect(target.adjacentEvidenceCount).toBeGreaterThan(0);
    expect(target.sourceDistribution).toEqual(sourceDistribution);
    expect(target.evidenceIds.every((id) => evidenceIds.has(id))).toBe(true);
    expect(candidateSupportLabel(target.evidenceIds.length, target.directEvidenceCount, Object.keys(target.sourceDistribution).length)).toBe("Limited candidate support");

    const stat = dashboard.analytics?.opportunityStats.find((item) => item.opportunityId === target.opportunityId);
    expect(stat).toMatchObject({ evidenceCount: target.evidenceIds.length, directCount: target.directEvidenceCount, adjacentCount: target.adjacentEvidenceCount, reviewState: "unreviewed" });
    expect(opportunities.every((item, index) => index === 0 || opportunities[index - 1]!.adjustedScore >= item.adjustedScore)).toBe(true);
  });
});
