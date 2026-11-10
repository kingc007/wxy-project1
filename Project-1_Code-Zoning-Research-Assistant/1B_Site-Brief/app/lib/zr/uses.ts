// Permitted uses by district, derived ONLY from the official ZR use tables in the corpus:
// Article II Ch 2 (22-1x, R columns), Article III Ch 2 (32-1x, C columns), Article IV Ch 2 (42-1x, M columns).
// Status is computed in code from the table symbols; nothing here is hand-entered zoning data.
// Symbol legend: research/commercial-rules-and-uses.md rows 1-2 (section 22-10): ● as-of-right, ♦ as-of-right
// with broad limits, ○ special permit, – not permitted. A cell may carry second-level letters ("● P").
import type { Citation } from "../types";
import { getSection, allSections, manifest } from "./corpus";
import type { UseGroupSummary, UseStatus, ZrSection } from "./types";

const UG_ORDER = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
// The corpus carries `parent` (not part of the app contract type).
type CorpusSection = ZrSection & { parent?: string | null };
const parentOf = (s: ZrSection) => (s as CorpusSection).parent ?? null;

const CHAPTER_PREFIX = { R: "22", C: "32", M: "42" } as const;

type Series = keyof typeof CHAPTER_PREFIX;

/** "R6A" -> {series:"R", column:"R6"}; "C4-4A" -> C4; "M1-1" -> M1; others (PARK, BPC...) -> null. */
export function districtColumn(district: string): { series: Series; column: string } | null {
  const m = /^([RCM])(\d+)/i.exec(district.trim());
  if (!m) return null;
  const series = m[1].toUpperCase() as Series;
  return { series, column: `${series}${m[2]}` };
}

