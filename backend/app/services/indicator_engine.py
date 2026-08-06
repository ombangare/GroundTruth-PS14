"""
Indicator Engine
=================

This module turns raw before/after numbers into:
  1. a % change
  2. a severity band (good / warn / bad)
  3. a one-line, plain-language verdict a non-technical official can read

TODAY: it runs on mock data (see data/mock_districts.py).

NEXT STEP (when you plug in Google Earth Engine):
  Replace `get_all_districts()` / `get_district(district_id)` with real
  calls, e.g.:

    import ee
    ee.Initialize()

    def compute_ndwi(aoi, start, end):
        img = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                 .filterBounds(aoi)
                 .filterDate(start, end)
                 .median())
        ndwi = img.normalizedDifference(["B3", "B8"])  # (Green - NIR)/(Green + NIR)
        water_area = ndwi.gt(0.0).multiply(ee.Image.pixelArea())
        return water_area.reduceRegion(ee.Reducer.sum(), aoi, 10).getInfo()

  The rest of this file (thresholds, verdict text, severity bands) stays
  exactly the same — only the numbers feeding into it change from
  mock_districts.py to a live GEE result. This is why the API/frontend
  contract is designed around `before_value` / `after_value` pairs.
"""

from app.data.mock_districts import DISTRICTS
from app.config import USE_GEE
from app.services import gee_service
from app.services import gee_cache
import copy
from typing import Optional

_gee_ready = False
if USE_GEE:
    _gee_ready = gee_service.init_earth_engine()
    if _gee_ready:
        print("[indicator_engine] Earth Engine connected — using LIVE satellite data.")
    else:
        print("[indicator_engine] USE_GEE=true but Earth Engine init failed — falling back to mock data. Check SETUP_GEE.md.")

# Severity thresholds: % change beyond which we flag "warn" or "bad".
# These are placeholder thresholds for the hackathon demo — tune once
# real multi-district data is available.
THRESHOLDS = {
    "water": {"warn": -10, "bad": -20},        # negative = shrinkage
    "green_cover": {"warn": -8, "bad": -15},   # negative = loss
    "urban_heat": {"warn": 30, "bad": 60},      # positive = intensity rising
}

