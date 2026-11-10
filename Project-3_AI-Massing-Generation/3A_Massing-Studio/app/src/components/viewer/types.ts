import type { MultiPolygon, Polygon, Prism, Program } from "@wxy/massing";

export type ViewerStyle = "model" | "diagram";
export type CameraPreset = "axon-ne" | "axon-sw" | "plan" | "street";

export interface ViewerOption {
  id: string;
  prisms: Prism[];
  /** Short label, e.g. "Perimeter courtyard"; also used in the aria-live description. */
  label: string;
}

export interface EnvelopeSection {
  /** Elevation (ft) at which this section is sampled. Drawn as a band up to the next section's z. */
  z: number;
  polygons: MultiPolygon;
}

export interface ContextBuilding {
  polygon: Polygon;
  height: number;
}

export interface SunState {
  /** Direction TOWARD the sun, engine frame (x east, y north, z up). Need not be normalised. */
  dir: [number, number, number];
  enabled: boolean;
}

export interface CameraSnapshot {
  azimuth: number;
  polar: number;
  distance: number;
  /** Orbit target in three world coordinates (see camera.ts). */
  target: [number, number, number];
}

export const PROGRAM_LABEL: Record<Program, string> = {
  residential: "RES",
  commercial: "COM",
  community_facility: "CF",
};
