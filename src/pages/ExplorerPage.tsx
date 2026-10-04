import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LocationPicker } from "../components/LocationPicker";
import { CatchmentMap } from "../components/CatchmentMap";
import { useData } from "../lib/DataContext";
import { buildCatchment } from "../lib/catchment";
import { optimiseRadius } from "../lib/optimiser";
import { supplySecurityScore } from "../lib/security";
import { analyseBlend } from "../lib/blend";
import type { FeedstockId } from "../lib/types";

export function ExplorerPage() {
  const {
    dataset,
    loading,
    error,
    location,
    radiusKm,
    setRadiusKm,
    roadFactor,
    feedstockFilter,
    factors,
    application,
    setApplication,
  } = useData();
  const [focusDistrict, setFocusDistrict] = useState<string | null>(null);

  const filter = feedstockFilter.length ? feedstockFilter : null;

  const catchment = useMemo(() => {
    if (!dataset) return null;
    return buildCatchment({
      sel: location,
      districts: dataset.districts,
      feedstocks: dataset.feedstocks,
      radiusKm,
      roadFactor,
      feedstockFilter: filter,
      factors,
    });
  }, [dataset, location, radiusKm, roadFactor, filter, factors]);

  const optimiser = useMemo(() => {
    if (!dataset) return null;
    return optimiseRadius({
      sel: location,
      districts: dataset.districts,
      feedstocks: dataset.feedstocks,
      radiiKm: dataset.defaults.radiiKm,
      roadFactor,
      feedstockFilter: filter,
      factors,
    });
  }, [dataset, location, roadFactor, filter, factors]);

  const security = useMemo(() => {
    if (!catchment || !dataset) return null;
    return supplySecurityScore(catchment, dataset.feedstocks);
  }, [catchment, dataset]);

  const blend = useMemo(() => {
    if (!catchment || !dataset) return null;
    return analyseBlend(catchment, dataset.feedstocks, application);
  }, [catchment, dataset, application]);

  const focused = catchment?.districts.find((d) => d.id === focusDistrict) || null;

  if (loading) return <div className="state">Loading district biomass dataset…</div>;
  if (error) return <div className="state error">{error}</div>;
  if (!dataset || !catchment || !security || !optimiser) return <div className="state">No catchment for this location.</div>;

  return (
    <div className="explorer">
      <div className="hero-line">
        <div>
          <h1>Where can you realistically source biomass?</h1>
          <p>
            Screen any Indian location for surplus biomass by radius, feedstock, supply security and application fit —
            technology-agnostic for pellets, CBG, boilers, biochar and industrial heat.
          </p>
        </div>
      </div>

      <div className="layout-explorer">
        <LocationPicker />

        <section className="panel">
          <div className="panel-head row">
            <div>
              <h2>{catchment.origin.label}</h2>
              <p>
                {catchment.districtCount} districts · {catchment.feedstockCount} feedstocks · avg haul{" "}
                {catchment.avgDistanceKm} km
              </p>
            </div>
            <button type="button" className="btn" onClick={() => setRadiusKm(optimiser.recommendedKm)}>
              Use optimal {optimiser.recommendedKm} km
            </button>
          </div>

          <div className="kpi-strip">
            <div>
              <span>Surplus</span>
              <b>{catchment.ladder.surplusKtpa}</b>
              <small>KTPA</small>
            </div>
            <div>
              <span>Accessible</span>
              <b>{catchment.ladder.accessibleKtpa}</b>
              <small>KTPA</small>
            </div>
            <div>
              <span>Realistic</span>
              <b>{catchment.ladder.realisticKtpa}</b>
              <small>KTPA</small>
            </div>
            <div>
              <span>Security</span>
              <b>{security.score}</b>
              <small>{security.grade}</small>
            </div>
          </div>

          <CatchmentMap
            origin={catchment.origin}
            radiusKm={catchment.radiusKm}
            roadFactor={catchment.roadFactor}
            districts={catchment.districts}
            selectedDistrictId={focusDistrict}
            onSelectDistrict={setFocusDistrict}
          />
        </section>
      </div>

      <div className="grid-2-lg">
        <section className="panel">
          <div className="panel-head">
            <h2>Feedstock intelligence</h2>
            <p>Surplus within radius · filter chips above refine the catchment.</p>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={catchment.feedstockTotals.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="surplusKtpa" fill="#0f766e" radius={[6, 6, 0, 0]} name="KTPA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feedstock</th>
                  <th>KTPA</th>
                  <th>%</th>
                  <th>Moisture</th>
                  <th>GCV</th>
                  <th>Ash</th>
                  <th>Season</th>
                </tr>
              </thead>
              <tbody>
                {catchment.feedstockTotals.map((f) => {
                  const meta = dataset.feedstocks.find((x) => x.id === f.id);
                  return (
                    <tr key={f.id}>
                      <td>{f.label}</td>
                      <td>{f.surplusKtpa}</td>
                      <td>{f.pct}%</td>
                      <td>{meta?.moisturePct ?? "—"}%</td>
                      <td>{meta?.gcvKcalPerKg ?? "—"}</td>
                      <td>{meta?.ashPct ?? "—"}%</td>
                      <td className="muted">{meta?.seasonality ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Catchment optimiser</h2>
            <p>Compares {dataset.defaults.radiiKm.join(", ")} km for quantity, diversity and haul.</p>
          </div>
          <div className="opt-banner">
            Recommended radius: <b>{optimiser.recommendedKm} km</b>
          </div>
          <ul className="rationale">
            {optimiser.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Radius</th>
                  <th>Surplus</th>
                  <th>Realistic</th>
                  <th>Δ KTPA</th>
                  <th>Δ / km</th>
                  <th>Feeds</th>
                  <th>Avg km</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {optimiser.options.map((o) => (
                  <tr key={o.radiusKm} className={o.radiusKm === optimiser.recommendedKm ? "hi" : ""}>
                    <td>
                      <button type="button" className="linkish" onClick={() => setRadiusKm(o.radiusKm)}>
                        {o.radiusKm} km
                      </button>
                    </td>
                    <td>{o.catchment.ladder.surplusKtpa}</td>
                    <td>{o.catchment.ladder.realisticKtpa}</td>
                    <td>{o.incrementalKtpa}</td>
                    <td>{o.incrementalPerKm}</td>
                    <td>{o.diversity}</td>
                    <td>{o.catchment.avgDistanceKm}</td>
                    <td>{o.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid-2-lg">
        <section className="panel">
          <div className="panel-head">
            <h2>Supply security · {security.score}/100</h2>
            <p>{security.grade} — risks beyond raw tonnage.</p>
          </div>
          <div className="sec-bars">
            {security.components.map((c) => (
              <div key={c.key} className="sec-row">
                <div className="sec-meta">
                  <span>{c.label}</span>
                  <b>{Math.round(c.score)}</b>
                </div>
                <div className="bar">
                  <i style={{ width: `${c.score}%` }} />
                </div>
                <small className="muted">{c.note}</small>
              </div>
            ))}
          </div>
          <ul className="risks">
            {security.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Blend & application</h2>
            <p>Optional quality gates for your end use.</p>
          </div>
          <div className="grid-2">
            <label>
              Required KTPA
              <input
                type="number"
                value={application.requiredKtpa}
                onChange={(e) => setApplication({ ...application, requiredKtpa: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Max moisture %
              <input
                type="number"
                value={application.maxMoisturePct}
                onChange={(e) => setApplication({ ...application, maxMoisturePct: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Min GCV (kcal/kg)
              <input
                type="number"
                value={application.minGcvKcalPerKg}
                onChange={(e) => setApplication({ ...application, minGcvKcalPerKg: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Max ash %
              <input
                type="number"
                value={application.maxAshPct}
                onChange={(e) => setApplication({ ...application, maxAshPct: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div className="chips">
            {dataset.feedstocks.map((f) => {
              const on = application.preferredFeedstocks.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${on ? "active" : ""}`}
                  onClick={() => {
                    const next = on
                      ? application.preferredFeedstocks.filter((x) => x !== f.id)
                      : [...application.preferredFeedstocks, f.id as FeedstockId];
                    setApplication({ ...application, preferredFeedstocks: next });
                  }}
                >
                  Prefer {f.label.split(" /")[0]}
                </button>
              );
            })}
          </div>
          {blend && (
            <>
              <div className="kpi-strip compact">
                <div>
                  <span>Blend total</span>
                  <b>{blend.totalKtpa}</b>
                  <small>KTPA</small>
                </div>
                <div>
                  <span>Moisture</span>
                  <b>{blend.avgMoisture}%</b>
                </div>
                <div>
                  <span>GCV</span>
                  <b>{blend.avgGcv}</b>
                </div>
                <div>
                  <span>Ash</span>
                  <b>{blend.avgAsh}%</b>
                </div>
              </div>
              <ul className="rationale">
                {blend.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Feedstock</th>
                      <th>KTPA</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blend.feedstocks.map((f) => (
                      <tr key={f.id}>
                        <td>{f.label}</td>
                        <td>{f.ktpa}</td>
                        <td>{f.sharePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head row">
          <div>
            <h2>District contribution</h2>
            <p>Click a row or map marker for the full biomass profile.</p>
          </div>
          {focused && (
            <div className="focus-card">
              <b>
                {focused.district}, {focused.state}
              </b>
              <span>
                {focused.selectedSurplusKtpa} KTPA · {focused.distanceKm} km · {focused.pctOfCatchment}%
              </span>
              <div className="mini-feeds">
                {Object.entries(focused.selectedFeedstocks)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <span key={k}>
                      {dataset.feedstocks.find((f) => f.id === k)?.label.split(" /")[0]}: {v}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="table-wrap tall">
          <table>
            <thead>
              <tr>
                <th>District</th>
                <th>State</th>
                <th>Distance</th>
                <th>Surplus KTPA</th>
                <th>% catchment</th>
              </tr>
            </thead>
            <tbody>
              {catchment.districts.map((d) => (
                <tr
                  key={d.id}
                  className={d.id === focusDistrict ? "hi" : ""}
                  onClick={() => setFocusDistrict(d.id)}
                >
                  <td>{d.district}</td>
                  <td>{d.state}</td>
                  <td>{d.distanceKm} km</td>
                  <td>{d.selectedSurplusKtpa}</td>
                  <td>{d.pctOfCatchment}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
