import ee
from app.services.gee_service import EE_AVAILABLE, _initialized

def analyze_area_water(min_lat: float, max_lat: float, min_lon: float, max_lon: float, start_year="2018", end_year="2025"):
    """Calculates water shrinkage between two years for a given bounding box."""
    if not EE_AVAILABLE or not _initialized:
        return {"error": "Earth Engine not initialized"}

    try:
        coords = [
            [min_lon, min_lat],
            [min_lon, max_lat],
            [max_lon, max_lat],
            [max_lon, min_lat],
            [min_lon, min_lat]
        ]
        aoi = ee.Geometry.Polygon(coords)

        def get_water_area(year):
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(aoi)
                .filterDate(f"{year}-01-01", f"{year}-12-31")
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            )

            def maskClouds(img):
                qa = img.select('QA60')
                mask = qa.bitwiseAnd(1 << 10).eq(0)
                return img.updateMask(mask)

            collection = collection.map(maskClouds)
            image = collection.median()

            # MNDWI
            mndwi = image.normalizedDifference(['B3', 'B11'])
            water = mndwi.gt(0.2)

            pixelArea = ee.Image.pixelArea()
            waterArea = (
                pixelArea
                .updateMask(water)
                .reduceRegion(
                    reducer=ee.Reducer.sum(),
                    geometry=aoi,
                    scale=100,
                    maxPixels=1e10
                )
            )
            # Some years might not have water/data, safely handle it
            return ee.Number(waterArea.get('area')).divide(1_000_000)

        payload = ee.Dictionary({
            "area_start": get_water_area(start_year),
            "area_end": get_water_area(end_year)
        })

        res = payload.getInfo()
        area_start = res.get('area_start') or 0
        area_end = res.get('area_end') or 0
        loss = area_start - area_end
        loss_percent = (loss / area_start * 100) if area_start > 0 else 0

        return {
            "area_start": round(area_start, 2),
            "area_end": round(area_end, 2),
            "loss": round(loss, 2),
            "loss_percent": round(loss_percent, 1),
            "start_year": start_year,
            "end_year": end_year
        }
    except Exception as e:
        print(f"[gee_wetlands] area water analysis failed: {e}")
        return {"error": str(e)}

def analyze_wetland_health(min_lat: float, max_lat: float, min_lon: float, max_lon: float, start_year="2018", end_year="2024"):
    """
    Computes wetland area, rainfall, NDVI, and built-up area for start and end years.
    Returns the statistics and a deduced 'main cause' for shrinkage.
    """
    if not EE_AVAILABLE or not _initialized:
        return {"error": "Earth Engine not initialized"}

    try:
        coords = [
            [min_lon, min_lat],
            [min_lon, max_lat],
            [max_lon, max_lat],
            [max_lon, min_lat],
            [min_lon, min_lat]
        ]
        aoi = ee.Geometry.Polygon(coords)

        def get_yearly_stats(year):
            # 1. Optical Data (Sentinel-2)
            s2_col = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(aoi)
                .filterDate(f"{year}-01-01", f"{year}-12-31")
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            )
            def maskClouds(img):
                qa = img.select('QA60')
                mask = qa.bitwiseAnd(1 << 10).eq(0)
                return img.updateMask(mask)
            image = s2_col.map(maskClouds).median()

            # Indices
            ndwi = image.normalizedDifference(['B3', 'B8'])  # Water
            ndvi = image.normalizedDifference(['B8', 'B4'])  # Vegetation
            ndbi = image.normalizedDifference(['B11', 'B8']) # Built-up
            ndmi = image.normalizedDifference(['B8', 'B11']) # Moisture

            # Wetland Heuristic: Water + Moist Vegetation
            # water: NDWI > 0.1
            # moist veg: NDVI > 0.2 AND NDMI > 0.1
            is_water = ndwi.gt(0.1)
            is_moist_veg = ndvi.gt(0.2).And(ndmi.gt(0.1))
            wetland_mask = is_water.Or(is_moist_veg)
            
            # Urban Mask: NDBI > 0
            urban_mask = ndbi.gt(0)

            pixel_area = ee.Image.pixelArea()
            
            # Wetland Area
            wetland_area = pixel_area.updateMask(wetland_mask).reduceRegion(
                reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
            )
            
            # Urban Area
            urban_area = pixel_area.updateMask(urban_mask).reduceRegion(
                reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
            )
            
            # Mean NDVI
            mean_ndvi = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(), geometry=aoi, scale=100, maxPixels=1e10
            )

            # 2. Rainfall (CHIRPS)
            rainfall_col = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterBounds(aoi).filterDate(f"{year}-01-01", f"{year}-12-31")
            total_rainfall = rainfall_col.sum().reduceRegion(
                reducer=ee.Reducer.mean(), geometry=aoi, scale=5000, maxPixels=1e10
            )

            return ee.Dictionary({
                "wetland_sqkm": ee.Number(wetland_area.get('area')).divide(1_000_000),
                "urban_sqkm": ee.Number(urban_area.get('area')).divide(1_000_000),
                "ndvi": mean_ndvi.get('nd'),
                "rainfall_mm": total_rainfall.get('precipitation')
            })

        yearly_payload = {}
        for y in range(int(start_year), int(end_year) + 1):
            yearly_payload[str(y)] = get_yearly_stats(y)

        payload = ee.Dictionary(yearly_payload)

        res = payload.getInfo()
        
        start_data = res.get(str(start_year), {})
        end_data = res.get(str(end_year), {})
        
        time_series = []
        for y in range(int(start_year), int(end_year) + 1):
            val = res.get(str(y), {}).get("wetland_sqkm") or 0
            time_series.append({"name": str(y), "area": round(val, 2)})

        wetland_start = start_data.get('wetland_sqkm') or 0
        wetland_end = end_data.get('wetland_sqkm') or 0
        urban_start = start_data.get('urban_sqkm') or 0
        urban_end = end_data.get('urban_sqkm') or 0
        ndvi_start = start_data.get('ndvi') or 0
        ndvi_end = end_data.get('ndvi') or 0
        rain_start = start_data.get('rainfall_mm') or 0
        rain_end = end_data.get('rainfall_mm') or 0

        # Calculate Loss
        wetland_loss = wetland_start - wetland_end
        wetland_loss_pct = (wetland_loss / wetland_start * 100) if wetland_start > 0 else 0

        # Deduce Main Cause
        urban_growth = urban_end - urban_start
        cause = "Unknown / Natural Fluctuation"
        if urban_growth > (wetland_start * 0.05): # Urban grew significantly
            cause = "Urban Expansion"
        elif ndvi_end > ndvi_start and wetland_loss > 0:
            cause = "Agricultural Conversion"
        elif rain_end < (rain_start * 0.8):
            cause = "Drought / Climate Change"

        return {
            "start_year": start_year,
            "end_year": end_year,
            "wetland_start": round(wetland_start, 2),
            "wetland_end": round(wetland_end, 2),
            "wetland_loss": round(wetland_loss, 2),
            "wetland_loss_pct": round(wetland_loss_pct, 1),
            "urban_start": round(urban_start, 2),
            "urban_end": round(urban_end, 2),
            "ndvi_start": round(ndvi_start, 2),
            "ndvi_end": round(ndvi_end, 2),
            "rain_start": round(rain_start, 0),
            "rain_end": round(rain_end, 0),
            "main_cause": cause,
            "time_series": time_series
        }
    except Exception as e:
        print(f"[gee_wetlands] wetland health analysis failed: {e}")
        return {"error": str(e)}
