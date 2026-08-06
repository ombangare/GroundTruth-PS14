from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import districts, protected

app = FastAPI(
    title="GroundTruth API",
    description="Satellite-derived SDG indicators, translated into plain language.",
    version="0.1.0",
)

# Wide open for hackathon dev; tighten allow_origins before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(districts.router)
app.include_router(protected.router)


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
