// Extra checks: file:// open, Diagram/Plan views (3D label font), paste-envelope import, bad-JSON error.
import { launch } from "./lib.mjs";
import { readFileSync } from "node:fs";
const url = process.argv[2];
const env = readFileSync("/Users/king/Downloads/WXYArchitecture/_Shared/schemas/examples/r6a-interior-287-convent-ave.json", "utf8");
const { b, p, errs, reqs } = await launch(url);
await p.waitForTimeout(1500);
console.log("title:", await p.title(), "| Real lots visible:", await p.getByText("Real lots").first().isVisible());
// paste import
await p.getByRole("button", { name: "Setup" }).first().isVisible().catch(()=>{});
await p.getByRole("button", { name: "Paste envelope JSON" }).first().click();
await p.getByLabel("Zoning envelope JSON").first().fill("{ not json");
await p.getByRole("button", { name: "Load pasted envelope" }).first().click();
await p.waitForTimeout(500);
console.log("bad json shows error:", /isn't a valid zoning envelope/.test(await p.evaluate(() => document.body.innerText)));
await p.getByLabel("Zoning envelope JSON").first().fill(env);
await p.getByRole("button", { name: "Load pasted envelope" }).first().click();
await p.waitForTimeout(1500);
const t = await p.evaluate(() => document.body.innerText);
console.log("pasted envelope loaded:", /287 Convent|r6a-interior-287-convent-ave|R6A/.test(t), "| 'Loaded' announcement:", /Loaded /.test(t));
// diagram/plan
for (const v of ["Diagram", "Plan", "Street"]) { await p.getByRole("button", { name: v, exact: true }).click(); await p.waitForTimeout(1500); await p.screenshot({ path: `${process.argv[3]}/extra-${v}.png` }); }
console.log("errors:", errs, "\nrequests:", [...new Set(reqs)]);
await b.close();
