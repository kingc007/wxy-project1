import { test } from "@playwright/test";
import fs from "node:fs";

const SIZES = [{ w: 1440, h: 900 }, { w: 1024, h: 800 }, { w: 390, h: 844 }];
const OUT = "test-results/screens";

for (const theme of ["light", "dark"] as const) {
  for (const s of SIZES) {
    test(`screens ${s.w} ${theme}`, async ({ page }) => {
      fs.mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width: s.w, height: s.h });
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto("/");
      await page.screenshot({ path: `${OUT}/empty-${s.w}-${theme}.png` });
      await page.getByRole("combobox").fill("196 East 3 Street, Manhattan");
      await page.getByRole("button", { name: "Draft brief" }).click();
      await page.getByText("Brief ready.").waitFor({ state: "attached", timeout: 60_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/memo-${s.w}-${theme}.png`, fullPage: true });
    });
  }
}
