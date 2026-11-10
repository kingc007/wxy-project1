import { expect, test } from "@playwright/test";

const G1 = "287 Convent Avenue, Manhattan";

test("G1 brief: memo, citations, override recompute, envelope", async ({ page }) => {
  const t0 = Date.now();
  await page.goto("/");
  await expect(page.getByText("Enter an NYC address or BBL to draft a zoning brief.")).toBeVisible();

  await page.getByRole("combobox").fill(G1);
  await page.getByRole("button", { name: "Draft brief" }).click();

  await expect(page.getByRole("heading", { name: "Lot facts" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Brief ready.")).toBeAttached({ timeout: 60_000 });
  expect(Date.now() - t0).toBeLessThan(60_000);

  // Lot area with a PLUTO provenance tag.
  const areaRow = page.getByRole("row", { name: /Lot area/ });
  await expect(areaRow).toContainText("4,675 sf");
  await expect(areaRow.getByRole("button", { name: /PLUTO/ })).toBeVisible();

  // FAR row with a ZR 23-22 RefTag that opens the source pane.
  const farRow = page.getByRole("row", { name: /Max FAR \(residential\)/ });
  await expect(farRow).toContainText("3.00");
  const tag = farRow.getByRole("button", { name: "Open source: ZR 23-22" });
  await expect(tag).toBeVisible();
  await tag.click();
  await expect(page.getByRole("dialog").or(page.getByRole("complementary")).first()).toBeVisible();
  await page.getByRole("button", { name: "Close source pane" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(page.getByText("4,675 sf × 3.00 FAR = 14,025 sf").first()).toBeVisible();
  await expect(page.getByTestId("envelope-valid")).toContainText("Valid against zoning-envelope.schema.json");

  // Override building type -> detached.
  const item = page.locator("li", { hasText: "Assumed attached building" });
  await item.getByRole("button", { name: /^Edit/ }).click();
  await item.getByRole("combobox").selectOption("detached");
  await item.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Override saved. Memo recalculated.").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/overridden to detached/).first()).toBeVisible();
  await expect(page.getByTestId("envelope-valid")).toBeVisible();
});

test("Export > envelope JSON downloads zoning-envelope-<bbl>", async ({ page, request }) => {
  // The /api/export route is built by another builder; skip until it exists (404 = not there yet).
  const probe = await request.post("/api/export", { data: {} });
  test.fixme(probe.status() === 404, "/api/export is not implemented yet");

  await page.goto("/");
  await page.getByRole("combobox").fill(G1);
  await page.getByRole("button", { name: "Draft brief" }).click();
  await expect(page.getByRole("heading", { name: "Lot facts" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download envelope JSON" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^zoning-envelope-1020500004/);
});
