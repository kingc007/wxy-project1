// "Real lots" + "Paste envelope JSON" UI, injected into the app's SiteStep / SiteChooser by the build (see vite.config.ts).
// Real lots are ZoningEnvelope JSON files (schema-validated here with the app's own validateEnvelope) loaded through
// the app's own loadEnvelope(), exactly like the "Load envelope (.json)" file upload.
import { useMemo, useState } from "react";
import { fmtInt, validateEnvelope } from "@wxy/massing";
import { loadEnvelope } from "@/lib/studio/actions";
import { summarizeRawEnvelope } from "@/lib/studio/samples";
import { farSummary } from "@/lib/studio/format";
import { useStudio } from "@/lib/store/studio";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import REAL from "virtual:real-lots";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});

const VALID = (REAL as unknown[]).filter((e) => validateEnvelope(e).ok);

const BORO: Record<string, string> = { MN: "Manhattan", BK: "Brooklyn", BX: "Bronx", QN: "Queens", SI: "Staten Island" };
/** Address from envelope.site (e.g. "270 East 3 Street, Manhattan"), else the envelope id. */
function lotLabel(env: unknown, id: string): string {
  const site = obj(obj(env).site);
  const a = typeof site.address === "string" ? site.address.trim() : "";
  if (!a) return id;
  const t = a.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  const b = typeof site.borough === "string" ? BORO[site.borough] : undefined;
  return b ? `${t}, ${b}` : t;
}

function outline(env: unknown): string {
  const raw = obj(obj(env).lot).polygonLocal;
  const pts = (Array.isArray(raw) ? raw : []).filter((p): p is [number, number] => Array.isArray(p) && typeof p[0] === "number");
  if (pts.length < 3) return "";
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(200 / Math.max(1e-6, x1 - x0), 140 / Math.max(1e-6, y1 - y0));
  const ox = (240 - k * (x1 - x0)) / 2, oy = (180 - k * (y1 - y0)) / 2;
  return pts.map((p, i) => `${i ? "L" : "M"}${(ox + k * (p[0] - x0)).toFixed(1)} ${(oy + k * (y1 - p[1])).toFixed(1)}`).join(" ") + " Z";
}

export function RealLots({ variant }: { variant: "rail" | "chooser" }) {
  const siteId = useStudio((s) => s.siteId);
  const model = useStudio((s) => s.model);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const rows = useMemo(() => VALID.map((e) => { const sum = summarizeRawEnvelope(e); return { env: e, sum, label: lotLabel(e, sum.id) }; }), []);
  const load = (env: unknown) => void loadEnvelope(env, null);
  const loadPasted = () => {
    try {
      load(JSON.parse(text));
    } catch {
      useStudio.getState().set({ envelopeError: "This text isn't a valid zoning envelope: it isn't readable JSON. Check it against zoning-envelope.schema.json." });
    }
  };
  const paster = (
    <div className="flex flex-col gap-1.5">
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setPaste((v) => !v)} aria-expanded={paste}>
        Paste envelope JSON
      </Button>
      {paste && (
        <>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder='{ "schemaVersion": "...", "envelopeId": "...", ... }' className="code text-[13px]" aria-label="Zoning envelope JSON" />
          <Button size="sm" className="w-fit" disabled={!text.trim()} onClick={loadPasted}>Load pasted envelope</Button>
        </>
      )}
    </div>
  );

  if (variant === "chooser") {
    return (
      <div className="flex flex-col gap-4">
        {rows.length > 0 && (
          <>
            <h3 className="display-sm text-ink">Real lots</h3>
            <ul className="grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3" aria-label="Real lots">
              {rows.map(({ env, sum, label }) => (
                <li key={sum.id} className="min-w-0">
                  <button type="button" onClick={() => load(env)} aria-label={`Load ${label}, ${sum.district}, ${sum.areaSf ? fmtInt(sum.areaSf) : "unknown"} square feet`} className="flex w-full flex-col gap-3 text-left outline-none transition-transform duration-100 active:scale-[.98] focus-visible:ring-2 focus-visible:ring-ring">
                    <svg viewBox="0 0 240 180" className="aspect-[4/3] w-full text-ink" aria-hidden>
                      <path d={outline(env)} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <span className="flex flex-col gap-0.5 border-t border-rule pt-2">
                      <span className="font-medium text-ink">{label}</span>
                      <span className="num text-sm text-ink-3">{sum.district} district, {sum.areaSf ? fmtInt(sum.areaSf) : "?"} sf lot</span>
                      <span className="mt-1 text-sm font-semibold text-signal underline underline-offset-4">Use this site</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {paster}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <>
          <p className="font-medium text-ink">Real lots</p>
          <ul className="flex flex-col divide-y divide-rule" aria-label="Real lots">
            {rows.map(({ env, sum, label }) => {
              const sel = siteId === "upload" && model?.envelopeId === sum.id;
              return (
                <li key={sum.id}>
                  <button type="button" aria-pressed={sel} onClick={() => load(env)} aria-label={`${label}, ${sum.district}, ${sum.lotType} lot, ${sum.areaSf ? fmtInt(sum.areaSf) : "unknown"} square feet, ${farSummary(sum.maxFar)}`} className="flex w-full flex-col gap-0.5 py-2.5 text-left outline-none transition-transform duration-100 active:scale-[.98] focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={sel ? "font-medium text-accent-ink" : "font-medium text-ink"}>{label}</span>
                    <span className="num text-[13px] text-ink-3">{sum.district} district, {sum.lotType} lot</span>
                    <span className="num text-[13px] text-ink-3">{sum.areaSf ? fmtInt(sum.areaSf) : "?"} sf</span>
                    <span className="num text-[13px] text-ink-3">{farSummary(sum.maxFar)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {paster}
    </div>
  );
}