function symbolStatus(cell: string): UseStatus | null {
  const c = cell.trim().charAt(0);
  if (c === "●") return "as_of_right";
  if (c === "♦") return "limited";
  if (c === "○") return "special_permit";
  if (c === "–" || c === "-" || c === "−") return "not_permitted";
  return null;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function ugTitle(sectionTitle: string): string {
  return clean(sectionTitle.replace(/^Use Group\s+[IVX]+\s*[–-]\s*/, ""));
}

function citationFor(sec: ZrSection, quote: string): Citation {
  return {
    source: "NYC Zoning Resolution",
    section: sec.id,
    title: sec.title,
    url: sec.url,
    lastAmended: sec.lastAmended,
    retrievedAt: manifest().retrievedAt,
    quote,
  };
}

function firstSentence(sec: ZrSection): string {
  const t = clean(sec.paragraphs[0]?.text ?? sec.title);
  const m = /^(.+?[.:])(?:\s|$)/.exec(t);
  return m ? m[1] : t;
}

/** Use-group sections of one chapter, keyed by numeral. */
function groupSectionsOf(prefix: string): Map<string, ZrSection> {
  const out = new Map<string, ZrSection>();
  for (const s of allSections()) {
    const m = /^(\d\d)-(\d+)$/.exec(s.id);
    if (!m || m[1] !== prefix) continue;
    const t = /^Use Group\s+([IVX]+)\b/.exec(s.title);
    if (t && parentOf(s) === `${prefix}-10`) out.set(t[1], s);
  }
  return out;
}

/** First line of the section's own prose that mentions "special permit" (verbatim), or null. */
function specialPermitLine(sec: ZrSection): string | null {
  for (const p of sec.paragraphs) {
    for (const line of p.text.split("\n")) {
      if (/special permit/i.test(line)) return clean(line);
    }
  }
  return null;
}

function summariseGroup(numeral: string, ug: ZrSection, column: string): UseGroupSummary {
  const family = allSections().filter((s) => s.id === ug.id || parentOf(s) === ug.id);
  const rows: { use: string; cell: string; status: UseStatus; quote: string; sec: ZrSection }[] = [];
  for (const sec of family) {
    for (const t of sec.tables) {
      const header = t.headers.find((h) => h.includes(column));
      if (!header) continue;
      const colIdx = header.indexOf(column);
      const firstCol = header.findIndex((h) => /^[RCM]\d+$/.test(h));
      for (const r of t.rows) {
        if (r.length !== header.length) continue;
        if (r.length > 1 && r.every((c) => c === r[0])) continue; // full-width banner row
        const status = symbolStatus(r[colIdx]);
        if (!status) continue;
        const labels = clean(r.slice(0, firstCol).filter((c, i, a) => i === 0 || c !== a[i - 1]).join(", "));
        rows.push({ use: labels, cell: clean(r[colIdx]), status, quote: r.map(clean).join(" ; "), sec });
      }
    }
  }

  const counts = { asOfRight: 0, limited: 0, specialPermit: 0, notPermitted: 0 };
  for (const r of rows) {
    if (r.status === "as_of_right") counts.asOfRight++;
    else if (r.status === "limited") counts.limited++;
    else if (r.status === "special_permit") counts.specialPermit++;
    else counts.notPermitted++;
  }
  const kinds = (Object.keys(counts) as (keyof typeof counts)[]).filter((k) => counts[k] > 0);
  let status: UseStatus = "unknown";
  if (kinds.length > 1) status = "mixed";
  else if (kinds.length === 1) {
    status = { asOfRight: "as_of_right", limited: "limited", specialPermit: "special_permit", notPermitted: "not_permitted" }[
      kinds[0]
    ] as UseStatus;
  }

  // Examples: one row per distinct status first (so a mixed group shows its spread), then fill to 3.
  const picked: typeof rows = [];
  for (const st of ["as_of_right", "limited", "special_permit", "not_permitted"] as UseStatus[]) {
    const r = rows.find((x) => x.status === st);
    if (r && picked.length < 3) picked.push(r);
  }
  for (const r of rows) if (picked.length < 3 && !picked.includes(r)) picked.push(r);

  // Residence districts: UG V/VII/VIII have prose sections only. If that prose says "special permit", report it.
  const proseSp = rows.length === 0 && column.startsWith("R") ? specialPermitLine(ug) : null;
  if (proseSp) {
    return {
      useGroup: numeral,
      title: ugTitle(ug.title),
      column,
      status: "special_permit",
      counts,
      examples: [],
      citation: citationFor(ug, proseSp),
      note: "Special permit only (prose section; no use table)",
    };
  }
  const note =
    rows.length === 0
      ? `${ug.id} has no use-table row for the ${column} column; see the section text for how Use Group ${numeral} is treated.`
      : undefined;
  return {
    useGroup: numeral,
    title: ugTitle(ug.title),
    column,
    status,
    counts,
    examples: picked.map((r) => ({
      use: r.use,
      symbol: r.cell,
      citation: citationFor(r.sec, r.quote),
    })),
    citation: citationFor(ug, firstSentence(ug)),
    ...(note ? { note } : {}),
  };
}

function summariseColumn(series: Series, column: string): UseGroupSummary[] {
  const prefix = CHAPTER_PREFIX[series];
  const groups = groupSectionsOf(prefix);
  const names = new Map<string, string>();
  for (const p of Object.values(CHAPTER_PREFIX)) for (const [n, s] of groupSectionsOf(p)) names.set(n, ugTitle(s.title));
  const chapterIntro = getSection(`${prefix}-10`);
  const out: UseGroupSummary[] = [];
  for (const numeral of UG_ORDER) {
    const ug = groups.get(numeral);
    if (ug) {
      out.push(summariseGroup(numeral, ug, column));
    } else if (chapterIntro) {
      out.push({
        useGroup: numeral,
        title: names.get(numeral) ?? `Use Group ${numeral}`,
        column,
        status: "unknown",
        counts: { asOfRight: 0, limited: 0, specialPermit: 0, notPermitted: 0 },
        examples: [],
        citation: citationFor(chapterIntro, firstSentence(chapterIntro)),
        note: `No Use Group ${numeral} section in Article ${chapterIntro.article} Chapter ${chapterIntro.chapter}`,
      });
    }
  }
  return out;
}

/**
 * Use groups for the base district's column, then for each distinct overlay column (C1/C2 overlays use the
 * commercial chapter's C1/C2 columns). Districts without a use-table column (e.g. PARK) yield no entries.
 */
export function getPermittedUses(baseDistrict: string, overlays: string[] = []): UseGroupSummary[] {
  const seen = new Set<string>();
  const out: UseGroupSummary[] = [];
  for (const d of [baseDistrict, ...overlays]) {
    const dc = districtColumn(d);
    if (!dc || seen.has(dc.column)) continue;
    seen.add(dc.column);
    out.push(...summariseColumn(dc.series, dc.column));
  }
  return out;
}
