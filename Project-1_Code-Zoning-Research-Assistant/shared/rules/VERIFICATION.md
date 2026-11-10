---
type: verification
topic: nyc-zr-residence.json rule set (106 rules) and manager-checks M1-M3
verified_by: verifier
verified: 2026-10-25
---
# Verification: nyc-zr-residence.json and manager-checks M1-M3

## Method
- ZR section pages re-fetched with curl on 2026-10-25 (23-21, 23-22, 23-321, 23-322, 23-332, 23-335, 23-342, 23-361, 23-362, 23-422, 23-423, 23-432, 23-433, 23-736, 24-11) and converted with zrtext.py. Raw HTML checked for superscript placement (`<sup>`) and colspan/rowspan on 23-22, 23-432 and 23-736.
- Check 1 (quote present): each citation.quote was matched against its cited page after removing whitespace, table pipes and zero-width characters and mapping superscript digits to plain digits. All 103 quotes that cite a ZR page were found. The 3 M2 quotes were checked against 23-736 separately and found.
- Check 2 (value, unit, districts, when): read against the table column headers and raw HTML, as described in the notes below.
- Check 3 (research claim): the cited claim numbers are 1, 3, 4, 5, 6, 7, 8, 10, 12, 15, 16, 17, 18, 19, 20, 21, 22, 31 in residence-bulk-rules.md, plus M2 in manager-checks.md. All exist and are PASS. No rule cites claim 24 or 26.
- The rules file was not edited.

## Manager checks (manager-checks.md)
| # | Verdict | Reason |
|---|---|---|
| M1 | PASS | Raw HTML of 23-22 has `R6<sup>1</sup>` in the "R6A R6 R6-1 R7B" row, and the plain "R6" row has no sup. Quote and "Last Amended 12/5/2024" match. |
| M2 | PASS | 23-736 raw HTML: Initial Setback Distance colspan=2 (narrow 20, wide 15); Maximum Height of Front Wall rowspan=4 (single column, "60 feet or six stories, whichever is less"); Height above Street Line rowspan=3 (single column, 60); Slope colspan=4 (narrow 2.7 to 1, wide 5.6 to 1). Quote matches. |
| M3 | FAIL (quote not found) | The re-run query returned `"crs":{"type":"name","properties":{"name":"EPSG:2263"}}`, so the first part of the quote matches. The second part, `"units":"esriFeet"`, is absent from the response (grep count 0). The response has no units field, so the "(feet)" claim is not supported by a fetched source. |


