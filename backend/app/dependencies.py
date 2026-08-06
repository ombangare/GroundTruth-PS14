import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import SUPABASE_JWT_SECRET

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validates the Supabase JWT token and extracts the user information.
    """
    token = credentials.credentials
    try:
        # Supabase uses HS256 algorithm by default
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            # Supabase 'aud' is usually 'authenticated', but can be skipped or explicitly verified
            options={"verify_aud": False} 
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_researcher_role(current_user: dict = Depends(get_current_user)):
    """
    Example of RBAC based on the dbDesign.md doc.
    Requires 'researcher' or 'admin' role to trigger expensive Earth Engine queries.
    Note: Adjust the key path based on how roles are assigned in your Supabase setup.
    """
    # Roles can be stored in user_metadata or app_metadata in Supabase
    app_metadata = current_user.get("app_metadata", {})
    role = app_metadata.get("role", "viewer")
    
    if role not in ["researcher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )
    return current_user
