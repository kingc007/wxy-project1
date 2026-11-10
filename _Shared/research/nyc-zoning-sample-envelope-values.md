---
type: research
topic: NYC Zoning Resolution values for three SAMPLE zoning envelopes (R7A interior, R8A corner, R10 / C6-4 through-block)
prototype: shared
researched: 2026-10-25
verified_by: verifier
verified: 2026-10-25
---
# NYC Zoning Resolution values for sample envelopes

## Question
Collect current (post City of Yes for Housing Opportunity) ZR values for: (A) interior lot R7A; (B) corner lot R8A; (C) large through-block site R10 (and C6-4 equivalent). Fields: FAR, lot coverage, base heights, max height, setbacks, yards, street-wall rules, tower / sky-exposure-plane rules, wide/narrow street definitions, community facility FAR.

## Method / caveats
- All sources: official ZR site zr.planning.nyc.gov, fetched 2026-10-25 via `curl` of the section URL, then HTML stripped to text locally (WebFetch summarises and cannot quote verbatim). Quotes below are copied from that stripped text; table rows are flattened with " | " between cells.
- Each ZR section page shows "Last Amended". It is the only date the page gives (no separate "effective date" field). All Article II/III sections cited here show **Last Amended 12/5/2024**, except 12-10 (page-level "Last Amended 3/26/2026"; the individual definitions show their own dates, quoted per row).
- Table column mapping for 23-432 (heights) is taken from header order in the flattened table: Minimum base height | Standard: max base height, max height | Qualifying affordable/senior (UAP): max base height, max height. The verifier should confirm against the rendered page.
- "Standard" = "standard residences". "Qualifying" = "qualifying affordable housing or qualifying senior housing" (UAP). Both variants are given; the SAMPLE envelopes should use "Standard" unless stated.
- Superscript footnote numbers are fused to labels in the text extraction (e.g. "R10X1" = R10X footnote 1). I checked the HTML for R7A: the footnote superscript sits on R7-1 and R7-2, not on R7A.
- Source URLs: https://zr.planning.nyc.gov/article-ii/chapter-3/<section>, .../article-ii/chapter-4/24-11, .../article-iii/chapter-3/<section>, .../article-iii/chapter-4/34-112, .../article-i/chapter-2/12-10.

## Claims

### Definitions
| # | Claim | Source (URL) | Version / effective | Verbatim quote | Status | Verified |
|---|-------|-----|-----|-----|-----|-----|
| 1 | Wide street = 75 ft or more | https://zr.planning.nyc.gov/article-i/chapter-2/12-10 (street, wide) | Last Amended 3/26/2026 | "A "wide street" is any street 75 feet or more in width." | CITED | PASS |
| 2 | Wide street special case in C6-4 (and C5-3, C6-6) | same | Last Amended 3/26/2026 | "In C5-3, C6-4 or C6-6 Districts, when a front lot line of a zoning lot adjoins a portion of a street whose average width is 75 feet or more and whose minimum width is 65 feet, such portion of a street may be considered a wide street" | CITED | PASS |
| 3 | Narrow street = less than 75 ft | same (street, narrow) | Last Amended 12/15/1961 | "A "narrow street" is any street less than 75 feet wide." | CITED | PASS |
| 4 | Corner lot definition | same (lot, corner) | page 12-10 | "A "corner lot" is either a zoning lot bounded entirely by streets, or a zoning lot which adjoins the point of intersections of two or more streets and in which the interior angle formed by the extensions of the street lines ... forms an angle of 135 degrees or less." | CITED | PASS |
| 5 | Interior lot definition | same (lot, interior) | page 12-10 | "An "interior lot" is any zoning lot neither a corner lot nor a through lot." | CITED | PASS |
| 6 | Through lot definition | same (lot, through) | page 12-10 | "A "through lot" is any zoning lot, not a corner lot, which adjoins two street lines opposite to each other and parallel or within 45 degrees of being parallel to each other." | CITED | PASS |
| 7 | Large site = 1.5 acres or more | same (large site) | Last Amended 12/5/2024 | "A "large site" is either a single zoning lot with a lot area of at least 1.5 acres, or two or more zoning lots under single fee ownership or alternate ownership arrangements that are contiguous or would be contiguous but for their separation by a street with a lot area of at least 1.5 acres." | CITED | PASS |
| 8 | Sky exposure plane building definition (R6-R10 no suffix; developed/enlarged after 12/5/2024; uses 23-73 or 35-81) | same | Last Amended 12/5/2024 | "is located in R6 through R10 Districts without a letter suffix, or in Commercial Districts mapped within, or with a residential equivalent of, R6 through R10 Districts without a letter suffix; ... utilizes the optional bulk regulations set forth in Section 23-73, inclusive, or Section 35-81, inclusive." | CITED | PASS |
| 9 | Sky exposure plane geometric definition | same | Last Amended 4/18/1987 | "beginning above the street line ... at a height set forth in the district regulations; and (b) rising over a zoning lot at a ratio of vertical distance to horizontal distance set forth in the district regulations." | CITED | PASS |

