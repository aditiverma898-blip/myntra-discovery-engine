import { expect, test } from "@playwright/test";

test("renders the interview-ready provisional overview", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Where shopping confidence breaks" })).toBeVisible();
  await expect(page.getByText("Provisional corpus · candidate labels, not validated findings")).toBeVisible();
  await expect(page.getByText("11,903").first()).toBeVisible();
  await expect(page.getByText("2,202").first()).toBeVisible();
  await expect(page.getByText("3.68★")).toBeVisible();
  await expect(page.getByText("7", { exact: true }).first()).toBeVisible();
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { level: 1, name: "Opportunities" })).toBeVisible();
  await expect(page.getByText("Increase product-evidence diagnosticity").first()).toBeVisible();
  await expect(page.getByText("Make preferred variants easier to track").first()).toBeVisible();
  await expect(page.getByText("Limited candidate support").first()).toBeVisible();
});

test("evidence API returns all four sources and stable pagination", async ({ request }) => {
  for (const [source, total] of [["google_play", 6_821], ["app_store", 2_608], ["youtube", 2_109], ["reddit", 365]] as const) {
    const response = await request.get(`/api/evidence?source=${source}&limit=5`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("partial");
    expect(body.mode).toBe("provisional");
    expect(body.total).toBe(total);
    expect(body.items).toHaveLength(5);
    expect(body.items.every((item: { source: string }) => item.source === source)).toBe(true);
  }

  const firstResponse = await request.get("/api/evidence?relevance=journey_adjacent&limit=25&sort=newest");
  const first = await firstResponse.json();
  expect(first.nextCursor).toBeTruthy();
  const secondResponse = await request.get(`/api/evidence?relevance=journey_adjacent&limit=25&sort=newest&cursor=${encodeURIComponent(first.nextCursor)}`);
  const second = await secondResponse.json();
  const firstIds = new Set(first.items.map((item: { evidenceId: string }) => item.evidenceId));
  expect(second.items.every((item: { evidenceId: string }) => !firstIds.has(item.evidenceId))).toBe(true);
});

test("Evidence filters persist in the URL and show non-Google sources", async ({ page }) => {
  await page.goto("/evidence?source=reddit&relevance=journey_adjacent");
  await expect(page.getByLabel("Source")).toHaveValue("reddit");
  await expect(page.getByLabel("Relevance")).toHaveValue("journey_adjacent");
  await expect(page.getByText(/of 59 matching evidence units/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Source")).toHaveValue("reddit");
  await expect(page.getByLabel("Relevance")).toHaveValue("journey_adjacent");
});

test("analytics is filter-aware and uses explicit denominators", async ({ request }) => {
  const response = await request.get("/api/analytics?source=reddit");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.datasetVersion).toBe("myntra-provisional-20260823-005");
  expect(body.denominators.matchingEvidence).toBe(365);
  expect(body.kpis.candidateRelevant).toBe(60);
  expect(body.journeyStageStats.nonExclusive).toBe(true);
  expect(body.journeyBarrierMatrix.length).toBeGreaterThan(0);
});

test("Copilot uses the complete provisional corpus and never claims ready or synthetic", async ({ request }) => {
  const response = await request.post("/api/copilot", { data: { question: "Which evidence supports fit and size uncertainty?" } });
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.status).toBe("partial");
  expect(body.mode).toBe("extractive");
  expect(body.usedLLM).toBe(false);
  expect(body.datasetVersion).toBe("myntra-provisional-20260823-005");
  expect(body.findings.length).toBeGreaterThan(0);
  expect(JSON.stringify(body).toLowerCase()).not.toContain("synthetic");
});

test("mobile primary navigation exposes the six presentation views", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  for (const label of ["Overview", "Analytics", "Opportunities", "Themes", "Evidence", "Copilot"]) {
    await expect(page.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Segments" })).toHaveCount(0);
});
