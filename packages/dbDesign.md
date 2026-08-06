# Database Architecture (Supabase / PostgreSQL)

This document outlines the database design for the GroundTruth application, focusing on robust data storage and caching for satellite indicators. 

> **Note:** We do not use Row Level Security (RLS) in Supabase. The Supabase database is strictly accessed via our FastAPI backend using the Service Role Key. All authentication and role-based access control (RBAC) is enforced at the backend API layer.

## Setup Instructions (SQL)

You can easily set up the Supabase database by running the following SQL commands in the Supabase SQL Editor.

### 1. Database Setup

Copy and paste the following SQL block into the Supabase SQL Editor. It will create the caching table and the performance index in one step:

```sql
-- Indicator Comparisons Table: Used by gee_cache.py to instantly serve previously computed data.
CREATE TABLE public.indicator_comparisons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    district_id TEXT NOT NULL,
    period_before TEXT NOT NULL,
    period_after TEXT NOT NULL,
    indicators JSONB NOT NULL,
    images JSONB,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast cache lookups by district and time periods
CREATE INDEX idx_indicator_comparisons_lookup 
ON public.indicator_comparisons(district_id, period_before, period_after);
```

## Integration Workflow

1. **Frontend Request**: User requests data for Bengaluru (2017 vs 2024).
2. **Backend Cache Check**: `district_service.py` checks `indicator_comparisons` where `district_id='bengaluru_urban'`, `period_before='2017'`, and `period_after='2024'`.
3. **Cache Hit**: The row exists. The backend fetches the `JSONB` data, retrieves dynamic thresholds from the `indicators` table, computes the final plain-language verdict, and returns the response.
4. **Cache Miss**: The row does not exist. 
   - Backend triggers `gee_service.py` to run live Earth Engine scripts for the missing years.
   - Backend saves the newly computed JSON response into `indicator_comparisons`.
   - Backend calculates final results and returns the response.
