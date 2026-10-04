import type { CatchmentResult } from "./catchment";
import type { SecurityResult } from "./security";
import type { CompareWeights } from "./types";

export type SiteSnapshot = {
  id: string;
  label: string;
  catchment: CatchmentResult;
  security: SecurityResult;
  optimalRadiusKm: number;
};

export type RankedSite = SiteSnapshot & {
  rank: number;
  composite: number;
};

export function rankSites(sites: SiteSnapshot[], weights: CompareWeights): RankedSite[] {
  if (!sites.length) return [];
  const maxSurplus = Math.max(...sites.map((s) => s.catchment.ladder.surplusKtpa), 1);
  const maxAccess = Math.max(...sites.map((s) => s.catchment.ladder.accessibleKtpa), 1);
  const maxDiv = Math.max(...sites.map((s) => s.catchment.feedstockCount), 1);
  const maxSec = Math.max(...sites.map((s) => s.security.score), 1);
  const maxDist = Math.max(...sites.map((s) => s.catchment.avgDistanceKm), 1);

  const wSum = weights.surplus + weights.accessible + weights.diversity + weights.proximity + weights.security || 1;

  const scored = sites.map((s) => {
    const proximity = 1 - s.catchment.avgDistanceKm / maxDist;
    const composite =
      ((s.catchment.ladder.surplusKtpa / maxSurplus) * weights.surplus +
        (s.catchment.ladder.accessibleKtpa / maxAccess) * weights.accessible +
        (s.catchment.feedstockCount / maxDiv) * weights.diversity +
        proximity * weights.proximity +
        (s.security.score / maxSec) * weights.security) /
      wSum;
    return { ...s, composite: Math.round(composite * 1000) / 10, rank: 0 };
  });

  scored.sort((a, b) => b.composite - a.composite);
  scored.forEach((s, i) => {
    s.rank = i + 1;
  });
  return scored;
}
