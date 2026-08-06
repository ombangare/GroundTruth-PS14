"""
Google Earth Engine Service
============================

This module does the REAL satellite computation — it replaces mock_districts.py
once you've completed the setup in SETUP_GEE.md.

It's gated behind USE_GEE (see config.py) so the app keeps working on mock
data until you've actually got credentials wired up — you can develop the UI
and demo flow without waiting on GEE approval, then flip one flag.

WHAT THIS ACTUALLY COMPUTES (all server-side, inside Earth Engine's cloud —
we never download raw satellite imagery, just the final numbers):

  NDWI (water)      = (Green - NIR) / (Green + NIR)   from Sentinel-2 B3, B8
  NDVI (vegetation)  = (NIR - Red) / (NIR + Red)        from Sentinel-2 B8, B4
  NDBI (built-up)    = (SWIR - NIR) / (SWIR + NIR)      from Sentinel-2 B11, B8
  LST proxy          = derived from NDVI (real LST needs Landsat thermal
                        bands — see note in compute_urban_heat below)

AREA OF INTEREST NOTE:
  Real district boundaries need shapefiles (Survey of India / GADM). This
  module currently uses a circular buffer around each district's centroid as
  a placeholder AOI — good enough for a hackathon demo, not for a real
  district-level rollout. Swap `ee.Geometry.Point(...).buffer(...)` for a
  proper polygon loaded from a GeoJSON once you have real boundaries.
"""

import os
from datetime import datetime
from app.services import district_boundaries

try:
    import ee
    EE_AVAILABLE = True
except ImportError:
    EE_AVAILABLE = False

_initialized = False


def init_earth_engine() -> bool:
    """
    Initializes Earth Engine using a service account.
    Returns True if successful, False otherwise (caller should fall back to mock data).
    """
    global _initialized
    if _initialized:
        return True
    if not EE_AVAILABLE:
        return False

    service_account = os.environ.get("GEE_SERVICE_ACCOUNT_EMAIL")
    key_path = os.environ.get("GEE_SERVICE_ACCOUNT_KEY_PATH")
    project_id = os.environ.get("GEE_PROJECT_ID")

    if not (service_account and key_path and project_id):
        return False

    try:
        credentials = ee.ServiceAccountCredentials(service_account, key_path)
        ee.Initialize(credentials, project=project_id)
        _initialized = True
        return True
    except Exception as e:
        print(f"[gee_service] Earth Engine init failed: {e}")
        return False


def _sentinel2_composite(aoi, start_date: str, end_date: str):
    """Cloud-masked median composite for the AOI/date range."""
    def mask_clouds(image):
        scl = image.select("SCL")
        # SCL values 3=cloud shadow, 8/9=cloud medium/high, 10=cirrus
        mask = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10))
        return image.updateMask(mask)

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(start_date, f"{start_date[:4]}-12-31" if end_date is None else end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        .map(mask_clouds)
    )
    return collection.median().clip(aoi)


def compute_water_area(aoi, year: str) -> float:
    """Returns water surface area in sq km using NDWI > 0 threshold."""
    image = _sentinel2_composite(aoi, f"{year}-01-01", f"{year}-12-31")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
    water_mask = ndwi.gt(0.0)
    area_image = water_mask.multiply(ee.Image.pixelArea())
    stats = area_image.reduceRegion(
        reducer=ee.Reducer.sum(), geometry=aoi, scale=30, maxPixels=1e9
    )
    sq_meters = stats.get("NDWI").getInfo() or 0
    return round(sq_meters / 1_000_000, 2)  # sq km


def compute_green_cover_pct(aoi, year: str) -> float:
    """Returns % of AOI with healthy vegetation using NDVI > 0.3 threshold."""
    image = _sentinel2_composite(aoi, f"{year}-01-01", f"{year}-12-31")
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    veg_mask = ndvi.gt(0.3)

    veg_area = veg_mask.multiply(ee.Image.pixelArea()).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=aoi, scale=30, maxPixels=1e9
    ).get("NDVI").getInfo() or 0

    # AOI area never depends on the year/image — computing it via a pixel
    # sum every call was pure waste. aoi.area() is a direct geometry
    # calculation (near-instant), not a satellite image reduction.
    total_area = aoi.area(maxError=1).getInfo() or 1

    return round((veg_area / total_area) * 100, 1)


