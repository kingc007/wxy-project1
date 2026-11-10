"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./site-map.css";
import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";
import type { GeoJSONSource, Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import type { Ring } from "@/lib/types";
import { bbox, hatchSegments, type Pt } from "@/lib/geometry/polygon";
import { MAP_FLY, NYC_WIDE } from "@/lib/motion";
import { useThemeColors, type ThemeColors } from "./use-theme-colors";

export interface MapDistrict {
  code: string;
  kind: string;
  geometry4326?: Ring[];
}

export interface SiteMapProps {
  lot4326: Ring | null;
  neighbors4326: Ring[];
  districts: MapDistrict[];
  center?: [number, number];
  /** optional, used only for the accessible name */
  bbl?: string | null;
  className?: string;
  /** Fly in from the wide NYC view to the lot when the map first loads (zoom arrival). Read once, at mount. */
  arrive?: boolean;
}

// MapLibre 6 derives its worker URL from import.meta.url and gives up unless that is http(s), which is not the
// case under the bundler. Point it at the bundled, self-contained worker file instead (no network service).
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const SRC = { neighbors: "neighbors", districts: "districts", lot: "lot", hatch: "hatch" } as const;

const closed = (r: Ring): Ring => {
  if (r.length === 0) return r;
  const a = r[0];
  const b = r[r.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? r : [...r, a];
};

function overlayKind(kind: string) {
  return kind !== "base";
}

/** Build GeoJSON for the map. Hatch is computed in a local planar frame so lines are true 45 degrees. */
export function buildSiteGeoJSON(props: Pick<SiteMapProps, "lot4326" | "neighbors4326" | "districts">) {
  const neighbors: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: props.neighbors4326.map((r) => ({
      type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closed(r)] },
    })),
  };
  const districts: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: props.districts.flatMap((d) =>
      (d.geometry4326 ?? []).map((r) => ({
        type: "Feature" as const,
        properties: { code: d.code, overlay: overlayKind(d.kind) },
        geometry: { type: "LineString" as const, coordinates: closed(r) },
      })),
    ),
  };
  let lot = EMPTY;
  let hatch = EMPTY;
  if (props.lot4326 && props.lot4326.length >= 3) {
    lot = {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closed(props.lot4326)] } }],
    };
    const lat0 = props.lot4326[0][1];
    const lon0 = props.lot4326[0][0];
    const k = Math.cos((lat0 * Math.PI) / 180);
    const local: Pt[] = props.lot4326.map(([lon, lat]) => [(lon - lon0) * k, lat - lat0]);
    const bb = bbox(local);
    const spacing = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 18;
    const segs = hatchSegments(local, spacing);
    hatch = {
      type: "FeatureCollection",
      features: segs.map(([a, b]) => ({
        type: "Feature" as const, properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: [[a[0] / k + lon0, a[1] + lat0], [b[0] / k + lon0, b[1] + lat0]],
        },
      })),
    };
  }
  return { neighbors, districts, lot, hatch };
}

function baseStyle(c: ThemeColors): StyleSpecification {
  // No tiles, no glyphs, no sprites: nothing is fetched from any third-party service.
  return {
    version: 8,
    sources: {},
    layers: [{ id: "paper", type: "background", paint: { "background-color": c.paper2 } }],
  };
}

function applyColors(map: MlMap, c: ThemeColors) {
  const set = (layer: string, prop: "line-color" | "fill-color" | "background-color", value: string) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };
  set("paper", "background-color", c.paper2);
  set("neighbors-fill", "fill-color", c.paper);
  set("neighbors-line", "line-color", c.ruleStrong);
  set("districts-base", "line-color", c.ink2);
  set("districts-overlay", "line-color", c.ink2);
  set("lot-fill", "fill-color", c.ink);
  set("lot-hatch", "line-color", c.ink3);
  set("lot-line", "line-color", c.ink);
}

