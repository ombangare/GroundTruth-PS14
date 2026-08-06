from fastapi import APIRouter, Query, BackgroundTasks, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.services import district_service

class PointRequest(BaseModel):
    lat: float
    lon: float
    years: Optional[list[str]] = None

router = APIRouter(prefix="/api/districts", tags=["districts"])

@router.post("/analyze-point")
def analyze_map_click(payload: PointRequest):
    from app.services import gee_service
    from app.db.supabase import supabase
    import uuid, time
    
    # 1. Try to fetch from Supabase first
    if supabase:
        try:
            # We can use simple coordinate rounding for matching (approx 100m)
            rounded_lat = round(payload.lat, 3)
            rounded_lon = round(payload.lon, 3)
            cache_res = supabase.table("poi_history").select("*").eq("lat_round", rounded_lat).eq("lon_round", rounded_lon).execute()
            if cache_res.data and len(cache_res.data) > 0:
                print(f"[poi] Cache HIT for {rounded_lat}, {rounded_lon}")
                return cache_res.data[0]["result"]
        except Exception as e:
            print(f"[poi] Cache read failed: {e}")

    # 2. Compute via Earth Engine
    res = gee_service.analyze_point_timeline(payload.lat, payload.lon, years=payload.years)
    if "error" in res and res["error"] != "Earth Engine not initialized":
        raise HTTPException(status_code=500, detail=res["error"])
        
    # 3. Cache into Supabase
    if supabase and "timeline" in res and res["timeline"]:
        try:
            rounded_lat = round(payload.lat, 3)
            rounded_lon = round(payload.lon, 3)
            supabase.table("poi_history").insert({
                "id": str(uuid.uuid4()),
                "lat": payload.lat,
                "lon": payload.lon,
                "lat_round": rounded_lat,
                "lon_round": rounded_lon,
                "result": res,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S")
            }).execute()
            print(f"[poi] Saved analysis to history.")
        except Exception as e:
            print(f"[poi] Cache write failed (table might not exist): {e}")

    return res

@router.get("/poi-history")
def get_poi_history():
    from app.db.supabase import supabase
    if not supabase:
        return []
    try:
        res = supabase.table("poi_history").select("*").order("created_at", desc=True).limit(50).execute()
        return res.data
    except Exception as e:
        print(f"[poi] History read failed: {e}")
        return []

@router.get("/")
def get_all_districts():
    return district_service.get_all_districts()

@router.get("/{district_id}")
def get_district(
    district_id: str, 
    year_before: Optional[int] = Query(None), 
    year_after: Optional[int] = Query(None), 
    background_tasks: BackgroundTasks = None
):
    res = district_service.get_district(district_id, year_before, year_after, background_tasks)
    if not res:
        raise HTTPException(status_code=404, detail="District not found")
    return res

@router.get("/{district_id}/images")
def get_district_images(
    district_id: str, 
    year_before: Optional[int] = Query(None), 
    year_after: Optional[int] = Query(None)
):
    res = district_service.get_district_images_only(district_id, year_before, year_after)
    if not res:
        raise HTTPException(status_code=404, detail="Images not found")
    return res

@router.get("/{district_id}/history")
def get_district_history(district_id: str):
    res = district_service.get_district_history(district_id)
    if not res:
        raise HTTPException(status_code=404, detail="District not found")
    return res
