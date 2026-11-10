"use client";
// Async studio actions: envelope loading, brief parsing, generation stream, iteration, exports.
// Browser-only. Numbers always come from the engine: server output is treated as parameters + prose.
import {
  EMPTY_SCHEDULE,
  buildEnvelopeModel,
  fmtInt,
  formatEnvelopeErrors,
  initGeometry,
  validateEnvelope,
  type EnvelopeModel,
  type MassingOption,
} from "@wxy/massing";
import { useStudio } from "@/lib/store/studio";
import { OPTION_COUNT, makeSlot, paramsWithChanges, runGenerate, type OptionSlot, type SlotSource } from "@/lib/store/logic";
import {
  fetchStatus,
  iterateRequest,
  parseBriefRequest,
  streamGenerate,
  type EnvelopeSummary,
} from "./api";
import { builtinProposals } from "./builtin";
import { exportBaseName, farSummary, generationAnnouncement, timeLabel } from "./format";
import { REFERENCE_SITE, SAMPLE_SITES, contextFor, summarizeRawEnvelope, type SiteSidecar } from "./samples";
import { envelopeSections, viewerOption } from "./viewer-data";

const st = () => useStudio.getState();

export const ensureGeometry = () => initGeometry({ locateFile: () => "/wasm/manifold.wasm" });

export async function refreshStatus(): Promise<void> {
  try {
    st().set({ aiStatus: await fetchStatus() });
  } catch {
    st().set({ aiStatus: { ai: false } });
  }
}

// ---------- site ----------
export async function loadEnvelope(json: unknown, sample: { id: string; site: SiteSidecar } | null): Promise<void> {
  const v = validateEnvelope(json);
  if (!v.ok) {
    st().set({ envelopeError: formatEnvelopeErrors(v.errors) });
    return;
  }
  try {
    await ensureGeometry();
    const model = buildEnvelopeModel(v.envelope);
    const sum = summarizeRawEnvelope(v.envelope);
    st().reset();
    st().set({
      siteId: sample?.id ?? "upload",
      siteIsSample: sample !== null || model.sample,
      envelopeRaw: v.envelope,
      model,
      site: sample?.site ?? null,
      context: sample ? contextFor(sample.site) : [],
      reviewFlags: sum.reviewFlags,
      envelopeError: null,
      activeStep: "brief",
      announcement: `Loaded ${model.envelopeId}.`,
    });
  } catch (e) {
    st().set({ envelopeError: `This file isn't a valid zoning envelope: ${e instanceof Error ? e.message : "it couldn't be read"}. Check it against zoning-envelope.schema.json.` });
  }
}

export function loadSample(id: string): Promise<void> {
  const s = SAMPLE_SITES.find((x) => x.id === id);
  return s ? loadEnvelope(s.envelope, { id: s.id, site: s.site }) : Promise.resolve();
}

export async function loadEnvelopeFile(file: File): Promise<void> {
  try {
    const json: unknown = JSON.parse(await file.text());
    await loadEnvelope(json, null);
  } catch {
    st().set({ envelopeError: "This file isn't a valid zoning envelope: it isn't readable JSON. Check it against zoning-envelope.schema.json." });
  }
}

export function announce(text: string): void {
  st().announce(text);
}

/** "builtin" when AI is off or the designer chose Built-in; else "ai". */
export function effectiveMode(): "ai" | "builtin" {
  const s = st();
  return s.aiStatus?.ai && s.mode === "ai" ? "ai" : "builtin";
}

export function lotLatLng(): { lat: number; lng: number; reference: boolean } {
  const s = st().site;
  return s ? { lat: s.lat, lng: s.lng, reference: false } : { ...REFERENCE_SITE, reference: true };
}

export function envelopeSummary(model: EnvelopeModel): EnvelopeSummary {
  const maxFar: Record<string, number> = {};
  for (const [k, c] of Object.entries(model.maxFar)) if (c) maxFar[k] = c.value;
  const raw = summarizeRawEnvelope(st().envelopeRaw);
  return {
    envelopeId: model.envelopeId,
    district: raw.district,
    lotAreaSf: Math.round(model.lotArea),
    lotType: raw.lotType,
    maxFar,
    maxBuildingHeightFt: model.maxBuildingHeight?.value ?? null,
  };
}

