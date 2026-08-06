"""
District list — now generated dynamically from districts.geojson.

Previously this file hand-typed 3 districts with fabricated indicator
numbers. That's gone: the district list now comes directly from the same
boundary file used for Earth Engine's area-of-interest, so there's a
single source of truth and no more spelling-mismatch bugs.

To cover a different or additional state, add more calls below and
concatenate the lists — e.g.:

    DISTRICTS = (
        district_loader.load_districts_for_state("Maharashtra")
        + district_loader.load_districts_for_state("Karnataka")
    )

CURRENT SCOPE: Maharashtra only, per current project phase. Pan-India
rollout is just adding more states here once boundaries are verified.
"""

from datetime import date
from app.data import district_loader

DISTRICTS = district_loader.load_districts_for_state("Maharashtra")

GENERATED_ON = date.today().isoformat()
