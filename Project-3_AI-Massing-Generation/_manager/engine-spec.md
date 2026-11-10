---
type: spec
owner: Opus manager (Project 3)
applies_to: 3A /lib/massing, 3C (shared), 3B compliance table (C# port of the checker rules)
version: 0.1 (2026-10-25)
---
# Massing engine spec — grammar, envelope, metrics, compliance, AI boundary

Back to [[Project 3 Overview]]. Input contract: canonical `_Shared/schemas/zoning-envelope.schema.json` v1.0.0
(owned by Project 1; never edited here). All lengths ft, areas sf, volumes cf. Local frame: x east, y north, z up.

## 0. The boundary ("LLM proposes, geometry engine disposes")
```
brief text ──haiku──► ProgramSchedule + Assumptions (zod)  ──user confirms──┐
                                                                            ▼
envelope JSON ──ajv validate──► EnvelopeModel ──────────────────────► generate(params) ──► Option
                                                                       ▲   (pure TS, deterministic)
LLM (sonnet) ──► StrategyProposal {typology,name,intent,params} ──zod──┘
                                   (NO coordinates, NO metrics accepted from the LLM)
Option = { params, floors[], prisms[], metrics, compliance[], programFit[], trims[] }  ← all computed in code
AI prose (intent, critique) ──► groundingCheck(text, numbers allowed) ──► shown, or rejected/regenerated
```
Rules: (1) the AI never returns geometry or metrics; any numeric field it returns is a PARAMETER, range-checked by zod
(out of range → tool error back to the model, never clamped silently). (2) Every number in AI prose must equal a
computed/param/envelope value (§7). (3) Engine is pure & deterministic: same input → byte-identical output (no Date, no
Math.random; seeded PRNG only in 3C sampling).

## 1. EnvelopeModel (`envelope.ts`)
`buildEnvelopeModel(env) → { lot: Polygon, lotArea, edges[], frontageEdge, sectionAt(z), breakHeights, caps, notes[], unchecked[] }`
- `lotArea` = shoelace of `lot.polygonLocal`. If `lot.area.value` non-null and differs > 1 % → note "Lot area from data
  ({v}) differs from polygon area ({a}); using polygon".
- `frontageEdge` = the longest edge with kind `front` (ties → lowest index). Defines the design frame: u along the
  frontage (direction p_i→p_i+1), v = inward normal (left normal of CCW edge).
- Values usable only if `status ∈ {cited, data, computed, assumed, overridden}` and value non-null. Otherwise the
  control is listed in `unchecked[]` (Review row "Not checked — {status}") and imposes NO geometry.
- Per-edge inset at height z (horizontal distance from the lot line inward where matter is not permitted):
  `d_i(z) = max( yard_i, setback_i(z), sep_i(z) )` where
  - yard_i: front edges → yards.front, rear → yards.rear, side → yards.side; unknown → 0 (+ note).  (SIMPLIFIED: yards
    apply at all heights; ground-floor permitted obstructions not modelled.)
  - setback_i(z) = depth if z > startHeight, for each setback whose `edgeIndices` include i, or (no edgeIndices) whose
    `appliesTo` matches edge i: street_frontage = any front edge; wide/narrow = front edge with that street width;
    front edge with width `unknown` matches BOTH (conservative, note). rear/side = edges of that kind.
  - sep_i(z) = z > startHeight ? max(initialSetback ?? 0, (z − startHeight)/slope) : 0 for matching SEP planes
    (only when skyExposure.status = implemented). SIMPLIFIED: plane evaluated per floor at the floor's top.
- `sectionAt(z)` = lot − ⋃ strip(edge_i, d_i(z)); empty if z > maxBuildingHeight (when usable).
  strip(edge, d): rectangle on the inward side of the edge, depth d, extended along the edge line by d at convex
  vertices and 0 at reflex vertices (SIMPLIFIED for irregular lots).
- `breakHeights` = sorted unique {0, all startHeights, maxBuildingHeight} + SEP sampled every 5 ft (for drawing the
  translucent envelope wireframe as stacked sections).

## 2. Parametric grammar (`grammar.ts`) — one composite generator, typologies are presets
Every parameter has: key, designer label (copy deck), unit, min, max, step (snap), default, `typological: bool`.
| key | label | unit | range / step | typological |
|---|---|---|---|---|
| baseFloors | Street wall / podium height | floors | 1–15 / 1 | yes (bucketed ≤3, 4–7, ≥8) |
| baseDepth | Base depth from street | ft | 20–400 / 5 (clamped to lot depth) | no |
| parts | Number of volumes | count | 1–3 / 1 | yes |
| gapWidth | Gap between volumes | ft | 0–80 / 5 | no |
| ringDepth | Courtyard ring depth (0 = no courtyard) | ft | 0, 25–70 / 5 | yes (>0) |
| upperMode | Above the base | enum none·extrude·tower | — | yes |
| upperFloors | Floors above the base | floors | 0–80 / 1 | no |
| towerCoverage | Tower footprint | % of lot | 8–45 / 1 | no |
| towerAspect | Tower proportion (long:short) | ratio | 1–5 / 0.25 | yes (≥2.5 = slab) |
| towerU, towerV | Tower position along street / into the block | 0–1 | 0.05 | no |
| towerRotation | Tower orientation vs street | deg | 0–90 / 15 | no |
| stepEvery | Step back every | floors | 0–8 / 1 (0 = none) | yes (>0) |
| stepDepth | Step depth | ft | 0–40 / 5 | no |
| stepFrom | Step down toward | enum front·rear·left·right | — | no |
| carveWidth, carveDepth | Carve width / depth | ft | 0–120 / 5 | yes (both >0) |
| carveU | Carve position along street | 0–1 | 0.05 | no |
| carveFromFloor | Carve starts at floor | floor | 0–20 / 1 | no |
| carveSide | Carve from | enum front·rear | — | no |
| heightBias | Height shift between volumes | −1…1 | 0.1 | no |
| clipToEnvelope | Trim to zoning envelope | bool | default true | no |
Left/right are relative to standing on the frontage looking in (left = −u side).

Desired footprint D_k for floor k (frame-relative rectangles converted to world, then polygon ops):
1. B = sectionAt(0⁺) ∩ band(frontage, baseDepth). Split B along u into `parts` pieces of equal u-length with
   `gapWidth` gaps (gap removed from B). Part j has its own floor count: n_j = baseFloors + round(upperFloors·(1 +
   heightBias·t_j)), t_j = −1…1 linearly across parts (single part → t=0), clamped ≥ baseFloors.
2. Courtyard: if ringDepth > 0: void_j = inset(part_j, ringDepth) (if non-empty) — applies at every floor of that part.
3. Carve: if carveWidth>0 & carveDepth>0: rectangle width carveWidth (u), depth carveDepth (v) from the front line
   (carveSide front) or from the back of B (rear), centred at carveU; subtracted for floors ≥ carveFromFloor.
4. k < baseFloors: D_k = ⋃_j (part_j − void_j) − carve.
5. k ≥ baseFloors:
   - upperMode none → ∅ ;
   - extrude → for parts with k < n_j: (part_j − void_j − carve) minus stepping strip: s = stepEvery>0 ?
     floor((k − baseFloors)/stepEvery) + 1 : 0, strip depth s·stepDepth taken from side `stepFrom` of part_j's bbox;
   - tower → if k < baseFloors + upperFloors: rectangle of area towerCoverage·lotArea, aspect towerAspect (long side
     along u when rotation 0), rotated towerRotation, centred at (towerU, towerV) inside bbox of sectionAt(z_k) in frame;
     minus carve.
6. Plate P_k = clipToEnvelope ? D_k ∩ sectionAt(z_k + h_k) : D_k. trimmedArea_k = area(D_k) − area(P_k).
   Stop when P_k = ∅ for all remaining parts, or z exceeds 2× max height safeguard (1,500 ft cap).
Typology presets (3A's six) set the moves; `classifyTypology(params)` (3C bias check) derives a label in priority:
tower&aspect≥2.5 → slab_bar · tower → podium_tower · ringDepth>0 → perimeter_courtyard · parts≥2 → split_massing ·
stepEvery>0 → stepped_terraces · carve → carved_volume · else block.

## 3. Program stacking (`program.ts`)
Floor heights come from Assumptions (editable; source tagged default/brief/ai/user):
floorToFloor.{residential, commercial, community_facility}, groundFloorHeight, avgUnitNetSf, efficiency (net÷gross).
Defaults are design assumptions shown as "Default — edit for your project", never presented as code values.
Assign floors bottom-up: floor 0 = schedule.groundFloorUse (default residential); then each non-residential use in
schedule order (placement ground/lower) takes floors until its targetGFA is reached (or its `floors` if given);
remaining floors residential. Floor k height = groundFloorHeight for k=0 else floorToFloor[program].

## 4. Floors → solids (`solids.ts`)
Consecutive floors with identical polygons and program merge into one prism {polygon(with holes), z0, z1, program}.
Mesh = triangulated caps (earcut from installed `three` ShapeUtils or earcut pkg — confirm API) + side quads; one
mesh per prism, CCW outward normals, watertight per prism. Exports use these prisms (no CSG needed for metrics).

## 5. Metrics (`metrics.ts`) — the ONLY source of numbers
lotArea_sf · gfa_sf (Σ plate areas) · gfaByProgram · zfa_sf = gfa (SIMPLIFIED: no ZR deductions) · far = zfa/lotArea ·
farByProgram · floors · height_ft (top of highest plate; SIMPLIFIED: no bulkheads/parapets) · footprint_sf (floor-0
plate) · lotCoverage_pct = area(⋃ all plates projected)/lotArea·100 (SIMPLIFIED) · openSpace_pct = (lotArea −
footprint)/lotArea·100 · facadeArea_sf = Σ perimeter(P_k)·h_k (incl. courtyard rings) · facadePerGfa ·
volume_cf · compactness = surface/volume^(2/3) · unitsEst = floor(resGFA·efficiency/avgUnitNetSf) ·
streetWallHeight_ft = top of the highest k such that every floor 0..k has a plate edge within (frontYard + 1 ft) of
the frontage line (SIMPLIFIED street-wall rule) · trimmedVolume_cf = Σ trimmedArea_k·h_k · courtyardSunHours (§8).
Rounding for display only (sf → nearest 10, ft → 0.1, FAR → 2 dp, % → 1 dp); raw values kept.

## 6. Compliance checker (`compliance.ts`) — Rule | Allowed | Proposed | Status
Independent of the clipper: re-measures plates against each control, so a clipping bug shows up as a Fail.
Area tolerance 1 sf per floor; length tolerance 0.05 ft.
| Rule | Check | Status |
|---|---|---|
| FAR — {use} (each key in maxFar with usable value) | farByProgram[use] ≤ allowed | Pass/Fail |
| FAR — total | far ≤ max(usable maxFar values for uses present) (SIMPLIFIED mixed-use rule) | Pass/Fail |
| Max building height | height ≤ allowed | Pass/Fail |
| Max stories | floors ≤ allowed | Pass/Fail |
| Base height — min | streetWallHeight ≥ min | Pass/Fail |
| Base height — max | streetWallHeight ≤ max | Pass/Fail |
| Setback {id} | for floors with top > startHeight: area(P_k ∩ strip(edge, depth)) ≤ tol | Pass/Fail (+ worst floor) |
| Yard — front/rear/side | all floors: area(P_k ∩ strip(edge, yard)) ≤ tol | Pass/Fail |
| Lot coverage | lotCoverage ≤ max | Pass/Fail |
| Sky exposure plane {id} | floors above start: area(P_k ∩ strip(edge, inset(top))) ≤ tol | Pass/Fail |
| Trimmed to envelope | trimmedVolume_cf > 0 → Review "Trimmed {cf} cf to fit"; else Pass | Review/Pass |
| Unchecked controls | one row per `unchecked[]` item | Review |
Every Allowed cell carries the provenancedValue's citations (section, url, quote) for the UI link. Overall:
any Fail → "Fails {n} rule(s)"; else any Review → "Needs review"; else "Passes all rules".
Program fit (separate table, not zoning): per use target GFA vs proposed (Δ%), units target vs est; within ±5 % → met.

## 7. Grounding check (`grounding.ts`)
`checkGrounding(text, allowed: {label, value, decimals}[]) → {ok, unmatched[]}`. Extract numbers (handles 1,234 · 12.5 ·
45% · 3.0 · "6 floors"); a number matches if equal to some allowed value at that value's display rounding OR
within 0.5 % relative. Small integers 1–10 used as counts of options/floors are allowed only if they appear in
allowed. Unmatched → reject; UI never shows ungrounded text (regenerate once, then show "Couldn't write a grounded
note; edit it yourself").

## 8. Sun & shadow (`sun.ts`)
Sun position from `suncalc` (confirm return fields/units in installed types; convert its azimuth convention to a
local vector, x east y north). Site lat/lng: from the sample's verified research point; for uploaded envelopes the
same NYC reference point (SIMPLIFIED, note shown). Grid north = true north (SIMPLIFIED). Shadow test is analytic:
for sample point p and sun (alt>0), horizontal ray p + t·ŝ; for each prism, compute the t-intervals where the ray is
inside the footprint polygon; blocked if [t_a·tan(alt), t_b·tan(alt)] overlaps [z0, z1]. Sun hours = Σ sunlit
samples × Δt (15-min steps sunrise→sunset). Courtyard = ⋃ void_j at ground (else open space at grade inside lot);
grid spacing 5 ft. Labeled "Study-grade, not certified daylight analysis".

## 9. Strategy proposal schema (`strategy.ts`, zod) — what the LLM may output
`{ typology: enum(6), name: string ≤40, intent: string ≤160, params: Partial<MassingParams> (each key range-checked),
  notes?: string ≤300 }`. Param diff for iteration: `{ changes: [{ key, to, reason ≤120 }] }` (old value filled by code).
Diversity: typological feature vector (typology, upperMode, parts, ringDepth>0, stepEvery>0, carve>0, baseFloors bucket,
towerAspect≥2.5); two options must differ on ≥ 2 features AND have active-key parameter distance ≥ 0.10. Distance = mean
over the union of both options' ACTIVE numeric keys (keys their moves actually use): range-normalised |Δ| if active in
both, 0.5 if active in only one (the move exists in one scheme only). (Revised 2026-10-26 after testing: a plain mean
over all 18 keys made the six presets look like duplicates.) Test: all six presets are mutually distinct.
