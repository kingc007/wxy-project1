import type { MultiPolygon, Polygon } from "@wxy/massing";
import { boundsOf } from "./mesh";
import { sceneFrame, type SceneFrame } from "./camera";
import type { EnvelopeSection, ViewerOption } from "./types";

/**
 * Stable framing from the lot, the envelope sections and EVERY option (not just the selected one),
 * so switching the selected option never shifts the world or the camera.
 */
export function computeFrame(
  options: ViewerOption[],
  lot?: MultiPolygon,
  envelopeSections?: EnvelopeSection[],
  marginFt = 0,
): SceneFrame {
  const prisms = options.flatMap((o) => o.prisms);
  const extra: Polygon[] = [...(lot ?? []), ...(envelopeSections ?? []).flatMap((s) => s.polygons)];
  const b = boundsOf(prisms, extra);
  const maxEnvZ = Math.max(0, ...(envelopeSections ?? []).map((s) => s.z));
  if (b && maxEnvZ > b.max[2]) b.max[2] = maxEnvZ;
  return sceneFrame(b, marginFt);
}
