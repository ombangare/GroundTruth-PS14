# GroundTruth

Satellite-derived SDG progress, translated into plain language, for 780+ Indian districts.

GroundTruth features a real FastAPI backend and a Next.js dashboard, wired end to end. It leverages **live Google Earth Engine** computation on Sentinel-2 satellite imagery to track water body surface area (NDWI), green cover (NDVI), and urban heat (NDBI proxy) over time, while instantly caching the data centrally via Supabase.

```text
groundtruth/
├── backend/                     FastAPI — indicator engine + API
│   ├── BACKEND_SETUP.md         ← MUST READ: Initial one-time setup guide
│   └── app/
│       ├── main.py
│       ├── routers/districts.py
│       ├── services/
│       │   ├── district_service.py         ← business logic: thresholds, verdicts, severity
│       │   ├── gee_cache.py                ← Supabase database cache integrations
│       │   └── gee_service.py              ← REAL Sentinel-2 NDWI/NDVI/NDBI computation
│       └── data/mock_districts.py          ← fallback data source
└── frontend/                    Next.js 14 (App Router) + Tailwind + Three.js
    ├── app/page.tsx             ← dashboard with 3D globe hero
    ├── components/
    │   ├── Globe3D.tsx          ← rotating Earth (Three.js), district markers
    │   ├── DistrictMap.tsx      ← Leaflet transparent Esri satellite map
    │   ├── IndicatorCard.tsx    ← dynamic SDG breakdowns
    │   └── BeforeAfterSlider.tsx← true-color satellite thumbnail comparisons
    └── public/districts.geojson ← 781 Indian district polygons mapping
```

## Performance & Architecture

- **Ultra-Lean Database:** We have removed redundant tables. The app runs on a single `indicator_comparisons` cache table in Supabase. The district list is powered directly by a static `districts.geojson` file in both the frontend and backend, drastically cutting network latency.
- **FastAPI Background Tasks:** Writing new satellite computations to the database never blocks the user. The JSON payload is returned to the frontend instantly upon completion, while Supabase caching happens silently in a background thread.
- **Optimized Earth Engine Graph:** Sentinel-2 median composites are built lazily. The backend generates a single computation graph for all 3 indicators for both years and executes it via a single `getInfo()` call at a `1000m` scale. This prevents Google memory limit crashes and returns district-wide stats blazingly fast.

## 1. Initial One-Time Setup

**Before you can run the app**, you must configure your Google Earth Engine service account and initialize your Supabase caching database.

**➡️ Please strictly follow the [backend/BACKEND_SETUP.md](./backend/BACKEND_SETUP.md) guide.** 

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

That's it! You should now see a stunning 3D Earth. You can spin the globe, filter districts, or click the transparent map. Any district you select will trigger the backend to crunch the math on Google Earth Engine and permanently cache the result for all future users.
