import { expect, test } from "@playwright/test";

test("overview labels and renders the synthetic fixture release", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Synthetic demonstration · not research findings")).toBeVisible();
  await expect(page.getByText("13", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where shopping confidence breaks" })).toBeVisible();
});

test("renders synthetic opportunities, themes, and segments", async ({ page }) => {
  await page.goto("/opportunities");
  await expect(page.getByText("Preserve shortlist comparison context").first()).toBeVisible();
  await expect(page.getByText("Make preferred variants easier to track").first()).toBeVisible();
  await page.goto("/themes");
  await expect(page.getByText("Fit and size confidence").first()).toBeVisible();
  await page.goto("/segments");
  await expect(page.getByText("Active confidence seeker").first()).toBeVisible();
});

test("filters public-safe synthetic evidence", async ({ page }) => {
  await page.goto("/evidence");
  await expect(page.getByText(/of 13 matching evidence units/)).toBeVisible();
  await page.getByLabel("Search evidence").fill("size");
  await expect(page).toHaveURL(/q=size/);
  await expect(page.getByText(/matching evidence units/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Apply filters/i })).toHaveCount(0);
});

test("Copilot retrieves locally and cites fixture evidence IDs", async ({ page }) => {
  await page.goto("/copilot");
  await page.getByLabel("Ask an evidence-based question").fill("What supports fit and size uncertainty?");
  await page.getByRole("button", { name: "Ask Copilot" }).click();
  await expect(page.getByText("Concise answer")).toBeVisible();
  await expect(page.getByText("No LLM used")).toBeVisible();
  await expect(page.getByRole("link", { name: /ev-/ }).first()).toBeVisible();
});

test("fixture APIs remain local, bounded, and model-free", async ({ request }) => {
  const evidence = await request.get("/api/evidence?relevance=direct_wishlist&limit=2");
  expect(evidence.status()).toBe(200);
  const evidenceBody = await evidence.json();
  expect(evidenceBody.items).toHaveLength(2);
  expect(evidenceBody.datasetVersion).toBe("fixture-001");
  const next = await request.get(`/api/evidence?relevance=direct_wishlist&limit=2&cursor=${encodeURIComponent(evidenceBody.nextCursor)}`);
  expect(next.status()).toBe(200);
  const nextBody = await next.json();
  expect(nextBody.items[0].evidenceId).not.toBe(evidenceBody.items[0].evidenceId);
  expect((await request.get("/api/evidence?cursor=tampered&limit=2")).status()).toBe(400);

  const copilot = await request.post("/api/copilot", { data: { question: "fit size" } });
  expect(copilot.status()).toBe(200);
  expect(await copilot.json()).toMatchObject({ mode: "extractive", usedLLM: false, datasetVersion: "fixture-001" });
});
