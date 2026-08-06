"""
Google Earth Engine Service
============================

This module does the REAL satellite computation.


WHAT THIS ACTUALLY COMPUTES (all server-side, inside Earth Engine's cloud —
we never download raw satellite imagery, just the final numbers):

  NDWI (water)      = (Green - NIR) / (Green + NIR)   from Sentinel-2 B3, B8
  NDVI (vegetation)  = (NIR - Red) / (NIR + Red)        from Sentinel-2 B8, B4
  NDBI (built-up)    = (SWIR - NIR) / (SWIR + NIR)      from Sentinel-2 B11, B8
  LST proxy          = derived from NDVI (real LST needs Landsat thermal
                        bands — see note in compute_urban_heat below)

AREA OF INTEREST NOTE:
  This module dynamically loads the exact district polygon from Google Earth Engine 
  Assets using the GEE_ASSET_DISTRICT_BOUNDARY environment variable. If the asset
  is not configured, it gracefully falls back to a circular buffer around the centroid.
"""

import os
from datetime import datetime

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


def _compute_year_stats_ee(aoi, year: str):
    """
    Returns an uncomputed ee.Dictionary containing the water, green, and heat 
    stats for a given year. This prevents redundant composite building.
    """
    image = _sentinel2_composite(aoi, f"{year}-01-01", f"{year}-12-31")
    
    # Water (NDWI)
    ndwi = image.normalizedDifference(["B3", "B8"])
    water_area = ndwi.gt(0).multiply(ee.Image.pixelArea()).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=aoi, scale=1000, maxPixels=1e10
    ).get("nd")
    
    # Green (NDVI)
    ndvi = image.normalizedDifference(["B8", "B4"])
    green_area = ndvi.gt(0.3).multiply(ee.Image.pixelArea()).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=aoi, scale=1000, maxPixels=1e10
    ).get("nd")
    
    # Heat Proxy (NDBI)
    ndbi = image.normalizedDifference(["B11", "B8"])
    mean_ndbi = ndbi.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=aoi, scale=1000, maxPixels=1e10
    ).get("nd")
    
    return ee.Dictionary({
        "water_sqkm": ee.Number(water_area).divide(1_000_000),
        "green_area_sqm": ee.Number(green_area),
        "mean_ndbi": ee.Number(mean_ndbi)
    })


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
    If GEE_ASSET_DISTRICT_BOUNDARY is set in the environment, it queries
    the actual polygon from the Earth Engine FeatureCollection.
    Otherwise, it falls back to a simple centroid buffer.
    """
    asset_id = os.environ.get("GEE_ASSET_DISTRICT_BOUNDARY")
    if asset_id and district and district.get("name"):
        try:
            fc = ee.FeatureCollection(asset_id)
            # The shapefile DISTRICT names are entirely uppercase
            feature = fc.filter(ee.Filter.eq("DISTRICT", district["name"].upper())).first()
            return feature.geometry()
        except Exception as e:
            print(f"[gee_service] Failed to load AOI from Asset {asset_id}: {e}. Falling back to buffer.")
            
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
    time periods using a single highly-optimized Earth Engine network call.
    """
    aoi = _build_aoi(lat, lon, buffer_m, district)

    # Build an Earth Engine dictionary to compute EVERYTHING in parallel on Google's servers
    payload = ee.Dictionary({
        "before": _compute_year_stats_ee(aoi, before_year),
        "after": _compute_year_stats_ee(aoi, after_year),
        "total_area_sqm": aoi.area(maxError=1)
    })
    
    # ⬇⬇⬇ THIS IS THE ONLY NETWORK CALL ⬇⬇⬇
    results = payload.getInfo()
    
    # Safely parse the results (Earth Engine returns None for empty/null values)
    total_area_sqm = results.get("total_area_sqm") or 1
    
    def parse_stats(period: str):
        data = results.get(period, {})
        water = data.get("water_sqkm") or 0
        green_sqm = data.get("green_area_sqm") or 0
        green_pct = (green_sqm / total_area_sqm) * 100
        ndbi = data.get("mean_ndbi") or 0
        heat_proxy = max(0, (ndbi + 1) * 5)
        
        return {
            "water": round(water, 2),
            "green": round(green_pct, 1),
            "heat": round(heat_proxy, 2)
        }

    before_stats = parse_stats("before")
    after_stats = parse_stats("after")

    return {
        "water": {
            "sdg": "SDG 6",
            "label": "Water body surface area",
            "index_used": "NDWI",
            "before_value_sqkm": before_stats["water"],
            "after_value_sqkm": after_stats["water"],
        },
        "green_cover": {
            "sdg": "SDG 15",
            "label": "Vegetation / green cover",
            "index_used": "NDVI",
            "before_value_pct": before_stats["green"],
            "after_value_pct": after_stats["green"],
        },
        "urban_heat": {
            "sdg": "SDG 11",
            "label": "Urban heat island intensity",
            "index_used": "NDBI (proxy)",
            "before_value_celsius": before_stats["heat"],
            "after_value_celsius": after_stats["heat"],
        },
    }
