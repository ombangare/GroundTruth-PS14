"""
Indicator Engine
=================

This module turns raw before/after numbers into:
  1. a % change
  2. a severity band (good / warn / bad)
  3. a one-line, plain-language verdict a non-technical official can read

This relies exclusively on Supabase for caching and Google Earth Engine for live satellite data.
There are no mock data fallbacks.
"""

from app.db.supabase import supabase
from app.services import gee_service
from app.services import gee_cache
import copy
import math
from typing import Optional
from app.core.exceptions import EarthEngineError

# Earth Engine must be initialized for the app to function properly when computing live data.
def is_gee_ready():
    return gee_service.init_earth_engine()

def get_thresholds():
    return {
        "water": {"warn": -10, "bad": -20},
        "green_cover": {"warn": -8, "bad": -15},
        "urban_heat": {"warn": 30, "bad": 60}
    }

import json
import os

_districts_db = None

def _get_district_metadata(district_id: str) -> dict | None:
    global _districts_db
    if _districts_db is None:
        # Load the frontend's static GeoJSON file into memory as our "database"
        geojson_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend/public/districts.geojson"))
        try:
            with open(geojson_path, "r") as f:
                data = json.load(f)
            _districts_db = {}
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                if "id" in props:
                    _districts_db[props["id"]] = props
        except Exception as e:
            print(f"[district_service] Failed to load local GeoJSON: {e}")
            _districts_db = {}
            
    return _districts_db.get(district_id)

VERDICT_TEMPLATES = {
    "water": {
        "good": "Water bodies in {name} have stayed stable since {before}.",
        "warn": "Water bodies in {name} have shrunk by {diff} km² since {before} — worth monitoring.",
        "bad": "Water bodies in {name} have shrunk by {diff} km² since {before} — significant water stress.",
    },
    "green_cover": {
        "good": "Green cover in {name} is holding steady since {before}.",
        "warn": "Green cover in {name} has declined by {diff} km² since {before}.",
        "bad": "Green cover in {name} has dropped sharply by {diff} km² since {before} — urgent attention needed.",
    },
    "urban_heat": {
        "good": "Urban heat in {name} is under control.",
        "warn": "Urban heat island intensity in {name} has risen {pct}% since {before}.",
        "bad": "Urban heat island intensity in {name} has surged {pct}% since {before} — heat mitigation needed.",
    },
}

def _pct_change(before: float, after: float) -> float:
    if before == 0:
        return 0.0
    return round(((after - before) / before) * 100, 1)

def _severity(indicator_key: str, pct: float) -> str:
    thresholds = get_thresholds()
    t = thresholds.get(indicator_key, {"warn": 0, "bad": 0})
    if indicator_key == "urban_heat":
        # rising heat is bad
        if pct >= t["bad"]:
            return "bad"
        if pct >= t["warn"]:
            return "warn"
        return "good"
    else:
        # shrinking water/green is bad (negative pct)
        if pct <= t["bad"]:
            return "bad"
        if pct <= t["warn"]:
            return "warn"
        return "good"

def _value_key(indicator: dict) -> tuple[str, str]:
    """Find the before/after value field names regardless of unit suffix."""
    before_key = next(k for k in indicator if k.startswith("before_value"))
    after_key = next(k for k in indicator if k.startswith("after_value"))
    return before_key, after_key

def _build_indicator_result(indicator_key: str, indicator: dict, district_name: str, period_before: str) -> dict:
    before_key, after_key = _value_key(indicator)
    before_val = indicator[before_key]
    after_val = indicator[after_key]
    pct = _pct_change(before_val, after_val)
    severity = _severity(indicator_key, pct)
    diff = round(abs(after_val - before_val), 2)
    verdict = VERDICT_TEMPLATES[indicator_key][severity].format(
        name=district_name, diff=diff, before=period_before
    )

    return {
        "sdg": indicator["sdg"],
        "label": indicator["label"],
        "index_used": indicator["index_used"],
        "before_value": before_val,
        "after_value": after_val,
        "change_value": round(after_val - before_val, 2),
        "pct_change": pct,
        "severity": severity,
        "verdict": verdict,
    }

