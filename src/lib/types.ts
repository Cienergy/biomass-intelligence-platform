export type FeedstockId =
  | "paddy_straw"
  | "wheat_straw"
  | "maize_stover"
  | "mustard_stalk"
  | "cane_trash"
  | "press_mud"
  | "soya_trash"
  | "of_msw";

export type FeedstockMeta = {
  id: FeedstockId;
  label: string;
  col?: string;
  cbgYieldTPerT: number | null;
  moisturePct: number;
  gcvKcalPerKg: number;
  ashPct: number;
  seasonality: string;
  availability: string;
};

export type District = {
  id: string;
  state: string;
  district: string;
  lat: number;
  lon: number;
  feedstocks: Record<string, number>;
  totalSurplusKtpa: number;
};

export type Dataset = {
  version: number;
  generatedAt: string;
  source: string;
  notes: string[];
  defaults: {
    roadFactor: number;
    radiiKm: number[];
    plantDaysPa: number;
    earthRadiusKm: number;
    collectionEfficiency: number;
    competingUseFactor: number;
    logisticsAccessFactor: number;
  };
  feedstocks: FeedstockMeta[];
  districts: District[];
  states: string[];
};

export type LocationSel =
  | { mode: "district"; districtId: string }
  | { mode: "custom"; lat: number; lon: number; label?: string };

export type AccessFactors = {
  collectionEfficiency: number;
  competingUseFactor: number;
  logisticsAccessFactor: number;
};

export type ApplicationReq = {
  requiredKtpa: number;
  maxMoisturePct: number;
  minGcvKcalPerKg: number;
  maxAshPct: number;
  preferredFeedstocks: FeedstockId[];
};

export type CompareWeights = {
  surplus: number;
  accessible: number;
  diversity: number;
  proximity: number;
  security: number;
};
