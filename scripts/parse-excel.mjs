import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC =
  process.env.BIOMASS_XLSX ||
  join(ROOT, "..", "pellet-trade-platform", "data", "Biomass_Radius_Finder_30_09_2026.xlsx");
const OUT = join(ROOT, "public", "data");
mkdirSync(OUT, { recursive: true });

const FEEDSTOCKS = [
  { id: "paddy_straw", label: "Paddy Straw", col: "Paddy Straw (KTPA)" },
  { id: "wheat_straw", label: "Wheat Straw", col: "Wheat Straw (KTPA)" },
  { id: "maize_stover", label: "Maize Stover", col: "Maize Stover (KTPA)" },
  { id: "mustard_stalk", label: "Mustard Stalk", col: "Mustard Stalk (KTPA)" },
  { id: "cane_trash", label: "Cane Trash / Sugarcane residue", col: "Cane Trash (KTPA)" },
  { id: "press_mud", label: "Press Mud / Bagasse-adjacent", col: "Press Mud (KTPA)" },
  { id: "soya_trash", label: "Soya Trash", col: "Soya Trash (KTPA)" },
  { id: "of_msw", label: "OF MSW", col: "OF MSW (KTPA)" },
];

/** Static feedstock intelligence (where Excel has no specs) */
const FEEDSTOCK_META = {
  paddy_straw: {
    moisturePct: 12,
    gcvKcalPerKg: 3500,
    ashPct: 15,
    seasonality: "Oct–Dec (kharif harvest)",
    availability: "Peak post-harvest; high seasonal concentration",
  },
  wheat_straw: {
    moisturePct: 10,
    gcvKcalPerKg: 3800,
    ashPct: 8,
    seasonality: "Apr–May (rabi harvest)",
    availability: "Short collection window; competes with fodder",
  },
  maize_stover: {
    moisturePct: 15,
    gcvKcalPerKg: 3600,
    ashPct: 6,
    seasonality: "Sep–Nov / Feb–Mar",
    availability: "Moderate; often left in field",
  },
  mustard_stalk: {
    moisturePct: 10,
    gcvKcalPerKg: 4000,
    ashPct: 5,
    seasonality: "Mar–Apr",
    availability: "Localized clusters in NW India",
  },
  cane_trash: {
    moisturePct: 25,
    gcvKcalPerKg: 3200,
    ashPct: 8,
    seasonality: "Nov–Apr (crushing season)",
    availability: "Tied to mill catchments",
  },
  press_mud: {
    moisturePct: 70,
    gcvKcalPerKg: 1800,
    ashPct: 12,
    seasonality: "Nov–Apr (crushing season)",
    availability: "Point-source at sugar mills; wet, needs drying",
  },
  soya_trash: {
    moisturePct: 12,
    gcvKcalPerKg: 3700,
    ashPct: 6,
    seasonality: "Oct–Nov",
    availability: "Central India belt",
  },
  of_msw: {
    moisturePct: 45,
    gcvKcalPerKg: 2200,
    ashPct: 20,
    seasonality: "Year-round",
    availability: "Urban continuous; quality variable",
  },
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function main() {
  // Keep a local copy of the workbook for reproducibility
  const localXlsx = join(ROOT, "data", "Biomass_Radius_Finder_30_09_2026.xlsx");
  mkdirSync(dirname(localXlsx), { recursive: true });
  try {
    copyFileSync(SRC, localXlsx);
  } catch {
    /* ignore if already local-only */
  }

  const wb = XLSX.readFile(exists(localXlsx) ? localXlsx : SRC, { cellDates: true });
  const dataSheet = wb.Sheets.Data;
  const rows = XLSX.utils.sheet_to_json(dataSheet, { defval: null, range: 2 });

  const districts = [];
  for (const r of rows) {
    const state = String(r.State || "").trim();
    const district = String(r.District || "").trim();
    if (!state || !district) continue;
    const lat = num(r["Lat (approx)"]);
    const lon = num(r["Lon (approx)"]);
    const feedstocks = {};
    let total = 0;
    for (const f of FEEDSTOCKS) {
      const v = Math.max(0, num(r[f.col]));
      feedstocks[f.id] = v;
      total += v;
    }
    districts.push({
      id: `${state}|${district}`,
      state,
      district,
      lat,
      lon,
      feedstocks,
      totalSurplusKtpa: Math.round(total * 10000) / 10000,
    });
  }

  const assumptionsSheet = wb.Sheets.Assumptions;
  const arows = XLSX.utils.sheet_to_json(assumptionsSheet, { header: 1, defval: null });
  const cbgYield = {};
  for (let i = 0; i < arows.length; i++) {
    const label = String(arows[i]?.[0] || "");
    const match = FEEDSTOCKS.find((f) => label.toLowerCase().startsWith(f.label.split(" ")[0].toLowerCase()) || label === f.label.split(" /")[0]);
    // simpler map by known names
  }
  const yieldByLabel = {
    "Paddy Straw": "paddy_straw",
    "Wheat Straw": "wheat_straw",
    "Maize Stover": "maize_stover",
    "Mustard Stalk": "mustard_stalk",
    "Cane Trash": "cane_trash",
    "Press Mud": "press_mud",
    "Soya Trash": "soya_trash",
    "OF MSW": "of_msw",
  };
  for (const row of arows) {
    const id = yieldByLabel[String(row?.[0] || "").trim()];
    if (id) cbgYield[id] = num(row[1]);
  }

  const feedstocks = FEEDSTOCKS.map((f) => ({
    ...f,
    cbgYieldTPerT: cbgYield[f.id] || null,
    ...FEEDSTOCK_META[f.id],
  }));

  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "Biomass_Radius_Finder_30_09_2026.xlsx",
    notes: [
      "Surplus KTPA by feedstock from DES APY 2022-23 basis (CBG Analysis workbook).",
      "Coordinates are approximate district-HQ points (±10–20 km) — for screening, not final site selection.",
      "A district is included if its HQ falls inside the radius; FULL district surplus is counted.",
      "Distance = haversine × road factor (typical India road factor 1.2–1.4).",
    ],
    defaults: {
      roadFactor: 1.3,
      radiiKm: [25, 50, 75, 100, 150],
      plantDaysPa: 341,
      earthRadiusKm: 6371,
      /** Biomass ladder defaults */
      collectionEfficiency: 0.65,
      competingUseFactor: 0.85,
      logisticsAccessFactor: 0.9,
    },
    feedstocks,
    districts,
    states: [...new Set(districts.map((d) => d.state))].sort(),
  };

  writeFileSync(join(OUT, "dataset.json"), JSON.stringify(dataset));
  console.log(`Wrote ${districts.length} districts → public/data/dataset.json`);
}

function exists(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

main();
