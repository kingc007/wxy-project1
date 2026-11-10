import { notFound } from "next/navigation";
import { MapPanel } from "@/components/map-panel";
import { SAMPLE_DISTRICTS, SAMPLE_ENVELOPE, SAMPLE_LOT, SAMPLE_NEIGHBORS } from "./sample";

export default function DevGeometryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-[1440px] space-y-4 p-4">
      <h1 className="text-[1.25rem] font-semibold">Map and envelope preview (dev)</h1>
      <p className="border border-flag px-3 py-2 text-[0.875rem] text-flag">
        SAMPLE geometry — not a real lot. A 25 ft by 100 ft rectangle with R7A values from research/residence-bulk-rules.md
        (base height 40 to 75 ft, building height 85 ft, street setback 15 ft, rear yard 30 ft). Front and side yards are left
        unset on purpose.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-[560px]">
          <MapPanel
            lot4326={SAMPLE_LOT} neighbors4326={SAMPLE_NEIGHBORS} districts={SAMPLE_DISTRICTS}
            bbl="SAMPLE" envelope={SAMPLE_ENVELOPE}
          />
        </div>
        <div className="h-[560px]">
          <MapPanel
            lot4326={SAMPLE_LOT} neighbors4326={SAMPLE_NEIGHBORS} districts={SAMPLE_DISTRICTS}
            bbl="SAMPLE" envelope={SAMPLE_ENVELOPE} defaultView="3d"
          />
        </div>
        <div className="h-[200px] md:col-span-2">
          <MapPanel />
        </div>
      </div>
    </main>
  );
}
