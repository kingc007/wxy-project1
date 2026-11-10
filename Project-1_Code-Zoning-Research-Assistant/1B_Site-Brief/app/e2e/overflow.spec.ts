import { expect, test } from "@playwright/test";

const WIDTHS = [390, 768, 1024, 1280, 1440];

for (const w of WIDTHS) {
  test(`no horizontal page overflow at ${w}px (home and memo)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await page.goto("/");
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await over()).toBeLessThanOrEqual(0);
    await page.getByRole("combobox").fill("287 Convent Avenue, Manhattan");
    await page.getByRole("button", { name: "Draft brief" }).click();
    await expect(page.getByRole("heading", { name: "Lot facts" })).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    expect(await over()).toBeLessThanOrEqual(0);
  });
}
