# 1B Site Brief — eval report

Generated: 2026-10-30T21:39:08.070Z by `scripts/eval.ts` (SOURCE_MODE=offline).
Gold: `evals/gold.json` (written 2026-10-25; manager-written from verified research only).

## Totals

| metric | result |
| --- | --- |
| Field-level accuracy | 88/88 (100.0%) |
| Null-correctness | 4/4 expected-null fields correct; 0 hallucinated value(s) |
| Provenance completeness (target 100%) | 277/277 (100.0%) |
| checkProvenance issues | 0 |
| Envelopes valid | 10/10 (all valid) |
| Parcels with harness errors | 0 |
| Parcels with any FAIL | 0/10 |

## Per parcel

| parcel | category | fields | flags | provenance | valid | ms |
| --- | --- | --- | --- | --- | --- | --- |
| 1020500004 287 CONVENT AVENUE | interior R6A | 10/10 | ok | 100.0% (32/32) | yes | 48 |
| 1003450002 152 ATTORNEY STREET | interior R7A | 10/10 | ok | 100.0% (27/27) | yes | 2 |
| 3039730022 261 SHEPHERD AVENUE | interior R8A | 10/10 | ok | 100.0% (32/32) | yes | 7 |
| 2022720049 501 EAST 145 STREET | corner R6 / C1-4 | 10/10 | ok | 100.0% (42/42) | yes | 4 |
| 1003720008 270 EAST 3 STREET | corner R7A / C2-5 | 10/10 | ok | 100.0% (29/29) | yes | 4 |
| 1003980028 196 EAST 3 STREET | split R7A + R8B | 4/4 | ok | 100.0% (14/14) | yes | 3 |
| 2027570124 1039 LOWELL STREET | split M1-1 + R7-1 | 4/4 | ok | 100.0% (8/8) | yes | 5 |
| 1007330055 430 WEST 36 STREET | special district HY, R8A / C2-5 | 10/10 | ok | 100.0% (27/27) | yes | 2 |
| 2025500028 618 EAST 138 STREET | individual landmark, R6 / C1-4 | 10/10 | ok | 100.0% (39/39) | yes | 4 |
| 1004630033 123 2 AVENUE | historic district, R7A / C1-5 | 10/10 | ok | 100.0% (27/27) | yes | 2 |

## Failing fields

None.

## Flags, assumptions and special-district checks

| parcel | kind | detail |
| --- | --- | --- |
| 1003980028 196 EAST 3 STREET | unexpected flags (info) | unsupported_district |
| 2027570124 1039 LOWELL STREET | unexpected flags (info) | unsupported_district |
| 1004630033 123 2 AVENUE | unexpected flags (info) | data_conflict |

## Provenance offenders

None.

## checkProvenance (envelope) issues

None.

## Gold conditional notes

- **1020500004 287 CONVENT AVENUE** (interior R6A): no conditional
  - gold notes: FAR rows 4 (23-22); coverage row 8 (23-362 standard lot); rear yard row 12 / 23-342 (attached, lot width 46.75 ft ≥ 40 ft → 20 ft up to 75 ft); heights row 21 (23-432 R6A 40/65/75).
- **1003450002 152 ATTORNEY STREET** (interior R7A): no conditional
  - gold notes: Rear yard 30 ft: attached building, lot width 25 ft < 40 ft (23-342).
- **3039730022 261 SHEPHERD AVENUE** (interior R8A): no conditional
  - gold notes: PLUTO lists R8A only; DCP layer shows an R6B portion → data_conflict flag expected, not split (manager rule).
- **2022720049 501 EAST 145 STREET** (corner R6 / C1-4): R6 values assume the lot is within 100 ft of a wide street (Brook Avenue; DCM Streetwidth from live data — street width is data, not a verified research claim). If narrow-only: FAR 2.20, ZFA 5,495.6 sf, heights 30/45/55.
  - gold notes: Corner lot: ZR 23-342 sets rear yards for interior lots only → rear yard must be null (needs input/manual), never guessed.
- **1003720008 270 EAST 3 STREET** (corner R7A / C2-5): no conditional
- **1003980028 196 EAST 3 STREET** (split R7A + R8B): no conditional
  - gold notes: Split lot must be flagged, not guessed. R8B is outside the verified rule set → no combined FAR.
- **2027570124 1039 LOWELL STREET** (split M1-1 + R7-1): no conditional
- **1007330055 430 WEST 36 STREET** (special district HY, R8A / C2-5): no conditional
  - gold notes: Underlying R8A values; special district HY may modify them → confidence must not be 'cited'.
- **2025500028 618 EAST 138 STREET** (individual landmark, R6 / C1-4): R6 values assume within 100 ft of a wide street (East 138 Street; DCM width from live data). If narrow-only: FAR 2.20, ZFA 11,000 sf, heights 30/45/55.
- **1004630033 123 2 AVENUE** (historic district, R7A / C1-5): no conditional
