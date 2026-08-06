from fastapi import APIRouter, Query, BackgroundTasks, HTTPException
from typing import Optional
from app.services import district_service

router = APIRouter(prefix="/api/districts", tags=["districts"])

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
