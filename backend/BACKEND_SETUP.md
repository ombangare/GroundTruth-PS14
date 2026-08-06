# GroundTruth Backend Setup Guide

The backend relies on two critical external services to function: **Google Earth Engine (GEE)** for live satellite data computation, and **Supabase** for caching and authentication. 

Follow these steps linearly from top to bottom to set up your environment.

---

## Step 1: Google Earth Engine Setup (Satellite Data & Shapefiles)

To run live satellite computations and parse the exact district geometries, you must configure a Google Cloud Service Account with access to Google Earth Engine.

### 1.1 Create the Google Cloud Project and Service Account
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (e.g., `groundtruth`). **Write down the Project ID**.
2. Search for **Earth Engine API** in the API Library and click **Enable**.
3. Go to **IAM & Admin → Service Accounts → Create Service Account**. 
4. Name it (e.g., `gee-compute`) and click Create.
5. In the **Roles** section, grant it the following two roles:
   - **"Service Usage Consumer"**
   - **"Earth Engine Resource Admin"** (or GEE Admin)
6. Click into your new service account → **Keys** tab → **Add Key → Create New Key → JSON**. 
7. Download this `.json` file and place it inside the `backend/` folder of this project. **Never commit this file to git.**

### 1.2 Register for Earth Engine
1. Go to https://code.earthengine.google.com/register.
2. Register your Google account for non-commercial use.
3. Link the Google Cloud project you just created to your Earth Engine account.

### 1.3 Upload District Shapefiles to GEE Assets
To allow the backend to query exact district boundaries, you need to upload the shapefiles to Google's servers:
1. Go to the [Earth Engine Code Editor](https://code.earthengine.google.com/).
2. On the left panel, click the **Assets** tab.
3. Click **New → Shape files (.shp, .shx, .dbf, .prj, or .zip)**.
4. Upload your district `shapefile.zip` containing all components (`.shp`, `.dbf`, `.shx`, etc.).
5. Give the asset a memorable ID, for example: `users/your-username/DISTRICT_BOUNDARY`.
6. Wait for the ingestion task to finish (you can check the **Tasks** tab on the right panel). 

---

## Step 2: Supabase Setup (Database & Auth)

We use Supabase as our high-speed cache and authentication provider. 

### 2.1 Create the Project and Get Tokens
1. Go to [Supabase](https://supabase.com/) and create a new project. Wait for the database to finish provisioning.
2. Go to **Project Settings** (the gear icon on the left sidebar).
3. Click on **API** in the settings menu.
4. From this screen, you need to copy 3 important strings:
   - **Project URL** (looks like `https://xxxxxx.supabase.co`)
   - **anon `public` key** (You will paste this into the Frontend `.env.local`!)
   - **service_role `secret` key** (You will paste this into the Backend `.env`!)
5. Still in Project Settings, click on **Authentication** (or **Auth**) and then **JWT Settings**. Copy your **JWT Secret**.

### 2.2 Initialize the Database
1. Go to the **SQL Editor** (the SQL icon on the left sidebar) in the Supabase dashboard.
2. Click **New Query**.
3. Copy and paste the following SQL block, which creates the caching table and indexes in one step:

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
4. Click **Run** to execute the query. Your database architecture is now complete!

---

## Step 3: Configure Environment Variables

You must now inject all the keys you gathered into the application.

### 3.1 Backend `.env`
Create a `.env` file in the `backend/` directory:

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and paste your keys:

```env
# Google Earth Engine
GEE_SERVICE_ACCOUNT_EMAIL=gee-compute@your-project-id.iam.gserviceaccount.com
GEE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/backend/service-account-key.json
GEE_PROJECT_ID=your-google-cloud-project-id
GEE_SERVICE_ACCOUNT_EMAIL=your-service-account@...
GEE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/your-key-file.json

# Earth Engine Assets
# This MUST match the asset ID you created in Step 1.3
GEE_ASSET_DISTRICT_BOUNDARY=users/your-username/DISTRICT_BOUNDARY

# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
# IMPORTANT: Paste the service_role SECRET key here!
SUPABASE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

### 3.2 Frontend `.env.local`
Create a `.env.local` file in the `frontend/` directory:

```bash
cd ../frontend
touch .env.local
```

Open `frontend/.env.local` and paste your keys:

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
# IMPORTANT: Paste the anon PUBLIC key here! NEVER use the secret key here!
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

---


