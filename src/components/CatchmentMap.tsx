import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  Popup,
  LngLatBounds,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CatchmentDistrict } from "../lib/catchment";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

type Props = {
  origin: { lat: number; lon: number; label: string };
  radiusKm: number;
  roadFactor: number;
  districts: CatchmentDistrict[];
  onSelectDistrict?: (id: string) => void;
  selectedDistrictId?: string | null;
  height?: number;
};

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

function circlePolygon(lon: number, lat: number, radiusKm: number, steps = 64): Feature<Polygon> {
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
  const onSelectRef = useRef(onSelectDistrict);
  onSelectRef.current = onSelectDistrict;

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE,
      center: [origin.lon, origin.lat],
      zoom: 7,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    popupRef.current = new Popup({ closeButton: true, maxWidth: "260px" });

    map.on("load", () => {
      map.addSource("catchment-ring", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "catchment-fill",
        type: "fill",
        source: "catchment-ring",
        paint: { "fill-color": "#1f6b4a", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "catchment-line",
        type: "line",
        source: "catchment-ring",
        paint: { "line-color": "#1f6b4a", "line-width": 2, "line-opacity": 0.85 },
      });

      map.addSource("facility", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "facility-point",
        type: "circle",
        source: "facility",
        paint: {
          "circle-radius": 9,
          "circle-color": "#c4a35a",
          "circle-stroke-color": "#14201a",
          "circle-stroke-width": 2,
        },
      });

      map.addSource("districts", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "district-points",
        type: "circle",
        source: "districts",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "surplus"], 0, 5, 50, 8, 200, 14, 500, 18],
          "circle-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#b7791f",
            ["interpolate", ["linear"], ["get", "intensity"], 0, "#93c5fd", 1, "#1d4ed8"],
          ],
          "circle-opacity": 0.9,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.25,
        },
      });
      map.addLayer({
        id: "district-labels",
        type: "symbol",
        source: "districts",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.25],
          "text-anchor": "top",
          "text-optional": true,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#14201a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      map.on("mouseenter", "district-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "district-points", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "district-points", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f?.properties || f.geometry.type !== "Point") return;
        const id = String(f.properties.id);
        onSelectRef.current?.(id);
        const coords = (f.geometry as Point).coordinates as [number, number];
        popupRef.current
          ?.setLngLat(coords)
          .setHTML(
            `<strong>${f.properties.name}, ${f.properties.state}</strong><br/>${f.properties.surplus} KTPA · ${f.properties.distance} km · ${f.properties.pct}%`
          )
          .addTo(map);
      });

      readyRef.current = true;
      requestAnimationFrame(() => map.resize());
    });

    mapRef.current = map;
    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data + camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (!map.getSource("catchment-ring")) return;
      const geoRadiusKm = radiusKm / Math.max(roadFactor, 0.01);
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
        features: districts.map((d) => ({
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
      for (const d of districts) b.extend([d.lon, d.lat]);
      if (districts.length) {
        map.fitBounds(b, { padding: 56, maxZoom: 8.5, duration: 600 });
      } else {
        map.easeTo({ center: [origin.lon, origin.lat], zoom: 7, duration: 600 });
      }
      map.resize();
    };

    if (readyRef.current && map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [origin.lat, origin.lon, origin.label, radiusKm, roadFactor, districts, selectedDistrictId]);

  return (
    <div className="map-shell" style={{ height }}>
      <div ref={containerRef} className="map-canvas" />
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
      <div className="map-credit">MapLibre · OpenFreeMap · OSM</div>
    </div>
  );
}