/** "{lot area} sf lot · {district} · max FAR {far}" (copy deck). */
export function siteSubline(model: EnvelopeModel, district: string): string {
  const fars: Record<string, number> = {};
  for (const [k, c] of Object.entries(model.maxFar)) if (c) fars[k] = c.value;
  return `${fmtInt(model.lotArea)} sf lot, ${district || "district unknown"}, ${farSummary(fars)}`;
}

// ---------- brief ----------
export function startEmptySchedule(): void {
  st().set({ schedule: { ...EMPTY_SCHEDULE, confirmed: false }, activeStep: "schedule" });
}

export async function readBrief(): Promise<void> {
  const s = st();
  if (!s.model || !s.brief.trim()) return;
  s.set({ briefStatus: "loading", briefError: null, briefWarning: null });
  try {
    const r = await parseBriefRequest(s.brief, envelopeSummary(s.model), effectiveMode());
    st().mergeAssumptions(r.assumptions);
    st().setScheduleRaw(r.schedule);
    if (r.usage.input || r.usage.output) st().addUsage("Read brief", r.usage);
    st().set({ briefWarning: r.warning, briefStatus: "idle", activeStep: "schedule", announcement: "Program schedule ready to review." });
  } catch (e) {
    st().set({
      briefStatus: "error",
      briefError: `The AI couldn't return a valid schedule (${e instanceof Error ? e.message : "unknown reason"}). Try again, or start from an empty schedule and fill it in by hand.`,
    });
  }
}

// ---------- generate ----------
let genAbort: AbortController | null = null;

function fillSlot(index: number, p: Parameters<typeof makeSlot>[2], source: SlotSource): boolean {
  const s = st();
  const c = s.ctx();
  if (!c) return false;
  const r = makeSlot(index, c, p, source);
  if (!r.ok) return false;
  const slots = s.slots.slice();
  slots[index] = r.value;
  s.set({ slots });
  return true;
}

export async function generate(): Promise<void> {
  const s0 = st();
  const c = s0.ctx();
  if (!c || !c.schedule.confirmed) return;
  genAbort?.abort();
  const ac = new AbortController();
  genAbort = ac;
  s0.set({
    slots: Array(OPTION_COUNT).fill(null),
    selectedIndex: null,
    viewMode: "compare",
    gen: { phase: "running", done: 0, message: null },
    announcement: `Building ${OPTION_COUNT} options… 0/${OPTION_COUNT}`,
    notice: null,
  });
  const failures: string[] = [];
  const filled = () => st().slots.filter(Boolean).length;
  try {
    await streamGenerate(
      { envelope: s0.envelopeRaw, schedule: c.schedule, assumptions: c.assumptions, count: 6, mode: effectiveMode() },
      (ev) => {
        if (ev.kind === "done") {
          st().addUsage("Generate (run total)", ev.totals, true);
          return;
        }
        if (ev.kind === "start") {
          if (ev.notice) st().set({ gen: { ...st().gen, message: ev.notice } });
          return;
        }
        if (ev.kind === "error") {
          failures.push(ev.message);
          return;
        }
        if (ev.kind === "progress") {
          if (ev.status === "error" && ev.message) failures.push(ev.message);
          return;
        }
        const taken = st().slots;
        const idx = ev.slot !== null && ev.slot >= 0 && ev.slot < OPTION_COUNT && !taken[ev.slot] ? ev.slot : taken.findIndex((x) => !x);
        if (idx < 0) return;
        const source: SlotSource = ev.proposal.source ?? (st().aiStatus?.ai ? "ai" : "builtin");
        const notes = ev.reason ? [...ev.proposal.notes, ev.reason] : ev.proposal.notes;
        const ok = fillSlot(idx, { name: ev.proposal.name, intent: ev.proposal.intent, params: ev.proposal.params, notes }, source);
        if (!ok) failures.push(`Option ${idx + 1} came back with parameters the engine rejected.`);
        const n = filled();
        st().set({ gen: { phase: "running", done: n, message: st().gen.message }, announcement: `Building ${OPTION_COUNT} options… ${n}/${OPTION_COUNT}` });
        if (ev.usage.input || ev.usage.output) st().addUsage(`Option ${idx + 1}`, ev.usage, false);
      },
      ac.signal,
    );
  } catch (e) {
    if (ac.signal.aborted) return;
    // Service unreachable or failed before finishing: say so, then fill the gaps with the built-in presets.
    const reason = e instanceof Error ? e.message : "unknown reason";
    const props = builtinProposals();
    props.forEach((p, i) => {
      if (!st().slots[i]) fillSlot(i, p, "builtin");
    });
    st().set({ gen: { phase: "error", done: filled(), message: `The generate service didn't finish (${reason}). Showing the built-in presets for the empty slots; they are not fitted to your program.` } });
  }
  if (ac.signal.aborted) return;
  const n = filled();
  const cur = st();
  if (cur.gen.phase !== "error") {
    cur.set({
      gen: { phase: n > 0 ? "done" : "error", done: n, message: n === 0 ? "No options came back. Try again, or edit parameters by hand." : failures[0] ?? null },
    });
  }
  const done = st().slots.filter((x): x is OptionSlot => !!x).map((x) => x.option);
  if (n === OPTION_COUNT) st().set({ settleNonce: st().settleNonce + 1 });
  st().announce(done.length ? generationAnnouncement(done) : "No options were produced.");
}

