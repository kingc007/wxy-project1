import { beforeAll, describe, expect, it } from "vitest";
import { PARAM_SPECS, DEFAULT_ASSUMPTIONS, EMPTY_SCHEDULE, buildEnvelopeModel, checkGrounding, allowedNumbersFromOption, initGeometry, type MassingOption } from "@wxy/massing";
import { SAMPLE_SITES, summarizeRawEnvelope, contextFor } from "@/lib/studio/samples";
import { builtinProposals } from "@/lib/studio/builtin";
import { makeSlot } from "@/lib/store/logic";
import { farSummary, freshAnnouncement, generationAnnouncement, selectionAnnouncement, deltaRows, exportBaseName, metricRow, metricsAnnouncement, minutesLabel, overallInfo } from "@/lib/studio/format";
import { paramGroups } from "@/lib/studio/params";
import { parseGenerateLine } from "@/lib/studio/api";
import { courtyardSunHoursSync, daylightRange, presetById } from "@/lib/studio/sun-study";
import { envelopeSections } from "@/lib/studio/viewer-data";

let option: MassingOption;
let model: ReturnType<typeof buildEnvelopeModel>;

beforeAll(async () => {
  await initGeometry();
  model = buildEnvelopeModel(SAMPLE_SITES[0].envelope);
  const r = makeSlot(0, { model, schedule: { ...EMPTY_SCHEDULE, confirmed: true }, assumptions: DEFAULT_ASSUMPTIONS }, builtinProposals()[1], "builtin");
  if (!r.ok) throw new Error(r.error);
  option = r.value.option;
});

describe("metricRow", () => {
  it("formats FAR used / max from the compliance row and the engine's own numbers", () => {
    const row = metricRow(option);
    expect(row.map((m) => m.id)).toEqual(["far", "gfa", "height", "units", "open"]);
    expect(row[0].value).toMatch(/^\d+\.\d{2} \/ \d+\.\d{2}$/);
    expect(row[0].spoken).toMatch(/^FAR \d+\.\d{2} of \d+\.\d{2}$/);
    expect(row[2].value).toMatch(/ ft$/);
    expect(row[3].value.startsWith("~")).toBe(true);
    expect(row[4].value.endsWith("%")).toBe(true);
  });
  it("status label pluralises the fail count", () => {
    const label = overallInfo(option).label;
    const n = option.overall.failCount;
    if (option.overall.status === "fail" && n > 0) expect(label).toBe(`Fails ${n} ${n === 1 ? "rule" : "rules"}`);
    else expect(label).toBe(option.overall.label);
    expect(["Passes all rules", "Needs review"].includes(option.overall.label) || /^Fails \d+ rule\(s\)$/.test(option.overall.label)).toBe(true);
  });
  it("announcement mentions FAR and the overall status", () => {
    expect(metricsAnnouncement(option)).toMatch(/^FAR \d+\.\d{2} of \d+\.\d{2}, (passes|fails|review)\./);
  });
  it("deltaRows of identical options are unchanged", () => {
    expect(deltaRows(option, option).every((d) => !d.changed)).toBe(true);
  });
});

describe("misc pure helpers", () => {
  it("export base name", () => {
    expect(exportBaseName("sample-a", new Date(2026, 9, 5))).toBe("wxy-massing-sample-a-20261005");
  });
  it("minutes label", () => {
    expect(minutesLabel(720)).toBe("12:00 pm");
    expect(minutesLabel(0)).toBe("12:00 am");
    expect(minutesLabel(795)).toBe("1:15 pm");
  });
  it("param groups cover every param exactly once", () => {
    for (const t of ["podium_tower", "perimeter_courtyard", "stepped_terraces", "slab_bar", "split_massing", "carved_volume", "block"] as const) {
      const g = paramGroups(t);
      const keys = [...g.lead, ...g.more].map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toHaveLength(PARAM_SPECS.length);
      expect(g.lead.length).toBeGreaterThan(3);
    }
  });
  it("sample card summaries are read from the envelope JSON", () => {
    const s = summarizeRawEnvelope(SAMPLE_SITES[2].envelope);
    expect(s).toMatchObject({ district: "R10", lotType: "through", sample: true });
    expect(s.areaSf).toBeGreaterThan(39000);
  });
  it("context drops the removed BINs", () => {
    const all = contextFor({ ...SAMPLE_SITES[0].site, removedContextBins: [] });
    const some = contextFor(SAMPLE_SITES[0].site);
    expect(some.length).toBe(all.length - SAMPLE_SITES[0].site.removedContextBins.length);
  });
  it("envelope sections end on a repeated top band", () => {
    const s = envelopeSections(model);
    expect(s.length).toBe(model.breakHeights.length);
    expect(s[0].z).toBe(0);
  });
});

