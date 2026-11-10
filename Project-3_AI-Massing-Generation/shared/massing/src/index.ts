export * from "./types";
export * from "./format";
export {
  initGeometry,
  liveGeometryObjects,
  area,
  perimeter,
  union,
  intersect,
  difference,
  inset,
  bbox,
  isEmpty,
  rectPolygon,
  rectFromFrame,
  strip,
  makeFrame,
  toFrame,
  fromFrame,
  mpKey,
  ringSignedArea,
  normalizePolygon,
} from "./geom2d";
export type { Frame, BBox, FrameBox } from "./geom2d";
export { buildEnvelopeModel, parseEnvelope, sectionAt, envelopeInsetAt, designFrame, edgeStrip, skyExposureInsetAt, sectionKeyAt, EnvelopeParseError } from "./envelope";
export {
  PARAM_SPECS,
  PARAM_SPEC_BY_KEY,
  DEFAULT_PARAMS,
  TYPOLOGY_PRESETS,
  validateParams,
  snapParam,
  classifyTypology,
  presetParams,
} from "./grammar";
export { assignPrograms, programForFloor, floorHeight, stackingOrder, DEFAULT_ASSUMPTIONS, EMPTY_SCHEDULE } from "./program";
export { generateOption, paramsId } from "./generate";
export { buildPrisms, prismToMesh } from "./solids";
export type { PrismMesh } from "./solids";
export { computeMetrics, streetWallHeight } from "./metrics";
export { evaluateCompliance, evaluateProgramFit, overallStatus } from "./compliance";
// Builder B modules
export * from "./validate";
export * from "./sun";
export * from "./grounding";
export * from "./strategy";
