// Turn a ZR section into citable blocks (one per paragraph / table caption / header row / body row / footnote).
// The block array is sent as a custom-content document, so citation block indices map straight back to anchors.
// Anchor codes match lib/zr/locate.ts: paragraph anchor, "t<n>" (caption/header/footnote), "t<n>r<m>" (body row).
import type { ZrSection } from "@/lib/zr/types";

export interface SectionBlock { anchor: string; text: string }

const flat = (s: string) => s.replace(/\s+/g, " ").trim();

export function sectionBlocks(s: ZrSection): SectionBlock[] {
  const out: SectionBlock[] = [];
  for (const p of s.paragraphs) {
    const t = flat(p.text);
    if (t) out.push({ anchor: p.anchor, text: t });
  }
  s.tables.forEach((tb, n) => {
    const a = `t${n}`;
    if (tb.caption && flat(tb.caption)) out.push({ anchor: a, text: flat(tb.caption) });
    for (const h of tb.headers) {
      const t = flat(h.join(" | "));
      if (t) out.push({ anchor: a, text: t });
    }
    tb.rows.forEach((r, m) => {
      const t = flat(r.join(" | "));
      if (t) out.push({ anchor: `${a}r${m}`, text: t });
    });
    for (const f of tb.footnotes) {
      const t = flat(f);
      if (t) out.push({ anchor: a, text: t });
    }
  });
  return out;
}