### Residential FAR (ZR 23-22, https://zr.planning.nyc.gov/article-ii/chapter-3/23-22, Last Amended 12/5/2024)
Table title "MAXIMUM FLOOR AREA RATIO FOR R6-R12 DISTRICTS", columns: Standard residences | Qualifying affordable housing or qualifying senior housing.
| # | Claim | Version | Verbatim quote (table row) | Status | Verified |
|---|-------|-----|-----|-----|-----|
| 10 | A: R7A residential FAR, standard = 4.00; qualifying = 5.01 | 12/5/2024 | "R7A R7-11 R7-21 | 4.00 | 5.01" (fn 1 sits on R7-1/R7-2 only) | CITED | PASS |
| 11 | B: R8A residential FAR, standard = 6.02; qualifying = 7.20 | 12/5/2024 | "R8A R8X R8 | 6.02 | 7.20" | CITED | PASS |
| 12 | C: R10 residential FAR, standard = 10.00; qualifying = 12.00 | 12/5/2024 | "R10A R10X R10 | 10.00 | 12.00" | CITED | PASS |
| 13 | R10 under sky exposure plane option (23-733, same Last Amended 12/5/2024) | 12/5/2024 | "In R10 Districts, the maximum floor area ratio on a zoning lot shall be 12.0 for qualifying affordable housing or qualifying senior housing and 10.0 for other residences." | CITED | PASS |
| 14 | Towers in R9/R10: extra floor-area counting for mechanical/unused space (23-241) - not modelled | 12/5/2024 | "In R9 and R10 Districts, for zoning lots containing a building that is developed or enlarged pursuant to the applicable tower regulations of Section 23-435 (Tower regulations), any floor space used for mechanical equipment ... shall be considered floor area" | CITED (SIMPLIFY: likely omit) | PASS |

