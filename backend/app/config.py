import os

# Set USE_GEE=true in your .env once you've completed SETUP_GEE.md.
# Defaults to false so the app always works out of the box on mock data.
USE_GEE = os.environ.get("USE_GEE", "false").lower() == "true"

GEE_SERVICE_ACCOUNT_EMAIL = os.environ.get("GEE_SERVICE_ACCOUNT_EMAIL")
GEE_SERVICE_ACCOUNT_KEY_PATH = os.environ.get("GEE_SERVICE_ACCOUNT_KEY_PATH")
GEE_PROJECT_ID = os.environ.get("GEE_PROJECT_ID")