// ---------- think harder (one slot on Opus) ----------
/**
 * Re-runs ONE slot on the hard model. The route runs slots 0..count-1, so we ask for count = slot + 1 and keep only
 * the event for `index` (earlier slots are re-run by the server but ignored here).
 */
export async function thinkHarder(index: number): Promise<void> {
  const s0 = st();
  const c = s0.ctx();
  const old = s0.slots[index];
  if (!c || !c.schedule.confirmed || !old || effectiveMode() !== "ai") return;
  s0.set({ thinkingSlot: index, announcement: `Thinking harder about option ${index + 1}…` });
  let landed = false;
  try {
    await streamGenerate(
      { envelope: s0.envelopeRaw, schedule: c.schedule, assumptions: c.assumptions, count: (index + 1) as 6, mode: "ai", thinkHarderSlot: index },
      (ev) => {
        if (ev.kind === "done") st().addUsage("Think harder (run total)", ev.totals, true);
        if (ev.kind !== "option" || ev.slot !== index) return;
        const r = makeSlot(index, c, { name: ev.proposal.name, intent: ev.proposal.intent, params: ev.proposal.params, notes: ev.reason ? [...ev.proposal.notes, ev.reason] : ev.proposal.notes }, ev.proposal.source ?? "ai");
        if (!r.ok) return;
        const slots = st().slots.slice();
        slots[index] = {
          ...r.value,
          history: [
            ...old.history,
            { id: `think-${Date.now()}`, kind: "diff", groupKey: null, instruction: "Think harder (Opus)", at: timeLabel(new Date()), prevParams: old.option.params, prevIntent: old.intent },
          ],
        };
        st().set({ slots });
        landed = true;
      },
    );
    st().set({ thinkingSlot: null, notice: landed ? "Option replaced. ⌘Z to undo." : "The hard model didn't return a usable option." });
    if (landed) st().announce(`Option ${index + 1} replaced.`);
  } catch (e) {
    st().set({ thinkingSlot: null, notice: `Think harder failed: ${e instanceof Error ? e.message : "unknown reason"}.` });
  }
}

