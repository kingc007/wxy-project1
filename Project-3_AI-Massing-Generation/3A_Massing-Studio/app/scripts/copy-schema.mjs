// schemas/zoning-envelope.schema.json is a generated copy of the canonical file shipped by @wxy/massing
// (shared/massing/data). Do not edit it; run `npm run copy-schema`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
const from = "node_modules/@wxy/massing/data/zoning-envelope.schema.json";
if (!existsSync(from)) throw new Error(`${from} not found: run npm install`);
mkdirSync("schemas", { recursive: true });
copyFileSync(from, "schemas/zoning-envelope.schema.json");
console.log("copied zoning-envelope.schema.json to schemas/");
