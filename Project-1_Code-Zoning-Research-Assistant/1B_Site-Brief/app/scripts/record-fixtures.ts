// Records live responses for the 10 eval parcels (research/test-parcels.md L1-L10 / G1-G10) into .cache/http,
// then copies exactly the cache files this run touched into fixtures/http (committed; offline demo fallback).
// Usage: npx tsx scripts/record-fixtures.ts
import fs from "node:fs";
import path from "node:path";
import { cacheDir, fixturesDir, runWithFetchLog, type FetchMeta } from "../lib/sources/http";

process.env.SOURCE_MODE = "live";

// Address strings are the exact GeoSearch queries from test-parcels.md G1-G10.
const PARCELS: { bbl: string; query: string }[] = [
  { bbl: "1020500004", query: "287 Convent Avenue, Manhattan" },
  { bbl: "1003450002", query: "152 Attorney Street, Manhattan" },
  { bbl: "3039730022", query: "261 Shepherd Avenue, Brooklyn" },
  { bbl: "2022720049", query: "501 East 145 Street, Bronx" },
  { bbl: "1003720008", query: "270 East 3 Street, Manhattan" },
  { bbl: "1003980028", query: "196 East 3 Street, Manhattan" },
  { bbl: "2027570124", query: "1039 Lowell Street, Bronx" },
  { bbl: "1007330055", query: "430 West 36 Street, Manhattan" },
  { bbl: "2025500028", query: "618 East 138 Street, Bronx" },
  { bbl: "1004630033", query: "123 2 Avenue, Manhattan" },
];

async function main() {
  fs.rmSync(cacheDir(), { recursive: true, force: true }); // so everything in .cache after the run was fetched by it
  const { getSiteData } = await import("../lib/sources/site");
  const log: FetchMeta[] = [];
  await runWithFetchLog(log, async () => {
    for (const p of PARCELS) {
      for (const q of [p.query, p.bbl]) {
        const s = await getSiteData(q);
        const front = s.edges.filter((e) => e.kind === "front").map((e) => `${e.street?.name ?? "?"} (${e.street?.widthRaw ?? "?"})`);
        console.log(
          `${p.bbl} <- "${q}": bbl=${s.geocode?.bbl} zone=${s.pluto?.zoneDist.join("/")} ov=${s.pluto?.overlays.join("/")} ` +
          `districts=${s.districts.map((d) => `${d.code}:${(d.share ?? 0).toFixed(3)}`).join(",")} front=[${front.join("; ")}] ` +
          `edges=${s.edges.map((e) => e.kind[0]).join("")} errors=${s.errors.map((e) => e.source + ": " + e.message).join(" | ") || "none"}`,
        );
      }
    }
  });
  fs.mkdirSync(fixturesDir(), { recursive: true });
  void log;
  const files = fs.readdirSync(cacheDir()).filter((f) => f.endsWith(".json"));
  let n = 0;
  for (const f of files) {
    const src = path.join(cacheDir(), f);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(fixturesDir(), f)); n++; }
  }
  console.log(`copied ${n} cache files to ${fixturesDir()}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
