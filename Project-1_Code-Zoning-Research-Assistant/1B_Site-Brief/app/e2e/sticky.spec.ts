import { expect, test } from "@playwright/test";

test("map panel stays in view while the memo scrolls (desktop)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("combobox").fill("196 East 3 Street, Manhattan");
  await page.getByRole("button", { name: "Draft brief" }).click();
  await expect(page.getByRole("heading", { name: "Bulk regulations" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("heading", { name: "Calculations" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const box = await page.getByRole("region", { name: "Site view" }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(40);
  await page.screenshot({ path: "test-results/screens/sticky-1440-light.png" });
});