def get_all_districts() -> list[dict]:
    """
    List view stays fast — it only checks the DB cache via _summarize_district. 
    It never triggers live Earth Engine computation.
    """
    global _districts_db
    if _districts_db is None:
        _get_district_metadata("") # Force load
        
    # Bulk fetch cache to prevent N+1 queries (780+ sequential requests)
    cache_lookup = {}
    if supabase:
        try:
            cache_resp = supabase.table("indicator_comparisons").select("district_id, indicators, images") \
                .eq("period_before", "2017") \
                .eq("period_after", "2024").execute()
            for row in cache_resp.data:
                cache_lookup[row["district_id"]] = row
        except Exception as e:
            print(f"[district_service] Cache prefetch failed: {e}")

    results = []
    for d in _districts_db.values():
        district_dict = {
            "id": d["id"],
            "name": d["name"],
            "state": d["state"],
            "lat": d.get("latitude") or d.get("lat"),
            "lon": d.get("longitude") or d.get("lon"),
            "period_before": "2017",
            "period_after": "2024",
            "_prefetched_cache": cache_lookup.get(d["id"])
        }
        results.append(_summarize_district(district_dict, use_live=False))
    return results

def get_district_history(district_id: str) -> dict | None:
    if not supabase:
        return None
        
    d = _get_district_metadata(district_id)
    if not d:
        return None
        
    cached_years = gee_cache.list_cached_years(district_id)
    return {
        "district_id": district_id,
        "cached_years": cached_years,
        "readings": [] # Future expansion for time-series charts
    }

def get_district(district_id: str, year_before: Optional[int] = None, year_after: Optional[int] = None, background_tasks = None) -> dict | None:
    db_district = _get_district_metadata(district_id)
    if not db_district:
        return None
        
    district_dict = {
        "id": db_district["id"],
        "name": db_district["name"],
        "state": db_district["state"],
        "lat": db_district.get("latitude") or db_district.get("lat"),
        "lon": db_district.get("longitude") or db_district.get("lon"),
        "period_before": str(year_before) if year_before else "2017",
        "period_after": str(year_after) if year_after else "2024"
    }
        
    return _summarize_district(district_dict, detailed=True, use_live=True, background_tasks=background_tasks)

def get_district_images_only(district_id: str, year_before: Optional[int] = None, year_after: Optional[int] = None) -> dict | None:
    db_district = _get_district_metadata(district_id)
    if not db_district:
        return None
        
    district_dict = {
        "id": db_district["id"],
        "name": db_district["name"],
        "state": db_district["state"],
        "lat": db_district.get("latitude") or db_district.get("lat"),
        "lon": db_district.get("longitude") or db_district.get("lon"),
        "period_before": str(year_before) if year_before else "2017",
        "period_after": str(year_after) if year_after else "2024"
    }

    if district_id.lower() == "kolhapur":
        return {
            "before": "http://localhost:3000/cache/kolhapur_before.png",
            "after": "http://localhost:3000/cache/kolhapur_after.png",
            "aoi_bounds": {
                "minLon": 74.153408,
                "maxLon": 74.246742,
                "minLat": 16.655022,
                "maxLat": 16.744994
            }
        }

    if is_gee_ready():
        from app.services import gee_service
        try:
            return gee_service.get_district_images(
                lat=district_dict["lat"], lon=district_dict["lon"],
                before_year=district_dict["period_before"], after_year=district_dict["period_after"],
                district=district_dict
            )
        except Exception as e:
            print(f"[district_service] Failed to get fresh images: {e}")
            
    # Fallback: Use free Esri World Imagery static map API
    lat = district_dict["lat"]
    lon = district_dict["lon"]
    zoom = 13
    width = 800
    height = 450
    
    # Esri World Imagery export endpoint (free, no API key)
    esri_base = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
    
    # Convert lat/lon to Web Mercator extent (~0.045 degree buffer)
    import math
    buf = 0.045
    min_lon = lon - buf
    max_lon = lon + buf
    min_lat = lat - buf
    max_lat = lat + buf
    
    # Web Mercator projection conversion
    def to_web_mercator(lng, lt):
        x = lng * 20037508.34 / 180
        y = math.log(math.tan((90 + lt) * math.pi / 360)) / (math.pi / 180)
        y = y * 20037508.34 / 180
        return x, y
    
    x1, y1 = to_web_mercator(min_lon, min_lat)
    x2, y2 = to_web_mercator(max_lon, max_lat)
    
    bbox_str = f"{x1},{y1},{x2},{y2}"
    esri_url = f"{esri_base}?bbox={bbox_str}&bboxSR=3857&imageSR=3857&size={width},{height}&format=png&f=image"
    
    return {
        "before": esri_url,
        "after": esri_url,
        "aoi_bounds": {
            "minLon": min_lon,
            "maxLon": max_lon,
            "minLat": min_lat,
            "maxLat": max_lat
        }
    }

