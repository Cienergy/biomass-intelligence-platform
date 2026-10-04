import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import type { FeedstockId, LocationSel } from "../lib/types";

export function LocationPicker() {
  const { dataset, location, setLocation, radiusKm, setRadiusKm, roadFactor, setRoadFactor, feedstockFilter, setFeedstockFilter, factors, setFactors, saveSite } =
    useData();
  const [mode, setMode] = useState<"district" | "custom">(location.mode);
  const [state, setState] = useState(() => {
    if (location.mode === "district") return location.districtId.split("|")[0] || "";
    return dataset?.states[0] || "";
  });
  const [customLat, setCustomLat] = useState("29.15");
  const [customLon, setCustomLon] = useState("75.72");

  const districts = useMemo(() => {
    if (!dataset) return [];
    return dataset.districts.filter((d) => d.state === state).sort((a, b) => a.district.localeCompare(b.district));
  }, [dataset, state]);

  if (!dataset) return null;

  const applyDistrict = (districtId: string) => {
    setLocation({ mode: "district", districtId });
    setMode("district");
  };

  const applyCustom = () => {
    const lat = Number(customLat);
    const lon = Number(customLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setLocation({ mode: "custom", lat, lon, label: `Custom ${lat.toFixed(2)}, ${lon.toFixed(2)}` });
    setMode("custom");
  };

  const toggleFeed = (id: FeedstockId) => {
    setFeedstockFilter(
      feedstockFilter.includes(id) ? feedstockFilter.filter((x) => x !== id) : [...feedstockFilter, id]
    );
  };

  return (
    <section className="panel controls">
      <div className="panel-head">
        <h2>Location & catchment</h2>
        <p>Select a district HQ or enter coordinates. Distances use Haversine × road factor.</p>
      </div>

      <div className="seg">
        <button type="button" className={mode === "district" ? "active" : ""} onClick={() => setMode("district")}>
          District
        </button>
        <button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
          Lat / Lng
        </button>
      </div>

      {mode === "district" ? (
        <div className="grid-2">
          <label>
            State
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                const first = dataset.districts.find((d) => d.state === e.target.value);
                if (first) applyDistrict(first.id);
              }}
            >
              {dataset.states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            District
            <select
              value={location.mode === "district" ? location.districtId : districts[0]?.id || ""}
              onChange={(e) => applyDistrict(e.target.value)}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.district}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="grid-2">
          <label>
            Latitude
            <input value={customLat} onChange={(e) => setCustomLat(e.target.value)} />
          </label>
          <label>
            Longitude
            <input value={customLon} onChange={(e) => setCustomLon(e.target.value)} />
          </label>
          <button type="button" className="btn" onClick={applyCustom}>
            Apply coordinates
          </button>
        </div>
      )}

      <div className="grid-3">
        <label>
          Radius (km)
          <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
            {dataset.defaults.radiiKm.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </label>
        <label>
          Road factor
          <input
            type="number"
            min={1}
            max={2}
            step={0.05}
            value={roadFactor}
            onChange={(e) => setRoadFactor(Number(e.target.value) || 1)}
          />
        </label>
        <div className="field-actions">
          <button type="button" className="btn ghost" onClick={() => saveSite()}>
            Save to compare
          </button>
        </div>
      </div>

      <details className="factors">
        <summary>Access factors (surplus → accessible → realistic)</summary>
        <div className="grid-3">
          <label>
            Collection efficiency
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={factors.collectionEfficiency}
              onChange={(e) => setFactors({ ...factors, collectionEfficiency: Number(e.target.value) })}
            />
          </label>
          <label>
            Logistics access
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={factors.logisticsAccessFactor}
              onChange={(e) => setFactors({ ...factors, logisticsAccessFactor: Number(e.target.value) })}
            />
          </label>
          <label>
            Competing-use factor
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={factors.competingUseFactor}
              onChange={(e) => setFactors({ ...factors, competingUseFactor: Number(e.target.value) })}
            />
          </label>
        </div>
      </details>

      <div className="chips">
        <span className="chips-label">Feedstocks</span>
        <button
          type="button"
          className={`chip ${feedstockFilter.length === 0 ? "active" : ""}`}
          onClick={() => setFeedstockFilter([])}
        >
          All
        </button>
        {dataset.feedstocks.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${feedstockFilter.includes(f.id) ? "active" : ""}`}
            onClick={() => toggleFeed(f.id)}
          >
            {f.label.split(" /")[0]}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Helper unused export for typing LocationSel updates */
export type { LocationSel };
