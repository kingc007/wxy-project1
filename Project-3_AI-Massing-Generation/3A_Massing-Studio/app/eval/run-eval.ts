// npm run eval: sample envelopes x briefs, offline (always) and AI (when ANTHROPIC_API_KEY is set).
// Writes eval/results.json and eval/report.html.
import fs from "node:fs";
import path from "node:path";
import { parseBriefAi, parseBriefOffline, type ParsedBrief } from "../src/lib/ai/brief";
import { getClient } from "../src/lib/ai/client";
import type { GenerateEvent, OptionPayload } from "../src/lib/ai/contracts";
import { runGenerate } from "../src/lib/ai/generate";
import { loadModel } from "../src/lib/ai/site";
import { DEFAULT_ASSUMPTIONS, diversityScore, generateOption } from "@wxy/massing";
import type { Assumptions, ProgramSchedule } from "@wxy/massing";
import { renderReport, type EvalRun } from "./report-template";

const ROOT = path.resolve(__dirname, "..");
const samplesDir = path.join(ROOT, "node_modules/@wxy/massing/data/samples");
// Project 1 published REAL envelopes (not SAMPLE data); second set, labelled sample=false.
const realDir = path.resolve(ROOT, "../../../_Shared/schemas/examples");
const briefs: { id: string; text: string }[] = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/briefs.json"), "utf8")).briefs;

function confirm(p: ParsedBrief): { schedule: ProgramSchedule; assumptions: Assumptions } {
  return {
    schedule: { ...p.schedule, confirmed: true, uses: p.schedule.uses.map((u) => ({ ...u, accepted: true })) },
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...p.assumptions },
  };
}

async function main() {
  const sets: { dir: string; sample: boolean; files: string[] }[] = [
    { dir: samplesDir, sample: true, files: fs.readdirSync(samplesDir).filter((f) => f.endsWith(".json") && !f.endsWith(".site.json")).sort() },
    ...(fs.existsSync(realDir) ? [{ dir: realDir, sample: false, files: fs.readdirSync(realDir).filter((f) => f.endsWith(".json")).sort() }] : []),
  ];
  const hasKey = Boolean(getClient());
  const modes: ("offline" | "ai")[] = hasKey ? ["offline", "ai"] : ["offline"];
  const runs: EvalRun[] = [];

  for (const { dir, sample, files } of sets) for (const file of files) {
    const loaded = await loadModel(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
    if (!loaded.ok) throw new Error(`${file}: ${loaded.message}`);
    const model = loaded.model;
    for (const brief of briefs) {
      for (const mode of modes) {
        const t0 = Date.now();
        let parsed: ParsedBrief = parseBriefOffline(brief.text);
        let cost = 0;
        if (mode === "ai") {
          const r = await parseBriefAi(getClient()!, brief.text, undefined);
          if (!("error" in r)) {
            parsed = r.parsed;
            cost += r.usage.usd;
          }
        }
        const { schedule, assumptions } = confirm(parsed);
        const events: GenerateEvent[] = [];
        const totals = await runGenerate({ model, schedule, assumptions, mode: mode === "ai" ? "ai" : "builtin" }, (e) => events.push(e));
        cost += totals.usd;
        const slots = events
          .filter((e): e is Extract<GenerateEvent, { type: "slot"; option: OptionPayload }> => e.type === "slot" && e.status !== "running")
          .sort((a, b) => a.slot - b.slot);
        const options = slots.map((s) => {
          // prisms are not part of the payload: regenerate from params (the engine is deterministic)
          const o = generateOption(model, schedule, assumptions, s.option.params);
          return {
            slot: s.slot,
            typology: s.option.typology,
            source: s.option.source,
            status: s.status,
            overall: s.option.overall.label,
            failCount: s.option.overall.failCount,
            gfa: s.option.metrics.gfa,
            far: s.option.metrics.far,
            prisms: o.prisms,
            pass: s.option.overall.status === "pass",
            fit: s.option.programFit,
            params: s.option.params,
          };
        });
        const rows = options.flatMap((o) => o.fit);
        runs.push({
          envelope: file.replace(/\.json$/, ""),
          sample,
          notRealisable: slots.filter((x) => x.option.fit === "typology-not-realisable").length,
          empty: options.filter((o) => !(o.gfa > 0)).length,
          brief: brief.id,
          mode,
          options,
          pctNoFails: (options.filter((o) => o.failCount === 0).length / options.length) * 100,
          pctPass: (options.filter((o) => o.pass).length / options.length) * 100,
          diversity: diversityScore(options.map((o) => ({ params: o.params, typology: o.typology as never }))),
          programFitPct: rows.length ? (rows.filter((r) => r.met).length / rows.length) * 100 : null,
          latencyMs: Date.now() - t0,
          costUsd: cost,
        });
      }
    }
  }

  const slim = runs.map((r) => ({ ...r, options: r.options.map((o) => ({ ...o, prisms: undefined, params: undefined, fit: undefined })) }));
  fs.writeFileSync(path.join(ROOT, "eval/results.json"), JSON.stringify({ aiMode: hasKey, runs: slim }, null, 2));
  fs.writeFileSync(path.join(ROOT, "eval/report.html"), renderReport(runs, { generatedBy: "eval/run-eval.ts" }));

  console.log("set | envelope | brief | mode | noFails% | pass% | diversity | programFit% | ms | $ | notRealisable | empty");
  for (const r of runs)
    console.log(`${r.sample ? "SAMPLE" : "real"} | ${r.envelope} | ${r.brief} | ${r.mode} | ${r.pctNoFails.toFixed(0)} | ${r.pctPass.toFixed(0)} | ${r.diversity.toFixed(3)} | ${r.programFitPct === null ? "n/a" : r.programFitPct.toFixed(0)} | ${r.latencyMs} | ${r.costUsd.toFixed(4)} | ${r.notRealisable} | ${r.empty}`);
  if (!hasKey) console.log("AI mode skipped: no ANTHROPIC_API_KEY.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
