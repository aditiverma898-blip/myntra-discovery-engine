import { describe, expect, it } from "vitest";

import { POST as postCopilot } from "@/app/api/copilot/route";
import { GET as getEvidence } from "@/app/api/evidence/route";
import { GET as getAnalytics } from "@/app/api/analytics/route";

describe("empty release API routes", () => {
  it("returns the validated empty Evidence contract", async () => {
    const response = await getEvidence(
      new Request("http://localhost/api/evidence?limit=20&source=reddit"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      status: "empty",
      items: [],
      nextCursor: null,
      total: null,
      datasetVersion: "empty-001",
    });
  });

  it("rejects invalid Evidence filters", async () => {
    const response = await getEvidence(
      new Request("http://localhost/api/evidence?limit=101"),
    );
    expect(response.status).toBe(400);
    const unknown = await getEvidence(new Request("http://localhost/api/evidence?platform=reddit"));
    expect(unknown.status).toBe(400);
  });

  it("rejects pagination parameters on analytics", async () => {
    const response = await getAnalytics(new Request("http://localhost/api/analytics?limit=10"));
    expect(response.status).toBe(400);
  });

  it("returns validated empty filter-aware analytics", async () => {
    const response = await getAnalytics(new Request("http://localhost/api/analytics?source=reddit"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      status: "empty",
      mode: "empty",
      datasetVersion: "empty-001",
      denominators: { releaseCorpus: null, matchingEvidence: null },
      kpis: { evidence: null, candidateRelevant: null, candidateRelevantRate: null, averageStoreRating: null, directWishlist: null },
      activeFilters: { source: ["reddit"] },
    });
  });

  it("returns deterministic no-data Copilot output without an LLM", async () => {
    const response = await postCopilot(
      new Request("http://localhost/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "What blocks wishlist progression?" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "empty",
      relevant: false,
      mode: "unavailable",
      usedLLM: false,
      findings: [],
      metricLinks: [],
      datasetVersion: "empty-001",
    });
  });

  it("rejects malformed and oversized Copilot requests", async () => {
    const malformed = await postCopilot(
      new Request("http://localhost/api/copilot", {
        method: "POST",
        body: "not-json",
      }),
    );
    const oversized = await postCopilot(
      new Request("http://localhost/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "x".repeat(1_001) }),
      }),
    );

    expect(malformed.status).toBe(415);
    expect(oversized.status).toBe(400);
  });
});
