import { writeFileSync } from "node:fs";
const OUT = process.argv[2];
const lots = [
  ["287 Convent Avenue, Manhattan","R6A inside lot"],["152 Attorney Street, Manhattan","R7A inside lot"],["261 Shepherd Avenue, Brooklyn","R8A inside lot"],
  ["501 East 145 Street, Bronx","corner"],["270 East 3 Street, Manhattan","corner"],["196 East 3 Street, Manhattan","split lot"],
  ["1039 Lowell Street, Bronx","split lot"],["430 West 36 Street, Manhattan","special district"],["618 East 138 Street, Bronx","landmark"],["123 2 Avenue, Manhattan","historic district"]];
const all = [];
for (const [query, note] of lots) {
  const r = await fetch("http://localhost:3101/api/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, intendedUse: "residential", programs: [] }) });
  const text = await r.text(); const ev = {};
  for (const block of text.split("\n\n")) { const e = block.match(/^event: (.+)$/m)?.[1]; const d = block.match(/^data: (.+)$/m)?.[1]; if (e && d) ev[e] = JSON.parse(d); }
  console.log(query, Object.keys(ev).join(","), ev.error?.message ?? "", (JSON.stringify(ev.site ?? {}).length + JSON.stringify(ev.brief ?? {}).length));
  all.push({ query, note, meta: ev.meta, site: ev.site, brief: ev.brief, error: ev.error ?? null });
}
writeFileSync(OUT, JSON.stringify(all));
