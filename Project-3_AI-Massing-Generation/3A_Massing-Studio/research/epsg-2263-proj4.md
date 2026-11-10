---
type: research
topic: EPSG:2263 proj4 definition and proj4 npm API
prototype: 3A
researched: 2026-10-25
verified_by: verifier
verified: 2026-10-25
---
# EPSG:2263 and proj4 npm

## Question
Official EPSG:2263 name/unit/proj4 string from epsg.io and spatialreference.org; proj4 npm version and lon/lat -> custom projection API; sanity conversion.

## Claims
| # | Claim | Source (URL / file) | Version / effective date | Verbatim quote | Status | Verified |
|---|-------|--------------------|--------------------------|----------------|--------|----------|
| 1 | epsg.io proj4 string (raw .proj4 endpoint, fetched with curl) | https://epsg.io/2263.proj4 | retrieved 2026-10-25 | "+proj=lcc +lat_0=40.1666666666667 +lon_0=-74 +lat_1=41.0333333333333 +lat_2=40.6666666666667 +x_0=300000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs +type=crs" | CITED | PASS |
| 2 | epsg.io HTML page (WebFetch summary) shows a different proj4 form with nadgrids instead of towgs84 | https://epsg.io/2263 | retrieved 2026-10-25; CRS "Revision date: 2001-11-06" | "+x_0=300000 +y_0=0 +ellps=GRS80 +nadgrids=us_noaa_nyhpgn.tif +units=us-ft +no_defs +type=crs" (tail of string, as extracted by fetch tool; page not re-read raw) | CITED (see Conflicts) | PASS |
| 3 | epsg.io name | https://epsg.io/2263 | as above | "NAD83 / New York Long Island (ftUS)" | CITED | PASS |
| 4 | epsg.io unit | https://epsg.io/2263 | as above | "US survey foot" | CITED | PASS |
| 5 | spatialreference.org proj4.txt (raw, curl) | https://spatialreference.org/ref/epsg/2263/proj4.txt | retrieved 2026-10-25 | "+proj=lcc +lat_0=40.1666666666667 +lon_0=-74 +lat_1=41.0333333333333 +lat_2=40.6666666666667 +x_0=300000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs +type=crs" | CITED | PASS |
| 6 | spatialreference.org name, unit, method | https://spatialreference.org/ref/epsg/2263/ (raw HTML via curl) | retrieved 2026-10-25 | "EPSG:2263 NAD83 / New York Long Island (ftUS)"; "Projection method name : Lambert Conic Conformal (2SP)"; "UoM : US survey foot." | CITED | PASS |
| 7 | spatialreference.org area/bounds | same | same | "Area : United States (USA) - New York - counties of Bronx; Kings; Nassau; New York; Queens; Richmond; Suffolk."; "WGS84 Bounds : -74.26, 40.47, -71.8, 41.3" | CITED | PASS |
| 8 | proj4 npm version installed | /private/tmp/claude-501/-Users-king-Downloads-WXYArchitecture-Project-3-AI-Massing-Generation/1a63f540-b471-4285-a216-f1fffbc0bc52/scratchpad/libprobe/node_modules/proj4/package.json (npm ls) | installed 2026-10-25 via `npm i proj4 @types/proj4` | `"version": "2.22.0"` (npm ls: proj4@2.22.0, @types/proj4@2.5.6) | CITED | PASS |
| 9 | proj4 basic signature | node_modules/proj4/README.md | proj4 2.22.0 | "proj4([fromProjection, ]toProjection[, coordinates])" | CITED | PASS |
| 10 | Three-arg form transforms from projection 1 to 2 | same | same | "When all 3 arguments  are given, the result is that the coordinates are transformed from projection1 to projection 2." | CITED | PASS |
| 11 | Axis order default | same | same | "By default, proj4 uses `[x,y]` axis order for projected (cartesian) coordinate systems and `[x=longitude,y=latitude]` for geographic coordinates." | CITED | PASS |
| 12 | One-arg form assumes WGS84 source | same | same | "If only 1 projection is given then it is assumed that it is being projected *from* WGS84 (fromProjection is WGS84)." | CITED | PASS |
| 13 | proj4 ships own types; call signature via dist/index.d.ts; Converter forward/inverse | node_modules/proj4/package.json, dist/index.d.ts, @types/proj4/index.d.ts | proj4 2.22.0 / @types/proj4 2.5.6 | package.json: `"types": "dist/index.d.ts"`; @types: `forward<T extends TemplateCoordinates>(coordinates: T, enforceAxis?: boolean): T;` | CITED | PASS |
| 14 | Sanity conversion lon -73.9755, lat 40.6890 -> EPSG:2263 (COMPUTED IN PROBE, NOT A SOURCE CLAIM). `proj4('EPSG:4326', def, [-73.9755, 40.6890])` gave [991044.5010835083, 190298.66478741975] ft with both the epsg.io .proj4 string and the spatialreference.org string, and the 1-arg form. Script: .../libprobe/t.mjs | probe | n/a (computed) | n/a | COMPUTED (not a source claim) | PASS |

## Not found / open questions
- Official epsg.org registry page not fetched (task asked only epsg.io and spatialreference.org).
- epsg.io HTML page was read only through the fetch tool's extraction; the nadgrids string tail (claim 2) was not seen raw. Unit "US survey foot" on epsg.io likewise.
- Whether the `us_noaa_nyhpgn.tif` grid is available in proj4js: UNVERIFIED (not checked; proj4 needs proj4.nadgrid loading for nadgrids). The probe used only the two raw strings.
- Computed output not compared against an independent reference (e.g. pyproj/PROJ); accuracy is UNVERIFIED.

## Conflicts
- CONFLICTING (datum handling only): epsg.io/2263.proj4 uses "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0"; spatialreference.org uses "+datum=NAD83"; epsg.io/2263 HTML shows "+nadgrids=us_noaa_nyhpgn.tif". The projection parameters (lcc, lat_0, lon_0, lat_1, lat_2, x_0, y_0, units=us-ft) are identical in all. In the probe the first two gave identical output to the printed precision.
