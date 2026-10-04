import type { CatchmentResult } from "./catchment";
import type { OptimiserResult } from "./optimiser";
import type { SecurityResult } from "./security";
import type { BlendOption } from "./blend";

export function buildReportHtml(opts: {
  catchment: CatchmentResult;
  security: SecurityResult;
  optimiser: OptimiserResult | null;
  blend: BlendOption | null;
  generatedAt: string;
}) {
  const { catchment: c, security: s, optimiser: o, blend: b, generatedAt } = opts;
  const feedRows = c.feedstockTotals
    .map((f) => `<tr><td>${f.label}</td><td>${f.surplusKtpa}</td><td>${f.pct}%</td></tr>`)
    .join("");
  const distRows = c.districts
    .slice(0, 25)
    .map(
      (d) =>
        `<tr><td>${d.district}</td><td>${d.state}</td><td>${d.distanceKm}</td><td>${d.selectedSurplusKtpa}</td><td>${d.pctOfCatchment}%</td></tr>`
    )
    .join("");
  const risks = s.risks.map((r) => `<li>${r}</li>`).join("");
  const rationale = (o?.rationale || []).map((r) => `<li>${r}</li>`).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Biomass Opportunity Report — ${c.origin.label}</title>
<style>
  body{font-family:Georgia,serif;color:#1c2434;max-width:860px;margin:40px auto;padding:0 24px;line-height:1.5}
  h1{font-size:1.8rem;margin:0 0 .25rem} h2{margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.35rem}
  .muted{color:#64748b} .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:1rem 0}
  .kpi div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
  .kpi b{display:block;font-size:1.25rem} table{width:100%;border-collapse:collapse;font-size:.92rem}
  th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left} th{font-size:.8rem;text-transform:uppercase;color:#64748b}
  @media print{.noprint{display:none}}
</style></head><body>
<button class="noprint" onclick="window.print()">Print / Save PDF</button>
<h1>Biomass Opportunity Report</h1>
<p class="muted">${c.origin.label} · Radius ${c.radiusKm} km · Road factor ${c.roadFactor} · ${generatedAt}</p>

<h2>1. Location summary</h2>
<p>Facility screening location at <b>${c.origin.label}</b> (${c.origin.lat.toFixed(3)}, ${c.origin.lon.toFixed(3)}).
Catchment includes <b>${c.districtCount}</b> districts and <b>${c.feedstockCount}</b> feedstocks.</p>

<div class="kpi">
  <div><span class="muted">Surplus</span><b>${c.ladder.surplusKtpa} KTPA</b></div>
  <div><span class="muted">Accessible</span><b>${c.ladder.accessibleKtpa} KTPA</b></div>
  <div><span class="muted">Realistic</span><b>${c.ladder.realisticKtpa} KTPA</b></div>
  <div><span class="muted">Security</span><b>${s.score}/100 · ${s.grade}</b></div>
</div>

<h2>2. Catchment map</h2>
<p class="muted">See interactive map in the platform. District HQ points within ${c.radiusKm} km (transport-adjusted) are included; full district surplus is attributed when HQ falls inside.</p>

<h2>3. Biomass availability</h2>
<p>Theoretical/surplus (source data): <b>${c.ladder.surplusKtpa} KTPA</b>. 
Accessible (× collection ${c.ladder.factors.collectionEfficiency} × logistics ${c.ladder.factors.logisticsAccessFactor}): <b>${c.ladder.accessibleKtpa} KTPA</b>. 
Realistically sourceable (× competing-use ${c.ladder.factors.competingUseFactor}): <b>${c.ladder.realisticKtpa} KTPA</b>.</p>

<h2>4. Feedstock breakdown</h2>
<table><thead><tr><th>Feedstock</th><th>Surplus KTPA</th><th>%</th></tr></thead><tbody>${feedRows}</tbody></table>

<h2>5. District contribution (top 25)</h2>
<table><thead><tr><th>District</th><th>State</th><th>Distance km</th><th>Surplus KTPA</th><th>%</th></tr></thead><tbody>${distRows}</tbody></table>

<h2>6. Optimal sourcing radius</h2>
<p>Recommended: <b>${o?.recommendedKm ?? c.radiusKm} km</b></p>
<ul>${rationale}</ul>

<h2>7. Accessible biomass</h2>
<p>${c.ladder.accessibleKtpa} KTPA accessible; ${c.ladder.realisticKtpa} KTPA realistically sourceable after competing uses.</p>

<h2>8. Supply security score</h2>
<p><b>${s.score}/100</b> (${s.grade}). Avg distance ${c.avgDistanceKm} km · max ${c.maxDistanceKm} km · concentration HHI ${c.concentrationHhi}.</p>

<h2>9. Key risks</h2>
<ul>${risks}</ul>

<h2>10. Recommended sourcing strategy</h2>
<ul>
<li>Anchor offtake within the recommended ${o?.recommendedKm ?? c.radiusKm} km radius first.</li>
<li>Prioritise top feedstocks while keeping single-feedstock share below ~50% where possible.</li>
<li>Contract across multiple districts to reduce ${c.districts[0]?.district || "lead-district"} dependence.</li>
${b ? `<li>Application blend covers ${b.totalKtpa} KTPA (${b.meetsQuantity && b.meetsSpecs ? "meets" : "partial"} specs).</li>` : ""}
</ul>
<p class="muted">Screening model only — district HQ coordinates approximate; validate with field logistics and offtake surveys.</p>
</body></html>`;
}