### Commercial / community facility FAR
| # | Claim | Source | Version | Verbatim quote | Status | Verified |
|---|-------|-----|-----|-----|-----|-----|
| 15 | C6-4 commercial-only FAR = 10.00 | https://zr.planning.nyc.gov/article-iii/chapter-3/33-122 | 12/5/2024 | "C4-7 C5-2 C5-4 C6-4 C6-5 C6-8 C7-7 | 10.00" (table "Maximum Floor Area Ratio", zoning lot containing only commercial uses) | CITED | PASS |
| 16 | C6-4 community facility (and mixed commercial + CF) FAR = 10.00 | https://zr.planning.nyc.gov/article-iii/chapter-3/33-123 | 12/5/2024 | "C1-8 C1-9 C2-7 C2-8 C4-6 C4-7 C4-9 C5-1 C5-2 C5-4 C6-3 C6-4 C6-5 C6-8 C7-7 | 10.00" | CITED | PASS |
| 17 | C6-4 bulk follows residential equivalent R10 | https://zr.planning.nyc.gov/article-iii/chapter-4/34-112 | 12/5/2024 | "the applicable bulk regulations are the bulk regulations for the residential equivalent of the Commercial District as set forth in the following table" ; row "C1-9 C2-8 C4-6 C4-7 C5 C6-4 C6-5 C6-6 C6-7 C6-8 C6-9 | R10" | CITED | PASS |
| 18 | Residential FAR in C-districts governed by Article II; total not above greatest single-use FAR | https://zr.planning.nyc.gov/article-iii/chapter-5/35-31 | 12/5/2024 | "the maximum floor area ratio permitted for a residential use shall be as set forth in Article II, Chapter 3 ... The total of all such floor area ratios shall not exceed the greatest floor area ratio permitted for any such use on the zoning lot" | CITED | PASS |
| 19 | Community facility FAR (and CF lot coverage) in R7A: FAR 4.00, corner lot 80, interior/through 65 | https://zr.planning.nyc.gov/article-ii/chapter-4/24-11 | 12/5/2024 | "R7A | 4.00 | 80 | 65" (table "...R6 THROUGH R12 DISTRICTS FOR CONTEXTUAL DISTRICTS"; columns FAR, Corner Lot, Interior Lot or Through Lot, lot coverage percent of lot area) | CITED | PASS |
| 20 | Community facility FAR in R8A: 6.50, corner 80, interior/through 70 | same | 12/5/2024 | "R8A | 6.50 | 80 | 70" | CITED | PASS |
| 21 | Community facility FAR in R10: 10.00, corner 75, interior/through 65 (non-contextual table) | same | 12/5/2024 | "R10 | 10.00 | 75 | 65" | CITED | PASS |

### Lot coverage (ZR 23-362 and 23-363, Last Amended 12/5/2024)
| # | Claim | Source | Verbatim quote | Status | Verified |
|---|-------|-----|-----|-----|-----|
| 22 | Standard residential lot coverage R6-R12: interior or through lot 80%; corner lot 100% (applies to R7A, R8A, R10) | https://zr.planning.nyc.gov/article-ii/chapter-3/23-362 | "the maximum residential lot coverage for interior lots or through lots shall be 80 percent and the maximum residential lot coverage for corner lots shall be 100 percent." | CITED | PASS |
| 23 | Eligible sites (23-434): overall max residential coverage 65% (lot area 30,000 sf or more, not large sites) or 50% (large sites) | same | "65 percent on zoning lots with a lot area of 30,000 square feet or more that are not large sites; and 50 percent on large sites." | CITED | PASS |
| 24 | Interior/through lot portions within 100 ft of a corner: 100% coverage | https://zr.planning.nyc.gov/article-ii/chapter-3/23-363 | "for interior or through lots, or portions thereof, within 100 feet of the point of intersection of two street lines intersecting at an angle of 135 degrees or less, the maximum lot coverage shall be 100 percent." | CITED | PASS |
| 25 | Short block dimension: 100% within 100 ft | same | "whenever a front lot line of an interior or through lot coincides with the street line of the short dimension of a block, the maximum lot coverage for such zoning lot, or portion thereof, shall be 100 percent within 100 feet of such street line." | CITED | PASS |
| 26 | Shallow lot increase: +1% per 5 ft shorter than 95 ft (interior) / 190 ft (through), capped 90% | same | "may be increased by one percent for every five feet the depth of such zoning lot, or portion thereof, is less than 95 feet for interior lots or 190 feet for through lots." | CITED | PASS |

