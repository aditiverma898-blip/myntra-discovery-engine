import { describe, expect, it } from "vitest";

import { readPublicEvidence, filterPublicEvidence } from "@/lib/data/evidence-reader";
import { readActiveRelease } from "@/lib/data/release-loader";
import { buildExtractiveCopilotResponse } from "@/lib/rag/extractive";

describe("fixture release retrieval", () => {
  it("reads only the minimized server artifact and filters it deterministically", async () => {
    const result = await readActiveRelease({ dataMode: "fixtures" });
    if (!result.ok) throw new Error(result.error.message);
    const items = await readPublicEvidence(result);
    expect(items).toHaveLength(13);
    expect(filterPublicEvidence(items, { q: "size", limit: 20 }).length).toBeGreaterThan(0);
    expect(items.every((item) => item.canonicalUrl === null)).toBe(true);
  });

  it("answers from matching fixture excerpts without fetch or an LLM", async () => {
    const result = await readActiveRelease({ dataMode: "fixtures" });
    if (!result.ok) throw new Error(result.error.message);
    const items = await readPublicEvidence(result);
    const response = buildExtractiveCopilotResponse({ question: "What supports fit and size uncertainty?" }, items, result.release.datasetVersion);
    expect(response).toMatchObject({ status: "ready", relevant: true, mode: "extractive", usedLLM: false, datasetVersion: "fixture-001" });
    expect(response.findings[0]?.evidenceIds.length).toBeGreaterThan(0);
  });
});
