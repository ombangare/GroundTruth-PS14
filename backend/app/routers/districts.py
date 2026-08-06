from fastapi import APIRouter, HTTPException
from app.services import indicator_engine

router = APIRouter(prefix="/api/districts", tags=["districts"])


@router.get("/")
def list_districts():
    """Lightweight list for the map view — one entry per district."""
    return indicator_engine.get_all_districts()


@router.get("/{district_id}")
def get_district(district_id: str):
    """Full indicator breakdown for one district — used by the detail panel."""
    district = indicator_engine.get_district(district_id)
    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_id}' not found")
    return district