### Height and setback, non-tower (ZR 23-431, 23-432, 23-433; Last Amended 12/5/2024)
23-432 table "MINIMUM BASE HEIGHT, MAXIMUM BASE HEIGHT, AND MAXIMUM BUILDING HEIGHTS", cells in feet: min base | Standard (max base, max height) | Qualifying (max base, max height).
| # | Claim | Source | Verbatim quote (row) | Status | Verified |
|---|-------|-----|-----|-----|-----|
| 27 | A: R7A min base 40, std max base 75, std max height 85; qualifying base 85, height 115 | https://zr.planning.nyc.gov/article-ii/chapter-3/23-432 | "R7A R7-11 R7-21 | 40 | 75 | 85 | 85 | 115" (fn 1 on R7-1/R7-2 only, not R7A) | CITED (column mapping to verify) | PASS |
| 28 | B: R8A min base 60, std max base 95, std max height 125; qualifying base 105, height 145 | same | "R8A | 60 | 95 | 125 | 105 | 145" | CITED (column mapping to verify) | PASS |
| 29 | C: R10, within 100 ft of wide street: min base 60, std base 155, height 215; qualifying 155 / 235 | same | "R10X1 R101 | 60 | 155 | 215 | 155 | 235" with "1 For zoning lots or portions thereof within 100 feet of a wide street" | CITED (column mapping to verify) | PASS |
| 30 | C: R10, narrow street beyond 100 ft of wide street (or wide-only frontage beyond 100 ft of street line): min base 60, std base 125, height 185; qualifying 155 / 235 | same | "R10A2 R10X2 R102 | 60 | 125 | 185 | 155 | 235" with "2 For zoning lots or portions thereof on a narrow street beyond 100 feet of a wide street or, for zoning lots with only wide street frontage, portions of such zoning lot beyond 100 feet of the street line" | CITED (column mapping to verify) | PASS |
| 31 | Setback is placed between min and max base height | same | "a setback shall be provided at a height not lower than the minimum base height or higher than the maximum base height in accordance with Section 23-433." | CITED | PASS |
| 32 | Required setback depth: 10 ft wide street, 15 ft narrow street (min 7 ft after reductions) | https://zr.planning.nyc.gov/article-ii/chapter-3/23-433 | "a setback with a depth of at least 10 feet shall be provided from any street wall fronting on a wide street, and a setback with a depth of at least 15 feet shall be provided from any street wall fronting on a narrow street." / "in no event shall a setback of less than seven feet in depth be provided" | CITED | PASS |
| 33 | Setback optional for walls beyond 50 ft of a street line or at 65 degrees or less | same | "These setback provisions are optional for any building wall that either is located beyond 50 feet of a street line, or oriented so that lines drawn perpendicular to it, in plan, would intersect a street line at an angle of 65 degrees or less." | CITED | PASS |
| 34 | Street wall location (not R6B/R7B/R8B): wide street 70% within 8 ft of street line | https://zr.planning.nyc.gov/article-ii/chapter-3/23-431 | "Along wide streets, at least 70 percent of the aggregate width of street walls shall be located within eight feet of the street line and extend to at least the minimum base height specified in Section 23-432, or the height of the building, whichever is less." | CITED | PASS |
| 35 | Street wall location: narrow street 70% within 10 ft | same | "Along narrow streets, at least 70 percent of the aggregate width of street wall shall be located within 10 feet of the street line and extend to at least the minimum base height specified in Section 23-432, or the height of the building, whichever is less." | CITED | PASS |
| 36 | Street wall, large lots (>= 40,000 sf or full block): 50% within 15 ft | same | "for zoning lots with a lot area of at least 40,000 square feet or for zoning lots that occupy an entire block, at least 50 percent of the aggregate width of street walls shall be located within 15 feet of the street line" | CITED | PASS |
| 37 | Corner lots: street wall rule mandatory on one frontage (wide street if mixed); through lots < 190 ft deep: one frontage | https://zr.planning.nyc.gov/article-ii/chapter-3/23-436 | "On corner lots, or portions thereof, the street wall location requirements of Section 23-431 shall be mandatory along only one street frontage. Where one of the street frontages bounding the corner lot is a wide street and the other a narrow street, the street wall location rules shall be applied along the wide street frontage;" | CITED | PASS |
| 38 | Through lot < 190 ft depth: street wall rule one frontage only | same | "On through lots which extend less than 190 feet in maximum depth from street to street, the street wall location requirements of Section 23-431 shall be mandatory along only one street frontage." | CITED | PASS |
| 39 | Eligible-site height (23-434) for R8: 215 ft; R10: 355 ft (alternative max height; eligible sites require lot >= 20,000 sf / entire block etc.) | https://zr.planning.nyc.gov/article-ii/chapter-3/23-434 | "R8 | 215" ; "R10 | 355" (table "MAXIMUM BUILDING HEIGHT FOR ELIGIBLE SITES"; applies to districts "without a letter suffix"; eligible if "zoning lots that have a lot area of at least 20,000 square feet or occupy an entire block") | CITED (applicability SIMPLIFIED if used) | PASS |

