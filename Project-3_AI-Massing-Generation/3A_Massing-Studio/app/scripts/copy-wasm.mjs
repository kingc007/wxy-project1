// Copies WASM binaries the browser needs into public/wasm (run by predev/prebuild).
// manifold.wasm comes from the shared engine package's own manifold-3d install.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
mkdirSync("public/wasm", { recursive: true });
const manifold = ["node_modules/@wxy/massing/node_modules/manifold-3d/manifold.wasm", "node_modules/manifold-3d/manifold.wasm"].find(existsSync);
if (!manifold) throw new Error("manifold.wasm not found: run npm install in shared/massing");
for (const [from, to] of [
  ["node_modules/rhino3dm/rhino3dm.wasm", "public/wasm/rhino3dm.wasm"],
  [manifold, "public/wasm/manifold.wasm"],
]) copyFileSync(from, to);
console.log("copied wasm to public/wasm");
