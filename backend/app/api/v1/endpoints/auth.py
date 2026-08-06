from fastapi import APIRouter, Depends
from app.api.dependencies.auth import get_current_user, require_researcher_role

# Centralized router for auth-protected endpoints, to avoid disturbing public routes initially
router = APIRouter(prefix="/api/secure", tags=["secure"])

@router.get("/me")
def read_current_user(current_user: dict = Depends(get_current_user)):
    """
    Returns the decoded JWT payload of the currently authenticated Supabase user.
    """
    return {
        "message": "Authentication successful",
        "user_payload": current_user
    }

@router.post("/trigger-compute")
def trigger_compute(current_user: dict = Depends(require_researcher_role)):
    """
    Example endpoint showing how to protect expensive operations using RBAC.
    Only users with 'researcher' or 'admin' role can access this.
    """
    return {
        "message": "Compute triggered successfully",
        "triggered_by": current_user.get("sub")
    }
