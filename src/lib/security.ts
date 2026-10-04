import type { CatchmentResult } from "./catchment";
import type { FeedstockMeta } from "./types";

export type SecurityResult = {
  score: number;
  grade: "Strong" | "Moderate" | "Elevated risk";
  components: { key: string; label: string; score: number; weight: number; note: string }[];
  risks: string[];
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

export function supplySecurityScore(
  c: CatchmentResult,
  feedstocks: FeedstockMeta[]
): SecurityResult {
  const topFeedPct = c.feedstockTotals[0]?.pct || 0;
  const topDistrictPct = c.districts[0]?.pctOfCatchment || 0;

  // Seasonal coverage: how many distinct seasonal windows appear
  const seasons = new Set(
    c.feedstockTotals.map((f) => feedstocks.find((x) => x.id === f.id)?.seasonality || "").filter(Boolean)
  );
  const seasonScore = clamp((seasons.size / 4) * 100);

  const diversityScore = clamp((c.feedstockCount / 6) * 100);
  const concentrationScore = clamp((1 - c.concentrationHhi) * 100);
  const surplusScore = clamp(Math.log10(1 + c.ladder.realisticKtpa) * 28);
  const distanceScore = clamp(100 - c.avgDistanceKm * 0.55);
  const singleFeedScore = clamp(100 - Math.max(0, topFeedPct - 40) * 1.8);
  const singleDistrictScore = clamp(100 - Math.max(0, topDistrictPct - 35) * 2);

  const components = [
    { key: "diversity", label: "Feedstock diversity", score: diversityScore, weight: 0.18, note: `${c.feedstockCount} feedstocks in catchment` },
    { key: "concentration", label: "District concentration", score: concentrationScore, weight: 0.16, note: `HHI ${c.concentrationHhi}` },
    { key: "seasonality", label: "Seasonal availability", score: seasonScore, weight: 0.12, note: `${seasons.size} seasonal windows` },
    { key: "surplus", label: "Biomass surplus depth", score: surplusScore, weight: 0.18, note: `${c.ladder.realisticKtpa} KTPA realistic` },
    { key: "distance", label: "Sourcing distance", score: distanceScore, weight: 0.12, note: `Avg ${c.avgDistanceKm} km` },
    { key: "single_feed", label: "Single-feedstock dependence", score: singleFeedScore, weight: 0.12, note: `Top feedstock ${topFeedPct}%` },
    { key: "single_district", label: "Single-district dependence", score: singleDistrictScore, weight: 0.12, note: `Top district ${topDistrictPct}%` },
  ];

  const score = Math.round(
    components.reduce((s, cpt) => s + cpt.score * cpt.weight, 0)
  );

  const risks: string[] = [];
  if (topFeedPct >= 55) risks.push(`High dependence on ${c.feedstockTotals[0]?.label} (${topFeedPct}% of catchment).`);
  if (topDistrictPct >= 45)
    risks.push(`Top district ${c.districts[0]?.district} contributes ${topDistrictPct}% — supplier concentration risk.`);
  if (c.avgDistanceKm > 90) risks.push(`Average haul ${c.avgDistanceKm} km elevates logistics cost and disruption risk.`);
  if (c.feedstockCount <= 2) risks.push("Narrow feedstock mix — vulnerable to crop-year shocks.");
  if (seasons.size <= 1) risks.push("Seasonality clustered in one window — storage / year-round cover needed.");
  if (c.ladder.realisticKtpa < 50) risks.push("Realistic sourceable biomass is thin for industrial-scale offtake.");
  if (!risks.length) risks.push("No critical structural risks flagged at this radius — monitor competing offtake.");

  const grade = score >= 70 ? "Strong" : score >= 50 ? "Moderate" : "Elevated risk";
  return { score, grade, components, risks };
}
