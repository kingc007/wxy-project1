// Adapters from engine output to the viewer's props.
import { sectionAt, type EnvelopeModel, type MultiPolygon } from "@wxy/massing";
import type { EnvelopeSection, ViewerOption } from "@/components/viewer/types";
import type { OptionSlot } from "@/lib/store/logic";

const EPS = 1e-6;

/**
 * Envelope bands for the translucent wireframe. The viewer draws section i from its z up to section i+1's z, so
 * each band is sampled just below its top (setbacks start above their start height; sky-exposure insets grow upward).
 */
export function envelopeSections(model: EnvelopeModel): EnvelopeSection[] {
  const zs = model.breakHeights.length >= 2 ? model.breakHeights : [0, 150];
  const out: EnvelopeSection[] = [];
  for (let i = 0; i < zs.length - 1; i++) out.push({ z: zs[i], polygons: sectionAt(model, zs[i + 1] - EPS) });
  const last = out[out.length - 1];
  out.push({ z: zs[zs.length - 1], polygons: last ? last.polygons : ([model.lot] as MultiPolygon) });
  return out;
}

export function optionLabel(slot: OptionSlot): string {
  return `Option ${slot.index + 1} · ${slot.name}`;
}

export function viewerOption(slot: OptionSlot): ViewerOption {
  // id is stable per tile (not per params) so the camera/selection state survives live edits.
  return { id: `opt-${slot.index}`, label: optionLabel(slot), prisms: slot.option.prisms };
}

export function slotIdToIndex(id: string): number {
  return Number(id.replace("opt-", ""));
}
