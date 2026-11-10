// Generates dist/envelopes.json: the ZoningEnvelope for each preloaded lot (default assumptions, residential),
// produced by the app's real engine in node with SOURCE_MODE=offline, each validated against the canonical schema
// in _Shared/schemas. Run via `npm run envelopes` (the script cd's into the app dir because the engine reads
// fixtures/ and data/ relative to process.cwd(); it only reads from there).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const APP = path.resolve(ROOT, "../../../Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/app");

if (!process.env.__ENVELOPES_INNER) {
  const tsx = path.join(ROOT, "node_modules/.bin/tsx");
  execFileSync(tsx, ["--tsconfig", path.join(APP, "tsconfig.json"), fileURLToPath(import.meta.url)], {
    cwd: APP, stdio: "inherit", env: { ...process.env, SOURCE_MODE: "offline", __ENVELOPES_INNER: "1" },
  });
  process.exit(0);
}

const { default: Ajv2020 } = await import(path.join(ROOT, "node_modules/ajv/dist/2020.js"));
const { default: addFormats } = await import(path.join(ROOT, "node_modules/ajv-formats/dist/index.js"));
const { getSiteData } = await import(path.join(APP, "lib/sources/site.ts"));
const { computeBrief } = await import(path.join(APP, "lib/zoning/index.ts"));
const { toSchemaJson } = await import(path.join(APP, "lib/zoning/envelope.ts"));

const schema = JSON.parse(fs.readFileSync(path.resolve(ROOT, "../../schemas/zoning-envelope.schema.json"), "utf8"));
const gold = JSON.parse(fs.readFileSync(path.join(APP, "evals/gold.json"), "utf8")) as { parcels: { bbl: string; query: string; address: string }[] };
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const out: unknown[] = [];
let bad = 0;
for (const p of gold.parcels) {
  const site = await getSiteData(p.query);
  const brief = computeBrief(site, { intendedUse: "residential", programs: [], overrides: {} });
  const env = toSchemaJson(brief.envelope);
  const ok = validate(env);
  if (!ok) { bad++; console.error(`INVALID ${p.bbl} ${p.address}`, JSON.stringify(validate.errors?.slice(0, 5))); }
  else console.log(`valid   ${p.bbl} ${p.address}`);
  out.push(env);
}
const dist = path.join(ROOT, "dist");
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "envelopes.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.length} envelopes (${bad} invalid) -> dist/envelopes.json`);
process.exit(bad ? 1 : 0);
