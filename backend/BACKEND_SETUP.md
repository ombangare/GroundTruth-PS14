# GroundTruth Backend Setup Guide

The backend relies on two critical external services to function: **Google Earth Engine (GEE)** for live satellite data computation, and **Supabase** for caching and authentication. 

*Note: Legacy mock-data fallbacks have been permanently removed to enforce strict production-grade reliability.*

## 1. Supabase Setup (Database & Auth)

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Under **Project Settings -> API**, copy your `Project URL` and `anon` or `service_role` key.
3. Under **Authentication -> JWT Settings**, copy your `JWT Secret`.
4. In the **SQL Editor**, create the required caching table:
   ```sql
   CREATE TABLE indicator_comparisons (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       district_id TEXT NOT NULL,
       period_before TEXT NOT NULL,
       period_after TEXT NOT NULL,
       indicators JSONB NOT NULL,
       images JSONB NOT NULL,
       cached_at TIMESTAMP NOT NULL
   );
   ```

## 2. Google Earth Engine Setup (Satellite Data)

1. Go to https://earthengine.google.com/ → "Get Started" and register a Google account for **non-commercial use**.
2. Go to https://console.cloud.google.com/ and create a new project (e.g. `groundtruth`). Note the **Project ID**.
3. Enable the **"Earth Engine API"** in the Cloud Console.
4. Go to **IAM & Admin → Service Accounts → Create Service Account**. Name it (e.g. `groundtruth-backend`) and grant it the role **"Earth Engine Resource Writer"**.
5. Click into the new service account → **Keys** tab → **Add Key → Create New Key → JSON**. Download this `.json` file and place it in the `backend/` folder. **Never commit this to git.**
6. Go to https://code.earthengine.google.com/register and register your Cloud project for Earth Engine access.

## 3. Environment Variables

Create a `.env` file in the `backend/` directory by copying `.env.example`:

```bash
cp .env.example .env
```

Fill it out completely:

```env
USE_GEE=true
GEE_PROJECT_ID=your-google-cloud-project-id
GEE_SERVICE_ACCOUNT_EMAIL=your-service-account@...
GEE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/your-key-file.json

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

## 4. Run the Backend

Install dependencies (including `earthengine-api` and `supabase`):

```bash
cd backend
pip install -r requirements.txt
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

### Verification

If configured correctly, the terminal logs will show:
- `[indicator_engine] Earth Engine connected — using LIVE satellite data.`
- No startup validation errors regarding missing environment variables.

If the app crashes immediately, the `app/core/config.py` strict environment validator has actively blocked startup because of missing credentials in your `.env`.

### Troubleshooting

- **HTTP 503 Service Unavailable on districts endpoint**: Earth Engine isn't initialized properly. Check if your service account was registered for GEE access (Step 2.6) and your key path is correct.
- **HTTP 500 Internal Server Error**: Supabase table might be missing or you've provided the wrong credentials.
- **HTTP 429 Too Many Requests**: You have hit the slowapi rate limit (15 requests/minute on the heavy detail endpoints). Wait a minute and try again.
