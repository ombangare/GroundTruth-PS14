import os

# Set USE_GEE=true in your .env once you've completed SETUP_GEE.md.
# Defaults to false so the app always works out of the box on mock data.
USE_GEE = os.environ.get("USE_GEE", "false").lower() == "true"

GEE_SERVICE_ACCOUNT_EMAIL = os.environ.get("GEE_SERVICE_ACCOUNT_EMAIL")
GEE_SERVICE_ACCOUNT_KEY_PATH = os.environ.get("GEE_SERVICE_ACCOUNT_KEY_PATH")
GEE_PROJECT_ID = os.environ.get("GEE_PROJECT_ID")

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
    
    # If GEE is enabled, the credentials MUST be provided.
    if USE_GEE:
        if not GEE_SERVICE_ACCOUNT_EMAIL:
            missing.append("GEE_SERVICE_ACCOUNT_EMAIL")
        if not GEE_SERVICE_ACCOUNT_KEY_PATH:
            missing.append("GEE_SERVICE_ACCOUNT_KEY_PATH")
        if not GEE_PROJECT_ID:
            missing.append("GEE_PROJECT_ID")
            
    if not SUPABASE_URL:
        print("⚠️ WARNING: SUPABASE_URL is not set. Database integration will not work.")
    if not SUPABASE_KEY:
        print("⚠️ WARNING: SUPABASE_KEY is not set. Database integration will not work.")
    if not os.environ.get("SUPABASE_JWT_SECRET"):
        print("⚠️ WARNING: SUPABASE_JWT_SECRET is not set in environment. Using insecure fallback default for local dev. Do not use in production!")
        
    if missing:
        raise ValueError(f"CRITICAL: Missing required environment variables for USE_GEE=true: {', '.join(missing)}. Please set them in your .env file.")

# Run validation on initialization
validate_env()
