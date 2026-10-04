import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AccessFactors, ApplicationReq, CompareWeights, Dataset, FeedstockId, LocationSel } from "./types";

type Ctx = {
  dataset: Dataset | null;
  loading: boolean;
  error: string | null;
  location: LocationSel;
  setLocation: (l: LocationSel) => void;
  radiusKm: number;
  setRadiusKm: (n: number) => void;
  roadFactor: number;
  setRoadFactor: (n: number) => void;
  feedstockFilter: FeedstockId[];
  setFeedstockFilter: (ids: FeedstockId[]) => void;
  factors: AccessFactors;
  setFactors: (f: AccessFactors) => void;
  application: ApplicationReq;
  setApplication: (a: ApplicationReq) => void;
  compareWeights: CompareWeights;
  setCompareWeights: (w: CompareWeights) => void;
  savedSites: { id: string; label: string; location: LocationSel; radiusKm: number }[];
  saveSite: (label?: string) => void;
  removeSite: (id: string) => void;
};

const DataCtx = createContext<Ctx | null>(null);

const defaultApp: ApplicationReq = {
  requiredKtpa: 100,
  maxMoisturePct: 20,
  minGcvKcalPerKg: 3000,
  maxAshPct: 15,
  preferredFeedstocks: [],
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationSel>({ mode: "district", districtId: "Haryana|Hisar" });
  const [radiusKm, setRadiusKm] = useState(100);
  const [roadFactor, setRoadFactor] = useState(1.3);
  const [feedstockFilter, setFeedstockFilter] = useState<FeedstockId[]>([]);
  const [factors, setFactors] = useState<AccessFactors>({
    collectionEfficiency: 0.65,
    competingUseFactor: 0.85,
    logisticsAccessFactor: 0.9,
  });
  const [application, setApplication] = useState<ApplicationReq>(defaultApp);
  const [compareWeights, setCompareWeights] = useState<CompareWeights>({
    surplus: 25,
    accessible: 20,
    diversity: 15,
    proximity: 15,
    security: 25,
  });
  const [savedSites, setSavedSites] = useState<Ctx["savedSites"]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/dataset.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`dataset.json ${r.status}`);
        return r.json();
      })
      .then((d: Dataset) => {
        setDataset(d);
        setRoadFactor(d.defaults.roadFactor);
        setRadiusKm(d.defaults.radiiKm.includes(100) ? 100 : d.defaults.radiiKm[2] || 100);
        setFactors({
          collectionEfficiency: d.defaults.collectionEfficiency,
          competingUseFactor: d.defaults.competingUseFactor,
          logisticsAccessFactor: d.defaults.logisticsAccessFactor,
        });
        if (!d.districts.find((x) => x.id === "Haryana|Hisar") && d.districts[0]) {
          setLocation({ mode: "district", districtId: d.districts[0].id });
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      dataset,
      loading,
      error,
      location,
      setLocation,
      radiusKm,
      setRadiusKm,
      roadFactor,
      setRoadFactor,
      feedstockFilter,
      setFeedstockFilter,
      factors,
      setFactors,
      application,
      setApplication,
      compareWeights,
      setCompareWeights,
      savedSites,
      saveSite: (label) => {
        const id = `${Date.now()}`;
        const d =
          location.mode === "district"
            ? dataset?.districts.find((x) => x.id === location.districtId)
            : null;
        const auto =
          location.mode === "custom"
            ? location.label || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`
            : d
              ? `${d.district}, ${d.state}`
              : "Site";
        setSavedSites((prev) => [...prev, { id, label: label || auto, location, radiusKm }]);
      },
      removeSite: (id) => setSavedSites((prev) => prev.filter((s) => s.id !== id)),
    }),
    [
      dataset,
      loading,
      error,
      location,
      radiusKm,
      roadFactor,
      feedstockFilter,
      factors,
      application,
      compareWeights,
      savedSites,
    ]
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData outside provider");
  return ctx;
}
