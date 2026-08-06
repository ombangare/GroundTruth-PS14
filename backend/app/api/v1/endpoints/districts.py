from fastapi import APIRouter, Depends, Request
from app.schemas.district import DistrictQuerySanitizer
from app.core.exceptions import NotFoundError
from app.services import indicator_engine
from app.core.rate_limit import limiter

router = APIRouter(prefix="/api/districts", tags=["districts"])


@router.get("/")
@limiter.limit("30/minute")
def list_districts(request: Request):
    """Lightweight list for the map view — one entry per district."""
    return indicator_engine.get_all_districts()


@router.get("/{district_id}/history")
@limiter.limit("20/minute")
def get_district_history(request: Request, district_id: str):
    """Returns a list of cached years for a district."""
    history = indicator_engine.get_district_history(district_id)
    if not history:
        raise NotFoundError(f"District '{district_id}' not found")
    return history


@router.get("/{district_id}")
@limiter.limit("15/minute")
def get_district(request: Request, district_id: str, query: DistrictQuerySanitizer = Depends()):
    """Full indicator breakdown for one district — used by the detail panel."""
    district = indicator_engine.get_district(district_id, query.year_before, query.year_after)
    if not district:
        raise NotFoundError(f"District '{district_id}' not found")
    return district
