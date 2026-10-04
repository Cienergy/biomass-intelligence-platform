import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CatchmentDistrict } from "../lib/catchment";

type Props = {
  origin: { lat: number; lon: number; label: string };
  radiusKm: number;
  roadFactor: number;
  districts: CatchmentDistrict[];
  onSelectDistrict?: (id: string) => void;
  selectedDistrictId?: string | null;
  height?: number;
};

function Fit({ origin, radiusKm }: { origin: { lat: number; lon: number }; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    const meters = (radiusKm / Math.max(1, 1)) * 1000;
    const bounds = L.latLng(origin.lat, origin.lon).toBounds(meters * 2.2);
    map.fitBounds(bounds.pad(0.15));
  }, [map, origin.lat, origin.lon, radiusKm]);
  return null;
}

export function CatchmentMap({
  origin,
  radiusKm,
  roadFactor,
  districts,
  onSelectDistrict,
  selectedDistrictId,
  height = 420,
}: Props) {
  const max = useMemo(() => Math.max(1, ...districts.map((d) => d.selectedSurplusKtpa)), [districts]);
  // Visual circle uses geographic radius ≈ transport radius / roadFactor
  const geoRadiusM = (radiusKm / Math.max(roadFactor, 0.01)) * 1000;

  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={[origin.lat, origin.lon]} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OSM" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <Fit origin={origin} radiusKm={radiusKm / Math.max(roadFactor, 0.01)} />
        <Circle
          center={[origin.lat, origin.lon]}
          radius={geoRadiusM}
          pathOptions={{ color: "#0f766e", weight: 2, fillColor: "#0d9488", fillOpacity: 0.08 }}
        />
        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={8}
          pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 1, weight: 2 }}
        >
          <Popup>
            <b>{origin.label}</b>
            <br />
            Facility location
          </Popup>
        </CircleMarker>
        {districts.map((d) => {
          const t = d.selectedSurplusKtpa / max;
          const selected = d.id === selectedDistrictId;
          return (
            <CircleMarker
              key={d.id}
              center={[d.lat, d.lon]}
              radius={5 + t * 12}
              pathOptions={{
                color: selected ? "#b45309" : "#334155",
                fillColor: selected ? "#f59e0b" : `rgba(59, 130, 246, ${0.35 + t * 0.55})`,
                fillOpacity: 0.9,
                weight: selected ? 2 : 1,
              }}
              eventHandlers={{
                click: () => onSelectDistrict?.(d.id),
              }}
            >
              <Popup>
                <b>
                  {d.district}, {d.state}
                </b>
                <br />
                {d.selectedSurplusKtpa} KTPA · {d.distanceKm} km · {d.pctOfCatchment}%
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