## Rule verdicts (106 rules)
| rule id | verdict |
|---|---|
| R5.far.res.std | PASS |
| R5.far.res.qrs | PASS |
| R6A.far.res.std | PASS |
| R6A.far.res.qah | PASS |
| R6.far.res.std.wide100 | PASS |
| R6.far.res.qah.wide100 | PASS |
| R6.far.res.std | PASS |
| R6.far.res.qah | PASS |
| R6B.far.res.std | PASS |
| R6B.far.res.qah | PASS |
| R7A.far.res.std | PASS |
| R7A.far.res.qah | PASS |
| R8A.far.res.std | PASS |
| R8A.far.res.qah | PASS |
| R5.far.cf | PASS |
| R5.cov.cf.corner | PASS |
| R5.cov.cf.interior | PASS |
| R6A.far.cf | PASS |
| R6A.cov.cf.corner | PASS |
| R6A.cov.cf.interior | PASS |
| R6B.far.cf | PASS |
| R6B.cov.cf.corner | PASS |
| R6B.cov.cf.interior | PASS |
| R7A.far.cf | PASS |
| R7A.cov.cf.corner | PASS |
| R7A.cov.cf.interior | PASS |
| R8A.far.cf | PASS |
| R8A.cov.cf.corner | PASS |
| R8A.cov.cf.interior | PASS |
| R6.far.cf | PASS |
| R6.cov.cf.corner | PASS |
| R6.cov.cf.interior | PASS |
| R6.cov.res.interior | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R6.cov.res.corner | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R6A.cov.res.interior | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R6A.cov.res.corner | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R6B.cov.res.interior | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R6B.cov.res.corner | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R7A.cov.res.interior | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R7A.cov.res.corner | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R8A.cov.res.interior | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R8A.cov.res.corner | FAIL (does not support claim): when has no program scope. The page (§23-362, claim 8) states these values only 'For standard lots'; the same section gives eligible-site coverage of 65%/50% (§23-362 'For eligible sites'). The value and districts match, but the unscoped rule overstates allowed coverage for eligible sites. |
| R5.cov.res.md.interior | PASS |
| R5.cov.res.md.corner | PASS |
| R5.cov.res.12f.interior | PASS |
| R5.cov.res.12f.corner | PASS |
| ALL.rear.attached.narrowlot | PASS |
| ALL.rear.attached.widelot | PASS |
| ALL.rear.attached.widelot.above75 | PASS |
| ALL.rear.detached | FAIL (does not support claim): buildingType 'one_two_family' is not stated by the quote ('For detached and zero lot line buildings', §23-342). One/two-family semi-detached or attached buildings fall under the attached/semi-detached rule, so this rule overlaps with and contradicts it. The term is not defined anywhere in the vault. |
| ALL.rear.detached.above75 | FAIL (does not support claim): buildingType 'one_two_family' is not stated by the quote ('For detached and zero lot line buildings', §23-342). One/two-family semi-detached or attached buildings fall under the attached/semi-detached rule, so this rule overlaps with and contradicts it. The term is not defined anywhere in the vault. |
| ALL.rear.heightBreak | FAIL (does not support claim): when has only lotType=interior. The 75 ft break is stated only for detached/zero lot line buildings and for attached/semi-detached lots 40 ft or wider (§23-342). Attached/semi-detached lots under 40 ft have a flat 30 ft rear yard with no break, so the rule is not supported for them. |
| R6up.front.none | PASS |
| R5.front | PASS |
| R6up.side.none | PASS |
| R5.side.none.md | PASS |
| R6A.base.min | PASS |
| R6A.base.max.std | PASS |
| R6A.height.max.std | PASS |
| R6A.base.max.qah | PASS |
| R6A.height.max.qah | PASS |
| R6B.base.min | PASS |
| R6B.base.max.std | PASS |
| R6B.height.max.std | PASS |
| R6B.base.max.qah | PASS |
| R6B.height.max.qah | PASS |
| R7A.base.min | PASS |
| R7A.base.max.std | PASS |
| R7A.height.max.std | PASS |
| R7A.base.max.qah | PASS |
| R7A.height.max.qah | PASS |
| R8A.base.min | PASS |
| R8A.base.max.std | PASS |
| R8A.height.max.std | PASS |
| R8A.base.max.qah | PASS |
| R8A.height.max.qah | PASS |
| R6.base.min.w100 | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.base.max.std.w100 | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.height.max.std.w100 | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.base.max.qah.w100 | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.height.max.qah.w100 | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.base.min.n | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.base.max.std.n | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.height.max.std.n | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.base.max.qah.n | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.height.max.qah.n | PASS (quote footnote part matches; the "Footnote N:" label is added text and is not on the page) |
| R6.setback.wide | PASS |
| R6.setback.narrow | PASS |
| R6A.setback.wide | PASS |
| R6A.setback.narrow | PASS |
| R6B.setback.wide | PASS |
| R6B.setback.narrow | PASS |
| R7A.setback.wide | PASS |
| R7A.setback.narrow | PASS |
| R8A.setback.wide | PASS |
| R8A.setback.narrow | PASS |
| R5.setback.wide | PASS |
| R5.setback.narrow | PASS |
| R5.base.max | PASS |
| R5.height.max | PASS |
| R6.sep.initialSetback.narrow | PASS |
| R6.sep.initialSetback.wide | PASS |
| R6.sep.startHeight | PASS |
| R6.sep.slope.narrow | PASS |
| R6.sep.slope.wide | PASS |
| R6.sep.frontWallMax | PASS |

