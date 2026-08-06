"""
GEE Result Cache
=================

Disk cache for computed Earth Engine indicator results and thumbnail
URLs. Without this, EVERY click on a district re-runs the full live
Earth Engine computation (6+ satellite queries), even if you clicked
that same district 2 minutes ago — which is exactly the kind of thing
that kills a live demo when you're re-showing a district to a judge.

Cache key = district_id + before_year + after_year. Cached forever
(no TTL) — this is a hackathon demo cache, not a production one; delete
the cache/ folder manually if you need to force a re-fetch after
changing thresholds or AOI logic.
"""

import json
import os
import time

_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cache", "gee_results")


def _cache_path(district_id: str, before_year: str, after_year: str) -> str:
    os.makedirs(_CACHE_DIR, exist_ok=True)
    filename = f"{district_id}_{before_year}_{after_year}.json"
    return os.path.join(_CACHE_DIR, filename)


def get(district_id: str, before_year: str, after_year: str) -> dict | None:
    """Returns cached {"indicators": ..., "images": ...} or None if not cached."""
    path = _cache_path(district_id, before_year, after_year)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"[gee_cache] Cache HIT for {district_id} ({before_year}->{after_year}) — skipping Earth Engine.")
        return data
    except Exception as e:
        print(f"[gee_cache] Cache read failed for {district_id}: {e} — will recompute.")
        return None


def set(district_id: str, before_year: str, after_year: str, indicators: dict, images: dict) -> None:
    """Saves computed results to disk so the next request for this district+year-range is instant."""
    path = _cache_path(district_id, before_year, after_year)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump({
                "indicators": indicators,
                "images": images,
                "cached_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }, f)
        print(f"[gee_cache] Cached {district_id} ({before_year}->{after_year}) for instant reload next time.")
    except Exception as e:
        print(f"[gee_cache] Cache write failed for {district_id}: {e} — continuing without caching this result.")
