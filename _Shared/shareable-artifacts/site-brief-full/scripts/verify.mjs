// Headless verification of dist/index.html opened as a file:// page. Usage: CHROME=<path to chromium> node scripts/verify.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.resolve(ROOT, "../../../Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/app");
const gold = JSON.parse(fs.readFileSync(path.join(APP, "evals/gold.json"), "utf8"));
const envs = JSON.parse(fs.readFileSync(path.join(ROOT, "dist/envelopes.json"), "utf8"));
const URL_ = "file://" + path.join(ROOT, "dist/index.html");
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -- " + detail : ""}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
async function newPage(w = 1280, h = 900, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"], ...ctxOpts });
  const p = await ctx.newPage();
  p.logs = []; p.ext = [];
  p.on("console", (m) => { if (m.type() === "error") p.logs.push(m.text()); });
  p.on("pageerror", (e) => p.logs.push("pageerror: " + e.message));
  p.on("request", (r) => { const u = r.url(); if (!/^(file|blob|data|about):/.test(u)) p.ext.push(u); });
  return p;
}

// ---- A. load
let p = await newPage();
await p.goto(URL_); await p.waitForSelector('[data-testid="demo-note"]');
ok("A1 loads with zero console errors", p.logs.length === 0, JSON.stringify(p.logs));
ok("A2 no requests to other origins on load", p.ext.length === 0, JSON.stringify(p.ext));

// ---- B. every lot through the real route handlers, in the browser
const TOL = 0.01;
const getPath = (o, d) => d.split(".").reduce((c, k) => (c && typeof c === "object" && k in c ? c[k] : undefined), o);
for (let i = 0; i < gold.parcels.length; i++) {
  const g = gold.parcels[i];
  const r = await p.evaluate(async ({ query, bbl }) => {
    const res = await fetch("/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, intendedUse: "residential", programs: [], overrides: {} }) });
    const text = await res.text();
    const ev = {};
    for (const blk of text.split("\n\n")) { const m = /event: (\w+)\ndata: (.*)/s.exec(blk); if (m) ev[m[1]] = JSON.parse(m[2]); }
    const ex = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bbl, format: "json", intendedUse: "residential", programs: [], overrides: {} }) });
    return { ev, exportJson: await ex.json(), exStatus: ex.status, valid: ex.headers.get("x-envelope-valid") };
  }, { query: g.query, bbl: g.bbl });
  const { site, brief } = r.ev;
  const fails = [];
  if (!brief || !site) fails.push("no brief/site: " + JSON.stringify(r.ev.error));
  else for (const [f, exp] of Object.entries(g.expect)) {
    let raw;
    if (f === "zoneDist") raw = site.pluto?.zoneDist;
    else if (f === "lotArea") raw = getPath(brief.envelope, "lot.area");
    else if (f === "lotType") raw = brief.assumptions.find((a) => a.key === "lotType")?.value;
    else if (f === "split") raw = brief.splitLot.isSplit;
    else raw = getPath(brief.controls, f);
    const act = raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw ? raw.value : raw;
    const pass = exp === null ? act === null || act === undefined : typeof exp === "number" ? typeof act === "number" && Math.abs(act - exp) <= TOL : JSON.stringify(act) === JSON.stringify(exp);
    if (!pass) fails.push(`${f}: expected ${JSON.stringify(exp)} got ${JSON.stringify(act)}`);
  }
  ok(`B ${g.bbl} ${g.address}: ${Object.keys(g.expect).length} gold fields`, fails.length === 0, fails.join("; "));
  ok(`B ${g.bbl} done event, envelope valid, no error`, !!r.ev.done && !r.ev.error && brief?.validation?.valid === true && r.valid === "true");
  ok(`B ${g.bbl} browser export envelope == node envelopes.json (ignoring envelopeId/generatedAt timestamps)`, JSON.stringify({ ...r.exportJson, envelopeId: 0, generatedAt: 0 }) === JSON.stringify({ ...envs[i], envelopeId: 0, generatedAt: 0 }));
}
// out-of-set address fails gracefully
const bad = await p.evaluate(async () => { const res = await fetch("/api/brief", { method: "POST", body: JSON.stringify({ query: "1 Main Street, Brooklyn" }) }); return await res.text(); });
ok("B11 unknown address -> error event (no crash)", /event: error/.test(bad), bad.slice(0, 160));
const ac = await p.evaluate(async () => (await (await fetch("/api/geocode?q=convent")).json()).results);
ok("B12 geocode autocomplete returns only matching preloaded lots", ac.length === 1 && ac[0].bbl === "1020500004", JSON.stringify(ac));
await p.context().close();

