from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import districts, auth
from fastapi.responses import JSONResponse
from fastapi import Request
from app.core.exceptions import AppException
from app.core.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

app = FastAPI(
    title="GroundTruth API",
    description="Satellite-derived SDG indicators, translated into plain language.",
    version="0.1.0",
)

# Attach rate limiter to app state and register error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Wide open for hackathon dev; tighten allow_origins before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(districts.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {
        "service": "GroundTruth API",
        "status": "online",
        "docs": "/docs",
        "endpoints": ["/api/districts/", "/api/districts/{district_id}"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )
