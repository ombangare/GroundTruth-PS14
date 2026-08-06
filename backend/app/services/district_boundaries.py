"""
District Boundary Loader
==========================

Loads real district polygon boundaries from `data/districts.geojson`
(India district-level GeoJSON — see backend/SETUP_GEE.md or project chat
history for where this came from) and matches them to the districts
tracked in mock_districts.py.

WHY THIS EXISTS:
  Without this, gee_service.py uses a 5km circle around each district's
  lat/lon centroid as its "area of interest" — a crude placeholder. Real
  district shapes are irregular polygons, often much larger or smaller
  than a 5km circle, so water/vegetation/heat area calculations against
  the circle are only approximate. This module lets gee_service.py use
  the ACTUAL district polygon instead, once available.

MATCHING STRATEGY:
  Boundary datasets and our own district list don't always agree on
  spelling (e.g. official renames like Bangalore -> Bengaluru in 2014
  often aren't reflected in older boundary data). So matching uses:
    1. `boundary_name` / `boundary_state` override fields on the district
       entry in mock_districts.py, if present (exact match, case-insensitive)
    2. Falls back to `name` / `state` if no override is set
    3. If nothing matches, logs a clear warning and returns None — the
       caller (gee_service.py) then falls back to the circle-buffer AOI
       automatically, so a naming mismatch never crashes anything.

FILE NOT YET PRESENT:
  If districts.geojson hasn't been added to data/ yet, this module stays
  silent and every lookup returns None — same safe fallback behavior.
"""

import json
import os

_GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "districts.geojson")

_boundary_index: dict[tuple[str, str], dict] | None = None  # lazy-loaded


def _normalize(s: str) -> str:
    return s.strip().lower().replace("  ", " ")


def _load_index() -> dict[tuple[str, str], dict]:
    """
    Builds a {(district_name_lower, state_name_lower): geometry} lookup
    from districts.geojson. Cached after first call. Returns an empty
    dict (not an error) if the file is missing or malformed, so the app
    keeps running on the circle-buffer fallback.
    """
    global _boundary_index
    if _boundary_index is not None:
        return _boundary_index

    _boundary_index = {}

    if not os.path.exists(_GEOJSON_PATH):
        print(f"[district_boundaries] {_GEOJSON_PATH} not found — using circle-buffer AOI for all districts.")
        return _boundary_index

    try:
        with open(_GEOJSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[district_boundaries] Failed to parse districts.geojson: {e} — using circle-buffer AOI for all districts.")
        return _boundary_index

    features = data.get("features", [])
    for feature in features:
        props = feature.get("properties", {})
        # Field names confirmed from the actual dataset: "district", "st_nm"
        district_name = props.get("district") or props.get("DISTRICT") or props.get("dtname")
        state_name = props.get("st_nm") or props.get("ST_NM") or props.get("state")
        geometry = feature.get("geometry")

        if not district_name or not state_name or not geometry:
            continue

        key = (_normalize(district_name), _normalize(state_name))
        _boundary_index[key] = geometry

    print(f"[district_boundaries] Loaded {len(_boundary_index)} district boundaries from districts.geojson.")
    return _boundary_index


def get_district_geometry(d: dict) -> dict | None:
    """
    Returns the raw GeoJSON geometry dict for a district (suitable for
    ee.Geometry(geometry) directly), or None if no match was found —
    caller should fall back to a circle-buffer AOI in that case.

    `d` is a district entry from mock_districts.py — uses boundary_name/
    boundary_state if present, otherwise falls back to name/state.
    """
    index = _load_index()
    if not index:
        return None

    lookup_name = d.get("boundary_name", d["name"])
    lookup_state = d.get("boundary_state", d["state"])
    key = (_normalize(lookup_name), _normalize(lookup_state))

    geometry = index.get(key)
    if geometry is None:
        print(
            f"[district_boundaries] No boundary match for '{lookup_name}, {lookup_state}' "
            f"(district '{d['name']}') — falling back to circle-buffer AOI. "
            f"Check spelling against districts.geojson, or set boundary_name/boundary_state overrides."
        )
    return geometry