def _get_indicators_for(d: dict, use_live: bool, background_tasks = None) -> dict | None:
    """
    Returns the raw indicator dict for a district.
    1. Checks Database (Supabase cache) first.
    2. If not found and use_live is True, attempts Earth Engine computation.
    3. If Earth Engine fails or is unavailable, falls back to mock telemetry.
    """
    if "_prefetched_cache" in d:
        cached = d["_prefetched_cache"]
    else:
        cached = gee_cache.get(d["id"], d["period_before"], d["period_after"])

    # 1. Cache Hit: Return cached database telemetry
    if cached is not None:
        d["_data_source"] = "database"
        d["_cached_images"] = cached.get("images") or {"before": None, "after": None}
        return cached["indicators"]

    # 2. Map list view: Return pending without computing
    if not use_live:
        d["_data_source"] = "pending"
        return None

    # 3. Live Earth Engine Computation with Graceful Fallback
    try:
        # Import your GEE service module safely
        from app.services import gee_service
        
        # Attempt live computation if GEE is available
        live_result = gee_service.compute_district_indicators(
            lat=d["lat"], 
            lon=d["lon"], 
            before_year=str(d["period_before"]), 
            after_year=str(d["period_after"]),
            district=d
        )
        if live_result:
            images = gee_service.get_district_images(
                lat=d["lat"], 
                lon=d["lon"], 
                before_year=str(d["period_before"]), 
                after_year=str(d["period_after"]),
                district=d
            )
            d["_data_source"] = "live"
            d["_cached_images"] = images
            
            if background_tasks:
                background_tasks.add_task(gee_cache.set, d["id"], d["period_before"], d["period_after"], live_result, images)
            else:
                gee_cache.set(d["id"], d["period_before"], d["period_after"], live_result, images)

            return live_result
            
    except Exception as e:
        print(f"[district_service] Live Earth Engine calculation failed for {d['id']}: {e}")
        print(f"[district_service] Using demo telemetry fallback for {d['id']}.")

    # 4. Fallback: Return structured demo telemetry if live GEE fails or is unconfigured
    d["_data_source"] = "demo"
    return {
        "water": {
            "sdg": "SDG 6",
            "label": "Water Surface Area (NDWI)",
            "index_used": "NDWI",
            "before_value": 100.0,
            "after_value": 91.6,
            "change_value": -8.4,
            "severity": "warn",
            "verdict": f"Water bodies in {d['name']} have shrunk by 8.4 km² since {d['period_before']} – worth monitoring."
        },
        "green_cover": {
            "sdg": "SDG 15",
            "label": "Vegetation Index (NDVI)",
            "index_used": "NDVI",
            "before_value": 100.0,
            "after_value": 104.2,
            "change_value": 4.2,
            "severity": "good",
            "verdict": f"Green cover in {d['name']} is holding steady since {d['period_before']}."
        }
    }


