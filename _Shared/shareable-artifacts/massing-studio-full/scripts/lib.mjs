import { createRequire } from "node:module";
const require = createRequire("/Users/king/Downloads/WXYArchitecture/Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/app/package.json");
export const { chromium } = require("playwright");
export async function launch(url, viewport = { width: 1440, height: 900 }) {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
  const ctx = await b.newContext({ viewport });
  const p = await ctx.newPage();
  const errs = [], reqs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("request", (r) => { const u = r.url(); if (!u.startsWith("data:") && !u.startsWith("blob:")) reqs.push(u); });
  await p.addInitScript(() => {
    // Mock of the artifact `downloads` capability: records saves instead of prompting.
    window.__saves = [];
    window.claude = { use: async (n) => n === "downloads" ? { save: async (r) => { const buf = r.data instanceof Blob ? new Uint8Array(await r.data.arrayBuffer()) : typeof r.data === "string" ? new TextEncoder().encode(r.data) : new Uint8Array(r.data); window.__saves.push({ filename: r.filename, bytes: Array.from(buf.slice(0, 64)), size: buf.length, b64: btoa(String.fromCharCode(...buf.slice(0, 1))), all: null }); window.__lastSave = buf; return { status: "saved" }; } } : null };
  });
  await p.goto(url);
  return { b, p, errs, reqs };
}
