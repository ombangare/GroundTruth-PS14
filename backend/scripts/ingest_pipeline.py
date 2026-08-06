import os
import sys
import time

# Ensure we can import the app modules when running from the backend dir
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

from app.services import gee_service, gee_cache, district_service

def run_pipeline(year_before="2017", year_after="2024", delay_seconds=2):
    print("🚀 Starting GEE Data Ingestion Pipeline...")
    
    if not gee_service.init_earth_engine():
        print("❌ Failed to initialize Google Earth Engine. Check your .env credentials.")
        return
        
    print("✅ Google Earth Engine connected.")
    
    # Force load district database from GeoJSON
    district_service._get_district_metadata("") 
    districts = district_service._districts_db
    
    if not districts:
        print("❌ Failed to load districts GeoJSON.")
        return
        
    total = len(districts)
    print(f"📊 Found {total} districts to process.")
    
    for i, (dist_id, d) in enumerate(districts.items(), 1):
        print(f"[{i}/{total}] Processing {d['name']} ({dist_id})...")
        
        # Check if already cached in Supabase
        cached = gee_cache.get(dist_id, year_before, year_after)
        if cached is not None:
            print(f"  ⏭️ Already cached. Skipping.")
            continue
            
        district_dict = {
            "id": d["id"],
            "name": d["name"],
            "state": d["state"],
            "lat": d.get("latitude") or d.get("lat"),
            "lon": d.get("longitude") or d.get("lon"),
            "period_before": year_before,
            "period_after": year_after
        }
            
        try:
            print(f"  📡 Fetching indicators from GEE...")
            indicators = gee_service.compute_district_indicators(
                lat=district_dict["lat"], 
                lon=district_dict["lon"], 
                before_year=year_before, 
                after_year=year_after,
                district=district_dict
            )
            
            print(f"  📸 Fetching thumbnails from GEE...")
            images = gee_service.get_district_images(
                lat=district_dict["lat"], 
                lon=district_dict["lon"], 
                before_year=year_before, 
                after_year=year_after,
                district=district_dict
            )
            
            print(f"  💾 Saving to Supabase...")
            gee_cache.set(dist_id, year_before, year_after, indicators, images)
            
            print(f"  ✅ Done.")
            
        except Exception as e:
            print(f"  ❌ Error processing {d['name']}: {e}")
            
        # Respect GEE rate limits
        time.sleep(delay_seconds)
        
    print("🎉 Pipeline finished successfully!")

if __name__ == "__main__":
    run_pipeline()
