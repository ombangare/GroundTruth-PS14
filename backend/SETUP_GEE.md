# Setting Up Real Google Earth Engine Access

This gets GroundTruth pulling **real Sentinel-2 satellite data** instead of
mock numbers. Takes about 15-20 minutes, most of it is waiting on Google's
approval step.

## 1. Get Earth Engine access (one-time, per Google account)

1. Go to https://earthengine.google.com/ → "Get Started"
2. Sign in with a Google account, register for **non-commercial use**
   (free, instant-to-a-few-days approval — student/hackathon use qualifies)
3. Wait for the confirmation email before continuing

## 2. Create a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Create a new project (e.g. `groundtruth-hackathon`) — note the **Project ID**
3. In the search bar, find **"Earth Engine API"** and click **Enable**

## 3. Create a service account (this is your "API key" equivalent)

1. In Cloud Console → **IAM & Admin → Service Accounts → Create Service Account**
2. Name it anything (e.g. `groundtruth-backend`)
3. Grant it the role **"Earth Engine Resource Writer"** (or Viewer if you only read data)
4. After creation, click into it → **Keys** tab → **Add Key → Create New Key → JSON**
5. This downloads a `.json` file — **treat it like a password, never commit it to git**

## 4. Register the service account for Earth Engine

1. Go to https://code.earthengine.google.com/register
2. Register the **same Google Cloud project** from step 2 for Earth Engine access

## 5. Wire it into the backend

Move the downloaded JSON file into `backend/` (it's already git-ignored) and
create a `.env` file in `backend/`:

```env
USE_GEE=true
GEE_PROJECT_ID=groundtruth-hackathon
GEE_SERVICE_ACCOUNT_EMAIL=groundtruth-backend@groundtruth-hackathon.iam.gserviceaccount.com
GEE_SERVICE_ACCOUNT_KEY_PATH=./your-key-file.json
```

Install the Earth Engine Python package:

```bash
cd backend
pip install earthengine-api python-dotenv
```

Add this to the very top of `app/main.py` (before other imports) so the `.env` loads:

```python
from dotenv import load_dotenv
load_dotenv()
```

Restart the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Check the terminal — you should see:

```
[indicator_engine] Earth Engine connected — using LIVE satellite data.
```

If instead you see `USE_GEE=true but Earth Engine init failed`, the two most
common causes are: (a) the service account wasn't registered in step 4, or
(b) the key path in `.env` is wrong/relative to the wrong folder.

## 6. Verify it's really live (not silently falling back)

Hit `http://localhost:8000/api/districts/beed` — the response now includes
`"data_source": "live"`. If it says `"mock"`, GEE init failed and it silently
fell back — check the terminal logs for why.

## What's still a placeholder after this

- **District boundaries**: currently a 5km circular buffer around each
  district's centroid (`gee_service.py`, `buffer_m=5000`), not a real
  administrative polygon. For a real district shape, get a GeoJSON from
  [GADM](https://gadm.org/) or Survey of India and load it with
  `ee.Geometry(geojson)` instead of the point-buffer.
- **Urban heat**: uses an NDBI-based proxy, not true Land Surface
  Temperature. Real LST needs Landsat 8/9 thermal bands — there's a
  commented-out worked example for this in `gee_service.py`.