## Caveats on PASS rules (not failures)
- Rear yards (ALL.rear.*): §23-342 is headed "Standard lots" and has a shallow-lot reduction (claim 13). The rules state the standard baseline without the shallow-lot case. Treated as PASS because the reduction only lowers the requirement, so the baseline is conservative.
- R6 sky exposure plane (R6.sep.*): elective under §23-731 (note field). The rules cover R6 only; R7 without a letter suffix is also in §23-736 scope but is not in this rule set. The six-story limit is not modelled (note field).
- R5 front yard (R5.front): the §23-321 reduction for qualifying residential sites of 150 ft or wider is not modelled.
- R5 multiple dwelling coverage (R5.cov.res.md.*): §23-361 says "where permitted". Permission is not modelled.
- R6 FAR (R6.far.res.std / R6.far.res.qah, and the within100ftWideStreet variants): depends on the footnote-1 placement interpretation in claim 3 and M1. The raw HTML confirms the sup is on R6 in the R6A row.
- Footnote quotes (R6.*.w100 and R6.*.n): the "Footnote N:" label is added text. The footnote wording after it matches the page.

## Judgement calls
- 23-362 coverage (10 rules FAIL): the rule is not scoped to standard lots, but the page scopes these values to standard lots and gives different eligible-site values in the same section. Coverage is FAILed because an unscoped rule overstates allowed coverage for eligible sites. Rear-yard shallow-lot reductions are treated as PASS because they lower the requirement.
- ALL.rear.detached / above75 (2 FAIL): "one_two_family" is undefined in the vault and is not in the quoted text. A narrower buildingType list (detached, zero_lot_line, multiple_dwelling_detached) would be supported.

## Counts
- Rules: 106
- PASS: 93
- FAIL: 13
- UNREACHABLE: 0

## Re-check 2026-10-25
Scope: the rules changed after the first pass. Sources: https://zr.planning.nyc.gov/article-ii/chapter-3/23-362 (Last Amended 12/5/2024) and https://zr.planning.nyc.gov/article-ii/chapter-3/23-342 (Last Amended 12/5/2024), fetched with curl on 2026-10-25 and converted with zrtext.py (run with python3 -I).

Checks: each quote matched against the page text after whitespace normalisation. Value, unit and when-scope read against the page. For 23-362, the page header lists districts as "R6 R7 R8 R9 R10 R11 R12" and the letter-suffix districts (R6A, R6B, R7A, R8A) are read as members of those series.

| rule id | verdict | reason |
|---|---|---|
| R6.cov.res.interior | PASS | 23-362 "For standard lots": interior/through 80 percent; when.siteCategory="standard" now matches the scope |
| R6.cov.res.corner | PASS | 23-362 "For standard lots": corner 100 percent |
| R6A.cov.res.interior | PASS | as R6.cov.res.interior |
| R6A.cov.res.corner | PASS | as R6.cov.res.corner |
| R6B.cov.res.interior | PASS | as R6.cov.res.interior |
| R6B.cov.res.corner | PASS | as R6.cov.res.corner |
| R7A.cov.res.interior | PASS | as R6.cov.res.interior |
| R7A.cov.res.corner | PASS | as R6.cov.res.corner |
| R8A.cov.res.interior | PASS | as R6.cov.res.interior |
| R8A.cov.res.corner | PASS | as R6.cov.res.corner |
| ALL.rear.detached | PASS | 23-342 "For detached and zero lot line buildings": 20 ft to 75 ft. buildingType is now [detached, zero_lot_line]; the earlier one_two_family term is gone |
| ALL.rear.detached.above75 | PASS | 23-342 same clause: 30 ft above 75 ft, where permitted |
| ALL.rear.heightBreak.detached | PASS | 23-342 same clause: 75 ft height break |
| ALL.rear.heightBreak.attached.widelot | PASS | 23-342 "for zoning lots with a lot width of 40 feet or greater": 75 ft break, 20 ft / 30 ft |

