import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { buildCatchment } from "../lib/catchment";
import { optimiseRadius } from "../lib/optimiser";
import { supplySecurityScore } from "../lib/security";
import { rankSites, type SiteSnapshot } from "../lib/compare";

export function ComparePage() {
  const {
    dataset,
    savedSites,
    removeSite,
    location,
    radiusKm,
    roadFactor,
    feedstockFilter,
    factors,
    compareWeights,
    setCompareWeights,
    saveSite,
  } = useData();

  const filter = feedstockFilter.length ? feedstockFilter : null;

  const snapshots: SiteSnapshot[] = useMemo(() => {
    if (!dataset) return [];
    return savedSites
      .map((s) => {
        const catchment = buildCatchment({
          sel: s.location,
          districts: dataset.districts,
          feedstocks: dataset.feedstocks,
          radiusKm: s.radiusKm,
          roadFactor,
          feedstockFilter: filter,
          factors,
        });
        if (!catchment) return null;
        const opt = optimiseRadius({
          sel: s.location,
          districts: dataset.districts,
          feedstocks: dataset.feedstocks,
          radiiKm: dataset.defaults.radiiKm,
          roadFactor,
          feedstockFilter: filter,
          factors,
        });
        const security = supplySecurityScore(catchment, dataset.feedstocks);
        return {
          id: s.id,
          label: s.label,
          catchment,
          security,
          optimalRadiusKm: opt?.recommendedKm ?? s.radiusKm,
        };
      })
      .filter(Boolean) as SiteSnapshot[];
  }, [dataset, savedSites, roadFactor, filter, factors]);

  const ranked = useMemo(() => rankSites(snapshots, compareWeights), [snapshots, compareWeights]);

  if (!dataset) return <div className="state">Loading…</div>;

  return (
    <div className="page">
      <div className="panel-head">
        <h1>Site comparison</h1>
        <p>Save locations from Explorer, then rank by your priorities.</p>
      </div>

      <section className="panel">
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => saveSite()}>
            Save current Explorer location ({radiusKm} km)
          </button>
          <Link className="btn ghost" to="/">
            Back to Explorer
          </Link>
        </div>

        <div className="weights">
          <h3>Ranking weights</h3>
          <div className="grid-5">
            {(
              [
                ["surplus", "Surplus"],
                ["accessible", "Accessible"],
                ["diversity", "Diversity"],
                ["proximity", "Proximity"],
                ["security", "Security"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={compareWeights[key]}
                  onChange={(e) => setCompareWeights({ ...compareWeights, [key]: Number(e.target.value) || 0 })}
                />
              </label>
            ))}
          </div>
        </div>

        {!ranked.length ? (
          <div className="state">No saved sites yet — open Explorer and click “Save to compare”.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Location</th>
                  <th>Surplus</th>
                  <th>Accessible</th>
                  <th>Realistic</th>
                  <th>Feeds</th>
                  <th>Districts</th>
                  <th>Avg km</th>
                  <th>Max km</th>
                  <th>HHI</th>
                  <th>Security</th>
                  <th>Optimal r</th>
                  <th>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ranked.map((s) => (
                  <tr key={s.id}>
                    <td>#{s.rank}</td>
                    <td>{s.label}</td>
                    <td>{s.catchment.ladder.surplusKtpa}</td>
                    <td>{s.catchment.ladder.accessibleKtpa}</td>
                    <td>{s.catchment.ladder.realisticKtpa}</td>
                    <td>{s.catchment.feedstockCount}</td>
                    <td>{s.catchment.districtCount}</td>
                    <td>{s.catchment.avgDistanceKm}</td>
                    <td>{s.catchment.maxDistanceKm}</td>
                    <td>{s.catchment.concentrationHhi}</td>
                    <td>
                      {s.security.score} · {s.security.grade}
                    </td>
                    <td>{s.optimalRadiusKm} km</td>
                    <td>{s.composite}</td>
                    <td>
                      <button type="button" className="linkish" onClick={() => removeSite(s.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted tiny">
          Current Explorer pin: {location.mode === "district" ? location.districtId : `${location.lat}, ${location.lon}`}
        </p>
      </section>
    </div>
  );
}
