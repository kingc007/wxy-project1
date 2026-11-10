import { buildEnvelopeModel, sectionAt, initGeometry, generateOption, DEFAULT_ASSUMPTIONS, EMPTY_SCHEDULE, DEFAULT_PARAMS } from "@wxy/massing";
import type { MassingOption, MassingParams } from "@wxy/massing";
import { squareLot } from "@wxy/massing/test-fixtures/envelopes";

export async function buildFixture(n = 2) {
  await initGeometry();
  const envelope = buildEnvelopeModel(squareLot());
  const mk = (o: Partial<MassingParams>): MassingOption => generateOption(envelope, EMPTY_SCHEDULE, DEFAULT_ASSUMPTIONS, { ...DEFAULT_PARAMS, ...o });
  const opts = [mk({ baseFloors: 4 }), mk({ baseFloors: 6, upperMode: "tower", upperFloors: 6 }), mk({ baseFloors: 3 })].slice(0, n);
  const options = opts.map((option, i) => ({ index: i + 1, option, name: `Fixture ${i + 1}`, intent: `Intent text ${i + 1}` }));
  const envelopeSections = [0, 60, 100].map((z) => ({ z, polygons: sectionAt(envelope, z) }));
  const context = [
    { polygon: { outer: [[-60, 0], [-20, 0], [-20, 40], [-60, 40]] as [number, number][], holes: [] }, height: 55, bin: "SAMPLE-1" },
    { polygon: { outer: [[120, 10], [160, 10], [160, 60], [120, 60]] as [number, number][], holes: [] }, height: 30 },
  ];
  return { envelope, envelopeSections, options, context, assumptions: DEFAULT_ASSUMPTIONS };
}