def compute_urban_heat_proxy(aoi, year: str) -> float:
    """
    Returns a built-up/heat intensity proxy (0-10 scale) using NDBI.
    NOTE: True Land Surface Temperature needs Landsat thermal bands
    (ST_B10 on Landsat 8/9). This NDBI-based proxy is a reasonable stand-in
    for a hackathon demo; swap in real LST for a production version — see
    the commented block below.
    """
    image = _sentinel2_composite(aoi, f"{year}-01-01", f"{year}-12-31")
    ndbi = image.normalizedDifference(["B11", "B8"]).rename("NDBI")
    mean_ndbi = ndbi.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=aoi, scale=30, maxPixels=1e9
    ).get("NDBI").getInfo() or 0
    # Rescale NDBI (~ -1 to 1) into a friendlier 0-10 "intensity" number
    return round(max(0, (mean_ndbi + 1) * 5), 2)

    # --- Real LST version (Landsat 8/9), for later ---
    # landsat = (ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    #            .filterBounds(aoi).filterDate(f"{year}-01-01", f"{year}-12-31")
    #            .median().clip(aoi))
    # thermal = landsat.select("ST_B10").multiply(0.00341802).add(149.0).subtract(273.15)
    # mean_temp = thermal.reduceRegion(ee.Reducer.mean(), aoi, 30).get("ST_B10").getInfo()
    # return round(mean_temp, 1)  # degrees Celsius


def get_thumbnail_url(aoi, year: str, dimensions: int = 512) -> str:
    """
    Returns a real, true-color satellite thumbnail URL for the AOI/year,
    hosted by Google (no image data passes through our backend). Used by
    the frontend's before/after slider when live GEE data is available.
    """
    image = _sentinel2_composite(aoi, f"{year}-01-01", f"{year}-12-31")
    vis_params = {"bands": ["B4", "B3", "B2"], "min": 0, "max": 3000, "gamma": 1.2}
    return image.getThumbURL({**vis_params, "region": aoi, "dimensions": dimensions, "format": "png"})


def _build_aoi(lat: float, lon: float, buffer_m: int, district: dict | None = None):
    """
    Returns the Earth Engine geometry to use as the area of interest.
    Uses the district's real boundary polygon if one was found in
    districts.geojson (via district_boundaries.py); falls back to a
    circle buffer around the centroid otherwise — so a missing/unmatched
    boundary file never breaks computation, it just makes it less precise.
    """
    if district is not None:
        geometry = district_boundaries.get_district_geometry(district)
        if geometry is not None:
            return ee.Geometry(geometry)
    return ee.Geometry.Point([lon, lat]).buffer(buffer_m)


def get_district_images(lat: float, lon: float, before_year: str, after_year: str, buffer_m: int = 5000, district: dict | None = None) -> dict:
    """Returns real before/after thumbnail URLs for a district, or None values on failure."""
    aoi = _build_aoi(lat, lon, buffer_m, district)
    return {
        "before": get_thumbnail_url(aoi, before_year),
        "after": get_thumbnail_url(aoi, after_year),
    }



def compute_district_indicators(lat: float, lon: float, before_year: str, after_year: str, buffer_m: int = 5000, district: dict | None = None) -> dict:
    """
    Main entry point: computes all 3 indicators for a district, for both
    time periods. Returns a dict shaped to match mock_districts.py exactly,
    so indicator_engine.py doesn't need to know or care whether the numbers
    came from GEE or the mock fixture.
    """
    aoi = _build_aoi(lat, lon, buffer_m, district)

    return {
        "water": {
            "sdg": "SDG 6",
            "label": "Water body surface area",
            "index_used": "NDWI",
            "before_value_sqkm": compute_water_area(aoi, before_year),
            "after_value_sqkm": compute_water_area(aoi, after_year),
        },
        "green_cover": {
            "sdg": "SDG 15",
            "label": "Vegetation / green cover",
            "index_used": "NDVI",
            "before_value_pct": compute_green_cover_pct(aoi, before_year),
            "after_value_pct": compute_green_cover_pct(aoi, after_year),
        },
        "urban_heat": {
            "sdg": "SDG 11",
            "label": "Urban heat island intensity",
            "index_used": "NDBI (proxy)",
            "before_value_celsius": compute_urban_heat_proxy(aoi, before_year),
            "after_value_celsius": compute_urban_heat_proxy(aoi, after_year),
        },
    }
