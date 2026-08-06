from typing import Optional
from fastapi import APIRouter, HTTPException
from app.services import indicator_engine

router = APIRouter(prefix="/api/districts", tags=["districts"])


@router.get("/")
def list_districts():
    """Lightweight list for the map view — one entry per district."""
    return indicator_engine.get_all_districts()


@router.get("/{district_id}/history")
def get_district_history(district_id: str):
    """Returns a list of cached years for a district."""
    history = indicator_engine.get_district_history(district_id)
    if not history:
        raise HTTPException(status_code=404, detail=f"District '{district_id}' not found")
    return history


@router.get("/{district_id}")
def get_district(district_id: str, year_before: Optional[int] = None, year_after: Optional[int] = None):
    """Full indicator breakdown for one district — used by the detail panel."""
    district = indicator_engine.get_district(district_id, year_before, year_after)
    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_id}' not found")
    return district