// ---------- iterate ----------
export async function proposeChanges(index: number, instruction: string): Promise<void> {
  const s = st();
  const c = s.ctx();
  const slot = s.slots[index];
  if (!c || !slot || !instruction.trim()) return;
  s.set({ proposalStatus: "loading", proposalError: null, proposal: null });
  try {
    const r = await iterateRequest({
      envelope: s.envelopeRaw,
      schedule: c.schedule,
      assumptions: c.assumptions,
      option: { typology: slot.option.typology, params: slot.option.params },
      instruction,
      history: slot.history.map((h) => ({ instruction: h.instruction })),
      mode: effectiveMode(),
    });
    const changes = r.changes.map((ch) => ({ ...ch, from: slot.option.params[ch.key] }));
    const check = paramsWithChanges(slot.option.params, changes);
    if (!check.ok) throw new Error(check.error);
    st().addUsage("Iterate", r.usage);
    st().set({ proposal: { index, instruction, changes, source: r.source }, proposalStatus: "idle" });
  } catch (e) {
    st().set({
      proposalStatus: "error",
      proposalError: `The AI couldn't return a valid change (${e instanceof Error ? e.message : "unknown reason"}). Try again, or edit parameters by hand.`,
    });
  }
}

/** Option as it would be after the pending proposal (for before/after deltas). Null if invalid. */
export function previewProposal(slot: OptionSlot): MassingOption | null {
  const s = st();
  const c = s.ctx();
  if (!c || !s.proposal) return null;
  const p = paramsWithChanges(slot.option.params, s.proposal.changes);
  if (!p.ok) return null;
  const r = runGenerate(c, p.value);
  return r.ok ? r.value : null;
}

export const nowLabel = () => timeLabel(new Date());

// ---------- export ----------
export type ExportKind = "3dm" | "gltf" | "boards" | "params";

export async function runExport(kind: ExportKind): Promise<string> {
  const s = st();
  const model = s.model;
  const filled = s.slots.filter((x): x is OptionSlot => !!x);
  if (!model || filled.length === 0) throw new Error("Generate options first.");
  const { downloadBlob } = await import("@/lib/export/download");
  const base = exportBaseName(model.envelopeId, new Date());
  const meta = { envelopeId: model.envelopeId, sample: s.siteIsSample };
  if (kind === "3dm") {
    const { export3dm, configureRhino3dm } = await import("@/lib/export/export3dm");
    configureRhino3dm({ locateFile: (f: string) => `/wasm/${f}` });
    const bytes = await export3dm({
      envelope: model,
      envelopeSections: envelopeSections(model),
      options: filled.map((o) => ({ index: o.index + 1, option: o.option, name: o.name, intent: o.intent })),
      context: s.context.map((c) => ({ polygon: c.polygon, height: c.height })),
      assumptions: s.assumptions,
      meta: { ...meta, generatedBy: filled.every((o) => o.source === "builtin") ? "Built-in (no AI)" : "WXY Massing Studio (AI-assisted)" },
    });
    downloadBlob(bytes as BlobPart, `${base}.3dm`, "application/octet-stream");
    return `${base}.3dm`;
  }
  if (kind === "gltf") {
    const { exportGltf } = await import("@/lib/export/exportGltf");
    const bytes = await exportGltf(filled.map((o) => ({ index: o.index + 1, name: o.name, intent: o.intent, option: o.option })), meta);
    downloadBlob(bytes as BlobPart, `${base}.glb`, "model/gltf-binary");
    return `${base}.glb`;
  }
  if (kind === "params") {
    const { exportParams } = await import("@/lib/export/exportParams");
    const text = exportParams({ ...meta, options: filled.map((o) => ({ index: o.index + 1, name: o.name, option: o.option })), assumptions: s.assumptions });
    downloadBlob(text, `${base}.json`, "application/json");
    return `${base}.json`;
  }
  const { boardSvg, svgToPng } = await import("@/lib/export/boards");
  const raw = summarizeRawEnvelope(s.envelopeRaw);
  const svg = boardSvg({
    envelopeId: model.envelopeId,
    options: filled.map((o) => ({ index: o.index + 1, name: o.name, intent: o.intent, option: o.option })),
    envelopeSummary: siteSubline(model, raw.district),
    lot: model.lot,
    context: s.context,
    date: new Date().toISOString().slice(0, 10),
    sample: s.siteIsSample,
  });
  const png = await svgToPng(svg, 2);
  downloadBlob(png, `${base}.png`, "image/png");
  return `${base}.png`;
}

export { viewerOption };