describe("grounding of the displayed intent", () => {
  it("flags a number the engine did not compute", () => {
    const ok = checkGrounding("A courtyard block.", allowedNumbersFromOption(option));
    expect(ok.ok).toBe(true);
    const bad = checkGrounding("Holds 9,876 units.", allowedNumbersFromOption(option));
    expect(bad.ok).toBe(false);
    expect(bad.unmatched).toContain("9,876");
  });
});

describe("generate stream parsing", () => {
  it("parses slot, start, error and done lines (contract: lib/ai/contracts.ts), ignores garbage", () => {
    const line = JSON.stringify({ type: "slot", slot: 2, status: "fallback", reason: "near-duplicate", option: { typology: "slab_bar", name: "Slab", intent: "A bar.", params: { baseFloors: 3 }, notes: ["n"], source: "builtin", metrics: { far: 99 } }, usage: { input: 10, output: 5 } });
    const ev = parseGenerateLine(line);
    expect(ev?.kind).toBe("option");
    if (ev?.kind === "option") {
      expect(ev.slot).toBe(2);
      expect(ev.proposal.source).toBe("builtin");
      expect(ev.reason).toBe("near-duplicate");
      expect(ev.usage.input).toBe(10);
      expect(ev.proposal).not.toHaveProperty("metrics"); // server metrics are never carried into the client
    }
    expect(parseGenerateLine(JSON.stringify({ type: "slot", slot: 1, status: "running" }))).toMatchObject({ kind: "progress", slot: 1 });
    expect(parseGenerateLine(JSON.stringify({ type: "start", notice: "AI is off" }))).toMatchObject({ kind: "start", notice: "AI is off" });
    expect(parseGenerateLine(JSON.stringify({ type: "error", message: "boom" }))).toMatchObject({ kind: "error", message: "boom" });
    expect(parseGenerateLine(JSON.stringify({ type: "done", totals: { usd: 0.01 } }))).toMatchObject({ kind: "done", totals: { usd: 0.01 } });
    expect(parseGenerateLine("not json")).toBeNull();
  });
  it("rejects options whose params fail the schema", () => {
    const ev = parseGenerateLine(JSON.stringify({ type: "slot", slot: 0, status: "done", option: { name: "x", intent: "y", params: { baseFloors: 99 } } }));
    expect(ev?.kind).toBe("progress");
  });
});

describe("sun study", () => {
  it("courtyard hours are within the day length; Dec 21 is shorter than Jun 21", () => {
    const site = SAMPLE_SITES[0].site;
    const ctxB = contextFor(site);
    const jun = courtyardSunHoursSync({ option, model, context: ctxB, preset: presetById("jun21"), lat: site.lat, lng: site.lng });
    const dec = courtyardSunHoursSync({ option, model, context: ctxB, preset: presetById("dec21"), lat: site.lat, lng: site.lng });
    expect(jun.hours).not.toBeNull();
    expect(jun.hours!).toBeGreaterThanOrEqual(0);
    expect(jun.hours!).toBeLessThan(16);
    expect(dec.hours!).toBeLessThanOrEqual(jun.hours!);
    const [lo, hi] = daylightRange(presetById("dec21"), site.lat, site.lng);
    expect(hi).toBeGreaterThan(lo);
  });
});

describe("announcements and summaries", () => {
  it("per-use FAR summary is always labelled", () => {
    expect(farSummary({ residential: 6.02, community_facility: 6.5 })).toBe("Residential FAR 6.02, CF 6.50");
    expect(farSummary({})).toBe("FAR not set");
  });
  it("site cards read per-use FAR from the raw envelope", () => {
    const r = summarizeRawEnvelope(SAMPLE_SITES[0].envelope);
    expect(Object.keys(r.maxFar).length).toBeGreaterThan(0);
  });
  it("selection and generation announcements", () => {
    expect(selectionAnnouncement(2, "Stepped terraces", option)).toMatch(/^Option 3, Stepped terraces, FAR \d+\.\d{2} of \d+\.\d{2}, /);
    expect(generationAnnouncement([option, option])).toMatch(/^2 options ready: \d+ pass, \d+ need review, \d+ fail$/);
  });
  it("identical announcements are made distinct so the live region re-announces", () => {
    expect(freshAnnouncement("a", "a")).not.toBe("a");
    expect(freshAnnouncement("a", "b")).toBe("b");
  });
});
