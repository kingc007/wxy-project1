// Copies the shared ZR corpus (official text parsed from zr.planning.nyc.gov) into app/data/zr/.
// Run via `npm run sync-corpus`. lib/zr/corpus.ts reads these files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const srcDir = path.resolve(appRoot, "../../shared/zr-corpus/data");
const dstDir = path.resolve(appRoot, "data/zr");
const files = ["zr-sections.json", "definitions.json", "manifest.json"];

fs.mkdirSync(dstDir, { recursive: true });
for (const f of files) {
  const src = path.join(srcDir, f);
  if (!fs.existsSync(src)) {
    console.error(`sync-corpus: missing ${src}`);
    process.exit(1);
  }
  const text = fs.readFileSync(src, "utf8");
  JSON.parse(text); // fail fast on invalid JSON
  fs.writeFileSync(path.join(dstDir, f), text);
}
console.log(`sync-corpus: copied ${files.length} files to ${path.relative(appRoot, dstDir)}`);