VERDICT_TEMPLATES = {
    "water": {
        "good": "Water bodies in {name} have stayed stable since {before}.",
        "warn": "Water bodies in {name} have shrunk by {pct}% since {before} — worth monitoring.",
        "bad": "Water bodies in {name} have shrunk by {pct}% since {before} — significant water stress.",
    },
    "green_cover": {
        "good": "Green cover in {name} is holding steady since {before}.",
        "warn": "Green cover in {name} has declined by {pct}% since {before}.",
        "bad": "Green cover in {name} has dropped sharply by {pct}% since {before} — urgent attention needed.",
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
    t = THRESHOLDS[indicator_key]
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
    verdict = VERDICT_TEMPLATES[indicator_key][severity].format(
        name=district_name, pct=abs(pct), before=period_before
    )

    return {
        "sdg": indicator["sdg"],
        "label": indicator["label"],
        "index_used": indicator["index_used"],
        "before_value": before_val,
        "after_value": after_val,
        "pct_change": pct,
        "severity": severity,
        "verdict": verdict,
    }


def get_all_districts() -> list[dict]:
    # List view stays fast — it never calls live GEE, only mock/cached severity
    # badges. Real computation happens on-demand when a district is opened
    # (get_district), so clicking around the app doesn't mean waiting on 9+
    # live satellite queries just to render a list.
    results = []
    for d in DISTRICTS:
        results.append(_summarize_district(d, use_live=False))
    return results


def get_district_history(district_id: str) -> dict | None:
    match = next((d for d in DISTRICTS if d["id"] == district_id), None)
    if not match:
        return None
    cached_years = gee_cache.list_cached_years(district_id)
    return {
        "district_id": district_id,
        "cached_years": cached_years,
        "readings": []
    }


def get_district(district_id: str, year_before: Optional[int] = None, year_after: Optional[int] = None) -> dict | None:
    match = next((d for d in DISTRICTS if d["id"] == district_id), None)
    if not match:
        return None
        
    d = copy.deepcopy(match)
    if year_before is not None:
        d["period_before"] = str(year_before)
    if year_after is not None:
        d["period_after"] = str(year_after)
        
    return _summarize_district(d, detailed=True, use_live=True)


def _get_indicators_for(d: dict, use_live: bool) -> dict | None:
    """
    Returns the raw indicator dict for a district. Order of preference:
      1. Disk cache (instant — no Earth Engine call at all)
      2. Live Earth Engine (only on a cache miss)
      3. Legacy mock fixture (older hand-typed entries only)
      4. None ("pending" — nothing available)

    Images are computed and cached together with indicators in the same
    Earth Engine round, so a cache hit skips ALL satellite queries for
    this district, not just the indicator ones.
    """
    if use_live and _gee_ready:
        cached = gee_cache.get(d["id"], d["period_before"], d["period_after"])
        if cached is not None:
            d["_data_source"] = "live"
            d["_cached_images"] = cached.get("images", {"before": None, "after": None})
            return cached["indicators"]

        try:
            result = gee_service.compute_district_indicators(
                lat=d["lat"], lon=d["lon"],
                before_year=d["period_before"], after_year=d["period_after"],
                district=d,
            )
            images = gee_service.get_district_images(
                lat=d["lat"], lon=d["lon"],
                before_year=d["period_before"], after_year=d["period_after"],
                district=d,
            )
            d["_data_source"] = "live"
            d["_cached_images"] = images
            gee_cache.set(d["id"], d["period_before"], d["period_after"], result, images)
            return result
        except Exception as e:
            print(f"[indicator_engine] Live GEE call failed for {d['name']}: {e} — marking as pending for this district.")

    if "indicators" in d:
        d["_data_source"] = "mock"
        return d["indicators"]

    d["_data_source"] = "pending"
    return None


def _get_images_for(d: dict) -> dict:
    """
    Images are computed together with indicators in _get_indicators_for
    (either from cache or a fresh Earth Engine call) and stashed on the
    district dict as _cached_images — this just returns that, so there's
    no separate/duplicate Earth Engine round-trip for images.
    """
    return d.get("_cached_images", {"before": None, "after": None})


def _build_climate_composite(indicator_results: dict, district_name: str, period_before: str) -> dict:
    """
    SDG 13 (Climate Action) — the one indicator here that ISN'T a direct
    satellite band computation. Sentinel-2 is an optical sensor; it can't
    measure greenhouse gases or "climate action" directly. What we CAN
    honestly derive: a composite stress score from the 3 real indicators
    (water/vegetation/heat) we do compute — if multiple environmental
    signals are declining together in the same district, that's a
    legitimate, defensible proxy for climate vulnerability. This is
    disclosed as derived, not raw-sensed, in the verdict text itself.
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
        "bad": f"{district_name} shows a compounding climate-stress pattern — {declining} of {total} tracked indicators (water, vegetation, heat) have worsened since {period_before}.",
        "warn": f"{district_name} shows an early climate-stress signal — {declining} of {total} tracked indicators have worsened since {period_before}.",
        "good": f"{district_name}'s tracked indicators (water, vegetation, heat) have stayed broadly stable since {period_before} — no compounding climate-stress pattern detected.",
    }[severity]

    return {
        "sdg": "SDG 13",
        "label": "Composite climate-stress signal",
        "index_used": "Derived (NDWI+NDVI+NDBI trend)",
        "before_value": total - declining,
        "after_value": declining,
        "pct_change": round((declining / total) * 100, 1) if total else 0,
        "severity": severity,
        "verdict": verdict,
    }


PENDING_META = {
    "water": {"sdg": "SDG 6", "label": "Water body surface area", "index_used": "NDWI"},
    "green_cover": {"sdg": "SDG 15", "label": "Vegetation / green cover", "index_used": "NDVI"},
    "urban_heat": {"sdg": "SDG 11", "label": "Urban heat island intensity", "index_used": "NDBI (proxy)"},
}


def _build_pending_result(indicator_key: str, district_name: str) -> dict:
    """
    Honest "not yet computed" state — used when live GEE isn't enabled/
    available and there's no legacy mock fixture for this district.
    Deliberately does NOT fabricate a plausible-looking number.
    """
    meta = PENDING_META[indicator_key]
    return {
        "sdg": meta["sdg"],
        "label": meta["label"],
        "index_used": meta["index_used"],
        "before_value": None,
        "after_value": None,
        "pct_change": None,
        "severity": "pending",
        "verdict": f"Not yet computed for {district_name} — enable live Earth Engine data or select this district to run a query.",
    }


def _summarize_district(d: dict, detailed: bool = False, use_live: bool = False) -> dict:
    raw_indicators = _get_indicators_for(d, use_live=use_live)

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
        # Add the derived SDG 13 composite as a 4th indicator — computed AFTER
        # the other 3 so it can read their severities, not a raw GEE call.
        indicator_results["climate_action"] = _build_climate_composite(
            indicator_results, d["name"], d["period_before"]
        )

    # overall district severity = worst severity among its indicators.
    # "pending" only wins if EVERY indicator is pending (nothing worse to show).
    severities = [v["severity"] for v in indicator_results.values()]
    if "bad" in severities:
        overall = "bad"
    elif "warn" in severities:
        overall = "warn"
    elif all(s == "pending" for s in severities):
        overall = "pending"
    else:
        overall = "good"

    base = {
        "id": d["id"],
        "name": d["name"],
        "state": d["state"],
        "lat": d["lat"],
        "lon": d["lon"],
        "period_before": d["period_before"],
        "period_after": d["period_after"],
        "overall_severity": overall,
        "data_source": d.get("_data_source", "mock"),
    }

    if detailed:
        base["indicators"] = indicator_results
        base["images"] = _get_images_for(d)
    else:
        # lightweight summary for map/list view
        base["indicator_summary"] = {
            key: {"severity": v["severity"], "pct_change": v["pct_change"]}
            for key, v in indicator_results.items()
        }

    return base
