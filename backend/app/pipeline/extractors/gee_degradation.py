import ee
from app.services.gee_service import EE_AVAILABLE, _initialized

def analyze_land_degradation(min_lat: float, max_lat: float, min_lon: float, max_lon: float, start_year="2018", end_year="2024"):
    """
    Computes Land Degradation (SDG 15.3.1 - modified) using:
    1. Land Productivity (NDVI decline)
    2. Land Cover Change (Dynamic World negative transitions)
    3. Climatic/Urban variables for cause deduction
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

        # 1. NDVI (Land Productivity)
        def get_ndvi(year):
            col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                   .filterBounds(aoi)
                   .filterDate(f"{year}-01-01", f"{year}-12-31")
                   .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20)))
            
            def maskClouds(img):
                qa = img.select('QA60')
                mask = qa.bitwiseAnd(1 << 10).eq(0)
                return img.updateMask(mask)
            
            img = col.map(maskClouds).median()
            return img.normalizedDifference(['B8', 'B4']).rename('ndvi')

        ndvi_start = get_ndvi(start_year)
        ndvi_end = get_ndvi(end_year)
        
        # Degradation condition 1: Severe NDVI drop
        # (Using a strict drop threshold to avoid seasonal noise)
        ndvi_degraded = ndvi_start.subtract(ndvi_end).gt(0.15)

        # 2. Land Cover Change (Dynamic World)
        # 0: water, 1: trees, 2: grass, 3: flooded_vegetation, 4: crops, 
        # 5: shrub_and_scrub, 6: built, 7: bare, 8: snow_and_ice
        def get_dw(year):
            return (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                    .filterBounds(aoi)
                    .filterDate(f"{year}-01-01", f"{year}-12-31")
                    .select('label')
                    .mode())

        dw_start = get_dw(start_year)
        dw_end = get_dw(end_year)

        # Negative transitions:
        # Trees (1) or Grass (2) or Shrub (5) -> Built (6) or Bare (7)
        veg_start = dw_start.eq(1).Or(dw_start.eq(2)).Or(dw_start.eq(5))
        degraded_end = dw_end.eq(6).Or(dw_end.eq(7))
        lc_degraded = veg_start.And(degraded_end)

        # Final Degraded Mask (NDVI drop OR negative land cover transition)
        degraded_mask = ndvi_degraded.Or(lc_degraded)

        # Calculate Areas
        pixel_area = ee.Image.pixelArea()
        
        total_area_req = pixel_area.reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
        )
        
        degraded_area_req = pixel_area.updateMask(degraded_mask).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
        )
        
        # Calculate Causes for the degraded pixels only
        # We look at NDBI increase and Rainfall decrease
        def get_ndbi(year):
            col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                   .filterBounds(aoi)
                   .filterDate(f"{year}-01-01", f"{year}-12-31")
                   .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20)))
            img = col.median()
            return img.normalizedDifference(['B11', 'B8']).rename('ndbi')
            
        ndbi_start = get_ndbi(start_year)
        ndbi_end = get_ndbi(end_year)
        ndbi_increase_mask = ndbi_end.subtract(ndbi_start).gt(0.1)
        
        # Urbanization cause: Degraded pixels that also saw NDBI increase
        urban_degraded_mask = degraded_mask.And(ndbi_increase_mask)
        urban_degraded_req = pixel_area.updateMask(urban_degraded_mask).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
        )
        
        # Cropland Expansion cause: 
        # Trees/Grass -> Crops (4)
        agri_mask = veg_start.And(dw_end.eq(4))
        agri_degraded_mask = degraded_mask.And(agri_mask)
        agri_degraded_req = pixel_area.updateMask(agri_degraded_mask).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
        )

        # Execute payload
        payload = ee.Dictionary({
            "total_sqkm": ee.Number(total_area_req.get('area')).divide(1_000_000),
            "degraded_sqkm": ee.Number(degraded_area_req.get('area')).divide(1_000_000),
            "urban_degraded_sqkm": ee.Number(urban_degraded_req.get('area')).divide(1_000_000),
            "agri_degraded_sqkm": ee.Number(agri_degraded_req.get('area')).divide(1_000_000),
        })

        res = payload.getInfo()
        
        total_sqkm = res.get('total_sqkm') or 0.001
        degraded_sqkm = res.get('degraded_sqkm') or 0
        urban_deg = res.get('urban_degraded_sqkm') or 0
        agri_deg = res.get('agri_degraded_sqkm') or 0
        
        # Driver deduction
        cause = "Drought / Natural Degradation"
        if urban_deg > agri_deg and urban_deg > (degraded_sqkm * 0.2):
            cause = "Urbanization & Infrastructure"
        elif agri_deg > urban_deg and agri_deg > (degraded_sqkm * 0.2):
            cause = "Agricultural Expansion"
            
        return {
            "start_year": start_year,
            "end_year": end_year,
            "total_area": round(total_sqkm, 2),
            "degraded_area": round(degraded_sqkm, 2),
            "healthy_area": round(total_sqkm - degraded_sqkm, 2),
            "main_cause": cause,
            "urban_degraded_sqkm": round(urban_deg, 2),
            "agri_degraded_sqkm": round(agri_deg, 2)
        }

    except Exception as e:
        print(f"[gee_degradation] analysis failed: {e}")
        return {"error": str(e)}