function addLayers(map: MlMap, c: ThemeColors) {
  for (const id of Object.values(SRC)) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY });
  }
  map.addLayer({ id: "neighbors-fill", type: "fill", source: SRC.neighbors, paint: { "fill-color": c.paper, "fill-opacity": 0.7 } });
  map.addLayer({ id: "neighbors-line", type: "line", source: SRC.neighbors, paint: { "line-color": c.ruleStrong, "line-width": 0.75 } });
  map.addLayer({
    id: "districts-base", type: "line", source: SRC.districts, filter: ["==", ["get", "overlay"], false],
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: { "line-color": c.ink2, "line-width": 1.5, "line-dasharray": [5, 3] },
  });
  map.addLayer({
    id: "districts-overlay", type: "line", source: SRC.districts, filter: ["==", ["get", "overlay"], true],
    paint: { "line-color": c.ink2, "line-width": 1.5, "line-dasharray": [1, 2.5] },
  });
  map.addLayer({ id: "lot-fill", type: "fill", source: SRC.lot, paint: { "fill-color": c.ink, "fill-opacity": 0.07 } });
  map.addLayer({ id: "lot-hatch", type: "line", source: SRC.hatch, paint: { "line-color": c.ink3, "line-width": 0.75, "line-opacity": 0.8 } });
  map.addLayer({ id: "lot-line", type: "line", source: SRC.lot, layout: { "line-join": "miter" }, paint: { "line-color": c.ink, "line-width": 2.25 } });
}

function ringCentroidish(r: Ring): [number, number] {
  const bb = bbox(r as Pt[]);
  return [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2];
}

export function SiteMap({ lot4326, neighbors4326, districts, center, bbl, className, arrive = true }: SiteMapProps) {
  const colors = useThemeColors();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Marker[]>([]);
  const colorsRef = useRef(colors);
  const data = useMemo(() => buildSiteGeoJSON({ lot4326, neighbors4326, districts }), [lot4326, neighbors4326, districts]);
  const dataRef = useRef(data);
  const actionsRef = useRef<{ push: () => void; fit: (fly: boolean) => void } | null>(null);
  const arriveRef = useRef(arrive);
  const fitRef = useRef<{ lot: Ring | null; center?: [number, number] }>({ lot: lot4326, center });

  // Keep the latest props in refs for the map callbacks. Declared before the create effect so it runs first.
  useEffect(() => {
    colorsRef.current = colors;
    dataRef.current = data;
    fitRef.current = { lot: lot4326, center };
  });

  // Refit only when the lot itself changes (a fresh array identity alone, e.g. from a parent re-render, must not move the camera).
  const lotKey = lot4326 && lot4326.length ? `${lot4326.length}:${lot4326[0].join(",")}` : (center ?? []).join(",");

  const codes = districts.map((d) => d.code);
  const label = `Map of lot ${bbl ?? "(unknown BBL)"} in ${codes.length ? codes.join(", ") : "no districts found"}`;

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Zoom arrival: start from the wide NYC view and fly to the lot. Reduced motion (or no arrival): start at the lot and jump.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fly = arriveRef.current && !reduced;
    const map = new maplibregl.Map({
      container: el,
      style: baseStyle(colorsRef.current),
      center: fly ? NYC_WIDE.center : (fitRef.current.center ?? fitRef.current.lot?.[0] ?? [-73.98, 40.73]),
      zoom: fly ? NYC_WIDE.zoom : 16,
      attributionControl: false,
      maxZoom: 21,
      cooperativeGestures: true,
    });
    mapRef.current = map;
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 96, unit: "imperial" }), "bottom-left");
    map.getCanvas().setAttribute("aria-label", "Map canvas. Arrow keys pan, plus and minus zoom.");
    map.on("load", () => {
      addLayers(map, colorsRef.current);
      readyRef.current = true;
      push();
      fit(fly);
    });

    function push() {
      const d = dataRef.current;
      (map.getSource(SRC.neighbors) as GeoJSONSource | undefined)?.setData(d.neighbors);
      (map.getSource(SRC.districts) as GeoJSONSource | undefined)?.setData(d.districts);
      (map.getSource(SRC.lot) as GeoJSONSource | undefined)?.setData(d.lot);
      (map.getSource(SRC.hatch) as GeoJSONSource | undefined)?.setData(d.hatch);
    }
    function fit(animate: boolean) {
      const { lot, center: ctr } = fitRef.current;
      if (lot && lot.length >= 3) {
        const bb = bbox(lot as Pt[]);
        const small = el!.clientWidth < 520;
        // animate:true -> fitBounds uses flyTo (linear is false by default); animate:false jumps.
        map.fitBounds([[bb.minX, bb.minY], [bb.maxX, bb.maxY]], {
          padding: small ? 56 : 90, maxZoom: 20, animate, ...(animate ? MAP_FLY : {}),
        });
      } else if (ctr) {
        if (animate) map.flyTo({ center: ctr, zoom: 16, ...MAP_FLY });
        else map.jumpTo({ center: ctr, zoom: 16 });
      }
    }
    actionsRef.current = { push, fit };

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      readyRef.current = false;
      actionsRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Data changes: update the sources. The camera only moves when the lot changes.
  useEffect(() => {
    if (!readyRef.current) return;
    actionsRef.current?.push();
  }, [data]);
  useEffect(() => {
    if (!readyRef.current) return;
    actionsRef.current?.fit(false);
  }, [lotKey]);

  // Theme changes: re-apply all token colours.
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyColors(map, colors);
  }, [colors]);

  // District labels as HTML markers (no glyph server needed).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    for (const d of districts) {
      const ring = d.geometry4326?.[0];
      if (!ring || ring.length < 3) continue;
      const el = document.createElement("div");
      el.className = "site-map-district-label";
      el.dataset.overlay = String(overlayKind(d.kind));
      el.textContent = d.code;
      el.setAttribute("aria-hidden", "true");
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(ringCentroidish(ring)).addTo(map));
    }
  }, [districts]);

  return (
    <div className={`site-map relative h-full min-h-[16rem] w-full overflow-hidden ${className ?? ""}`}>
      {/* maplibre-gl.css sets .maplibregl-map to position:relative, so the map needs its own sized child */}
      <div role="region" aria-label={label} className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <ul className="sr-only" aria-label="Districts on this lot">
        {districts.map((d) => (
          <li key={`${d.code}-${d.kind}`}>{d.code} ({d.kind.replace(/_/g, " ")})</li>
        ))}
      </ul>
      <NorthArrow />
      <MapKey sample={districts[0]?.code ?? ""} hasLot={!!lot4326} hasOverlay={districts.some((d) => overlayKind(d.kind))} hasBase={districts.some((d) => !overlayKind(d.kind))} />
    </div>
  );
}

