// End-to-end check of dist/index.html in headless Chromium. Usage: node scripts/verify.mjs <url> [outdir]
import { launch } from "./lib.mjs";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const url = process.argv[2];
const out = process.argv[3] || "/tmp/verify";
mkdirSync(out, { recursive: true });
const require = createRequire("/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/package.json");
const results = [];
const ok = (name, pass, extra = "") => { results.push({ name, pass }); console.log((pass ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

async function flow(siteName, label) {
  const { b, p, errs, reqs } = await launch(url);
  const consoleErrsAtLoad = [...errs];
  await p.getByRole("button", { name: siteName }).first().click();
  await p.getByLabel("Project brief").fill("About 120 units, ground-floor retail, a public courtyard, and step the building down toward the park to the north.");
  await p.getByRole("button", { name: "Read brief" }).click();
  await p.waitForTimeout(800);
  while (await p.getByRole("button", { name: /^Accept / }).count()) await p.getByRole("button", { name: /^Accept / }).first().click();
  await p.getByRole("button", { name: "Confirm schedule" }).click();
  const t0 = Date.now();
  await p.getByRole("button", { name: "Generate 6 options" }).click();
  await p.waitForFunction(() => [1, 2, 3, 4, 5, 6].every((n) => document.body.innerText.includes(`Option ${n}\n`)), null, { timeout: 120000 });
  const genMs = Date.now() - t0;
  const text = await p.evaluate(() => document.body.innerText);
  const metrics = (text.match(/FAR [\d.]+ \/ [\d.]+/g) || []).length;
  ok(`${label}: 6 options appear with metrics`, metrics >= 6, `generate ${genMs} ms, ${metrics} FAR metric lines`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${label}-compare.png` });
  await p.keyboard.press("3");
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /^Focus/ }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${label}-focus.png` });
  const sel = await p.evaluate(() => document.body.innerText.includes("Zoning table") || document.body.innerText.includes("Iterate"));
  ok(`${label}: option selected + focus view`, sel);
  // iterate
  await p.getByLabel(/Tell this option what to change/).fill("shorter");
  await p.getByRole("button", { name: "Propose changes" }).click();
  await p.waitForTimeout(2000);
  const afterProp = await p.evaluate(() => document.body.innerText);
  await p.screenshot({ path: `${out}/${label}-iterate.png` });
  const apply = p.getByRole("button", { name: /^(Apply|Accept|Keep)/ });
  const nApply = await apply.count();
  if (nApply) { await apply.first().click(); await p.waitForTimeout(1500); }
  const afterApply = await p.evaluate(() => document.body.innerText);
  ok(`${label}: iterate "shorter" proposes changes`, /Height|height|floors|Floors/.test(afterProp) && afterProp !== text, `apply buttons=${nApply}; history: ${(afterApply.match(/History[\s\S]{0,160}/) || [""])[0].replace(/\n/g, " | ")}`);
  // sun
  await p.getByRole("button", { name: "Sun study" }).click();
  await p.waitForTimeout(1500);
  const sunTxt = await p.evaluate(() => document.body.innerText);
  await p.screenshot({ path: `${out}/${label}-sun.png` });
  ok(`${label}: sun study panel opens`, /Sun study|sun hours|Shadow|shadow|hours of/i.test(sunTxt) && sunTxt.length !== afterApply.length, "");
  await p.keyboard.press("Escape");
  // theme
  await p.getByRole("button", { name: /Switch to dark theme/ }).click();
  await p.waitForTimeout(800);
  const dark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
  await p.screenshot({ path: `${out}/${label}-dark.png` });
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(`${label}: night theme toggles`, dark, `body bg ${bg}`);
  await p.getByRole("button", { name: /Switch to light theme/ }).click();
  // exports
  async function doExport(kind) {
    const before = await p.evaluate(() => window.__saves.length);
    await p.getByRole("button", { name: "Export" }).click();
    await p.getByRole("menuitem", { name: new RegExp(kind, "i") }).click();
    await p.waitForFunction((n) => window.__saves.length >= n, before + 1, { timeout: 60000 });
    return p.evaluate(() => { const s = window.__saves.at(-1); const u = window.__lastSave; let bin = ""; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode(...u.subarray(i, i + 8192)); return { filename: s.filename, size: s.size, b64: btoa(bin) }; });
  }
  const r3 = await doExport("Rhino|3dm");
  const zip = Buffer.from(r3.b64, "base64");
  // stored single-entry zip: local header 30 + name
  const nameLen = zip.readUInt16LE(26), size = zip.readUInt32LE(18), name = zip.subarray(30, 30 + nameLen).toString();
  const data = zip.subarray(30 + nameLen, 30 + nameLen + size);
  writeFileSync(`${out}/${label}-${name}`, data);
  const header = data.subarray(0, 32).toString("latin1");
  const rhino = await (await import(require.resolve("rhino3dm"))).default();
  const f = rhino.File3dm.fromByteArray(new Uint8Array(data));
  const nObj = f ? f.objects().count : -1, nLayers = f ? f.layers().count : -1;
  ok(`${label}: .3dm export (${r3.filename}, ${r3.size} B zip, inner ${name} ${size} B)`, header.startsWith("3D Geometry File Format") && nObj > 0, `header "${header.slice(0, 24)}", rhino3dm read-back: ${nObj} objects, ${nLayers} layers`);
  for (const [k, ext] of [["GLB|glTF", "glb"], ["JSON|param", "json"]]) {
    try { const r = await doExport(k); ok(`${label}: ${k} export (${r.filename})`, r.size > 100, `${r.size} B`); } catch (e) { ok(`${label}: ${k} export`, false, String(e).slice(0, 120)); }
  }
  const other = reqs.filter((u) => !u.startsWith(new URL(url).origin) && !u.startsWith("file:"));
  ok(`${label}: no console errors`, errs.length === 0, errs.slice(0, 3).join(" || "));
  ok(`${label}: no requests to other origins`, other.length === 0, `${reqs.length} requests total (${[...new Set(reqs)].slice(0, 4).join(", ")}) ${other.slice(0, 3).join(" ")}`);
  await b.close();
}

await flow(process.env.SAMPLE || /Interior lot/, "sample");
await flow(process.env.REAL || /East 3 Street/i, "real");

// mobile
{
  const { b, p, errs } = await launch(url, { width: 390, height: 844 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/mobile-0.png` });
  const hs = () => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  let h = await hs();
  ok("mobile: no horizontal scroll at start", h.sw <= h.cw, JSON.stringify(h));
  await p.getByRole("button", { name: "Setup" }).first().click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/mobile-1-setup.png` });
  await p.getByRole("button", { name: /Interior lot/ }).first().click();
  await p.waitForTimeout(600);
  await p.getByLabel("Project brief").fill("About 120 units, ground-floor retail, a public courtyard.");
  await p.getByRole("button", { name: "Read brief" }).click();
  await p.waitForTimeout(800);
  while (await p.getByRole("button", { name: /^Accept / }).count()) await p.getByRole("button", { name: /^Accept / }).first().click();
  await p.getByRole("button", { name: "Confirm schedule" }).click();
  await p.screenshot({ path: `${out}/mobile-2-confirmed.png` });
  await p.getByRole("button", { name: "Generate 6 options" }).last().click();
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/mobile-3-generated.png` });
  h = await hs();
  ok("mobile: no horizontal scroll after generate", h.sw <= h.cw, JSON.stringify(h));
  const det = p.getByRole("button", { name: "Details" }).first();
  await det.click();
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/mobile-4-details.png` });
  const dt = await p.evaluate(() => document.body.innerText);
  h = await hs();
  ok("mobile: Details sheet opens", /Option details|Zoning table|Parameters/.test(dt), JSON.stringify(h));
  ok("mobile: no console errors", errs.length === 0, errs.slice(0, 3).join(" || "));
  await b.close();
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