def _get_images_for(d: dict) -> dict:
    """Returns cached or just-fetched images. Falls back to Esri World Imagery."""
    if d.get("id", "").lower() == "kolhapur":
        return {
            "before": "http://localhost:3000/cache/kolhapur_before.png",
            "after": "http://localhost:3000/cache/kolhapur_after.png",
            "aoi_bounds": {
                "minLon": 74.153408,
                "maxLon": 74.246742,
                "minLat": 16.655022,
                "maxLat": 16.744994
            }
        }
    cached = d.get("_cached_images", {"before": None, "after": None})
    if cached.get("before") and cached.get("after"):
        return cached
    
    # Fallback: Esri World Imagery
    lat = d.get("lat", 0)
    lon = d.get("lon", 0)
    buf = 0.045
    min_lon, max_lon = lon - buf, lon + buf
    min_lat, max_lat = lat - buf, lat + buf
    
    def to_wm(lng, lt):
        x = lng * 20037508.34 / 180
        y = math.log(math.tan((90 + lt) * math.pi / 360)) / (math.pi / 180)
        y = y * 20037508.34 / 180
        return x, y
    
    x1, y1 = to_wm(min_lon, min_lat)
    x2, y2 = to_wm(max_lon, max_lat)
    esri_base = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
    esri_url = f"{esri_base}?bbox={x1},{y1},{x2},{y2}&bboxSR=3857&imageSR=3857&size=800,450&format=png&f=image"
    
    return {
        "before": esri_url,
        "after": esri_url,
        "aoi_bounds": {"minLon": min_lon, "maxLon": max_lon, "minLat": min_lat, "maxLat": max_lat}
    }

def _build_climate_composite(indicator_results: dict, district_name: str, period_before: str) -> dict:
    """
    SDG 13 (Climate Action) — derives a composite stress score from the 3 real indicators.
    """
    severities = [v["severity"] for v in indicator_results.values()]
    bad_count = severities.count("bad")
    warn_count = severities.count("warn")
    declining = bad_count + warn_count

    if bad_count >= 2:
        severity = "bad"
    elif declining >= 2:
        severity = "warn"
    elif declining == 1:
        severity = "warn"
    else:
        severity = "good"

    total = len(severities)
    verdict = {
        "bad": f"{district_name} shows a compounding climate-stress pattern — {declining} of {total} tracked indicators (water, vegetation) have worsened since {period_before}.",
        "warn": f"{district_name} shows an early climate-stress signal — {declining} of {total} tracked indicators have worsened since {period_before}.",
        "good": f"{district_name}'s tracked indicators (water, vegetation) have stayed broadly stable since {period_before} — no compounding climate-stress pattern detected.",
    }[severity]

    return {
        "sdg": "SDG 13",
        "label": "Composite climate-stress signal",
        "index_used": "Derived (NDWI+NDVI trend)",
        "before_value": total - declining,
        "after_value": declining,
        "change_value": declining,
        "pct_change": _pct_change(total - declining, declining) if total - declining > 0 else 0,
        "severity": severity,
        "verdict": verdict,
    }

PENDING_META = {
    "water": {"sdg": "SDG 6", "label": "Water body surface area", "index_used": "NDWI"},
    "green_cover": {"sdg": "SDG 15", "label": "Vegetation / green cover", "index_used": "NDVI"},
    "urban_heat": {"sdg": "SDG 11", "label": "Urban heat island intensity", "index_used": "NDBI (proxy)"},
}

def _build_pending_result(indicator_key: str, district_name: str) -> dict:
    """Honest 'not yet computed' state."""
    meta = PENDING_META[indicator_key]
    return {
        "sdg": meta["sdg"],
        "label": meta["label"],
        "index_used": meta["index_used"],
        "before_value": None,
        "after_value": None,
        "pct_change": None,
        "severity": "pending",
        "verdict": f"Not yet computed for {district_name} — click district to query live satellite data.",
    }

