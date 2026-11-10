// Grasshopper parameter JSON. Stable key order; pretty-printed (2 spaces).
import { PARAM_SPECS } from "@wxy/massing";
import type { MassingOption, Assumptions } from "@wxy/massing";
import { metricEntries } from "./shared";

export const PARAMS_SCHEMA = "wxy.massing-params/1";

export interface ParamsInput {
  envelopeId: string;
  sample: boolean;
  options: { index: number; name: string; option: MassingOption }[];
  assumptions: Assumptions;
}

export function buildParamsDoc(input: ParamsInput) {
  const assumptions: Record<string, { value: number; source: string; rationale: string }> = {};
  const a = input.assumptions;
  const flat: Record<string, { value: number; source: string; rationale: string }> = {
    "floorToFloor.residential": a.floorToFloor.residential,
    "floorToFloor.commercial": a.floorToFloor.commercial,
    "floorToFloor.community_facility": a.floorToFloor.community_facility,
    groundFloorHeight: a.groundFloorHeight,
    avgUnitNetSf: a.avgUnitNetSf,
    efficiency: a.efficiency,
  };
  for (const k of Object.keys(flat)) assumptions[k] = { value: flat[k].value, source: flat[k].source, rationale: flat[k].rationale };

  return {
    schema: PARAMS_SCHEMA,
    units: "ft",
    envelopeId: input.envelopeId,
    sample: input.sample,
    options: input.options.map(({ index, name, option }) => {
      const params: Record<string, unknown> = {};
      for (const s of PARAM_SPECS) params[s.key] = option.params[s.key];
      const metrics: Record<string, number | null> = {};
      for (const [k, v] of metricEntries(option.metrics)) metrics[k] = v === "unavailable" ? null : Number(v);
      return {
        index,
        name,
        typology: option.typology,
        params,
        assumptions,
        metrics,
        compliance: option.compliance.map((r) => ({ id: r.id, rule: r.rule, status: r.status, allowed: r.allowed, proposed: r.proposed })),
      };
    }),
    paramSpecs: PARAM_SPECS.map((s) => ({
      key: s.key,
      label: s.label,
      unit: s.unit,
      kind: s.kind,
      min: s.min ?? null,
      max: s.max ?? null,
      step: s.step ?? null,
      options: s.options ? [...s.options] : null,
      typological: s.typological,
    })),
  };
}

export function exportParams(input: ParamsInput): string {
  return JSON.stringify(buildParamsDoc(input), null, 2) + "\n";
}
