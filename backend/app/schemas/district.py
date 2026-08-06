from pydantic import BaseModel, Field, model_validator
from typing import Optional

class DistrictQuerySanitizer(BaseModel):
    """
    Pydantic schema acting as a strict type checker (equivalent to Zod in JS).
    It ensures all inputs are properly sanitized and typed before hitting business logic.
    """
    year_before: Optional[int] = Field(None, ge=2010, le=2030, description="Baseline year (must be between 2010 and 2030)")
    year_after: Optional[int] = Field(None, ge=2010, le=2030, description="Target year (must be between 2010 and 2030)")

    @model_validator(mode='after')
    def check_time_travel(self) -> 'DistrictQuerySanitizer':
        """Ensure the baseline year is actually before the target year."""
        if self.year_before is not None and self.year_after is not None:
            if self.year_before >= self.year_after:
                raise ValueError("year_before must be chronologically earlier than year_after")
        return self