Re-check counts: 14 rules checked, PASS 14, FAIL 0, UNREACHABLE 0.
Caveat carried forward (unchanged): the 23-342 shallow-lot reduction is not modelled. It only lowers the rear-yard requirement, so the baseline stays conservative.

## Commercial rules 2026-10-25

Scope: nyc-zr-commercial.json (23 rules, residentialEquivalents, commercialOverlays, splitLot). JSON not edited. Verifier: verifier (Haiku 5.5), 2026-10-25.

Method: ZR pages re-fetched with curl -sL and converted with zrtext.py: 34-112, 34-111, 77-22, 77-28, 77-02, 33-121, 33-122, 33-123, 43-12, 43-122, 43-43. Raw HTML table grids (colspan/rowspan) built for 33-121 and 43-43 to confirm column order. Quotes matched token-wise with " ; ", " — ", "Row:", "/" and "(…)" labels treated as separators. Each quote segment was checked against the source. Last Amended stamps checked against each citation. Claim numbers checked against the Verified column of commercial-rules-and-uses.md (rows 24, 26, 29, 31, 32, 38, 40, 42, 43, 49, 53, 54: all PASS).

Notes on PASS verdicts: the 34-112, 33-122 and 33-123 quotes join a verbatim sentence to a verbatim table row with "Row:"; each part appears in the source and the row sits under the stated column. The 43-43 narrow/wide mapping is confirmed by the raw grid: Initial Setback = [On Narrow Street, On Wide street] (20, 15); Slope = [Narrow V:H, Wide V:H] (M1-1 1:1 / 1:1; M1-2 2.7:1 / 5.6:1).

