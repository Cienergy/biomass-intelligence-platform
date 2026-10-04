import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../lib/DataContext";
import type { FeedstockId } from "../lib/types";

export function LocationPicker() {
  const {
    dataset,
    location,
    setLocation,
    radiusKm,
    setRadiusKm,
    roadFactor,
    setRoadFactor,
    feedstockFilter,
    setFeedstockFilter,
    factors,
    setFactors,
    saveSite,
  } = useData();

  const selected =
    location.mode === "district" ? dataset?.districts.find((d) => d.id === location.districtId) : null;

  const [stateName, setStateName] = useState(selected?.state || "Haryana");
  const [districtQuery, setDistrictQuery] = useState(selected?.district || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mode, setMode] = useState<"district" | "custom">(location.mode);
  const [customLat, setCustomLat] = useState(
    location.mode === "custom" ? String(location.lat) : "29.15"
  );
  const [customLon, setCustomLon] = useState(
    location.mode === "custom" ? String(location.lon) : "75.72"
  );
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.mode === "district") {
      const d = dataset?.districts.find((x) => x.id === location.districtId);
      if (d) {
        setStateName(d.state);
        setDistrictQuery(d.district);
        setMode("district");
      }
    } else {
      setMode("custom");
      setCustomLat(String(location.lat));
      setCustomLon(String(location.lon));
    }
  }, [location, dataset]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    if (!dataset) return [];
    const q = districtQuery.trim().toLowerCase();
    const pool = dataset.districts.filter((d) => d.state === stateName);
    const list = q
      ? pool.filter((d) => d.district.toLowerCase().includes(q))
      : pool;
    return [...list].sort((a, b) => a.district.localeCompare(b.district)).slice(0, 30);
  }, [dataset, stateName, districtQuery]);

  if (!dataset) return null;

  const pickDistrict = (districtId: string) => {
    const d = dataset.districts.find((x) => x.id === districtId);
    if (!d) return;
    setLocation({ mode: "district", districtId });
    setStateName(d.state);
    setDistrictQuery(d.district);
    setShowSuggestions(false);
    setMode("district");
  };

  const applyCustom = () => {
    const lat = Number(customLat);
    const lon = Number(customLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setLocation({ mode: "custom", lat, lon, label: `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E` });
    setMode("custom");
  };

  const toggleFeed = (id: FeedstockId) => {
    setFeedstockFilter(
      feedstockFilter.includes(id) ? feedstockFilter.filter((x) => x !== id) : [...feedstockFilter, id]
    );
  };

  return (
    <section className="controls-bar">
      <div className="controls-primary">
        <div className="seg">
          <button type="button" className={mode === "district" ? "active" : ""} onClick={() => setMode("district")}>
            District
          </button>
          <button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
            Coordinates
          </button>
        </div>

        {mode === "district" ? (
          <>
            <label className="field">
              <span>State</span>
              <select
                value={stateName}
                onChange={(e) => {
                  const next = e.target.value;
                  setStateName(next);
                  const first = dataset.districts
                    .filter((d) => d.state === next)
                    .sort((a, b) => a.district.localeCompare(b.district))[0];
                  if (first) pickDistrict(first.id);
                  else {
                    setDistrictQuery("");
                    setShowSuggestions(true);
                  }
                }}
              >
                {dataset.states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <div className="field field-district" ref={boxRef}>
              <span>District</span>
              <input
                aria-label="District"
                placeholder="Search or pick district…"
                value={districtQuery}
                onChange={(e) => {
                  setDistrictQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && suggestions[0]) {
                    e.preventDefault();
                    pickDistrict(suggestions[0].id);
                  }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggest">
                  {suggestions.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className={d.id === selected?.id ? "active" : ""}
                        onClick={() => pickDistrict(d.id)}
                      >
                        <strong>{d.district}</strong>
                        <em>{d.totalSurplusKtpa} KTPA</em>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span>Latitude</span>
              <input value={customLat} onChange={(e) => setCustomLat(e.target.value)} />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input value={customLon} onChange={(e) => setCustomLon(e.target.value)} />
            </label>
            <button type="button" className="btn" onClick={applyCustom}>
              Apply
            </button>
          </>
        )}

        <label className="field field-sm">
          <span>Radius</span>
          <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
            {dataset.defaults.radiiKm.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </label>

        <label className="field field-sm">
          <span>Road factor</span>
          <input
            type="number"
            min={1}
            max={2}
            step={0.05}
            value={roadFactor}
            onChange={(e) => setRoadFactor(Number(e.target.value) || 1)}
          />
        </label>

        <button type="button" className="btn ghost" onClick={() => saveSite()}>
          Save site
        </button>
      </div>

      <div className="controls-secondary">
        <div className="chips">
          <span className="chips-label">Feedstock</span>
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

        <details className="factors-inline">
          <summary>Access factors</summary>
          <div className="factors-row">
            <label>
              Collection
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
              Logistics
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
              Competing use
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
      </div>
    </section>
  );
}
