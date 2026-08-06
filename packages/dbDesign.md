# Database Architecture (Supabase / PostgreSQL)

This document outlines the database design for the GroundTruth application, focusing on robust data storage, Role-Based Access Control (RBAC), and time-series data tracking for satellite indicators.

## 1. Authentication & Role-Based Access Control (RBAC)

We leverage Supabase's built-in Auth module and PostgreSQL Row Level Security (RLS).

### `public.profiles`
Extends the `auth.users` table to store application-specific user data and roles.
- `id` (UUID, Primary Key, Foreign Key to `auth.users.id`)
- `role` (Enum: `admin`, `researcher`, `viewer`)
- `first_name` (Text)
- `last_name` (Text)
- `created_at` (Timestamp)

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
