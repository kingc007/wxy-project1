import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

// Mechanical a11y scan. Records axe violations and a tab-order trace; never fails on violations.
const OUT = path.join(process.cwd(), "test-results", "a11y");
const G1 = "287 Convent Avenue, Manhattan";
const SPLIT = "196 East 3 Street, Manhattan";
const THEMES = ["light", "dark"] as const;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

type Theme = (typeof THEMES)[number];

async function setup(page: Page, theme: Theme) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.goto("/");
}

async function draft(page: Page, query: string) {
  await page.getByRole("combobox").fill(query);
  await page.getByRole("button", { name: "Draft brief" }).click();
  await expect(page.getByRole("heading", { name: "Lot facts" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Brief ready.")).toBeAttached({ timeout: 60_000 });
}

async function scan(page: Page, state: string, theme: Theme) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    helpUrl: v.helpUrl,
    nodeCount: v.nodes.length,
    nodes: v.nodes.map((n) => {
      const contrast = n.any.map((c) => c.data).filter((d) => d !== undefined && d !== null);
      return {
        target: n.target,
        failureSummary: (n.failureSummary ?? "").slice(0, 300),
        ...(v.id === "color-contrast" && contrast.length ? { contrastData: contrast } : {}),
      };
    }),
  }));
  const record = {
    state,
    theme,
    viewport: { width: 1440, height: 900 },
    url: page.url(),
    axeVersion: results.testEngine?.version ?? null,
    scannedAt: new Date().toISOString(),
    violationCount: violations.length,
    // Sanity counts: proves axe executed rules (passes > 0) rather than scanning nothing.
    passCount: results.passes.length,
    incompleteCount: results.incomplete.length,
    incompleteIds: results.incomplete.map((i) => i.id),
    violations,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${state}-${theme}.json`), JSON.stringify(record, null, 2));
}

for (const theme of THEMES) {
  test.describe(`a11y ${theme}`, () => {
    test.setTimeout(240_000);

    test("1 empty state", async ({ page }) => {
      await setup(page, theme);
      await expect(page.getByText("Enter an NYC address or BBL to draft a zoning brief.")).toBeVisible();
      await scan(page, "empty", theme);
    });

    test("2 memo (287 Convent Avenue)", async ({ page }) => {
      await setup(page, theme);
      await draft(page, G1);
      await scan(page, "memo", theme);
    });

    test("3 memo with source pane open", async ({ page }) => {
      await setup(page, theme);
      await draft(page, G1);
      const farRow = page.getByRole("row", { name: /Max FAR \(residential\)/ });
      await farRow.getByRole("button", { name: "Open source: ZR 23-22" }).click();
      await expect(page.getByRole("dialog").or(page.getByRole("complementary")).first()).toBeVisible();
      await scan(page, "memo-source", theme);
    });

    test("4 map panel: Plan and 3D views", async ({ page }) => {
      await setup(page, theme);
      await draft(page, G1);
      const planItem = page.getByRole("radio", { name: "Plan", exact: true });
      const threeDItem = page.getByRole("radio", { name: "3D", exact: true });
      await expect(planItem).toBeVisible();
      await scan(page, "map-plan", theme);
      await threeDItem.click();
      await page.waitForTimeout(3000);
      await scan(page, "map-3d", theme);
    });

    test("5 split lot memo (196 East 3 Street)", async ({ page }) => {
      await setup(page, theme);
      await draft(page, SPLIT);
      await scan(page, "split-lot", theme);
    });

    test("tab order from top of memo", async ({ page }) => {
      await setup(page, theme);
      await draft(page, G1);
      // Move focus to the document top so Tab starts from the first focusable element.
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      const steps: Array<Record<string, unknown>> = [];
      for (let i = 1; i <= 40; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const cs = getComputedStyle(el);
          const outlineVisible = cs.outlineStyle !== "none" && cs.outlineWidth !== "0px";
          // Split shadow list on top-level commas; a shadow counts only if its colour is not fully transparent.
          const shadowParts = cs.boxShadow === "none" ? [] : cs.boxShadow.split(/,(?![^(]*\))/);
          const shadowVisible = shadowParts.some(
            (p) => !/rgba\([^)]*,\s*0\)/.test(p) && !/oklab\([^)]*\/\s*0\)/.test(p) && !/oklch\([^)]*\/\s*0\)/.test(p),
          );
          const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
          return {
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute("role"),
            ariaLabel: el.getAttribute("aria-label"),
            text: text.slice(0, 60),
            outlineStyle: cs.outlineStyle,
            outlineWidth: cs.outlineWidth,
            outlineColor: cs.outlineColor,
            boxShadow: cs.boxShadow,
            focusVisible: outlineVisible || shadowVisible,
          };
        });
        steps.push({ index: i, ...(info ?? { tag: null }) });
      }
      const record = {
        state: "memo-tab-order",
        theme,
        viewport: { width: 1440, height: 900 },
        scannedAt: new Date().toISOString(),
        note: "focusVisible = computed outline (style!=none and width!=0px) OR box-shadow!=none on document.activeElement; computed-style heuristic, not a visual check.",
        steps,
      };
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `tab-order-${theme}.json`), JSON.stringify(record, null, 2));
      expect(steps.length).toBe(40);
    });
  });
}
