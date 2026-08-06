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

**RLS Policies:**
- `viewer`: Can read data but cannot trigger new Earth Engine fetches (read-only).
- `researcher`: Can read data and trigger new Earth Engine computations via the API.
- `admin`: Full access to manage users, data, and system configurations.

## 2. Core Entities & Spatial Data

### `public.districts`
Stores geographical entities. Future-proofed by allowing PostGIS geometries.
- `id` (String, Primary Key) - e.g., 'kanpur_urban'
- `name` (Text)
- `state` (Text)
- `latitude` (Float)
- `longitude` (Float)
- `geom` (Geometry/Geography) - For advanced spatial queries (PostGIS expansion).
- `created_at` (Timestamp)

### `public.indicators`
Defines the types of metrics we track. By decoupling indicators into their own table, we can add new ones (e.g., Air Quality, Flood Risk) without altering the schema.
- `id` (String, Primary Key) - e.g., 'water', 'green_cover'
- `sdg_target` (Text) - e.g., 'SDG 6'
- `label` (Text)
- `index_used` (Text) - e.g., 'NDWI', 'NDVI'

## 3. Data Storage (Caching & Timelines)

To avoid re-visiting the Earth Engine API unnecessarily and to allow timeline comparisons across varying periods, we store computed absolute metrics.

### `public.indicator_readings`
Stores the actual computed values for a district at a specific time period.
- `id` (UUID, Primary Key)
- `district_id` (String, Foreign Key to `districts.id`)
- `indicator_id` (String, Foreign Key to `indicators.id`)
- `year` (Integer) - The time period (e.g., 2019, 2023). 
- `value` (Float) - The raw computed value (e.g., surface area, NDVI score).
- `created_at` (Timestamp)

*Querying over time:* By storing absolute `value` and `year`, the backend can instantly calculate the `pct_change` between any two arbitrary years without re-querying Google Earth Engine.

### `public.satellite_imagery`
Stores metadata and Supabase Storage URLs for map visualizations.
- `id` (UUID, Primary Key)
- `district_id` (String, Foreign Key to `districts.id`)
- `year` (Integer)
- `storage_path` (Text) - Path to the image bucket in Supabase Storage.
- `created_at` (Timestamp)

## 4. Integration Workflow

1. **Frontend Request**: User requests data for Kanpur (2019 vs 2023).
2. **Backend Cache Check**: Backend queries `indicator_readings` where `district_id='kanpur_urban'` and `year IN (2019, 2023)`.
3. **Cache Hit**: Both years exist in the database. Backend dynamically computes the percentage change, severity, and plain-language verdict, then returns the response.
4. **Cache Miss**: One or both years are missing. 
   - Backend checks User Role (only `researcher` or `admin` can trigger heavy compute).
   - Backend triggers Google Earth Engine script for the missing year(s).
   - Backend saves the new `value` in `indicator_readings` and saves image buffers to Supabase Storage, recording the URL in `satellite_imagery`.
   - Backend calculates final results and returns the response.