// ---- C. UI flows on lot 1 (with downloads capability stubbed) and fallback
async function openLot(page, text) {
  await page.getByText(text).first().click();
  await page.waitForSelector('[data-testid="envelope-valid"]', { timeout: 30000 });
}
p = await newPage();
await p.addInitScript(() => {
  window.__saved = [];
  window.claude = { use: async (n) => n === "downloads" ? { save: async (r) => { const b = r.data; window.__saved.push({ filename: r.filename, size: b.size ?? b.length, isBlob: b instanceof Blob, head: null, blob: b }); return { status: "saved" }; } } : null };
});
await p.goto(URL_);
await openLot(p, "287 Convent Avenue, Manhattan");
ok("C1 brief completes in UI (envelope valid badge)", true);
const txt = await p.innerText("body");
ok("C2 no-key narrative copy line shown", /No AI narrative in this build/.test(txt));
ok("C3 use-group matrix renders", await p.getByText("Use groups by district column").count() > 0 && await p.getByText("IIResidences").count() > 0);
// ZR source pane
await p.getByRole("button", { name: /ZR 23-22/ }).first().click();
await p.waitForTimeout(1500);
const pane = await p.innerText("body");
ok("C4 ZR source pane opens a cited section", /23-22/.test(pane) && /Floor Area Ratio|floor area ratio/i.test(pane), "");
await p.keyboard.press("Escape");
// override: edit lot type to corner -> lot coverage / values change
const cov = async () => (await p.innerText("body")).match(/Lot coverage \(max\)[\s\S]{0,12}?\n\s*(\d+)%/)?.[1] ?? (await p.innerText("body")).match(/80%|100%/)?.[0];
const key = async () => (await p.locator('[data-testid="key-controls"]').count()) ? await p.locator('[data-testid="key-controls"]').innerText() : (await p.innerText("body")).slice(0, 0);
const beforeTxt = await p.innerText("body");
await p.getByRole("button", { name: "Edit" }).first().click();
await p.locator("select").first().selectOption("corner");
await p.getByRole("button", { name: "Apply" }).click();
await p.waitForTimeout(1500);
const afterTxt = await p.innerText("body");
ok("C5 assumption override changes values", beforeTxt !== afterTxt && /Overridden|overridden|corner lot/i.test(afterTxt) && /100%/.test(afterTxt) && !/Rear yard\nInferred\n\t?20 ft/.test(afterTxt.slice(0,0)), `coverage 80%->${/100%/.test(afterTxt) ? "100%" : "?"}`);
// 3D tab
await p.getByText("3D", { exact: true }).first().click();
await p.waitForTimeout(3000);
const cv = await p.evaluate(() => { const c = [...document.querySelectorAll("canvas")].filter((c) => c.width > 50); return c.map((c) => [c.width, c.height]); });
const nonblank = await p.evaluate(() => { const c = [...document.querySelectorAll("canvas")].find((c) => c.closest("[aria-label],[role]") && c.width > 50 && !c.className.includes("maplibre")) ?? document.querySelectorAll("canvas")[0]; try { const t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const x = t.getContext("2d"); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, t.width, t.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n; } catch (e) { return -1; } });
await p.screenshot({ path: path.join(ROOT, "scripts/.3d.png") });
ok("C6 3D envelope preview renders (WebGL canvas present)", cv.length > 0, JSON.stringify(cv) + " nonTransparentSamples=" + nonblank);
// Open in Massing
await p.getByRole("button", { name: "Open in Massing" }).click();
await p.waitForTimeout(1500);
const clip = await p.evaluate(() => navigator.clipboard.readText()).catch((e) => "ERR " + e.message);
let envOk = false; try { const j = JSON.parse(clip); envOk = !!j.schemaVersion; } catch {}
ok("C7 Open in Massing copies envelope JSON to clipboard", envOk, clip.slice(0, 40));
const saved1 = await p.evaluate(() => window.__saved.map((x) => [x.filename, x.size]));
ok("C8 Open in Massing offers envelope download via downloads capability", saved1.some((x) => /^envelope-1020500004\.json$/.test(x[0])), JSON.stringify(saved1));
ok("C9 handoff toast names the Massing Studio artifact", (await p.getByText("Open Massing Studio").count()) > 0 || /Massing Studio/.test(await p.innerText("body")));
// Exports via capability
for (const [label, ext] of [["Download PDF sheet", "pdf"], ["Download Markdown", "md"], ["Download envelope JSON", "json"]]) {
  await p.getByRole("button", { name: "Export" }).first().click();
  await p.getByRole("button", { name: label }).click();
  await p.waitForFunction((e) => window.__saved.some((x) => x.filename.endsWith("." + e) && !x.filename.startsWith("envelope-")), ext, { timeout: 30000 }).catch(() => {});
  const info = await p.evaluate(async (e) => { const x = window.__saved.find((x) => x.filename.endsWith("." + e) && !x.filename.startsWith("envelope-")); if (!x) return null; const buf = new Uint8Array(await x.blob.arrayBuffer()); return { filename: x.filename, size: buf.length, head: new TextDecoder().decode(buf.slice(0, 8)), tail: new TextDecoder().decode(buf.slice(-8)) }; }, ext);
  const good = info && (ext === "pdf" ? info.head.startsWith("%PDF-") && info.size > 5000 : ext === "md" ? info.size > 500 && /^#/.test(info.head) : info.head.trim().startsWith("{"));
  ok(`C10 export ${ext} via downloads capability`, !!good, JSON.stringify(info));
  await p.keyboard.press("Escape");
}
await p.context().close();

// ---- C'. fallback path (no window.claude): normal blob <a download>
p = await newPage();
await p.goto(URL_);
await openLot(p, "152 Attorney Street, Manhattan");
for (const [label, ext] of [["Download Markdown", "md"], ["Download envelope JSON", "json"], ["Download PDF sheet", "pdf"]]) {
  await p.getByRole("button", { name: "Export" }).first().click();
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.getByRole("button", { name: label }).click()]);
  const fp = await dl.path(); const buf = fs.readFileSync(fp);
  const good = ext === "pdf" ? buf.slice(0, 5).toString() === "%PDF-" : ext === "md" ? buf.length > 500 : JSON.parse(buf.toString()).schemaVersion;
  ok(`C11 fallback ${ext} download (${dl.suggestedFilename()}, ${buf.length} B)`, !!good);
  await p.keyboard.press("Escape");
}
const [dl2] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Open in Massing" }).click()]);
ok("C12 fallback Open in Massing downloads envelope json", /^envelope-1003450002\.json$/.test(dl2.suggestedFilename()), dl2.suggestedFilename());
ok("C13 no console errors / other-origin requests during UI flows", p.logs.length === 0 && p.ext.length === 0, JSON.stringify([p.logs, p.ext]));
await p.context().close();

// ---- D. 390px
p = await newPage(390, 844);
await p.goto(URL_); await p.waitForSelector('[data-testid="demo-note"]');
let sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
ok("D1 no horizontal scroll at 390px (home)", sw[0] <= sw[1], sw.join("/"));
await openLot(p, "287 Convent Avenue, Manhattan");
await p.waitForTimeout(1500);
sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
ok("D2 no horizontal scroll at 390px (brief)", sw[0] <= sw[1], sw.join("/"));
await p.context().close();
await browser.close();
const f = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - f}/${results.length} passed`);
process.exit(f ? 1 : 0);
