import type { CatchmentResult } from "./catchment";
import type { ApplicationReq, FeedstockId, FeedstockMeta } from "./types";

export type BlendOption = {
  feedstocks: { id: FeedstockId; label: string; ktpa: number; sharePct: number }[];
  totalKtpa: number;
  meetsQuantity: boolean;
  avgMoisture: number;
  avgGcv: number;
  avgAsh: number;
  meetsSpecs: boolean;
  notes: string[];
};

export function analyseBlend(
  catchment: CatchmentResult,
  feedstocks: FeedstockMeta[],
  req: ApplicationReq
): BlendOption {
  const meta = Object.fromEntries(feedstocks.map((f) => [f.id, f]));
  const preferred = new Set(req.preferredFeedstocks);

  const candidates = catchment.feedstockTotals
    .map((f) => {
      const m = meta[f.id];
      if (!m) return null;
      const ok =
        m.moisturePct <= req.maxMoisturePct &&
        m.gcvKcalPerKg >= req.minGcvKcalPerKg &&
        m.ashPct <= req.maxAshPct;
      const preferBoost = preferred.has(f.id as FeedstockId) ? 1.15 : 1;
      return ok
        ? {
            id: f.id as FeedstockId,
            label: f.label,
            ktpa: f.surplusKtpa * preferBoost,
            raw: f.surplusKtpa,
            m,
          }
        : null;
    })
    .filter(Boolean) as {
    id: FeedstockId;
    label: string;
    ktpa: number;
    raw: number;
    m: FeedstockMeta;
  }[];

  candidates.sort((a, b) => b.ktpa - a.ktpa);

  let remaining = req.requiredKtpa;
  const picked: BlendOption["feedstocks"] = [];
  const notes: string[] = [];

  for (const c of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(c.raw, remaining);
    if (take <= 0) continue;
    picked.push({ id: c.id, label: c.label, ktpa: Math.round(take * 10) / 10, sharePct: 0 });
    remaining -= take;
  }

  const totalKtpa = picked.reduce((s, p) => s + p.ktpa, 0);
  for (const p of picked) p.sharePct = totalKtpa > 0 ? Math.round((p.ktpa / totalKtpa) * 1000) / 10 : 0;

  let wMoist = 0;
  let wGcv = 0;
  let wAsh = 0;
  for (const p of picked) {
    const m = meta[p.id];
    const w = p.ktpa;
    wMoist += m.moisturePct * w;
    wGcv += m.gcvKcalPerKg * w;
    wAsh += m.ashPct * w;
  }
  const avgMoisture = totalKtpa ? Math.round((wMoist / totalKtpa) * 10) / 10 : 0;
  const avgGcv = totalKtpa ? Math.round(wGcv / totalKtpa) : 0;
  const avgAsh = totalKtpa ? Math.round((wAsh / totalKtpa) * 10) / 10 : 0;

  const meetsQuantity = totalKtpa + 1e-6 >= req.requiredKtpa;
  const meetsSpecs =
    picked.length > 0 &&
    avgMoisture <= req.maxMoisturePct &&
    avgGcv >= req.minGcvKcalPerKg &&
    avgAsh <= req.maxAshPct;

  if (!candidates.length) notes.push("No feedstocks in catchment meet the moisture / GCV / ash gates.");
  if (!meetsQuantity)
    notes.push(
      `Catchment can cover ${totalKtpa} of ${req.requiredKtpa} KTPA under current filters — expand radius or relax specs.`
    );
  if (meetsQuantity && meetsSpecs) notes.push("Blend meets quantity and quality gates within this catchment.");
  if (preferred.size && picked.some((p) => preferred.has(p.id)))
    notes.push("Preferred feedstocks prioritised in the blend where available.");

  return {
    feedstocks: picked,
    totalKtpa: Math.round(totalKtpa * 10) / 10,
    meetsQuantity,
    avgMoisture,
    avgGcv,
    avgAsh,
    meetsSpecs,
    notes,
  };
}
