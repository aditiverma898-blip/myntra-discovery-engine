import { expect, test } from "@playwright/test";

test("shows the complete empty-data dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Where shopping confidence breaks",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No evidence release yet" })).toBeVisible();
  await expect(page.getByText(/keeps unknown values unknown/)).toBeVisible();
  await expect(page.getByText("Research mode · no findings yet")).toBeVisible();
});

for (const [name, path] of [
  ["Opportunities", "/opportunities"],
  ["Themes", "/themes"],
  ["See the shape behind the signals", "/analytics"],
  ["Evidence explorer", "/evidence"],
  ["Methodology", "/methodology"],
  ["Copilot", "/copilot"],
] as const) {
  test(`${name} route renders the empty contract`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Research mode · no findings yet")).toBeVisible();
  });
}

test("Copilot abstains without evidence or a model", async ({ page }) => {
  await page.goto("/copilot");
  await page.getByLabel("Ask an evidence-based question").fill("What is known?");
  await page.getByRole("button", { name: "Ask Copilot" }).click();
  await expect(page.getByText(/No reviewed evidence is available yet/)).toBeVisible();
  await expect(page.getByText("No LLM used")).toBeVisible();
});

test("mobile navigation reaches every major view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Evidence" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Evidence explorer" })).toBeVisible();
});
