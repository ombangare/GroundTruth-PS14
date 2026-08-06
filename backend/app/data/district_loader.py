"""
District Loader
================

Builds the tracked district list DIRECTLY from data/districts.geojson,
filtered by state — instead of a hand-typed list that has to be kept in
sync with the boundary file by hand (which is exactly how the Beed/Bid
spelling mismatch happened).

PERFORMANCE: on first run, this parses the full India-wide districts.geojson
(all ~734 districts) and writes a small filtered GeoJSON containing ONLY
this state's features to data/cache/. Every run after that loads the small
cached file directly instead of the full national file — cuts parse time
from "all of India" to "just this state" on every restart after the first.

Delete data/cache/<state>_districts.geojson to force a re-filter (e.g.
after updating districts.geojson to a newer version).
"""

import json
import os
import re

_GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "districts.geojson")
_CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")

DEFAULT_PERIOD_BEFORE = "2017"
DEFAULT_PERIOD_AFTER = "2024"


def _slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def _cache_path(state_name: str) -> str:
    return os.path.join(_CACHE_DIR, f"{_slugify(state_name)}_districts.geojson")


def _centroid(geometry: dict) -> tuple[float, float]:
    """
    Approximate centroid (average of all vertex coordinates) — good enough
    for map/globe marker placement. NOT used for area computation; Earth
    Engine uses the actual polygon geometry for that, so this approximation
    has no effect on indicator accuracy.
    """
    coords = []

    def collect(c):
        if isinstance(c[0], (int, float)):
            coords.append(c)
        else:
            for sub in c:
                collect(sub)

    collect(geometry.get("coordinates", []))
    if not coords:
        return (20.5937, 78.9629)  # India centroid fallback

    lon = sum(c[0] for c in coords) / len(coords)
    lat = sum(c[1] for c in coords) / len(coords)
    return (lat, lon)


def _build_entries(features: list) -> list[dict]:
    results = []
    seen_ids = set()

    for feature in features:
        props = feature.get("properties", {})
        district_name = props.get("district") or props.get("DISTRICT") or props.get("dtname")
        state_prop = props.get("st_nm") or props.get("ST_NM") or props.get("state")
        geometry = feature.get("geometry")

        if not district_name or not state_prop or not geometry:
            continue

        district_id = _slugify(district_name)
        if district_id in seen_ids:
            continue
        seen_ids.add(district_id)

        lat, lon = _centroid(geometry)

        results.append({
            "id": district_id,
            "name": district_name.strip(),
            "state": state_prop.strip(),
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "period_before": DEFAULT_PERIOD_BEFORE,
            "period_after": DEFAULT_PERIOD_AFTER,
            "boundary_name": district_name.strip(),
            "boundary_state": state_prop.strip(),
        })

    return results


def load_districts_for_state(state_name: str) -> list[dict]:
    """
    Returns a list of district entries for every district matching
    `state_name` in districts.geojson. Uses a cached, pre-filtered copy
    after the first run for fast startup.
    """
    target = state_name.strip().lower()
    cache_file = _cache_path(state_name)

    # Fast path: cached filtered file from a previous run.
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            results = _build_entries(data.get("features", []))
            print(f"[district_loader] Loaded {len(results)} {state_name} districts from cache — skipped parsing the full national file.")
            return results
        except Exception as e:
            print(f"[district_loader] Cache read failed ({e}) — falling back to full districts.geojson.")

    # Slow path: parse the full national file (first run only, per state).
    if not os.path.exists(_GEOJSON_PATH):
        print(f"[district_loader] {_GEOJSON_PATH} not found — no districts loaded. Add districts.geojson to enable coverage.")
        return []

    try:
        with open(_GEOJSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[district_loader] Failed to parse districts.geojson: {e}")
        return []

    matched_features = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        state_prop = props.get("st_nm") or props.get("ST_NM") or props.get("state")
        if state_prop and state_prop.strip().lower() == target:
            matched_features.append(feature)

    # Write the filtered cache for next time.
    try:
        os.makedirs(_CACHE_DIR, exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": matched_features}, f)
        print(f"[district_loader] Cached {len(matched_features)} {state_name} districts to {cache_file} for fast startup next time.")
    except Exception as e:
        print(f"[district_loader] Failed to write cache: {e} — will re-filter from the full file next run.")

    results = _build_entries(matched_features)
    print(f"[district_loader] Loaded {len(results)} districts for state '{state_name}'.")
    return results
