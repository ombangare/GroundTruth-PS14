import ee
import math
from app.services.gee_service import EE_AVAILABLE, _initialized

def analyze_urban_sprawl(min_lat: float, max_lat: float, min_lon: float, max_lon: float, start_year="2018", end_year="2020"):
    """
    Computes SDG 11.3.1 (Ratio of Land Consumption Rate to Population Growth Rate)
    1. Land Consumption Rate (LCR): Based on Dynamic World 'built' class expansion.
    2. Population Growth Rate (PGR): Based on WorldPop (WorldPop/POP).
    """
    if not EE_AVAILABLE or not _initialized:
        return {"error": "Earth Engine not initialized"}

    try:
        start_y = int(start_year)
        end_y = int(end_year)
        years = end_y - start_y
        if years <= 0:
            years = 1

        coords = [
            [min_lon, min_lat],
            [min_lon, max_lat],
            [max_lon, max_lat],
            [max_lon, min_lat],
            [min_lon, min_lat]
        ]
        aoi = ee.Geometry.Polygon(coords)

        # 1. Built-up Area (Dynamic World - Class 6 is built)
        def get_built_area(year):
            dw = (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                  .filterBounds(aoi)
                  .filterDate(f"{year}-01-01", f"{year}-12-31")
                  .select('label')
                  .mode())
            built_mask = dw.eq(6)
            pixel_area = ee.Image.pixelArea().updateMask(built_mask)
            area = pixel_area.reduceRegion(
                reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
            )
            return area.get('area')

        built_start_req = get_built_area(start_year)
        built_end_req = get_built_area(end_year)

        # 2. Population (WorldPop)
        # WorldPop is yearly. We use 'population' band.
        def get_population(year):
            # WorldPop latest is 2020, if requested > 2020, fallback to 2020
            # To ensure it doesn't break, we bound the year for WorldPop
            req_year = min(int(year), 2020)
            pop = (ee.ImageCollection("WorldPop/GP/100m/pop")
                   .filterBounds(aoi)
                   .filter(ee.Filter.eq('year', req_year))
                   .first())
            # In case no data for region, use a generic fallback or 0
            pop_img = ee.Image(pop).unmask(0)
            total_pop = pop_img.reduceRegion(
                reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
            )
            return total_pop.get('population')

        pop_start_req = get_population(start_year)
        pop_end_req = get_population(end_year)
        
        # 3. Compute Transitions (Why is it expanding?)
        # What was it before? (e.g. Forest, Crops)
        dw_start = (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                    .filterBounds(aoi)
                    .filterDate(f"{start_year}-01-01", f"{start_year}-12-31")
                    .select('label').mode())
        dw_end = (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                  .filterBounds(aoi)
                  .filterDate(f"{end_year}-01-01", f"{end_year}-12-31")
                  .select('label').mode())
                  
        new_urban_mask = dw_start.neq(6).And(dw_end.eq(6))
        
        # Agri lost to urban (Crops is 4)
        agri_to_urban = dw_start.eq(4).And(new_urban_mask)
        agri_lost_req = ee.Image.pixelArea().updateMask(agri_to_urban).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
        )
        
        # Forest lost to urban (Trees is 1)
        forest_to_urban = dw_start.eq(1).And(new_urban_mask)
        forest_lost_req = ee.Image.pixelArea().updateMask(forest_to_urban).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e10
        )

        payload = ee.Dictionary({
            "built_start": ee.Number(built_start_req).divide(1_000_000),
            "built_end": ee.Number(built_end_req).divide(1_000_000),
            "pop_start": ee.Number(pop_start_req),
            "pop_end": ee.Number(pop_end_req),
            "agri_lost": ee.Number(agri_lost_req.get('area')).divide(1_000_000),
            "forest_lost": ee.Number(forest_lost_req.get('area')).divide(1_000_000)
        })

        res = payload.getInfo()
        
        built_start = res.get('built_start') or 0.001
        built_end = res.get('built_end') or 0.001
        pop_start = res.get('pop_start') or 1.0
        pop_end = res.get('pop_end') or 1.0
        
        # Avoid division by zero
        built_start = max(built_start, 0.001)
        pop_start = max(pop_start, 1.0)
        
        # SDG Formulas
        try:
            lcr = math.log(built_end / built_start) / years
        except:
            lcr = 0
            
        try:
            pgr = math.log(pop_end / pop_start) / years
        except:
            pgr = 0
            
        # If PGR is very close to zero or negative, ratio can explode or be weird.
        if abs(pgr) < 0.0001:
            # Fake a tiny growth to avoid div by zero
            pgr = 0.0001
            
        lcr_pgr_ratio = lcr / pgr
        
        if lcr_pgr_ratio > 1.1:
            status = "Urban Sprawl"
        elif lcr_pgr_ratio < 0.9:
            status = "Densification"
        else:
            status = "Balanced Growth"
            
        return {
            "start_year": start_year,
            "end_year": end_year,
            "built_start_sqkm": round(built_start, 2),
            "built_end_sqkm": round(built_end, 2),
            "pop_start": int(pop_start),
            "pop_end": int(pop_end),
            "lcr": round(lcr, 4),
            "pgr": round(pgr, 4),
            "lcr_pgr_ratio": round(lcr_pgr_ratio, 2),
            "status": status,
            "agri_lost_sqkm": round(res.get('agri_lost') or 0, 2),
            "forest_lost_sqkm": round(res.get('forest_lost') or 0, 2)
        }

    except Exception as e:
        print(f"[gee_urban_sprawl] analysis failed: {e}")
        return {"error": str(e)}