| id | verdict | reason |
|---|---|---|
| citation:residentialEquivalents[C4-4A] (34-112, claim 29) | PASS | Sentence and row "C1-6A C2-6A C4-4A C4-4L C4-5A" then "R7A" verbatim; Last Amended 12/5/2024; claim 29 PASS. |
| citation:commercialOverlays (34-111, claim 26) | PASS | Quote verbatim incl. Greater Transit Zone exception; C1-1..C2-5 list present on page; Last Amended 12/5/2024; claim 26 PASS. |
| citation:splitLot.farMethod (77-22, claim 53) | PASS | Quote verbatim; Last Amended 12/5/2024; claim 53 PASS. "area_weighted" label is a reading of "percentage of the zoning lot", not a quoted term. |
| citation:splitLot.heightSetback (77-28, claim 54) | PASS | Quote verbatim; Last Amended 12/5/2024; claim 54 PASS. |
| citation:splitLot.portions (77-02, claim 49) | PASS | Quote verbatim; Last Amended 12/5/2024; claim 49 PASS. |
| overlay.inR6.far.commercial | FAIL (quote not found) | Quote header "Row (District ; Column A commercial only ; Column B community facility only ; Column C both)" is paraphrased; source reads "Column A / For Zoning Lots Containing only Commercial use" etc. Row "R6 R6-1 R7-1 ; 2.00 ; 4.80 ; 4.80" and Column A = 2.00 verified. |
| overlay.inR6A.far.commercial | FAIL (quote not found) | Same header paraphrase as overlay.inR6.far.commercial. Row "R6A R7B ; 2.00 ; 3.00 ; 3.00" and Column A = 2.00 verified. |
| overlay.inR7A.far.commercial | FAIL (quote not found) | Same header paraphrase. Row "R7A R8B ; 2.00 ; 4.00* ; 4.00" verified (asterisk present in source). |
| overlay.inR8A.far.commercial | FAIL (quote not found) | Same header paraphrase. Row "R7-2 R7-3 R8 R8A ; 2.00 ; 6.50 ; 6.50" verified. |
| overlay.inR6B.far.commercial | FAIL (quote not found) | Same header paraphrase. Row "R5D R6B ; 2.00 ; 2.00 ; 2.00" verified. |
| C4-4A.far.commercial (33-122, claim 31) | PASS | Sentence and row "C4-4A C4-4L C4-5A C4-5X C5-1 C7-3 ; 4.00" verbatim; Last Amended 12/5/2024; claim 31 PASS. |
| C4-4A.far.cf (33-123, claim 32) | PASS | Sentence and row "C1-6A C2-6A C4-4A C4-4L C4-5A C7-3 ; 4.00" verbatim; Last Amended 12/5/2024; claim 32 PASS. |
| M1-1.far.mfg (43-12, claim 38) | PASS | Row "M1-1 ; 1.00" verbatim; Last Amended 6/6/2024; claim 38 PASS. |
| M1-2.far.mfg (43-12, claim 38) | PASS | Row "M1-2* M1-4 M2-1 M2-3 M3 ; 2.00" verbatim; footnote on Queens CD 1 (4.0) confirmed on page but not part of quote; claim 38 PASS. |
| M1-1.far.cf (43-122, claim 40) | PASS | Row "M1-1 ; 2.40" verbatim; Last Amended 9/21/2011; claim 40 PASS. |
| M1-2.far.cf (43-122, claim 40) | PASS | Row "M1-2 ; 4.80" verbatim; Last Amended 9/21/2011; claim 40 PASS. |
| M1-1.sep.initialSetback.narrow (43-43, claim 42) | PASS | Raw grid: first sub-column under Initial Setback is "On Narrow Street"; M1-1 row value 20. Last Amended 8/14/2025; claim 42 PASS. |
| M1-1.sep.initialSetback.wide (43-43, claim 42) | PASS | Second sub-column "On Wide street"; M1-1 value 15. Claim 42 PASS. |
| M1-1.sep.startHeight (43-43, claim 42) | PASS | "Height above Street Line (in feet)" = 30 for M1-1. Claim 42 PASS. |
| M1-1.sep.frontWallMax (43-43, claim 42) | PASS | "30 feet or 2 stories, whichever is less" for M1-1; value 30 ft matches; story limit noted as not modelled. Claim 42 PASS. |
| M1-1.sep.slope.narrow (43-43, claim 42) | PASS | Slope "On Narrow Street" for M1-1 = "1 to 1". Claim 42 PASS. |
| M1-1.sep.slope.wide (43-43, claim 42) | PASS | Slope "On Wide Street" for M1-1 = "1 to 1". Claim 42 PASS. |
| M1-2.sep.initialSetback.narrow (43-43, claim 43) | PASS | M1-2 row value 20 in On Narrow Street column. Claim 43 PASS. |
| M1-2.sep.initialSetback.wide (43-43, claim 43) | PASS | M1-2 row value 15 in On Wide street column. Claim 43 PASS. |
| M1-2.sep.startHeight (43-43, claim 43) | PASS | "Height above Street Line" = 60 for M1-2. Claim 43 PASS. |
| M1-2.sep.frontWallMax (43-43, claim 43) | PASS | "60 feet or 4 stories, whichever is less" for M1-2; value 60 ft matches. Claim 43 PASS. |
| M1-2.sep.slope.narrow (43-43, claim 43) | PASS | Slope "On Narrow Street" for M1-2 = "2.7 to 1". Claim 43 PASS. |
| M1-2.sep.slope.wide (43-43, claim 43) | PASS | Slope "On Wide street" for M1-2 = "5.6 to 1". Claim 43 PASS. |

Counts: 28 items checked (5 citations + 23 rules): PASS 23, FAIL (quote not found) 5, FAIL (does not support claim) 0, FAIL (number mismatch) 0, UNREACHABLE 0.


## Manager fix 2026-10-25 (commercial overlay quotes)
The five overlay.in*.far.commercial quotes had a paraphrased header. They now use the verbatim header that the verifier supplied. The manager re-fetched https://zr.planning.nyc.gov/article-iii/chapter-3/33-121 and confirmed the header text "Column A For Zoning Lots Containing only Commercial use | Column B For Zoning Lots Containing only Community facility use | Column C For Zoning Lots Containing both Commercial and Community facility uses" is present. Rows and values are unchanged (the verifier had already confirmed them), so all 5 now count as PASS. Commercial rules: 28/28 PASS.
