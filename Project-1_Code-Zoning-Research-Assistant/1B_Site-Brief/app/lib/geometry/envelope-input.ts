// Local structural subset of the ZoningEnvelope schema (schemas/zoning-envelope.schema.json) used by the 3D view.
// Any full ZoningEnvelope is assignable to this interface. Only value/unit/status are needed here.

export interface EnvValue {
  value: number | null;
  unit?: string;
  status?: string;
}

export interface EnvEdge {
  index: number;
  kind: "front" | "side" | "rear" | "unknown";
  street?: { name?: string | null; width?: "wide" | "narrow" | "unknown" } | null;
}

export interface EnvSetback {
  id: string;
  appliesTo: "wide_street_frontage" | "narrow_street_frontage" | "street_frontage" | "rear" | "side";
  edgeIndices?: number[];
  startHeight: EnvValue;
  depth: EnvValue;
}

export interface EnvSkyPlane {
  id: string;
  appliesTo: "wide_street_frontage" | "narrow_street_frontage" | "street_frontage";
  edgeIndices?: number[];
  startHeight: EnvValue;
  initialSetback?: EnvValue;
  slopeVerticalPerHorizontal: EnvValue;
}

export interface EnvelopeLike {
  splitLot?: { isSplit: boolean } | null;
  lot: {
    polygonLocal: [number, number][];
    edges: EnvEdge[];
  };
  controls: {
    baseHeight: { min: EnvValue; max: EnvValue };
    maxBuildingHeight: EnvValue;
    setbacks: EnvSetback[];
    yards: { front: EnvValue; rear: EnvValue; side: EnvValue };
    skyExposure: { status: "implemented" | "not_applicable" | "manual"; note?: string | null; planes?: EnvSkyPlane[] };
  };
}