### Tower rules (R9-R12 without suffix), ZR 23-435, 23-441
| # | Claim | Source | Verbatim quote | Status | Verified |
|---|-------|-----|-----|-----|-----|
| 40 | Towers allowed R9-R12 except R9A/R9X/R10A/R11A, as alternative to 23-432 heights | https://zr.planning.nyc.gov/article-ii/chapter-3/23-435 | "In R9 through R12 Districts, other than R9A, R9X, R10A or R11A Districts, as an alternative to the maximum building heights set forth in Section 23-432, towers are permitted pursuant to the provisions of this Section." | CITED | PASS |
| 41 | Tower max lot coverage: 65% up to 300 ft; 50% above 300 ft (above max base height) | same | "Above the maximum base height specified for the particular district, a tower with a maximum lot coverage of: 65 percent shall be permitted up to a height of 300 feet; and 50 percent shall be permitted above a height of 300 feet." | CITED | PASS |
| 42 | R9/R10 (no suffix) tower-on-base near wide street: min tower coverage 30% | https://zr.planning.nyc.gov/article-ii/chapter-3/23-441 | "The minimum lot coverage of a tower above the maximum base height shall be 30 percent of the lot area of the zoning lot." (applies where >25% residential floor area and lot fronts a wide street within 125 ft (short block dimension) or 100 ft (long dimension)) | CITED | PASS |
| 43 | Same: >= 55% of floor area below 150 ft | same | "At least 55 percent of the total floor area permitted on the zoning lot shall be located in stories located either partially or entirely below a height of 150 feet." | CITED | PASS |
| 44 | No tower on narrow street more than 100 ft from wide-street intersection | same | "No tower or portion thereof shall be located on a narrow street at a distance that is more than 100 feet from the intersection with a wide street." | CITED | PASS |
| 45 | No towers within 100 ft of a public park of 1 acre+ | same | "No towers shall be permitted on any building located wholly or partly in a Residence District, that is within 100 feet of a public park with an area of one acre or more, or a street line opposite such a public park." | CITED | PASS |

