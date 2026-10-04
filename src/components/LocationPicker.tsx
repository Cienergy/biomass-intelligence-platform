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
  const [districtQuery, setDistrictQuery] = useState("");
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

  const districtsInState = useMemo(() => {
    if (!dataset) return [];
    return dataset.districts
      .filter((d) => d.state === stateName)
      .sort((a, b) => a.district.localeCompare(b.district));
  }, [dataset, stateName]);

  const suggestions = useMemo(() => {
    if (!dataset || !districtQuery.trim()) return districtsInState.slice(0, 12);
    const q = districtQuery.trim().toLowerCase();
    return dataset.districts
      .filter(
        (d) =>
          d.district.toLowerCase().includes(q) ||
          d.state.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
      )
      .sort((a, b) => a.district.localeCompare(b.district))
      .slice(0, 20);
  }, [dataset, districtQuery, districtsInState]);

  if (!dataset) return null;

  const pickDistrict = (districtId: string) => {
    const d = dataset.districts.find((x) => x.id === districtId);
    if (!d) return;
    setLocation({ mode: "district", districtId });
    setStateName(d.state);
    setDistrictQuery("");
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
                  const first = dataset.districts.find((d) => d.state === next);
                  if (first) pickDistrict(first.id);
                }}
              >
                {dataset.states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-district">
              <span>District</span>
              <select
                value={selected?.id || districtsInState[0]?.id || ""}
                onChange={(e) => pickDistrict(e.target.value)}
              >
                {districtsInState.length === 0 ? (
                  <option value="">No districts</option>
                ) : (
                  districtsInState.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.district}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="field field-search" ref={boxRef}>
              <span>Search district</span>
              <input
                placeholder="Type district or state…"
                value={districtQuery}
                onChange={(e) => {
                  setDistrictQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggest">
                  {suggestions.map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => pickDistrict(d.id)}>
                        <strong>{d.district}</strong>
                        <em>{d.state}</em>
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

      {selected && (
        <div className="selected-pill">
          Selected: <strong>{selected.district}</strong>, {selected.state}
          <span>
            {selected.lat.toFixed(2)}°N, {selected.lon.toFixed(2)}°E · {selected.totalSurplusKtpa} KTPA surplus
          </span>
        </div>
      )}
    </section>
  );
}
