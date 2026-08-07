import ee
from app.services.gee_service import EE_AVAILABLE, _initialized

def analyze_forest_cover(min_lat: float, max_lat: float, min_lon: float, max_lon: float, start_year="2018", end_year="2024"):
    """
    Computes forest cover area using ESA WorldCover mask combined with dynamic NDVI thresholding.
    Tracks SDG 15.1.1 (Forest area as a proportion of total land area).
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
        
        # ESA WorldCover v200 (2021) - Class 10 is 'Trees'
        worldcover = ee.ImageCollection("ESA/WorldCover/v200").first()
        tree_mask = worldcover.eq(10)
        
        def get_forest_stats(year):
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
            
            # NDVI > 0.6 indicates dense vegetation (like forests)
            ndvi = image.normalizedDifference(['B8', 'B4'])
            dense_veg = ndvi.gt(0.6)
            
            # Intersection: Must be historically classified as Trees AND currently dense vegetation
            forest_mask = dense_veg.And(tree_mask)
            
            pixel_area = ee.Image.pixelArea()
            forest_area = pixel_area.updateMask(forest_mask).reduceRegion(
                reducer=ee.Reducer.sum(), geometry=aoi, scale=10, maxPixels=1e10
            )
            return ee.Number(forest_area.get('area')).divide(1_000_000)
            
        yearly_payload = {}
        for y in range(int(start_year), int(end_year) + 1):
            yearly_payload[str(y)] = get_forest_stats(y)
            
        payload = ee.Dictionary({
            "yearly_data": ee.Dictionary(yearly_payload),
            "total_area_sqkm": ee.Number(aoi.area()).divide(1_000_000)
        })
        
        res = payload.getInfo()
        
        yearly_data = res.get('yearly_data', {})
        start_sqkm = yearly_data.get(str(start_year)) or 0
        end_sqkm = yearly_data.get(str(end_year)) or 0
        
        time_series = []
        for y in range(int(start_year), int(end_year) + 1):
            val = yearly_data.get(str(y)) or 0
            time_series.append({"name": str(y), "area": round(val, 2)})
        total_sqkm = res.get('total_area_sqkm') or 1
        
        loss_sqkm = start_sqkm - end_sqkm
        loss_pct = (loss_sqkm / start_sqkm * 100) if start_sqkm > 0 else 0
        
        start_proportion = (start_sqkm / total_sqkm * 100)
        end_proportion = (end_sqkm / total_sqkm * 100)
        
        return {
            "start_year": start_year,
            "end_year": end_year,
            "forest_start": round(start_sqkm, 2),
            "forest_end": round(end_sqkm, 2),
            "forest_loss": round(loss_sqkm, 2),
            "forest_loss_pct": round(loss_pct, 1),
            "start_proportion": round(start_proportion, 1),
            "end_proportion": round(end_proportion, 1),
            "total_area": round(total_sqkm, 2),
            "time_series": time_series
        }
    except Exception as e:
        print(f"[gee_forests] forest analysis failed: {e}")
        return {"error": str(e)}
