import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  Popup,
  LngLatBounds,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CatchmentDistrict } from "../lib/catchment";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

// Worker + shared must be served as sibling files (see vite copy-maplibre-worker plugin).
setWorkerUrl(`${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.mjs`);

type Props = {
  origin: { lat: number; lon: number; label: string };
  radiusKm: number;
  roadFactor: number;
  districts: CatchmentDistrict[];
  onSelectDistrict?: (id: string) => void;
  selectedDistrictId?: string | null;
  height?: number;
};

type OverlayState = {
  origin: Props["origin"];
  radiusKm: number;
  roadFactor: number;
  districts: CatchmentDistrict[];
  selectedDistrictId?: string | null;
};

function cartoStyle(): StyleSpecification {
  const key = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();
  const q = key ? `?key=${encodeURIComponent(key)}` : "";
  const path = `rastertiles/voyager/{z}/{x}/{y}.png${q}`;
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          `https://a.basemaps.cartocdn.com/${path}`,
          `https://b.basemaps.cartocdn.com/${path}`,
          `https://c.basemaps.cartocdn.com/${path}`,
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto" }],
  };
}

function circlePolygon(lon: number, lat: number, radiusKm: number, steps = 72): Feature<Polygon> {
  const coords: [number, number][] = [];
  const earth = 6371;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i * 360) / steps;
    const br = (bearing * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;
    const ang = radiusKm / earth;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br));
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
        Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2)
      );
    coords.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

function emptyFc(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function ensureOverlayLayers(map: MapLibreMap) {
  if (map.getSource("catchment-ring")) return;

  map.addSource("catchment-ring", { type: "geojson", data: emptyFc() });
  map.addLayer({
    id: "catchment-fill",
    type: "fill",
    source: "catchment-ring",
    paint: { "fill-color": "#15803d", "fill-opacity": 0.18 },
  });
  map.addLayer({
    id: "catchment-line",
    type: "line",
    source: "catchment-ring",
    paint: { "line-color": "#14532d", "line-width": 3, "line-opacity": 1 },
  });

  map.addSource("facility", { type: "geojson", data: emptyFc() });
  map.addLayer({
    id: "facility-glow",
    type: "circle",
    source: "facility",
    paint: {
      "circle-radius": 16,
      "circle-color": "#c4a35a",
      "circle-opacity": 0.35,
    },
  });
  map.addLayer({
    id: "facility-point",
    type: "circle",
    source: "facility",
    paint: {
      "circle-radius": 10,
      "circle-color": "#d4a017",
      "circle-stroke-color": "#111827",
      "circle-stroke-width": 2.5,
    },
  });

  map.addSource("districts", { type: "geojson", data: emptyFc() });
  map.addLayer({
    id: "district-points",
    type: "circle",
    source: "districts",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "surplus"], 0, 7, 25, 10, 100, 14, 300, 18, 800, 22],
      "circle-color": [
        "case",
        ["==", ["get", "selected"], 1],
        "#ea580c",
        ["interpolate", ["linear"], ["get", "intensity"], 0, "#38bdf8", 1, "#1d4ed8"],
      ],
      "circle-opacity": 0.95,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

function paintOverlay(map: MapLibreMap, state: OverlayState) {
  ensureOverlayLayers(map);
  const { origin, radiusKm, roadFactor, districts, selectedDistrictId } = state;
  const geoRadiusKm = Math.max(1, radiusKm / Math.max(roadFactor, 0.01));
  const ring = circlePolygon(origin.lon, origin.lat, geoRadiusKm);

  (map.getSource("catchment-ring") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: [ring],
  });
  (map.getSource("facility") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { label: origin.label },
        geometry: { type: "Point", coordinates: [origin.lon, origin.lat] },
      },
    ],
  });

  const max = Math.max(1, ...districts.map((d) => d.selectedSurplusKtpa));
  (map.getSource("districts") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: districts
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon))
      .map((d) => ({
        type: "Feature" as const,
        properties: {
          id: d.id,
          name: d.district,
          state: d.state,
          surplus: d.selectedSurplusKtpa,
          distance: d.distanceKm,
          pct: d.pctOfCatchment,
          intensity: d.selectedSurplusKtpa / max,
          selected: d.id === selectedDistrictId ? 1 : 0,
        },
        geometry: { type: "Point" as const, coordinates: [d.lon, d.lat] },
      })),
  });

  const b = new LngLatBounds();
  b.extend([origin.lon, origin.lat]);
  // Fit to catchment ring extent, not only district points
  for (const c of ring.geometry.coordinates[0]) b.extend(c as [number, number]);
  map.fitBounds(b, { padding: 48, maxZoom: 9, duration: 500 });
  map.resize();
}

export function CatchmentMap({
  origin,
  radiusKm,
  roadFactor,
  districts,
  onSelectDistrict,
  selectedDistrictId,
  height = 520,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<OverlayState | null>(null);
  const onSelectRef = useRef(onSelectDistrict);
  onSelectRef.current = onSelectDistrict;
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    try {
      const map = new MapLibreMap({
        container: containerRef.current,
        style: cartoStyle(),
        center: [origin.lon, origin.lat],
        zoom: 7,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
      popupRef.current = new Popup({ closeButton: true, maxWidth: "260px" });
      mapRef.current = map;

      map.on("error", (e) => {
        console.warn("map error", e.error);
      });

      let wired = false;
      const onReady = () => {
        if (cancelled || wired) return;
        wired = true;
        ensureOverlayLayers(map);
        map.on("mouseenter", "district-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "district-points", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "district-points", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const f = e.features?.[0];
          if (!f?.properties || f.geometry.type !== "Point") return;
          onSelectRef.current?.(String(f.properties.id));
          const coords = (f.geometry as Point).coordinates as [number, number];
          popupRef.current
            ?.setLngLat(coords)
            .setHTML(
              `<strong>${f.properties.name}, ${f.properties.state}</strong><br/>${f.properties.surplus} KTPA · ${f.properties.distance} km · ${f.properties.pct}%`
            )
            .addTo(map);
        });
        readyRef.current = true;
        if (pendingRef.current) paintOverlay(map, pendingRef.current);
        requestAnimationFrame(() => map.resize());
      };

      map.on("load", onReady);
      // Inline styles can be ready before 'load' listeners attach
      if (map.isStyleLoaded()) onReady();
    } catch (err) {
      setMapError(String(err));
    }

    return () => {
      cancelled = true;
      readyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state: OverlayState = { origin, radiusKm, roadFactor, districts, selectedDistrictId };
    pendingRef.current = state;
    const map = mapRef.current;
    if (!map) return;
    if (readyRef.current || map.isStyleLoaded()) {
      try {
        paintOverlay(map, state);
        readyRef.current = true;
      } catch (err) {
        console.warn("overlay paint deferred", err);
      }
    }
  }, [origin, radiusKm, roadFactor, districts, selectedDistrictId]);

  return (
    <div className="map-shell" style={{ height }}>
      {mapError ? (
        <div className="state error">Map failed to load: {mapError}</div>
      ) : (
        <div ref={containerRef} className="map-canvas" />
      )}
      <div className="map-legend">
        <span>
          <i className="dot facility" /> Facility
        </span>
        <span>
          <i className="dot district" /> District HQ (size = surplus)
        </span>
        <span>
          <i className="ring" /> Catchment (~{Math.round(radiusKm / Math.max(roadFactor, 0.01))} km geo)
        </span>
      </div>
      <div className="map-credit">MapLibre · CARTO Voyager · OSM</div>
    </div>
  );
}
