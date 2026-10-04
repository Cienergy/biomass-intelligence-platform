import type { CatchmentResult } from "./catchment";
import { buildCatchment } from "./catchment";
import type { AccessFactors, District, FeedstockId, FeedstockMeta, LocationSel } from "./types";

export type RadiusOption = {
  radiusKm: number;
  catchment: CatchmentResult;
  biomassPerKm: number;
  incrementalKtpa: number;
  incrementalPerKm: number;
  diversity: number;
  score: number;
};

export type OptimiserResult = {
  options: RadiusOption[];
  recommendedKm: number;
  rationale: string[];
};

export function optimiseRadius(opts: {
  sel: LocationSel;
  districts: District[];
  feedstocks: FeedstockMeta[];
  radiiKm: number[];
  roadFactor: number;
  feedstockFilter: FeedstockId[] | null;
  factors: AccessFactors;
}): OptimiserResult | null {
  const sorted = [...opts.radiiKm].sort((a, b) => a - b);
  const options: RadiusOption[] = [];
  let prevSurplus = 0;
  let prevR = 0;

  for (const radiusKm of sorted) {
    const catchment = buildCatchment({ ...opts, radiusKm });
    if (!catchment) return null;
    const incrementalKtpa = catchment.ladder.surplusKtpa - prevSurplus;
    const dr = radiusKm - prevR || radiusKm;
    const incrementalPerKm = incrementalKtpa / dr;
    const biomassPerKm = catchment.ladder.surplusKtpa / radiusKm;
    const diversity = catchment.feedstockCount;
    // Score: quantity + diversity − distance penalty − concentration penalty
    const score =
      Math.log10(1 + catchment.ladder.realisticKtpa) * 40 +
      diversity * 4 +
      Math.min(20, incrementalPerKm) -
      catchment.avgDistanceKm * 0.08 -
      catchment.concentrationHhi * 15;
    options.push({
      radiusKm,
      catchment,
      biomassPerKm: Math.round(biomassPerKm * 100) / 100,
      incrementalKtpa: Math.round(incrementalKtpa * 10) / 10,
      incrementalPerKm: Math.round(incrementalPerKm * 100) / 100,
      diversity,
      score: Math.round(score * 10) / 10,
    });
    prevSurplus = catchment.ladder.surplusKtpa;
    prevR = radiusKm;
  }

  const best = [...options].sort((a, b) => b.score - a.score)[0];
  const rationale: string[] = [];
  if (!best) {
    return { options, recommendedKm: sorted[0] || 100, rationale: ["Insufficient data"] };
  }
  rationale.push(
    `${best.radiusKm} km scores highest (${best.score}) balancing realistic biomass (${best.catchment.ladder.realisticKtpa} KTPA), diversity (${best.diversity} feedstocks), and average haul (${best.catchment.avgDistanceKm} km).`
  );
  const next = options.find((o) => o.radiusKm > best.radiusKm);
  if (next) {
    rationale.push(
      `Expanding to ${next.radiusKm} km adds only ${next.incrementalKtpa} KTPA (${next.incrementalPerKm} KTPA/km) — diminishing returns.`
    );
  }
  const prev = [...options].reverse().find((o) => o.radiusKm < best.radiusKm);
  if (prev && best.incrementalKtpa > 0) {
    rationale.push(
      `Versus ${prev.radiusKm} km, the step to ${best.radiusKm} km adds ${best.incrementalKtpa} KTPA (${best.incrementalPerKm} KTPA/km).`
    );
  }
  if (best.catchment.concentrationHhi > 0.35) {
    rationale.push(
      `Note: district concentration is elevated (HHI ${best.catchment.concentrationHhi}) — diversify suppliers even within this radius.`
    );
  }

  return { options, recommendedKm: best.radiusKm, rationale };
}
