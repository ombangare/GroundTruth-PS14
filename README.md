# GroundTruth

Satellite-derived SDG progress, translated into plain language, for 780+ Indian districts.

GroundTruth features a real FastAPI backend and a Next.js dashboard, wired end to end. It leverages **live Google Earth Engine** computation on Sentinel-2 satellite imagery to track water body surface area (NDWI), green cover (NDVI), and urban heat (NDBI proxy) over time, while instantly caching the data centrally via Supabase.

```text
groundtruth/
├── SETUP.md                     ← MUST READ: Initial one-time setup guide
├── backend/                     FastAPI — indicator engine + API
│   └── app/
│       ├── main.py
│       ├── routers/districts.py
│       ├── services/
│       │   ├── district_service.py         ← business logic: thresholds, verdicts, severity
│       │   ├── gee_cache.py                ← Supabase database cache integrations
│       │   └── gee_service.py              ← REAL Sentinel-2 NDWI/NDVI/NDBI computation
└── frontend/                    Next.js 14 (App Router) + Tailwind + Three.js
    ├── app/page.tsx             ← dashboard with 3D globe hero
    ├── components/
    │   ├── Globe3D.tsx          ← rotating Earth (Three.js), high-density district markers
    │   ├── DistrictMap.tsx      ← Leaflet transparent Esri satellite map
    │   ├── IndicatorCard.tsx    ← dynamic SDG breakdowns
    │   └── BeforeAfterSlider.tsx← true-color satellite thumbnail comparisons
    └── public/districts.geojson ← 781 Indian district polygons mapping
```

## Performance & Architecture

- **Ultra-Lean Database:** We have removed redundant tables. The app runs on a single `indicator_comparisons` cache table in Supabase. The district list is powered directly by a static `districts.geojson` file in both the frontend and backend, drastically cutting network latency and zeroing out database coordinate computations.
- **FastAPI Background Tasks:** Writing new satellite computations to the database never blocks the user. The JSON payload is returned to the frontend instantly upon completion, while Supabase caching happens silently in a background thread.
- **Optimized Earth Engine Graph:** Sentinel-2 median composites are built lazily. The backend generates a single computation graph for all 3 indicators for both years and executes it via a single `getInfo()` call at a `1000m` scale. This prevents Google memory limit crashes and returns district-wide stats blazingly fast.
- **Business Logic Layer:** The core brain of the backend is `district_service.py`. It parses raw geospatial numbers from Earth Engine, maps them against severity thresholds, and generates plain-language verdicts.

## Design: Mission-Control HUD

The UI avoids generic gradient SaaS aesthetics in favor of a sharper, instrument-panel identity: a moving cyan grid backdrop, a scanning sweep line, angular clipped-corner panels with corner brackets, and a live ticker strip. It reads as "satellite mission control."

**The globe is a real Earth**, not a wireframe placeholder — NASA Blue Marble day texture, an independently-rotating cloud layer, a Fresnel-glow atmosphere shader, and night-light emissive mapping. Drag to rotate, scroll to zoom, and **click a glowing marker to select that district** — it drives the same `onSelect` state as the 2D map and district list, so all three stay perfectly in sync.

## 1. Initial One-Time Setup

**Before you can run the app**, you must configure your Google Earth Engine service account and initialize your Supabase caching database.

**➡️ Please strictly follow the [SETUP.md](./SETUP.md) guide.** 

*Once you have completed the linear setup in that file, your `.env` and `.env.local` files will be populated, and you are ready to run the app below.*

## 2. Run the Stack (Development)

You will need two separate terminal windows, one for the Python backend and one for the Next.js frontend.

### Terminal 1: Backend
```bash
cd backend
python3 -m venv venv 
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/docs` to see the live API (auto-generated Swagger UI).

### Terminal 2: Frontend
```bash
cd frontend
pnpm install
pnpm dev
```
Visit `http://localhost:3000`.

## Ideas to push this from "working" to "hackathon-winning"

- **One real, verifiable number.** Judges remember the team that showed one real before/after satellite comparison with a citation, not the team with the most features. Prioritize this over blindly adding more districts.
- **A "why this matters" framing per district** — e.g. tie Beed's water shrinkage to Marathwada's known drought history. Real-world grounding beats more charts.
- **Add a PDF export** of the district scorecard — something a real district officer could actually forward to their boss. (`reportlab` or a headless print of the dashboard both work fast.)
- **Add a confidence/data-quality note** per indicator (e.g. "based on 3 cloud-free scenes") — shows you understand real satellite data isn't perfect, which reads as more credible than pretending it is.
- **A short "how we verified this" slide** — even one sentence like "cross-checked against Bhuvan's water body layer" makes the whole project feel audited rather than assumed.
- If you have any time left: a **simple linear trend line** per indicator (more than 2 data points) turns "before/after" into "trajectory," which is what SDG *tracking* actually implies.
