// Manager acceptance: the six built-in typology presets must be mutually distinct under the diversity rule (engine-spec §9).
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, TYPOLOGY_PRESETS, classifyTypology } from "../index";
import { isNearDuplicate, paramDistance } from "../strategy";
import type { MassingParams } from "../types";

const presets = Object.entries(TYPOLOGY_PRESETS).map(([t, p]) => {
  const params = { ...DEFAULT_PARAMS, ...p.params } as MassingParams;
  return { t, params, typology: classifyTypology(params) };
});

describe("built-in presets are mutually distinct", () => {
  for (let i = 0; i < presets.length; i++)
    for (let j = i + 1; j < presets.length; j++) {
      const a = presets[i], b = presets[j];
      it(`${a.t} vs ${b.t}`, () => {
        expect(isNearDuplicate(a, b), `distance ${paramDistance(a.params, b.params).toFixed(3)}`).toBe(false);
      });
    }
});
