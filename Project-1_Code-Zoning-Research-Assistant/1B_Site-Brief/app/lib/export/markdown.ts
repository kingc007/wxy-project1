// Markdown drawing-set memo. Text only; every number comes from the engine via buildMemo.
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { DRAFT_STAMP, buildMemo, type ExportOptions, type Memo } from "./memo";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
const refs = (r: number[]) => (r.length ? ` ${r.map((n) => `[^${n}]`).join("")}` : "");

export function memoToMarkdown(m: Memo): string {
  const L: string[] = [];
  L.push(`# ${m.title}`, "", `**${DRAFT_STAMP}**`, "");
  if (m.sample) L.push("**SAMPLE data: this memo was generated from synthetic site data.**", "");
  L.push("| Title block | |", "|---|---|");
  L.push(`| Project / Site | ${cell(m.site)} |`);
  L.push(`| BBL | ${m.bbl} |`);
  L.push(`| Sheet | ${m.sheet} |`);
  L.push(`| Date | ${m.date} |`);
  L.push(`| Drawn | ${m.drawn} |`);
  L.push(`| Checked | ${cell(m.checked)} |`, "");

  L.push("## Lot facts", "");
  for (const f of m.facts) L.push(`- ${f.label}: ${f.value} [${f.source}]`);
  L.push("", "## Designations", "");
  for (const f of m.designations) L.push(`- ${f.label}: ${f.value} [${f.source}]`);

  L.push("", "## Bulk controls", "", "| Rule | Value | Applies because | Citation |", "|---|---|---|---|");
  for (const b of m.bulk) {
    const cites = b.refs.length
      ? b.refs.map((n) => {
          const c = m.citations[n - 1];
          return `${c.label}${c.lastAmended ? ` (last amended ${c.lastAmended})` : ""} — “${c.quote}” [^${n}]`;
        }).join("; ")
      : "—";
    L.push(`| ${cell(b.label)} | ${cell(b.value)} | ${cell(b.because)} | ${cell(cites)} |`);
  }

  if (m.portions.length) {
    L.push("", "### Split-lot portions", "");
    for (const pt of m.portions) {
      L.push(`- ${pt.districts} (${pt.share})`);
      for (const l of pt.lines) L.push(`  - ${l.label}: ${l.value}`);
    }
  }

  L.push("", "## Calculations", "");
  for (const c of m.calculations) L.push(`- ${c.label}: ${c.value}${c.formula !== "—" ? ` (${c.unresolved ? "note" : "formula"}: ${c.formula})` : ""}`);

  L.push("", "## Assumptions", "");
  for (const a of m.assumptions) L.push(`- ${a.statement} [${a.state}]. Reason: ${a.reason}`);

  L.push("", "## Review flags", "");
  if (m.flags.length) for (const f of m.flags) L.push(`- ${f.kind.replace(/_/g, " ")}: ${f.message}${refs(f.refs)}`);
  else L.push("- None raised.");
  if (m.simplifications.length) {
    L.push("", "### Simplifications in this draft", "");
    for (const s of m.simplifications) L.push(`- ${s}`);
  }

  L.push("", "## Citations", "");
  for (const c of m.citations) {
    L.push(`[^${c.n}]: ${c.label}${c.lastAmended ? ` (last amended ${c.lastAmended})` : ""}${c.title ? `, ${c.title}` : ""} — “${c.quote}”${c.url ? ` <${c.url}>` : ""}`);
  }

  L.push("", "---", "", `${DRAFT_STAMP}. ${m.disclaimer}`, "",
    `Generated ${m.date} · PLUTO ${m.plutoVersion} · ZR text as of the zr.planning.nyc.gov home page currency line: “${m.zrCurrency}”`, "");
  return L.join("\n");
}

export function buildMarkdown(site: SiteData, brief: ZoningBrief, opts: ExportOptions = {}): string {
  return memoToMarkdown(buildMemo(site, brief, opts));
}
