import { expect, test } from "@playwright/test";

const G1 = "287 Convent Avenue, Manhattan";

// Regression: the 3D canvas was blank after switching to 3D until the user scrolled or orbited.
test("3D envelope draws on first paint without interaction", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("combobox").fill(G1);
  await page.getByRole("button", { name: "Draft brief" }).click();
  await expect(page.getByRole("heading", { name: "Lot facts" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Brief ready.")).toBeAttached({ timeout: 60_000 });

  await page.getByRole("radio", { name: "3D" }).click();
  const canvas = page.locator('canvas[role="img"]').first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  // no mouse, wheel or keyboard input from here on
  await page.waitForTimeout(1500);

  const box = (await canvas.boundingBox())!;
  expect(box.width).toBeGreaterThan(100);
  expect(box.height).toBeGreaterThan(100);
  // Root cause of the original report: the canvas was taller than the viewport, so the model sat below the fold
  // until the user scrolled. Sample only what is visible without scrolling.
  const vp = page.viewportSize()!;
  const clip = {
    x: Math.max(box.x, 0), y: Math.max(box.y, 0),
    width: Math.min(box.x + box.width, vp.width) - Math.max(box.x, 0),
    height: Math.min(box.y + box.height, vp.height) - Math.max(box.y, 0),
  };
  expect(clip.height).toBeGreaterThan(box.height * 0.99); // canvas is (almost) fully on screen
  const png = await page.screenshot({ clip });
  const data = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    // count pixels that differ noticeably from the most common (background) colour
    const counts = new Map<number, number>();
    for (let i = 0; i < d.length; i += 4) {
      const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const total = d.length / 4;
    const top = Math.max(...counts.values());
    return { total, nonBackground: total - top };
  }, png.toString("base64"));
  expect(data.nonBackground / data.total).toBeGreaterThan(0.01);
});
