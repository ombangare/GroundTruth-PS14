# GroundTruth

Satellite-derived SDG progress, translated into plain language, for Indian districts.

A real FastAPI backend and a real Next.js dashboard, wired end to end.
Ships on realistic mock data by default; flips to **live Google Earth Engine**
satellite computation with one env var once you complete `backend/SETUP_GEE.md`.

```
groundtruth/
├── backend/                     FastAPI — indicator engine + API
│   ├── SETUP_GEE.md             ← how to get real Earth Engine credentials
│   └── app/
│       ├── main.py
│       ├── config.py                       ← USE_GEE toggle
│       ├── routers/districts.py
│       ├── services/
│       │   ├── indicator_engine.py         ← the brain: thresholds, verdicts, severity
│       │   └── gee_service.py              ← REAL Sentinel-2 NDWI/NDVI/NDBI computation
│       └── data/mock_districts.py          ← fallback data source
└── frontend/                    Next.js 14 (App Router) + Tailwind + Three.js
    ├── app/page.tsx             ← dashboard with 3D globe hero
    ├── components/
    │   ├── Globe3D.tsx          ← rotating wireframe globe (Three.js), district markers
    │   ├── DistrictMap.tsx      ← Leaflet map
    │   ├── IndicatorCard.tsx
    │   └── BeforeAfterSlider.tsx
```

## Performance & Caching

- `district_loader.py` caches a state-filtered copy of `districts.geojson`
  after first parse (`data/cache/<state>_districts.geojson`) — every
  restart after the first parses ~36 Maharashtra features instead of the
  full ~734-district national file.
- `gee_cache.py` caches computed Earth Engine results to disk per
  district+year-range. First visit to a district does real satellite
  computation; every visit after that (same session or a restart) loads
  instantly from cache instead of re-querying Earth Engine. Delete
  `data/cache/gee_results/` to force a fresh recompute.
- Earth Engine `reduceRegion` calls use `scale=30` (not `10`) and AOI
  total-area is computed via `aoi.area()` (geometry calc) instead of a
  redundant pixel-sum — both cut live query time meaningfully.

## Design: Mission-Control HUD

The UI moved off soft purple gradient blobs into a sharper, instrument-panel
identity: a moving cyan grid backdrop, a scanning sweep line, angular
clipped-corner panels with corner brackets, and a live ticker strip — reads
as "satellite mission control," not generic gradient SaaS.

**The globe is now a real Earth**, not a wireframe placeholder — NASA Blue
Marble day texture, an independently-rotating cloud layer, a Fresnel-glow
atmosphere shader, and night-light emissive mapping. Drag to rotate, scroll
to zoom, and **click a glowing marker to select that district** — it drives
the same `onSelect` state as the 2D map and district list, so all three stay
in sync.

**The before/after slider is now data-driven, not decorative.** When live
Earth Engine data is on, it shows real exported satellite thumbnails
(`gee_service.get_district_images`). Until then, it falls back to
`SatelliteTile.tsx` — a visualization whose water-body size, vegetation
density, and built-up density are computed directly from that district's
real NDWI/NDVI/NDBI numbers, not a flat gradient you drag for show.

## Run it

**Backend**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/docs` to see the live API (auto-generated Swagger UI —
demo this, judges like it).

**Frontend**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Visit `http://localhost:3000`.

That's it — you should see a live map of 3 districts (Beed, Bengaluru Urban, Nagpur),
color-coded by severity, with plain-language SDG verdicts for each.

## Why this base is structured the way it is

The whole point of `indicator_engine.py` is that **the shape of the data never
changes** — only where it comes from does. It calls `gee_service.py` for live
numbers when `USE_GEE=true` and credentials are valid, and falls back
automatically (per-district, with a logged reason) to `mock_districts.py`
otherwise — one bad AOI or an expired credential never takes down the whole
dashboard mid-demo. The API response includes `"data_source": "live"` or
`"mock"` so the frontend (and you, in a pitch) can show honestly which is which.

## Next steps (in order)

1. **Get real Earth Engine access** — follow `backend/SETUP_GEE.md` end to
   end (Google Cloud project, service account, Earth Engine registration).
2. **Flip `USE_GEE=true`** in `backend/.env` — the computation code
   (`gee_service.py`) is already written and does real NDWI/NDVI/NDBI math on
   Sentinel-2 imagery, no further backend changes needed.
3. **Replace the placeholder AOI** — currently a 5km circle around each
   district centroid. Swap in real district boundary polygons (GADM / Survey
   of India GeoJSON) for accurate area calculations.
4. **Add real before/after imagery** — export GEE results as PNG tiles and
   swap the placeholder gradients in `BeforeAfterSlider.tsx` for `<img>` tags.

## Ideas to push this from "working" to "hackathon-winning"

- **One real, verifiable number.** Judges remember the team that showed one
  real before/after satellite comparison with a citation, not the team with
  the most features. Prioritize this over more districts.
- **A "why this matters" framing per district** — e.g. tie Beed's water
  shrinkage to Marathwada's known drought history. Real-world grounding beats
  more charts.
- **Add a PDF export** of the district scorecard — something a real district
  officer could actually forward to their boss. (`reportlab` or a headless
  print of the dashboard both work fast.)
- **Add a confidence/data-quality note** per indicator (e.g. "based on 3
  cloud-free scenes") — shows you understand real satellite data isn't
  perfect, which reads as more credible than pretending it is.
- **A short "how we verified this" slide** — even one sentence like "cross-
  checked against Bhuvan's water body layer" makes the whole project feel
  audited rather than assumed.
- If you have any time left: a **simple linear trend line** per indicator
  (more than 2 data points) turns "before/after" into "trajectory," which is
  what SDG *tracking* actually implies.

## Known limitations (be upfront about these if asked)

- Currently 3 mock districts — swap-in is designed but not yet done.
- Before/after imagery is a placeholder gradient, not real satellite tiles yet.
- Thresholds in `indicator_engine.py` (`THRESHOLDS` dict) are placeholder
  judgment calls — flag this and say you'd calibrate them against historical
  district data given more time.
