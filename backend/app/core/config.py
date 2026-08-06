import os

# Set USE_GEE=true in your .env once you've completed SETUP_GEE.md.
# Defaults to false so the app always works out of the box on mock data.
USE_GEE = os.environ.get("USE_GEE", "false").lower() == "true"

GEE_SERVICE_ACCOUNT_EMAIL = os.environ.get("GEE_SERVICE_ACCOUNT_EMAIL")
GEE_SERVICE_ACCOUNT_KEY_PATH = os.environ.get("GEE_SERVICE_ACCOUNT_KEY_PATH")
GEE_PROJECT_ID = os.environ.get("GEE_PROJECT_ID")
GEE_ASSET_DISTRICT_BOUNDARY = os.environ.get("GEE_ASSET_DISTRICT_BOUNDARY")

# Supabase Config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "your-super-secret-jwt-token-with-at-least-32-characters-long")

def validate_env():
    """
    Validates that all necessary environment variables are present before the code runs.
    Throws a ValueError if required variables are missing to prevent runtime errors.
    """
    missing = []
    
    if not GEE_SERVICE_ACCOUNT_EMAIL:
        missing.append("GEE_SERVICE_ACCOUNT_EMAIL")
    if not GEE_SERVICE_ACCOUNT_KEY_PATH:
        missing.append("GEE_SERVICE_ACCOUNT_KEY_PATH")
    if not GEE_PROJECT_ID:
        missing.append("GEE_PROJECT_ID")
    if not GEE_ASSET_DISTRICT_BOUNDARY:
        missing.append("GEE_ASSET_DISTRICT_BOUNDARY")
            
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_KEY")
    if not os.environ.get("SUPABASE_JWT_SECRET"):
        missing.append("SUPABASE_JWT_SECRET")
        
    if missing:
        raise ValueError(f"CRITICAL: Missing required environment variables for USE_GEE=true: {', '.join(missing)}. Please set them in your .env file.")

# Run validation on initialization
validate_env()
