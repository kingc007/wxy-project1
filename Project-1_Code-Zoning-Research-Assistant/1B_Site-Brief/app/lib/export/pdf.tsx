// PDF memo styled as a drawing-set sheet (A3 landscape). Fonts: @react-pdf built-in Helvetica/Courier (the
// design guide's IBM Plex TTFs are not installed locally and nothing is fetched at runtime).
import React from "react";
import {
  Circle, ClipPath, Defs, Document, Font, G, Line, Page, Path, Polygon, Rect, StyleSheet, Svg, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { buildMemo, DRAFT_STAMP, type ExportOptions, type Memo } from "./memo";
import { buildPlan, type PlanModel } from "./plan";

const C = {
  paper: "#F5F3EE", paper2: "#ECE9E2", ink: "#1E2124", ink2: "#4A4F55", ink3: "#62676D",
  rule: "#CFCBC2", strong: "#8E8A82", accent: "#1F4E9E", flag: "#8A3B12",
};

// Built-in PDF fonts use WinAnsi; map anything outside it so no glyph silently drops.
const WIN_EXTRA = new Set("–—‘’‚“”„•…€™†‡‰‹›ŒœŠšŽžŸƒˆ˜");
const MAP: Record<string, string> = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "−": "-", "≈": "~", " ": " ", " ": " ", " ": " ", " ": " ", "​": "" };
export function pdfSafe(s: string): string {
  let out = "";
  for (const ch of s) {
    if (MAP[ch] !== undefined) out += MAP[ch];
    else if (ch.codePointAt(0)! < 0x100 || WIN_EXTRA.has(ch)) out += ch;
    else out += "?";
  }
  return out;
}
const t = pdfSafe;
// No automatic hyphenation: broken words in a figures table read as wrong values.
Font.registerHyphenationCallback((word) => [word]);

const PAGE_W = 1190.55, PAGE_H = 841.89;
const PLAN_W = 600, PLAN_H = 510;
const FRAME = 20, PAD_X = 40, PAD_TOP = 38, BAND = 150, TB_W = 340, TB_H = 124;

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: "Helvetica", fontSize: 9.5, paddingTop: PAD_TOP, paddingBottom: BAND + FRAME + 6, paddingHorizontal: PAD_X },
  frame: { position: "absolute", top: FRAME, left: FRAME, right: FRAME, bottom: FRAME, borderWidth: 1.4, borderColor: C.strong },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 14, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 0.8, borderBottomColor: C.strong },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 20, letterSpacing: -0.3 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.rule, paddingVertical: 3.5 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: C.ink2 },
  mono: { fontFamily: "Courier", fontSize: 9 },
  small: { fontSize: 8, color: C.ink3 },
  tag: { fontFamily: "Courier", fontSize: 7.5, color: C.ink3 },
  cite: { fontFamily: "Courier", fontSize: 8, color: C.accent },
});

function Heading({ children }: { children: string }) {
  return <Text style={s.h2} minPresenceAhead={60}>{t(children)}</Text>;
}

