import fs from "node:fs";
import path from "node:path";
import { parseBriefOffline } from "/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/src/lib/ai/brief";
import type { GenerateEvent, OptionPayload } from "/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/src/lib/ai/contracts";
import { runGenerate } from "/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/src/lib/ai/generate";
import { loadModel } from "/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/src/lib/ai/site";
import { DEFAULT_ASSUMPTIONS, generateOption } from "/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/node_modules/@wxy/massing/src/index.ts";

const OUT = process.argv[2];
const samplesDir = "/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/node_modules/@wxy/massing/data/samples";
const realDir = "/Users/king/Downloads/WXYArchitecture/_Shared/schemas/examples";
const briefs = JSON.parse(fs.readFileSync("/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/eval/briefs.json", "utf8")).briefs as { id: string; text: string }[];
const context = JSON.parse(fs.readFileSync("/Users/king/Downloads/WXYArchitecture/Project-3_AI-Massing-Generation/3A_Massing-Studio/app/node_modules/@wxy/massing/data/context-fort-greene.json", "utf8")).buildings as { bin: number; height: number; polygon: { outer: [number, number][] } | [number, number][] }[];
const r1 = (n: number) => Math.round(n * 10) / 10;
const ring = (pts: [number, number][]) => pts.map(([x, y]) => [r1(x), r1(y)]);

async function main() {
  const sites: unknown[] = [];
  const files = [
    ...fs.readdirSync(samplesDir).filter((f) => f.endsWith(".json") && !f.endsWith(".site.json")).sort().map((f) => ({ file: path.join(samplesDir, f), sample: true })),
    ...fs.readdirSync(realDir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: path.join(realDir, f), sample: false })),
  ];
  for (const { file, sample } of files) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const loaded = await loadModel(raw);
    if (!loaded.ok) throw new Error(file + ": " + loaded.message);
    const model = loaded.model;
    const lot = model.lot.outer as [number, number][];
    const cx = lot.reduce((s, p) => s + p[0], 0) / lot.length, cy = lot.reduce((s, p) => s + p[1], 0) / lot.length;
    let ctx: { h: number; p: number[][] }[] = [];
    const sidecar = file.replace(/\.json$/, ".site.json");
    if (sample && fs.existsSync(sidecar)) {
      const removed = new Set(JSON.parse(fs.readFileSync(sidecar, "utf8")).removedContextBins ?? []);
      ctx = context.filter((b) => !removed.has(b.bin)).map((b) => {
        const outer = (Array.isArray(b.polygon) ? b.polygon : b.polygon.outer) as [number, number][];
        return { h: r1(b.height), p: ring(outer) };
      }).filter((b) => b.p.some(([x, y]) => Math.hypot(x - cx, y - cy) < 420));
    }
    const runs = [];
    for (const brief of briefs) {
      const parsed = parseBriefOffline(brief.text);
      const schedule = { ...parsed.schedule, confirmed: true, uses: parsed.schedule.uses.map((u) => ({ ...u, accepted: true })) };
      const assumptions = { ...DEFAULT_ASSUMPTIONS, ...parsed.assumptions };
      const events: GenerateEvent[] = [];
      await runGenerate({ model, schedule, assumptions, mode: "builtin" }, (e) => events.push(e));
      const slots = events.filter((e): e is Extract<GenerateEvent, { type: "slot"; option: OptionPayload }> => e.type === "slot" && e.status !== "running").sort((a, b) => a.slot - b.slot);
      runs.push({
        briefId: brief.id, briefText: brief.text,
        schedule: schedule.uses.map((u) => ({ use: u.use, targetSf: u.targetSf ?? null, units: (u as { units?: number }).units ?? null })),
        options: slots.map((s) => {
          const o = generateOption(model, schedule, assumptions, s.option.params);
          return {
            slot: s.slot, name: s.option.name, intent: s.option.intent, typology: s.option.typology,
            fit: s.option.fit ?? "ok", notes: s.option.notes, overall: s.option.overall,
            metrics: s.option.metrics,
            compliance: o.compliance.map((c) => ({ rule: c.rule, allowed: c.allowed, proposed: c.proposed, status: c.status, detail: c.detail, simplified: c.simplified, cite: c.citations.map((x) => x.section ? "ZR " + x.section : x.source).filter(Boolean).slice(0, 2) })),
            prisms: o.prisms.map((p) => ({ z0: r1(p.z0), z1: r1(p.z1), use: p.program, p: ring(p.polygon.outer as [number, number][]), h: (p.polygon.holes ?? []).map((hh) => ring(hh as [number, number][])) })),
          };
        }),
      });
      console.log(path.basename(file), brief.id, slots.length, "options");
    }
    sites.push({
      id: path.basename(file, ".json"), sample, envelopeId: model.envelopeId,
      lotArea: model.lotArea, lotAreaSource: model.lotAreaSource, polygonArea: r1(model.polygonArea),
      maxFar: Object.fromEntries(Object.entries(model.maxFar).map(([k, c]) => [k, c?.value ?? null])),
      maxHeight: model.maxBuildingHeight?.value ?? null,
      lot: ring(lot), edges: model.edges.map((e) => ({ kind: e.kind, street: e.streetWidth })),
      notes: model.notes, simplifications: model.simplifications, context: ctx, runs,
    });
  }
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), engine: "@wxy/massing built-in strategies", sites }));
}
main().catch((e) => { console.error(e); process.exit(1); });
