---
type: spec
owner: Opus manager (zoning interpretation)
date: 2026-10-25
sources: _Shared/research/nyc-zoning-sample-envelope-values.md (61/61 PASS, verified 2026-10-25), 3A research/nyc-footprints-data.md, 3A research/epsg-2263-proj4.md
---
# Three SAMPLE ZoningEnvelopes (schema v1.0.0) — manager's zoning interpretation

All three are **SAMPLE** (hypothetical lots, not real parcels) and **SIMPLIFIED**. They are placed at the verified
context point lat 40.6890, lng −73.9755 (south of Fort Greene Park, Brooklyn) so context buildings make sense; the
lot geometry is hypothetical. Existing footprints that intersect a sample lot are removed from its context set
("SAMPLE: existing buildings on the hypothetical lot removed"). Street widths are ASSUMPTIONS (state accepted).
Citations: copy the verbatim quote from the claim row (#) of the zoning note into `citation.quote`, section and URL as
listed there, `effectiveDate: "Last Amended 12/5/2024"` (12-10 rows: their own date), `retrievedAt: 2026-10-25`,
`researchNote: "_Shared/research/nyc-zoning-sample-envelope-values.md#<row>"`, confidence `cited`.

## Placement (all samples)
- θ = dominant street-grid angle from context footprints: length-weighted histogram of footprint edge directions
  mod 90° (1° bins, smoothed ±2°), argmax. Rectangle axes u=(cosθ, sinθ), v=(−sinθ, cosθ). Record θ in provenance notes.
- Choose the rectangle orientation (from the 4 options θ+k·90°) whose front edge's outward normal points closest to
  SOUTH (park is north → "toward the park" = rear). Lot centred on local (0,0); origin = EPSG:2263 of the point.
- Polygon CCW, unclosed; edge 0 = front (south) edge running west→east-ish; then east side, rear (north), west side.

## Sample A — `sample-a-r7a-interior` — R7A, interior lot, 100 ft frontage × 100 ft deep (10,000 sf)
edges: 0 front (street width `narrow`, assumption asm-a-street), 1 side, 2 rear, 3 side. lotType interior (assumed; asm-a-lottype).
| control | value | status | rows |
|---|---|---|---|
| maxFar.residential | 4.00 | cited | 10 |
| maxFar.community_facility | 4.00 | cited | 19 |
| maxFloorArea.residential / .community_facility | 40,000 sf | computed "10,000 sf × 4.00 = 40,000 sf", inputs [/lot/area, /controls/maxFar/…] | — |
| baseHeight.min / max | 40 / 75 ft | cited | 27 (+31) |
| maxBuildingHeight | 85 ft | cited | 27 |
| maxStories | null | not_applicable, confidence inferred, note "23-432 limits height in feet only; no stories limit found (research note: NOT FOUND)" | — |
| setbacks[0] narrow street frontage | edges [0], startHeight 75 (row 27), depth 15 (row 32) | cited | 27, 32 |
| setbacks[1] rear (upper rear yard) | appliesTo rear, edges [2], startHeight 75, depth 30 | cited | 54 |
| yards.front / side | 0 / 0 | cited | 52 / 53 |
| yards.rear | 20 ft | cited | 54 |
| lotCoverage.max | 80 percent | cited | 22 |
| skyExposure | status not_applicable, note "R7A has a letter suffix; sky exposure plane option applies only to districts without a suffix" | — | 8 |
simplifications: "Setback taken at the max base height (75 ft); designers may set back lower between 40 and 75 ft (ZR 23-432/23-433)." · "Setback depth measured from the street line (street wall assumed at the street line)." · "Street wall location (70% within 10 ft, ZR 23-431) checked by a simplified street-wall test." · "Qualifying affordable/senior housing variants (FAR 5.01, heights 85/115) not modelled."
districts: [{code R7A, kind base, provenance SAMPLE (dataset "SAMPLE — hypothetical district assignment")}]
reviewFlags: other — "SAMPLE lot: no use regulations checked; R7A without a commercial overlay has no commercial FAR."

## Sample B — `sample-b-r8a-corner` — R8A, corner lot, 100 ft × 100 ft (10,000 sf)
edges: 0 front (south, `wide`, asm-b-wide), 1 front (east, `narrow`, asm-b-narrow), 2 side, 3 side (the two interior lot lines;
for a corner lot these are side lot lines). lotType corner (asm-b-lottype).
| control | value | status | rows |
|---|---|---|---|
| maxFar.residential | 6.02 | cited | 11 |
| maxFar.community_facility | 6.50 | cited | 20 |
| maxFloorArea | computed (×10,000) | computed | — |
| baseHeight.min / max | 60 / 95 | cited | 28 |
| maxBuildingHeight | 125 | cited | 28 |
| maxStories | null not_applicable (as A) | — | — |
| setbacks[0] wide street | edges [0], start 95, depth 10 | cited | 28, 32 |
| setbacks[1] narrow street | edges [1], start 95, depth 15 | cited | 28, 32 |
| yards.front / side | 0 / 0 | cited | 52 / 53 |
| yards.rear | 0 | cited, note "Corner lot: no rear yard within 100 ft of the street intersection (23-344); SIMPLIFIED to the whole 100×100 lot" | 55 |
| lotCoverage.max | 100 percent (corner) | cited | 22 |
| skyExposure | not_applicable (suffix district) | — | 8 |
simplifications: as A, plus "Corner rear-yard exemption applied to the whole lot." · "Street wall rule applied along the wide street only (ZR 23-436)."

## Sample C — `sample-c-r10-through-sep` — R10, through lot, 200 ft frontage × 200 ft deep (40,000 sf), optional sky exposure plane regulations (ZR 23-73)
edges: 0 front (south, `wide`, asm-c-wide), 1 side, 2 front (north, `narrow`, asm-c-narrow), 3 side. lotType through (asm-c-lottype).
| control | value | status | rows |
|---|---|---|---|
| maxFar.residential | 10.0 | cited | 13 (SEP option) |
| maxFar.community_facility | 10.00 | cited | 21 |
| maxFloorArea | computed (×40,000) | computed | — |
| baseHeight.min | null | needs_input, note "Minimum base height for buildings using the sky exposure plane option was not researched" | — |
| baseHeight.max | 85 ft (max front wall height "85 feet or nine stories, whichever is less") | cited | 47 |
| maxBuildingHeight | null | not_applicable, confidence inferred, note "Height governed by the sky exposure plane under the optional regulations" | 47 |
| maxStories | null | not_applicable | — |
| setbacks[0] REY open area ≤75 ft | appliesTo street_frontage, edges [0,2], startHeight **0**, depth 20 | assumed+cited: depth status `assumed` (asm-c-rey: "Rear yard equivalent provided as open areas along both street lines (ZR 23-343 alternative): 40 ft combined → 20 ft at each street line at or below 75 ft; 60 ft combined → 30 ft each above 75 ft") with citations rows 58, 61 | 58, 61 |
| setbacks[1] REY open area >75 ft | edges [0,2], startHeight 75, depth 30 | assumed (asm-c-rey) + citations 58, 61 | 58, 61 |
| yards.front / side | 0 / 0 | cited | 52 / 53 |
| yards.rear | null | not_applicable, note "Through lot: no rear lot line; rear yard equivalent encoded in setbacks[] (see asm-c-rey)" | 58 |
| lotCoverage.max | null | not_applicable, cited row 51 ("lot coverages set forth in Section 23-36 … need not apply") | 51 |
| skyExposure | status implemented; planes: wide (edges [0]) start 85, initialSetback 15, slope 5.6; narrow (edges [2]) start 85, initialSetback 20, slope 2.7 | cited | 47 |
simplifications: "Optional sky exposure plane regulations (23-73) used; tower penetration of the plane (23-737) not modelled." ·
"Sky exposure plane evaluated per floor at the floor's top." · "Rear yard equivalent split equally along both street lines (SAMPLE design choice)." ·
"Street wall rules for sky exposure plane buildings not researched."
reviewFlags: other — "Towers (ZR 23-435 / 23-737) not modelled in this SAMPLE." · other — "Lot is 40,000 sf: large-lot street wall rule (50% within 15 ft, ZR 23-431) may apply; not checked."

## Provenance (all)
datasets: NYC Building Footprints `5zhs-2jue` (version: rowsUpdatedAt 2026-10-25T08:21:07Z, url = the verified query URL, fetchedAt
2026-10-25T19:37:07Z) for context; "SAMPLE — hypothetical lot" for lot geometry. `generator: {name: "Project 3 sample builder", version: "0.1"}`.
jurisdiction: {id nyc, name "New York City", code {name "NYC Zoning Resolution", versionLabel "Sections as Last Amended 12/5/2024 (12-10: 3/26/2026)", url "https://zr.planning.nyc.gov", retrievedAt 2026-10-25}}.
lot.area: computed from polygonLocal (formula "100 ft × 100 ft = 10,000 sf"), status computed, inputs ["/lot/polygonLocal"].
lot.geometrySource: dataset "SAMPLE — hypothetical lot".

## Site metadata (Project 3 extension, outside the envelope JSON)
Each sample ships with a sidecar `<id>.site.json`: `{lat: 40.6890, lng: -73.9755, latLngSource: "3A research/nyc-footprints-data.md (chosen point)",
gridAngleDeg: θ, parkPolygonLocal, contextFile}` — the envelope schema has no lat/lng, so the sun module reads the sidecar.
