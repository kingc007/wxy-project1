---
type: research
topic: manager direct checks (interpretation + live API probes)
prototype: 1B
researched: 2026-10-25
verified_by: verifier
verified: 2026-10-25
---
# Manager direct checks

| # | Claim | Source | Version / date | Verbatim quote | Status | Verified |
|---|---|---|---|---|---|---|
| M1 | In ZR §23-22 table, the row "R6A R6¹ R6-1 R7B" (3.00 std / 3.90 QAH) applies to R6 only within 100 ft of a wide street (footnote 1); other R6 uses row "R6" 2.20 / 3.90 | https://zr.planning.nyc.gov/article-ii/chapter-3/23-22 (raw HTML shows `R6<sup>1</sup>`) | Last Amended 12/5/2024 | "1 For zoning lots, or portions thereof, located within 100 feet of a wide street" | CITED (interpretation: manager) | PASS |
| M2 | §23-736(a) (R6/R7 sky exposure plane buildings, districts without letter suffix): initial setback distance 20 ft (narrow street) / 15 ft (wide street); max height of front wall within the initial setback distance "60 feet or six stories, whichever is less" (single column, no narrow/wide split); sky exposure plane starts at 60 ft above street line (single column); slope 2.7 to 1 (narrow) / 5.6 to 1 (wide) | https://zr.planning.nyc.gov/article-ii/chapter-3/23-736 — raw HTML header: "Initial Setback Distance" colspan=2; "Maximum Height of a Front Wall…" rowspan=4 (one column); "Height above Street Line" rowspan=3 (one column); "Slope over Zoning Lot" colspan=4 (narrow V/H, wide V/H) | Last Amended 12/5/2024 | "R6 or R7 Districts 20 15 60 feet or six stories, whichever is less 60 2.7 to 1 5.6 to 1" | CITED | PASS |
| M3 | MAPPLUTO FeatureServer returns lot polygons in EPSG:2263 (feet) when `outSR=2263` | https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/MAPPLUTO/FeatureServer/0/query?where=BBL=1020500004&outFields=BBL&outSR=2263&f=json (units) and same with f=geojson (crs) | live 2026-10-25 | `"crs":{"type":"name","properties":{"name":"EPSG:2263"}}` … `"units":"esriFeet"` | CITED | PASS (re-run 2026-10-25: `"units":"esriFeet"` in the f=json response; `"crs":{"type":"name","properties":{"name":"EPSG:2263"}}` in the f=geojson response; the quote joins fragments from the two responses) |
| M4 | §23-433: the street setback is taken "at a height not lower than the minimum base height or higher than the maximum base height". The engine models it at the max base height (SIMPLIFIED) | https://zr.planning.nyc.gov/article-ii/chapter-3/23-433 | Last Amended 12/5/2024 | "At a height not lower than the minimum base height or higher than the maximum base height specified for the applicable district, a setback with a depth of at least 10 feet shall be provided from any street wall fronting on a wide street" | CITED | (pending) |
