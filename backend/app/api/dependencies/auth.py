import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from typing import Optional, List
from app.core.config import SUPABASE_JWT_SECRET

# Centralized auth scheme, auto_error=False so we can manually handle absent tokens
security = HTTPBearer(auto_error=False)

class RequireAuth:
    """
    Centralized object-oriented auth dependency.
    Routes can seamlessly opt-in/opt-out of auth and enforce specific RBAC roles.
    
    Usage in routes:
    user = Depends(RequireAuth(required=False)) # Optional auth (returns dict or None)
    user = Depends(RequireAuth(required=True))  # Strict auth (throws 401 if missing)
    user = Depends(RequireAuth(allowed_roles=["admin", "researcher"])) # Role-based (throws 403)
    """
    def __init__(self, required: bool = True, allowed_roles: Optional[List[str]] = None):
        self.required = required
        self.allowed_roles = allowed_roles

    def __call__(self, request: Request, credentials=Depends(security)) -> Optional[dict]:
        if not credentials:
            if self.required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token is missing.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None

        try:
            # Supabase defaults to HS256 JWTs
            payload = jwt.decode(
                credentials.credentials,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        except jwt.ExpiredSignatureError:
            if self.required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Your authentication token has expired. Please log in again.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        except jwt.InvalidTokenError:
            if self.required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token provided.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None

        # RBAC Check
        if self.allowed_roles:
            app_metadata = payload.get("app_metadata", {})
            user_role = app_metadata.get("role", "viewer")
            if user_role not in self.allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access Denied. Role '{user_role}' is not authorized to access this route."
                )

        return payload
