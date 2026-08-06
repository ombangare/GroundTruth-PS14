from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_KEY

# Initialize the Supabase client
# Depending on your environment, you can use the service role key for backend access
# or the anon key if using RLS properly with auth context.
if not SUPABASE_URL or not SUPABASE_KEY:
    supabase: Client = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
