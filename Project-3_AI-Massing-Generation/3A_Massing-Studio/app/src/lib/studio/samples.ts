// Bundled SAMPLE sites (envelope + sidecar) and the SAMPLE Fort Greene context. All SAMPLE data, labelled as such in the UI.
import sampleA from "@wxy/massing/data/samples/sample-a-r7a-interior.json";
import sampleASite from "@wxy/massing/data/samples/sample-a-r7a-interior.site.json";
import sampleB from "@wxy/massing/data/samples/sample-b-r8a-corner.json";
import sampleBSite from "@wxy/massing/data/samples/sample-b-r8a-corner.site.json";
import sampleC from "@wxy/massing/data/samples/sample-c-r10-through-sep.json";
import sampleCSite from "@wxy/massing/data/samples/sample-c-r10-through-sep.site.json";
import contextData from "@wxy/massing/data/context-fort-greene.json";
import type { ContextBuilding } from "@/components/viewer/types";
import type { Polygon } from "@wxy/massing";

/** The part of the `*.site.json` sidecar the studio reads. */
export interface SiteSidecar {
  sample: boolean;
  envelopeId: string;
  lat: number;
  lng: number;
  gridAngleDeg: number;
  parkName?: string;
  removedContextBins: number[];
}

export interface SampleSite {
  id: string;
  /** Display name for the card. */
  name: string;
  envelope: unknown;
  site: SiteSidecar;
}

export const SAMPLE_SITES: SampleSite[] = [
  { id: "sample-a-r7a-interior", name: "Interior lot", envelope: sampleA, site: sampleASite as SiteSidecar },
  { id: "sample-b-r8a-corner", name: "Corner lot", envelope: sampleB, site: sampleBSite as SiteSidecar },
  { id: "sample-c-r10-through-sep", name: "Through-block site", envelope: sampleC, site: sampleCSite as SiteSidecar },
];

/**
 * Reference point for uploaded envelopes (they carry no lat/lng). SIMPLIFIED: the Fort Greene sample point.
 * The sun module shows a note when this is used.
 */
export const REFERENCE_SITE: Pick<SiteSidecar, "lat" | "lng"> = {
  lat: (sampleASite as SiteSidecar).lat,
  lng: (sampleASite as SiteSidecar).lng,
};

export interface RawEnvelopeSummary {
  id: string;
  district: string;
  lotType: string;
  areaSf: number | null;
  /** Max FAR per use, read from the raw envelope. */
  maxFar: Record<string, number>;
  sample: boolean;
  reviewFlags: string[];
  simplifications: string[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});

/** Card summary read straight from the raw JSON (no geometry needed). */
export function summarizeRawEnvelope(envelope: unknown): RawEnvelopeSummary {
  const e = obj(envelope);
  const districts = Array.isArray(e.districts) ? e.districts : [];
  const lot = obj(e.lot);
  const area = obj(lot.area).value;
  const lotType = obj(lot.lotType).value;
  const flags = obj(e.flags);
  const maxFar: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(obj(e.controls).maxFar))) {
    const val = obj(v).value;
    if (typeof val === "number") maxFar[k] = val;
  }
  const rf = Array.isArray(e.reviewFlags) ? e.reviewFlags : [];
  return {
    id: String(e.envelopeId ?? "envelope"),
    district: districts.length ? String(obj(districts[0]).code ?? "") : "",
    lotType: typeof lotType === "string" ? lotType : "unknown",
    areaSf: typeof area === "number" ? area : null,
    maxFar,
    sample: flags.sample === true,
    reviewFlags: rf.map((f) => String(obj(f).message ?? "")).filter(Boolean),
    simplifications: Array.isArray(flags.simplifications) ? flags.simplifications.map(String) : [],
  };
}

interface ContextFile {
  buildings: { bin: number; height: number; polygon: Polygon }[];
}

/** Context buildings for a sample, minus the footprints removed because they sit on the hypothetical lot. */
export function contextFor(site: SiteSidecar): ContextBuilding[] {
  const removed = new Set(site.removedContextBins);
  return (contextData as unknown as ContextFile).buildings
    .filter((b) => !removed.has(b.bin))
    .map((b) => ({ polygon: b.polygon, height: b.height }));
}