### Sky exposure plane (optional, ZR 23-73; Last Amended 12/5/2024 on each page)
Applies only to "sky exposure plane buildings" (R6-R10 without suffix, optional). R10 qualifies; R7A/R8A do not (suffix).
| # | Claim | Source | Verbatim quote | Status | Verified |
|---|-------|-----|-----|-----|-----|
| 46 | Applicability: R6-R10 without letter suffix, except R6-1, R6-2, R7-3, R9-1, certain CD9 Manhattan, Limited Height Districts | https://zr.planning.nyc.gov/article-ii/chapter-3/23-731 | "may be applied to zoning lots in R6 through R10 Districts without a letter suffix, except that such alternative provisions shall not apply to: zoning lots in R6-1, R6-2, R7-3 and R9-1 Districts;" | CITED | PASS |
| 47 | R8/R9/R10 front setback, standard SEP: initial setback distance 20 ft (narrow) / 15 ft (wide); max front wall height 85 feet or nine stories, whichever is less; height above street line 85 ft; slope narrow 2.7 to 1, wide 5.6 to 1 | https://zr.planning.nyc.gov/article-ii/chapter-3/23-736 | "R8 R9 or R10 Districts | 20 | 15 | 85 feet or nine stories, whichever is less | 85 | 2.7 | to 1 | 5.6 | to 1" (columns: Initial Setback Distance On Narrow / On Wide Street; Max Height of Front Wall; Sky Exposure Plane Height above Street Line; Slope vertical:horizontal On Narrow / On Wide Street) | CITED (column mapping to verify) | PASS |
| 48 | R6/R7 same table row (for reference) | same | "R6 or R7 Districts | 20 | 15 | 60 feet or six stories, whichever is less | 60 | 2.7 | to 1 | 5.6 | to 1" | CITED | PASS |
| 49 | Alternate front setbacks (R8-R10): open area depth 15 ft narrow / 10 ft wide; SEP height 85 ft; slope narrow 3.7 to 1, wide 7.6 to 1; inapplicable in R9/R10 if > 25% of floor area residential | same | "R8 R9 or R10 Districts | 15 | 10 | 85 | 3.7 | to 1 | 7.6 | to 1" and "In R9 or R10 Districts, the provisions of this paragraph shall be inapplicable to any development or enlargement with more than 25 percent of the total floor area of the building in residential use." | CITED (column mapping to verify) | PASS |
| 50 | Towers may penetrate SEP in R9/R10: max 40% of lot area if lot > 20,000 sf, else 50%; setback 10 ft wide street / 15 ft narrow street | https://zr.planning.nyc.gov/article-ii/chapter-3/23-737 | "does not occupy more than 40 percent of the lot area of a zoning lot for zoning lots with a lot area greater than 20,000 square feet, or more than 50 percent of the lot area for all other zoning lots; and is set back at least 10 feet from a street line along a wide street and at least 15 feet from a street line along a narrow street." | CITED | PASS |
| 51 | For SEP buildings, lot coverage limits of 23-36 need not apply | https://zr.planning.nyc.gov/article-ii/chapter-3/23-735 | "the maximum lot coverages set forth in Section 23-36, inclusive, need not apply;" | CITED | PASS |

