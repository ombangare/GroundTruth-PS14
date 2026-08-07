from typing import Dict, Any

def format_for_llm(sdg_target: str, raw_data: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Translates raw numbers from Google Earth Engine into a deeply enriched, 
    research-oriented JSON context window for the LangGraph/Groq LLM.
    """
    total_area = raw_data.get("total_area", 0)
    start_year = raw_data.get('start_year', '2018')
    end_year = raw_data.get('end_year', '2024')
    
    # Core Foundation Structure
    master_json = {
        "spatial_context": {
            "total_area_analyzed_sqkm": total_area,
            "bounding_box": {
                "min_lat": payload["minLat"],
                "max_lat": payload["maxLat"],
                "min_lon": payload["minLon"],
                "max_lon": payload["maxLon"]
            },
            "centroid": {
                "latitude": (payload["minLat"] + payload["maxLat"]) / 2,
                "longitude": (payload["minLon"] + payload["maxLon"]) / 2
            },
            "district_name_override": payload.get("districtName", "Unknown")
        },
        "temporal_context": {
            "baseline_year": start_year,
            "assessment_year": end_year,
            "duration_years": int(end_year) - int(start_year)
        },
        "sdg_analysis": {}
    }

    # SDG 6.6.1 - Wetland Ecosystems
    if sdg_target == "6.6.1":
        loss = raw_data.get("wetland_loss", 0)
        cause = raw_data.get("main_cause", "Unknown")
        severity = "Critical" if loss > (total_area * 0.1) else "High" if loss > (total_area * 0.05) else "Moderate" if loss > 0 else "Stable"
        
        master_json["data_lineage"] = [
            "COPERNICUS/S2_SR_HARMONIZED (Sentinel-2 MSI, 10m)",
            "UCSB-CHG/CHIRPS/DAILY (Precipitation, 5km)"
        ]
        
        master_json["sdg_analysis"]["sdg_6_6_1_wetlands"] = {
            "ecological_health_status": "Degraded" if loss > 0 else "Stable",
            "severity_level": severity,
            "primary_anthropogenic_or_climatic_driver": cause,
            "methodology_and_thresholds": {
                "water_extraction": "mNDWI (Modified Normalized Difference Water Index) evaluated at < 20% cloud cover.",
                "driver_attribution": "Temporal correlation checks: Negative NDWI/NDBI correlation -> Urbanization. NDWI to NDVI transition -> Agriculture. Local CHIRPS crash -> Drought."
            },
            "quantitative_findings": {
                "total_water_lost_sqkm": loss,
                "urban_expansion_during_period_sqkm": round(raw_data.get("urban_end", 0) - raw_data.get("urban_start", 0), 2)
            },
            "policy_implications": "If agricultural or urban drivers are high, zoning enforcement is urgently required to protect remaining riparian buffers."
        }

    # SDG 15.1.1 - Forest Cover
    elif sdg_target == "15.1.1":
        loss = raw_data.get("forest_lost_sqkm", 0)
        cause = raw_data.get("main_cause", "Unknown")
        severity = "Critical" if loss > (total_area * 0.1) else "High" if loss > (total_area * 0.05) else "Moderate" if loss > 0 else "Stable"

        master_json["data_lineage"] = [
            "ESA/WorldCover/v100 & v200 (10m)",
            "COPERNICUS/S2_SR_HARMONIZED (Sentinel-2 MSI, 10m)"
        ]

        master_json["sdg_analysis"]["sdg_15_1_1_forests"] = {
            "ecological_health_status": "Deforested" if loss > 0 else "Stable",
            "severity_level": severity,
            "primary_anthropogenic_or_climatic_driver": cause,
            "methodology_and_thresholds": {
                "forest_extraction": "Pixels intersecting ESA WorldCover Tree class AND exceeding Sentinel-2 NDVI > 0.6.",
                "driver_attribution": "NDVI drop cross-referenced with Dynamic World transitions to track conversion to bare soil or built-up surfaces."
            },
            "quantitative_findings": {
                "total_forest_cleared_sqkm": loss,
                "converted_to_urban_sqkm": raw_data.get("urban_lost_sqkm", 0),
                "converted_to_agriculture_sqkm": raw_data.get("agri_lost_sqkm", 0)
            },
            "policy_implications": "Requires immediate afforestation mandates or investigation into illegal logging/agricultural clearing."
        }

    # SDG 15.3.1 - Land Degradation
    elif sdg_target == "15.3.1":
        degraded = raw_data.get("degraded_area", 0)
        cause = raw_data.get("main_cause", "Unknown")
        percent = (degraded / total_area * 100) if total_area > 0 else 0
        severity = "Critical" if percent > 15 else "High" if percent > 5 else "Moderate" if degraded > 0 else "Stable"

        master_json["data_lineage"] = [
            "GOOGLE/DYNAMICWORLD/V1 (10m)",
            "COPERNICUS/S2_SR_HARMONIZED (Sentinel-2 MSI, 10m)"
        ]

        master_json["sdg_analysis"]["sdg_15_3_1_land_degradation"] = {
            "ecological_health_status": "Degrading" if degraded > 0 else "Stable",
            "severity_level": severity,
            "primary_anthropogenic_or_climatic_driver": cause,
            "methodology_and_thresholds": {
                "degradation_extraction": "Modified SDG 15.3.1. Uses Land Productivity (persistent absolute NDVI decline > 0.15) OR negative Land Cover transitions (e.g. Forest -> Bare Soil) in Dynamic World.",
                "omission_note": "Soil Organic Carbon (SOC) was omitted from this calculation due to temporal latency constraints in satellite tracking."
            },
            "quantitative_findings": {
                "total_degraded_area_sqkm": degraded,
                "percentage_of_total_land": round(percent, 2),
                "degraded_by_urbanization_sqkm": raw_data.get("urban_degraded_sqkm", 0),
                "degraded_by_agriculture_sqkm": raw_data.get("agri_degraded_sqkm", 0)
            },
            "policy_implications": "High degradation percentage indicates unsustainable land use practices leading to desertification or severe soil sealing."
        }

    # SDG 11.3.1 - Urban Sprawl
    elif sdg_target == "11.3.1":
        ratio = raw_data.get("lcr_pgr_ratio", 0)
        status = raw_data.get("status", "Unknown")
        severity = "Critical" if ratio > 2 else "High" if ratio > 1.2 else "Normal"

        master_json["data_lineage"] = [
            "GOOGLE/DYNAMICWORLD/V1 (Built-up class, 10m)",
            "WorldPop/GP/100m/pop (Population grids, 100m)"
        ]

        master_json["sdg_analysis"]["sdg_11_3_1_urban_sprawl"] = {
            "ecological_health_status": status,
            "severity_level": severity,
            "primary_anthropogenic_or_climatic_driver": "Unplanned Horizontal Expansion" if ratio > 1 else "Densification",
            "methodology_and_thresholds": {
                "lcr_extraction": "Logarithmic Land Consumption Rate: ln(Built_end / Built_start) / years.",
                "pgr_extraction": "Logarithmic Population Growth Rate: ln(Pop_end / Pop_start) / years.",
                "driver_attribution": "Calculated intersection of new Built-up pixels against historical vegetation masks to quantify ecological cost of sprawl."
            },
            "quantitative_findings": {
                "lcr_pgr_ratio": ratio,
                "total_urban_expansion_sqkm": raw_data.get("new_urban_sqkm", 0),
                "land_consumption_rate": raw_data.get("lcr", 0),
                "population_growth_rate": raw_data.get("pgr", 0),
                "agricultural_land_consumed_sqkm": raw_data.get("agri_lost_sqkm", 0),
                "forest_land_consumed_sqkm": raw_data.get("forest_lost_sqkm", 0)
            },
            "policy_implications": "Ratio > 1 indicates unsustainable outward sprawl, destroying adjacent ecologies. Prompts need for vertical densification policies."
        }

    return master_json
