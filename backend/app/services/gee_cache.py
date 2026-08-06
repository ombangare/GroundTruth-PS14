"""
GEE Result Cache (Supabase Integrated)
=================

Supabase cache for computed Earth Engine indicator results and thumbnail URLs.
Replaces the old local JSON disk cache for centralized persistence across timelines.
"""

import time
from app.db.supabase import supabase

def get(district_id: str, before_year: str, after_year: str) -> dict | None:
    """Returns cached {"indicators": ..., "images": ...} from Supabase or None if not cached."""
    if not supabase:
        print("[gee_cache] Supabase client not initialized, skipping cache read.")
        return None
        
    try:
        response = supabase.table("indicator_comparisons").select("*").eq("district_id", district_id).eq("period_before", before_year).eq("period_after", after_year).execute()
        if response.data and len(response.data) > 0:
            row = response.data[0]
            print(f"[gee_cache] Supabase Cache HIT for {district_id} ({before_year}->{after_year}).")
            return {
                "indicators": row.get("indicators"),
                "images": row.get("images")
            }
        return None
    except Exception as e:
        print(f"[gee_cache] Supabase cache read failed for {district_id}: {e}")
        return None


def set(district_id: str, before_year: str, after_year: str, indicators: dict, images: dict) -> None:
    """Saves computed results to Supabase so the next request is instant."""
    if not supabase:
        print("[gee_cache] Supabase client not initialized, skipping cache write.")
        return
        
    try:
        data = {
            "district_id": district_id,
            "period_before": str(before_year),
            "period_after": str(after_year),
            "indicators": indicators,
            "images": images,
            "cached_at": time.strftime("%Y-%m-%dT%H:%M:%S")
        }
        # Note: Depending on your Supabase table schema, you might need a composite unique key 
        # on (district_id, period_before, period_after) for upsert to work safely without an ID.
        supabase.table("indicator_comparisons").insert(data).execute()
        print(f"[gee_cache] Saved {district_id} ({before_year}->{after_year}) to Supabase.")
    except Exception as e:
        print(f"[gee_cache] Supabase cache write failed for {district_id}: {e}")


def list_cached_years(district_id: str) -> list[int]:
    """Returns a sorted list of unique years cached for a given district from Supabase."""
    if not supabase:
        return []
        
    try:
        response = supabase.table("indicator_comparisons").select("period_before, period_after").eq("district_id", district_id).execute()
        years = set()
        for row in response.data:
            try:
                if row.get("period_before"):
                    years.add(int(row["period_before"]))
                if row.get("period_after"):
                    years.add(int(row["period_after"]))
            except (ValueError, TypeError):
                pass
        return sorted(list(years))
    except Exception as e:
        print(f"[gee_cache] Failed to list cached years from Supabase: {e}")
        return []