### Yards
| # | Claim | Source | Verbatim quote | Status | Verified |
|---|-------|-----|-----|-----|-----|
| 52 | Front yard: none in R6-R12 | https://zr.planning.nyc.gov/article-ii/chapter-3/23-322 (Last Amended 12/5/2024) | "In the districts indicated, no front yard requirements shall apply." | CITED | PASS |
| 53 | Side yards R6-R12: none required (5 ft min width if an open area is provided); two 5 ft side yards only for detached 1-/2-family | https://zr.planning.nyc.gov/article-ii/chapter-3/23-335 (12/5/2024) | "for zoning lots containing all other types of residences, no side yards shall be required. However, if any open area extending along a side lot line is provided at any level, it shall have a minimum width of five feet, measured perpendicular to the side lot line." | CITED | PASS |
| 54 | Interior-lot rear yard: 20 ft at or below 75 ft; 30 ft above 75 ft (detached/zero lot line buildings; attached buildings: lot width >= 40 ft same; < 40 ft wide: 30 ft) | https://zr.planning.nyc.gov/article-ii/chapter-3/23-342 (12/5/2024) | "a rear yard with a depth of not less than 20 feet shall be provided at every rear lot line on any zoning lot, and for portions above 75 feet, where permitted, a rear yard with a depth of 30 feet shall be provided" | CITED | PASS |
| 55 | Corner lots: no rear yard within 100 ft of a street-line intersection of 135 degrees or less | https://zr.planning.nyc.gov/article-ii/chapter-3/23-344 (12/5/2024) | "no rear yard shall be required within 100 feet of the point of intersection of two street lines intersecting at an angle of 135 degrees or less." | CITED | PASS |
| 56 | Short block dimension: no rear yard within 100 ft of that street line | same | "whenever a front lot line of a zoning lot coincides with the street line of the short dimension of a block, no rear yard shall be required within 100 feet of such street line" | CITED | PASS |
| 57 | Corner lot portions beyond 100 ft: side lot line becomes rear lot line; R6-R12 no rear yard where it abuts a side lot line | same | "In R6 through R12 Districts, no rear yard shall be required where such rear lot line coincides with a side lot line of an adjoining zoning lot." | CITED | PASS |
| 58 | Through lot rear yard equivalent: 40 ft (at/below 75 ft), 60 ft above 75 ft, for through lots 190 ft or more deep | https://zr.planning.nyc.gov/article-ii/chapter-3/23-343 (12/5/2024) | "On any through lot that is 190 feet or more in maximum depth from street to street, for buildings or portions thereof at or below a height of 75 feet, a rear yard equivalent consisting of an open area with a minimum depth of 40 feet shall be provided, and above a height of 75 feet, where permitted, a rear yard equivalent of 60 feet shall be provided." | CITED | PASS |
| 59 | Rear yard equivalent location: midway (within 10 ft) between street lines | same | "A rear yard equivalent shall be provided midway, or within 10 feet of being midway, between the two street lines upon which such through lot fronts." | CITED | PASS |
| 60 | No rear yard equivalent for through lots < 110 ft deep, large sites, or whole-block lots | same | "No rear yard equivalent regulations shall apply: to any through lots that extend less than 110 feet in maximum depth from street to street; to large sites;" (continues: "or to any zoning lot occupying an entire block.") | CITED | PASS |
| 61 | Alternative REY locations for eligible sites / towers / SEP (open areas along both street lines, or half the REY depth along each side lot line, 5 ft min) | same | "open areas adjoining and extending along the full length of either or both street lines, where the combined depth of such open areas is equivalent to the depth of the required rear yard equivalent;" | CITED | PASS |

## Not found / open questions
- **Maximum number of stories for R7A / R8A / R10**: NOT FOUND. The 23-432 table gives heights in feet only; no stories column. (Stories appear only as "60 feet or six stories" / "85 feet or nine stories" in the 23-736 sky exposure plane front-wall limit.)
- **Distinct "max base height" for R7A on narrow vs wide street**: R7A has no wide/narrow split in 23-432 (single row); the split exists only for R8 (generic), R9, R10, R11 etc. via footnotes 1-2.
- **C6-4 specific commercial-district height/setback (Article III Ch. 5, 35-xx)**: NOT researched/fetched. 34-112 says C6-4 uses R10 residential-equivalent bulk (claim 17), so R10 rows are used; the sections for non-residential building bulk in commercial districts were not fetched. UNVERIFIED for commercial-only buildings.
- **Sky exposure plane in C6-4 via 35-81**: referenced in the 12-10 definition (claim 8) but 35-81 was not fetched. UNVERIFIED.
- Floor-area optional bonuses (e.g., UAP, MIH, plazas in C6-4 under 33-13) NOT researched.
- Corner-lot R7A/R8A: base height / setback have no extra corner-lot variant beyond 23-436 street-wall rule (claim 37); other corner-specific rules in the Article not researched.
- 23-434 "eligible site" criteria are long; only the 20,000 sf / full block criterion and heights are recorded.

## Conflicts
- None found between sources. Note date difference only: 12-10 shows Last Amended 3/26/2026 (wide street definition), while all residential/commercial bulk sections show 12/5/2024.

## Manager decisions / SIMPLIFIED candidates
- Sample C (R10): two modes exist (non-tower base+setback per 23-432/23-433; tower per 23-435/23-441; optional SEP per 23-73/23-737). Recommend modelling non-tower and tower, SEP as SIMPLIFIED option.
- Rear-yard rules around corners and shallow lots are complex: model 100-ft-from-corner rule only; label SIMPLIFIED.
- Column mapping for height/SEP tables is inferred from flattened header order; verifier should check the rendered tables.