function FactRows({ rows }: { rows: { label: string; value: string; source: string }[] }) {
  return (
    <View>
      {rows.map((f, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={{ width: 118, fontFamily: "Helvetica-Bold", color: C.ink2 }}>{t(f.label)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.mono}>{t(f.value)}</Text>
            <Text style={s.tag}>{t(f.source)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PlanSvg({ plan }: { plan: PlanModel }) {
  const { width: W, height: H } = plan;
  const bar = plan.scaleBar;
  const grid: React.ReactNode[] = [];
  for (let x = 0; x <= W; x += 32) grid.push(<Line key={`gx${x}`} x1={x} y1={0} x2={x} y2={H} stroke={C.rule} strokeWidth={x % 128 === 0 ? 0.6 : 0.25} />);
  for (let y = 0; y <= H; y += 32) grid.push(<Line key={`gy${y}`} x1={0} y1={y} x2={W} y2={y} stroke={C.rule} strokeWidth={y % 128 === 0 ? 0.6 : 0.25} />);
  const n = plan.north;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id="planClip"><Rect x={0} y={0} width={W} height={H} /></ClipPath>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill={C.paper} stroke={C.strong} strokeWidth={0.8} />
      <G clipPath="url(#planClip)">
        <G opacity={0.55}>{grid}</G>
        {plan.neighbors.map((pts, i) => (
          <Polygon key={i} points={pts} fill={C.paper2} stroke={C.rule} strokeWidth={0.8} />
        ))}
        <Polygon points={plan.lot} fill="#FFFFFF" stroke={C.ink} strokeWidth={2} strokeLinejoin="miter" />
      </G>
      {plan.labels.map((l, i) => (
        <Text
          key={i} x={l.x} y={l.y} textAnchor="middle" transform={`rotate(${l.angle}, ${l.x}, ${l.y})`}
          style={{ fontSize: l.size, fontFamily: l.bold ? "Helvetica-Bold" : "Courier", fill: l.bold ? C.ink : C.ink2 } as never}
        >{t(l.text)}</Text>
      ))}
      {/* north arrow: plan is north-up (EPSG:2263 y = north) */}
      <Circle cx={n.x} cy={n.y} r={19} fill="none" stroke={C.ink} strokeWidth={0.8} />
      <Path d={`M ${n.x} ${n.y - 17} L ${n.x + 7} ${n.y + 9} L ${n.x} ${n.y + 4} L ${n.x - 7} ${n.y + 9} Z`} fill={C.ink} />
      <Text x={n.x} y={n.y - 24} textAnchor="middle" style={{ fontSize: 10, fontFamily: "Helvetica-Bold", fill: C.ink } as never}>N</Text>
      {/* graphic scale bar */}
      {bar && (
        <G>
          <Rect x={bar.x} y={bar.y} width={bar.px / 2} height={6} fill={C.ink} stroke={C.ink} strokeWidth={0.8} />
          <Rect x={bar.x + bar.px / 2} y={bar.y} width={bar.px / 2} height={6} fill={C.paper} stroke={C.ink} strokeWidth={0.8} />
          <Text x={bar.x} y={bar.y - 4} textAnchor="middle" style={{ fontSize: 8, fontFamily: "Courier", fill: C.ink } as never}>0</Text>
          <Text x={bar.x + bar.px / 2} y={bar.y - 4} textAnchor="middle" style={{ fontSize: 8, fontFamily: "Courier", fill: C.ink } as never}>{String(bar.ft / 2)}</Text>
          <Text x={bar.x + bar.px} y={bar.y - 4} textAnchor="middle" style={{ fontSize: 8, fontFamily: "Courier", fill: C.ink } as never}>{`${bar.ft} ft`}</Text>
          <Text x={bar.x + bar.px + 14} y={bar.y + 6} textAnchor="start" style={{ fontSize: 8, fontFamily: "Helvetica", fill: C.ink2 } as never}>Scale: graphic</Text>
        </G>
      )}
    </Svg>
  );
}

function TitleBlock({ m }: { m: Memo }) {
  const lab = { fontSize: 6.5, color: C.ink3, fontFamily: "Helvetica" } as const;
  const val = { fontSize: 9.5, fontFamily: "Helvetica-Bold" } as const;
  const cellBase = { padding: 4, borderRightWidth: 0.6, borderRightColor: C.strong } as const;
  return (
    <View fixed style={{ position: "absolute", right: FRAME + 8, bottom: FRAME + 8, width: TB_W, height: TB_H, borderWidth: 1.2, borderColor: C.ink, backgroundColor: C.paper2, flexDirection: "row" }}>
      <View style={{ flex: 1, borderRightWidth: 1.2, borderRightColor: C.ink }}>
        <View style={{ padding: 4, borderBottomWidth: 0.6, borderBottomColor: C.strong, height: 36 }}>
          <Text style={lab}>Project / site</Text>
          <Text style={val}>{t(m.site)}</Text>
        </View>
        <View style={{ padding: 4, borderBottomWidth: 0.6, borderBottomColor: C.strong, height: 28 }}>
          <Text style={lab}>Sheet title</Text>
          <Text style={val}>{t(`${m.title}${m.sample ? " (SAMPLE data)" : ""}`)}</Text>
        </View>
        <View style={{ flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: C.strong, height: 28 }}>
          <View style={{ ...cellBase, flex: 1 }}><Text style={lab}>BBL</Text><Text style={{ ...val, fontFamily: "Courier-Bold" }}>{m.bbl}</Text></View>
          <View style={{ padding: 4, flex: 1 }}><Text style={lab}>Date</Text><Text style={{ ...val, fontFamily: "Courier-Bold" }}>{m.date}</Text></View>
        </View>
        <View style={{ flexDirection: "row", flex: 1 }}>
          <View style={{ ...cellBase, flex: 1 }}><Text style={lab}>Drawn</Text><Text style={{ fontSize: 8.5 }}>{t(m.drawn)}</Text></View>
          <View style={{ padding: 4, flex: 1 }}><Text style={lab}>Checked</Text><Text style={{ fontSize: 8.5 }}>{t(m.checked)}</Text></View>
        </View>
      </View>
      <View style={{ width: 92, padding: 4, justifyContent: "space-between" }}>
        <View><Text style={lab}>Sheet no.</Text>
          <Text style={{ fontFamily: "Courier-Bold", fontSize: 24 }} render={({ pageNumber }) => `Z-${100 + pageNumber}`} />
        </View>
        <View><Text style={lab}>Sheet</Text>
          <Text style={{ fontFamily: "Courier", fontSize: 9 }} render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
        </View>
        <View><Text style={lab}>Scale</Text><Text style={{ fontSize: 8.5 }}>Graphic</Text></View>
      </View>
    </View>
  );
}

function BottomBand({ m }: { m: Memo }) {
  return (
    <>
      <View fixed style={{ position: "absolute", left: PAD_X, bottom: FRAME + 10, width: PAGE_W - 2 * PAD_X - TB_W - 250 }}>
        <Text style={{ fontSize: 8, color: C.ink2 }}>{t(m.disclaimer)}</Text>
        <Text style={{ fontSize: 7.5, color: C.ink3, marginTop: 3 }}>
          {t(`Generated ${m.date} · PLUTO ${m.plutoVersion} · ZR text as of the zr.planning.nyc.gov home page currency line: “${m.zrCurrency}”`)}
        </Text>
      </View>
      <View fixed style={{ position: "absolute", right: FRAME + TB_W + 40, bottom: FRAME + 34, transform: "rotate(-4deg)", borderWidth: 2.2, borderColor: C.flag, paddingVertical: 6, paddingHorizontal: 12 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color: C.flag }}>{t(DRAFT_STAMP)}</Text>
      </View>
    </>
  );
}

function Refs({ refs }: { refs: number[] }) {
  return <Text style={s.cite}>{refs.length ? refs.map((n) => `[${n}]`).join(" ") : "—"}</Text>;
}

function Sheet({ m, plan }: { m: Memo; plan: PlanModel | null }) {
  const cites = m.citations;
  const half = Math.ceil(cites.length / 2);
  const CiteBlock = ({ c }: { c: Memo["citations"][number] }) => (
    <View style={{ marginBottom: 7, paddingBottom: 5, borderBottomWidth: 0.5, borderBottomColor: C.rule }} wrap={false}>
      <Text style={{ fontFamily: "Helvetica-Bold" }}>
        <Text style={s.cite}>{`[${c.n}] `}</Text>{t(c.label)}{c.lastAmended ? t(` · last amended ${c.lastAmended}`) : ""}{c.title ? t(` · ${c.title}`) : ""}
      </Text>
      <Text style={{ fontFamily: "Helvetica-Oblique", marginTop: 2 }}>{t(`“${c.quote}”`)}</Text>
      <Text style={{ ...s.tag, marginTop: 2 }}>{t(c.url ?? "URL not recorded")}</Text>
    </View>
  );
  return (
    <Document title={t(`${m.title} ${m.bbl}`)} author="WXY Site Brief (draft)" subject={DRAFT_STAMP}>
      <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
        <View fixed style={s.frame} />
        <TitleBlock m={m} />
        <BottomBand m={m} />

        {/* Z-101: plan + lot facts */}
        <Text style={s.h1}>{t(m.site)}</Text>
        <Text style={{ ...s.small, marginBottom: 8 }}>{t(`Lot plan and site data · BBL ${m.bbl}${m.sample ? " · SAMPLE data" : ""}`)}</Text>
        <View style={{ flexDirection: "row", gap: 28 }}>
          <View style={{ width: PLAN_W }}>
            {plan ? <PlanSvg plan={plan} /> : (
              <View style={{ width: PLAN_W, height: 380, borderWidth: 0.8, borderColor: C.strong, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.ink2 }}>Lot geometry not available. Plan not drawn.</Text>
              </View>
            )}
            <Text style={{ ...s.small, marginTop: 4 }}>North-up lot plan from the MapPLUTO polygon (EPSG:2263, feet). Neighbouring lots shown faint. Dimensions are polygon edge lengths. Graphic scale only; not a survey.</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Heading>Lot facts</Heading>
            <FactRows rows={m.facts} />
            <Heading>Designations</Heading>
            <FactRows rows={m.designations} />
            <Heading>Review flags</Heading>
            {m.flags.length ? m.flags.map((f, i) => (
              <View key={i} style={{ ...s.row, borderLeftWidth: 2.5, borderLeftColor: C.flag, paddingLeft: 7 }} wrap={false}>
                <Text style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold", color: C.flag }}>{t(`FLAG ${f.kind.replace(/_/g, " ")}: `)}</Text>
                  {t(f.message)}{f.refs.length ? t(` ${f.refs.map((n) => `[${n}]`).join(" ")}`) : ""}
                </Text>
              </View>
            )) : <Text style={s.small}>None raised.</Text>}
          </View>
        </View>

        {/* Z-102: bulk table */}
        <View break>
          <Text style={s.h1}>Bulk controls and calculations</Text>
          <Text style={{ ...s.small, marginBottom: 6 }}>Values resolve from the cited rule table; anything unresolved prints a status label, never a number.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 28 }}>
          <View style={{ flex: 1.65 }}>
            <View style={{ ...s.row, backgroundColor: C.paper2, borderBottomColor: C.strong }} fixed>
              <Text style={{ ...s.th, width: 170 }}>Rule</Text>
              <Text style={{ ...s.th, width: 190, textAlign: "right", paddingRight: 12 }}>Value</Text>
              <Text style={{ ...s.th, flex: 1 }}>Applies because</Text>
              <Text style={{ ...s.th, width: 54 }}>Citation</Text>
            </View>
            {m.bulk.map((b, i) => (
              <View key={i} style={{ ...s.row, paddingVertical: 5 }} wrap={false}>
                <Text style={{ width: 170 }}>{t(b.label)}</Text>
                <Text style={{ ...s.mono, width: 190, textAlign: "right", paddingRight: 12, color: b.unresolved ? C.flag : C.ink }}>{t(b.value)}</Text>
                <Text style={{ flex: 1, fontSize: 8.5, color: C.ink2, paddingRight: 12 }}>{t(b.because)}</Text>
                <View style={{ width: 54 }}><Refs refs={b.refs} /></View>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Heading>Calculations</Heading>
            {m.calculations.map((c, i) => (
              <View key={i} style={s.row} wrap={false}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(c.label)}</Text>
                  <Text style={{ ...s.mono, color: c.unresolved ? C.flag : C.ink }}>{t(c.value)}</Text>
                  <Text style={s.tag}>{t(c.formula)}</Text>
                </View>
              </View>
            ))}
            {m.portions.length > 0 && (
              <View>
                <Heading>Split-lot portions</Heading>
                {m.portions.map((pt, i) => (
                  <View key={i} style={s.row} wrap={false}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(`${pt.districts} (${pt.share})`)}</Text>
                      {pt.lines.map((l, j) => <Text key={j} style={s.mono}>{t(`${l.label}: ${l.value}`)}</Text>)}
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Heading>Assumptions</Heading>
            {m.assumptions.map((a, i) => (
              <View key={i} style={s.row} wrap={false}>
                <View style={{ flex: 1 }}>
                  <Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{t(a.statement)}</Text>{t(`  [${a.state}]`)}</Text>
                  <Text style={{ fontSize: 8.5, color: C.ink2 }}>{t(a.reason)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Citations */}
        <View break>
          <Text style={s.h1}>Citations</Text>
          <Text style={{ ...s.small, marginBottom: 8 }}>Quotes are verbatim from the Zoning Resolution text retrieved for this prototype.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 28 }}>
          <View style={{ flex: 1 }}>{cites.slice(0, half).map((c) => <CiteBlock key={c.n} c={c} />)}</View>
          <View style={{ flex: 1 }}>{cites.slice(half).map((c) => <CiteBlock key={c.n} c={c} />)}</View>
        </View>
        {m.simplifications.length > 0 && (
          <View wrap={false}>
            <Heading>Simplifications in this draft</Heading>
            {m.simplifications.map((x, i) => <Text key={i} style={{ marginBottom: 2 }}>{t(`- ${x}`)}</Text>)}
          </View>
        )}
        <View wrap={false} style={{ marginTop: 14, borderTopWidth: 0.8, borderTopColor: C.strong, paddingTop: 6 }}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(DRAFT_STAMP)}</Text>
          <Text>{t(m.disclaimer)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildPdf(site: SiteData, brief: ZoningBrief, opts: ExportOptions = {}): Promise<Buffer> {
  const memo = buildMemo(site, brief, opts);
  const plan = buildPlan(site, PLAN_W, PLAN_H);
  return renderToBuffer(<Sheet m={memo} plan={plan} />);
}
