import { launch } from "./lib.mjs";
const { b, p, errs } = await launch(process.argv[2]);
await p.getByRole("button", { name: /Interior lot/ }).first().click();
await p.getByLabel("Project brief").fill("About 120 units, ground-floor retail, a public courtyard.");
await p.getByRole("button", { name: "Read brief" }).click();
await p.waitForTimeout(800);
while (await p.getByRole("button", { name: /^Accept / }).count()) await p.getByRole("button", { name: /^Accept / }).first().click();
await p.getByRole("button", { name: "Confirm schedule" }).click();
await p.getByRole("button", { name: "Generate 6 options" }).click();
await p.waitForFunction(() => /Option 6/.test(document.body.innerText), null, { timeout: 60000 });
for (const re of [/parameters/i]) {
  await p.getByRole("button", { name: "Export" }).click();
  console.log("menu items", await p.getByRole("menuitem").allInnerTexts());
  await p.getByRole("menuitem", { name: re }).click();
  await p.waitForTimeout(3000);
  console.log(await p.evaluate(() => ({ saves: window.__saves.map(s=>[s.filename,s.size]), notice: document.body.innerText.match(/Export[^\n]*/g) })));
}
console.log(errs); await b.close();
