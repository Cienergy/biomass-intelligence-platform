import type { AccessFactors, District, FeedstockId, FeedstockMeta, LocationSel } from "./types";
import { transportKm } from "./geo";

export type CatchmentDistrict = District & {
  distanceKm: number;
  selectedSurplusKtpa: number;
  selectedFeedstocks: Record<string, number>;
  pctOfCatchment: number;
};

export type BiomassLadder = {
  theoreticalKtpa: number;
  surplusKtpa: number;
  accessibleKtpa: number;
  realisticKtpa: number;
  factors: AccessFactors;
};

export type CatchmentResult = {
  origin: { lat: number; lon: number; label: string };
  radiusKm: number;
  roadFactor: number;
  feedstockFilter: FeedstockId[] | null;
  districts: CatchmentDistrict[];
  ladder: BiomassLadder;
  feedstockTotals: { id: string; label: string; surplusKtpa: number; pct: number }[];
  districtCount: number;
  feedstockCount: number;
  avgDistanceKm: number;
  maxDistanceKm: number;
  concentrationHhi: number;
};

export function resolveOrigin(
  sel: LocationSel,
  districts: District[]
): { lat: number; lon: number; label: string } | null {
  if (sel.mode === "custom") {
    if (!Number.isFinite(sel.lat) || !Number.isFinite(sel.lon)) return null;
    return {
      lat: sel.lat,
      lon: sel.lon,
      label: sel.label || `${sel.lat.toFixed(3)}, ${sel.lon.toFixed(3)}`,
    };
  }
  const d = districts.find((x) => x.id === sel.districtId);
  if (!d) return null;
  return { lat: d.lat, lon: d.lon, label: `${d.district}, ${d.state}` };
}

function surplusFor(d: District, filter: FeedstockId[] | null) {
  const keys = filter?.length ? filter : (Object.keys(d.feedstocks) as FeedstockId[]);
  const selected: Record<string, number> = {};
  let total = 0;
  for (const k of keys) {
    const v = d.feedstocks[k] || 0;
    if (v > 0) selected[k] = v;
    total += v;
  }
  return { selected, total };
}

/** Herfindahl–Hirschman index on district share (0–1). */
export function concentrationHhi(shares: number[]) {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  return shares.reduce((a, s) => a + (s / sum) ** 2, 0);
}

export function buildCatchment(opts: {
  sel: LocationSel;
  districts: District[];
  feedstocks: FeedstockMeta[];
  radiusKm: number;
  roadFactor: number;
  feedstockFilter: FeedstockId[] | null;
  factors: AccessFactors;
  earthRadiusKm?: number;
}): CatchmentResult | null {
  const origin = resolveOrigin(opts.sel, opts.districts);
  if (!origin) return null;

  const rows: CatchmentDistrict[] = [];
  for (const d of opts.districts) {
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lon)) continue;
    const distanceKm =
      Math.round(
        transportKm(origin.lat, origin.lon, d.lat, d.lon, opts.roadFactor, opts.earthRadiusKm) * 10
      ) / 10;
    if (distanceKm > opts.radiusKm) continue;
    const { selected, total } = surplusFor(d, opts.feedstockFilter);
    if (total <= 0 && opts.feedstockFilter?.length) continue;
    rows.push({
      ...d,
      distanceKm,
      selectedSurplusKtpa: Math.round(total * 1000) / 1000,
      selectedFeedstocks: selected,
      pctOfCatchment: 0,
    });
  }
  rows.sort((a, b) => b.selectedSurplusKtpa - a.selectedSurplusKtpa || a.distanceKm - b.distanceKm);

  const surplusKtpa = rows.reduce((s, r) => s + r.selectedSurplusKtpa, 0);
  for (const r of rows) {
    r.pctOfCatchment = surplusKtpa > 0 ? Math.round((r.selectedSurplusKtpa / surplusKtpa) * 1000) / 10 : 0;
  }

  const byFeed: Record<string, number> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.selectedFeedstocks)) {
      byFeed[k] = (byFeed[k] || 0) + v;
    }
  }
  const feedstockTotals = opts.feedstocks
    .map((f) => ({
      id: f.id,
      label: f.label,
      surplusKtpa: Math.round((byFeed[f.id] || 0) * 1000) / 1000,
      pct: 0,
    }))
    .filter((f) => f.surplusKtpa > 0)
    .sort((a, b) => b.surplusKtpa - a.surplusKtpa);
  for (const f of feedstockTotals) {
    f.pct = surplusKtpa > 0 ? Math.round((f.surplusKtpa / surplusKtpa) * 1000) / 10 : 0;
  }

  const theoreticalKtpa = surplusKtpa; // surplus already net of on-farm use in source data
  const accessibleKtpa =
    theoreticalKtpa * opts.factors.collectionEfficiency * opts.factors.logisticsAccessFactor;
  const realisticKtpa = accessibleKtpa * opts.factors.competingUseFactor;

  const avgDistanceKm =
    rows.length === 0
      ? 0
      : Math.round((rows.reduce((s, r) => s + r.distanceKm * r.selectedSurplusKtpa, 0) / Math.max(surplusKtpa, 1e-9)) * 10) /
        10;
  const maxDistanceKm = rows.reduce((m, r) => Math.max(m, r.distanceKm), 0);

  return {
    origin,
    radiusKm: opts.radiusKm,
    roadFactor: opts.roadFactor,
    feedstockFilter: opts.feedstockFilter,
    districts: rows,
    ladder: {
      theoreticalKtpa: Math.round(theoreticalKtpa * 10) / 10,
      surplusKtpa: Math.round(surplusKtpa * 10) / 10,
      accessibleKtpa: Math.round(accessibleKtpa * 10) / 10,
      realisticKtpa: Math.round(realisticKtpa * 10) / 10,
      factors: opts.factors,
    },
    feedstockTotals,
    districtCount: rows.length,
    feedstockCount: feedstockTotals.length,
    avgDistanceKm,
    maxDistanceKm: Math.round(maxDistanceKm * 10) / 10,
    concentrationHhi: Math.round(concentrationHhi(rows.map((r) => r.selectedSurplusKtpa)) * 1000) / 1000,
  };
}
