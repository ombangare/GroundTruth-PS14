from fastapi import APIRouter, Depends
from app.api.dependencies.auth import RequireAuth

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/me")
def get_current_user(user: dict = Depends(RequireAuth(required=True))):
    return user