/** Key to the drawing: what the hatch, the dashed lines and the code tags mean. Static, so no geometry is invented. */
function MapKey({ sample, hasLot, hasOverlay, hasBase }: { sample: string; hasLot: boolean; hasOverlay: boolean; hasBase: boolean }) {
  if (!hasLot && !hasOverlay && !hasBase) return null;
  return (
    <ul className="site-map-legend" aria-label="Map key">
      {hasLot && (
        <li>
          <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
            <rect x="1" y="1" width="20" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M4 13 L12 1 M10 13 L18 1 M16 13 L21 5.5 M1 8.5 L5 1" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
          </svg>
          <span>Subject lot</span>
        </li>
      )}
      {hasBase && (
        <li>
          <svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="7 4" /></svg>
          <span>Zoning district boundary</span>
        </li>
      )}
      {hasOverlay && (
        <li>
          <svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.5 3.5" /></svg>
          <span>Overlay boundary</span>
        </li>
      )}
      {(hasBase || hasOverlay) && (
        <li>
          <span aria-hidden="true" className="site-map-district-label" style={{ position: "static" }}>{sample}</span>
          <span>District code</span>
        </li>
      )}
    </ul>
  );
}

function NorthArrow() {
  return (
    <svg className="site-map-north" width="28" height="40" viewBox="0 0 28 40" role="img" aria-label="North is up">
      <path d="M14 2 L22 28 L14 23 L6 28 Z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="miter" />
      <path d="M14 2 L14 23 L6 28 Z" fill="currentColor" />
      <text x="14" y="38" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="currentColor">N</text>
    </svg>
  );
}