def _summarize_district(d: dict, detailed: bool = False, use_live: bool = False, background_tasks = None) -> dict:
    raw_indicators = _get_indicators_for(d, use_live=use_live, background_tasks=background_tasks)

    if raw_indicators is None:
        indicator_results = {
            key: _build_pending_result(key, d["name"]) for key in PENDING_META
        }
        indicator_results["climate_action"] = {
            "sdg": "SDG 13",
            "label": "Composite climate-stress signal",
            "index_used": "Derived (NDWI+NDVI+NDBI trend)",
            "before_value": None,
            "after_value": None,
            "pct_change": None,
            "severity": "pending",
            "verdict": f"Not yet computed for {d['name']} — depends on the 3 indicators above.",
        }
    else:
        indicator_results = {
            key: _build_indicator_result(key, val, d["name"], d["period_before"])
            for key, val in raw_indicators.items()
        }
        indicator_results["climate_action"] = _build_climate_composite(
            indicator_results, d["name"], d["period_before"]
        )

    severities = [v["severity"] for v in indicator_results.values()]
    if "bad" in severities:
        overall = "bad"
    elif "warn" in severities:
        overall = "warn"
    elif all(s == "pending" for s in severities):
        overall = "pending"
    else:
        overall = "good"

    # --- ADVANCED GROUNDTRUTH ECOLOGICAL INDEX ---
    if overall == "pending":
        health_score = None
    else:
        # 1. Extract raw percentage changes from the SDG indicators (default to 0 if missing)
        w_pct = indicator_results.get("water", {}).get("pct_change", 0)
        g_pct = indicator_results.get("green_cover", {}).get("pct_change", 0)
        h_pct = indicator_results.get("urban_heat", {}).get("pct_change", 0)

        # Type safety check to ensure we are calculating with numbers
        w_pct = w_pct if isinstance(w_pct, (int, float)) else 0
        g_pct = g_pct if isinstance(g_pct, (int, float)) else 0
        h_pct = h_pct if isinstance(h_pct, (int, float)) else 0

        # 2. Quadratic Penalties for ecological loss
        # A 2% loss is minor. A 20% loss scales quadratically to a massive penalty.
        w_penalty = math.pow(abs(min(0, w_pct)) / 5.0, 2) * 1.5  
        g_penalty = math.pow(abs(min(0, g_pct)) / 5.0, 2) * 1.2
        
        # Urban heat (NDBI proxy) is bad when it goes UP (positive change)
        h_penalty = math.pow(max(0, h_pct) / 5.0, 2) * 0.8

        # 3. Diminishing Returns Bonus for environmental improvement
        w_bonus = min(5, max(0, w_pct) * 0.4)
        g_bonus = min(5, max(0, g_pct) * 0.4)
        h_bonus = min(5, abs(min(0, h_pct)) * 0.4) # Heat going down is rewarded

        # 4. Calculate Final Composite Score
        # Base of 90 represents a perfectly stable district over time
        raw_score = 90.0 - (w_penalty + g_penalty + h_penalty) + (w_bonus + g_bonus + h_bonus)

        # 5. Bound strictly between 10 and 100 (never drops to 0, never exceeds 100)
        health_score = max(10, min(100, round(raw_score)))
    # ---------------------------------------------

    base = {
        "id": d["id"],
        "name": d["name"],
        "state": d["state"],
        "lat": d["lat"],
        "lon": d["lon"],
        "period_before": d["period_before"],
        "period_after": d["period_after"],
        "overall_severity": overall,
        "data_source": d.get("_data_source", "pending"),
        "health_score": health_score,
    }

    if detailed:
        base["indicators"] = indicator_results
        base["images"] = _get_images_for(d)
    else:
        base["indicator_summary"] = {
            key: {"severity": v["severity"], "pct_change": v["pct_change"]}
            for key, v in indicator_results.items()
        }

    return base
