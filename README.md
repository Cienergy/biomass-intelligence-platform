# Biomass Intelligence & Catchment Optimisation Platform

Premium screening tool for biomass sourcing locations across India.

> If I establish a biomass-consuming facility here, how much biomass can I realistically source, from where, at what distance, and with what supply security?

Technology-agnostic: pellets, briquettes, CBG, boilers, biochar, gasification, industrial heat.

## Features (PRD)

1. **Location** — district HQ or custom lat/lng  
2. **Catchment engine** — Haversine × configurable road factor; multi-radius  
3. **Biomass ladder** — Theoretical/Surplus → Accessible → Realistically sourceable  
4. **Feedstock intelligence** — 8 residues + moisture/GCV/ash/seasonality  
5. **Catchment optimiser** — recommends radius with rationale  
6. **Supply security score** — 0–100 with risk callouts  
7. **Site comparison** — weighted ranking  
8. **Interactive map** — facility, radius, district intensity  
9. **Blend & application** — quantity + quality gates  
10. **Opportunity report** — printable HTML/PDF  

## Data

Initial engine from `Biomass_Radius_Finder_30_09_2026.xlsx` (744 districts, DES APY surplus by feedstock).

```bash
npm run data    # regenerates public/data/dataset.json
npm run dev
npm run build
```

## Deploy

Pushes to `main` deploy via GitHub Pages:

https://sajalsinha.github.io/biomass-intelligence-platform/

## Architecture notes

- Modular TypeScript engines under `src/lib/` (catchment, optimiser, security, blend, compare, report)
- Designed to later plug in GIS boundaries, village biomass, road-network distances, seasonal layers, and proprietary overlays without rewriting the UI flow
