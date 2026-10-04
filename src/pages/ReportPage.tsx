import { useMemo } from "react";
import { useData } from "../lib/DataContext";
import { buildCatchment } from "../lib/catchment";
import { optimiseRadius } from "../lib/optimiser";
import { supplySecurityScore } from "../lib/security";
import { analyseBlend } from "../lib/blend";
import { buildReportHtml } from "../lib/report";

export function ReportPage() {
  const { dataset, location, radiusKm, roadFactor, feedstockFilter, factors, application } = useData();
  const filter = feedstockFilter.length ? feedstockFilter : null;

  const bundle = useMemo(() => {
    if (!dataset) return null;
    const catchment = buildCatchment({
      sel: location,
      districts: dataset.districts,
      feedstocks: dataset.feedstocks,
      radiusKm,
      roadFactor,
      feedstockFilter: filter,
      factors,
    });
    if (!catchment) return null;
    const optimiser = optimiseRadius({
      sel: location,
      districts: dataset.districts,
      feedstocks: dataset.feedstocks,
      radiiKm: dataset.defaults.radiiKm,
      roadFactor,
      feedstockFilter: filter,
      factors,
    });
    const security = supplySecurityScore(catchment, dataset.feedstocks);
    const blend = analyseBlend(catchment, dataset.feedstocks, application);
    return { catchment, optimiser, security, blend };
  }, [dataset, location, radiusKm, roadFactor, filter, factors, application]);

  if (!dataset || !bundle) return <div className="state">Loading…</div>;

  const openReport = () => {
    const html = buildReportHtml({
      ...bundle,
      generatedAt: new Date().toLocaleString("en-IN"),
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const { catchment: c, security: s, optimiser: o } = bundle;

  return (
    <div className="page">
      <div className="panel-head">
        <h1>Biomass Opportunity Report</h1>
        <p>Professional one-pager from the current Explorer settings.</p>
      </div>
      <section className="panel">
        <div className="kpi-strip">
          <div>
            <span>Location</span>
            <b className="text-sm">{c.origin.label}</b>
          </div>
          <div>
            <span>Radius</span>
            <b>{c.radiusKm} km</b>
          </div>
          <div>
            <span>Realistic</span>
            <b>{c.ladder.realisticKtpa}</b>
            <small>KTPA</small>
          </div>
          <div>
            <span>Security</span>
            <b>{s.score}</b>
            <small>{s.grade}</small>
          </div>
        </div>
        <p>
          Optimal radius recommendation: <b>{o?.recommendedKm} km</b>. Report includes location summary, availability
          ladder, feedstock & district tables, optimiser rationale, security score, risks and sourcing strategy.
        </p>
        <button type="button" className="btn" onClick={openReport}>
          Open printable report
        </button>
      </section>
    </div>
  );
}
