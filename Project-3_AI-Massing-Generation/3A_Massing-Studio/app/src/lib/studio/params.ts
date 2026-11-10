// Which parameters lead the panel for each typology; the rest go under "More parameters". Pure and tested.
import { PARAM_SPECS, type MassingParams, type ParamSpec, type TypologyLabel } from "@wxy/massing";

type Key = keyof MassingParams;

const LEAD: Record<TypologyLabel, Key[]> = {
  podium_tower: ["baseFloors", "baseDepth", "upperMode", "upperFloors", "towerCoverage", "towerAspect", "towerU", "towerV", "towerRotation"],
  slab_bar: ["baseFloors", "baseDepth", "upperMode", "upperFloors", "towerCoverage", "towerAspect", "towerU", "towerV", "towerRotation"],
  perimeter_courtyard: ["baseFloors", "ringDepth", "upperMode", "upperFloors", "baseDepth"],
  stepped_terraces: ["baseFloors", "upperMode", "upperFloors", "stepEvery", "stepDepth", "stepFrom"],
  split_massing: ["baseFloors", "parts", "gapWidth", "heightBias", "upperMode", "upperFloors"],
  carved_volume: ["baseFloors", "carveWidth", "carveDepth", "carveU", "carveFromFloor", "carveSide"],
  block: ["baseFloors", "baseDepth", "upperMode", "upperFloors"],
};

export function paramGroups(typology: TypologyLabel): { lead: ParamSpec[]; more: ParamSpec[] } {
  const keys = LEAD[typology];
  const lead = keys.map((k) => PARAM_SPECS.find((s) => s.key === k)).filter((s): s is ParamSpec => !!s);
  const more = PARAM_SPECS.filter((s) => !keys.includes(s.key));
  return { lead, more };
}
