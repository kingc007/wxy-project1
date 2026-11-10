// SAMPLE geometry for the dev page only. Not a real lot, not a real location.
// Zoning values are the R7A figures verified in research/residence-bulk-rules.md rows 6, 12, 21, 22:
// base height min 40 / max 75 ft, max building height 85 ft, street setback 15 ft, rear yard 30 ft.
// Front and side yards are deliberately null (no verified value supplied) so the "Not drawn" note is exercised.
import type { EnvelopeLike } from "@/lib/geometry/envelope-input";
import type { Ring } from "@/lib/types";

const ft = (value: number | null) => ({ value, unit: "ft" as const, status: value == null ? "needs_input" : "cited" });

export const SAMPLE_ENVELOPE: EnvelopeLike = {
  lot: {
    polygonLocal: [[0, 0], [25, 0], [25, 100], [0, 100]],
    edges: [
      { index: 0, kind: "front", street: { name: "SAMPLE STREET", width: "narrow" } },
      { index: 1, kind: "side" },
      { index: 2, kind: "rear" },
      { index: 3, kind: "side" },
    ],
  },
  controls: {
    baseHeight: { min: ft(40), max: ft(75) },
    maxBuildingHeight: ft(85),
    setbacks: [{ id: "street-setback", appliesTo: "narrow_street_frontage", startHeight: ft(75), depth: ft(15) }],
    yards: { front: ft(null), rear: ft(30), side: ft(null) },
    skyExposure: { status: "not_applicable" },
  },
};

// Placement for the plan view: arbitrary point, local feet converted with a rough constant (SAMPLE only).
const LON0 = -73.99;
const LAT0 = 40.73;
const FT_LAT = 1 / 364000;
const FT_LON = 1 / (364000 * Math.cos((LAT0 * Math.PI) / 180));
const rect = (x0: number, y0: number, x1: number, y1: number): Ring =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [LON0 + x * FT_LON, LAT0 + y * FT_LAT] as [number, number]);

export const SAMPLE_LOT: Ring = rect(0, 0, 25, 100);
export const SAMPLE_NEIGHBORS: Ring[] = [
  rect(-25, 0, 0, 100), rect(25, 0, 50, 100), rect(50, 0, 75, 100), rect(-50, 0, -25, 100),
  rect(-25, 100, 0, 200), rect(0, 100, 25, 200), rect(25, 100, 50, 200), rect(50, 100, 75, 200),
  rect(-25, -100, 0, -20), rect(0, -100, 25, -20), rect(25, -100, 50, -20),
];
export const SAMPLE_DISTRICTS = [
  { code: "R7A", kind: "base", geometry4326: [rect(-60, -10, 90, 210)] },
  { code: "SAMPLE-OVERLAY", kind: "commercial_overlay", geometry4326: [rect(-60, -10, 90, 40)] },
];
