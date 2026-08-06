# SDG Feature Extraction Logic

This document outlines the satellite remote sensing pipelines implemented in the GroundTruth backend via Google Earth Engine (GEE). Our architecture extracts spectral features directly from raw satellite telemetry to monitor two core UN Sustainable Development Goals (SDGs) using absolute area measurements ($km^2$) instead of arbitrary scoring or percentages.

---

## 1. Wetland & Water Surface Extraction (SDG 6.6.1)
**Target:** *Change in the spatial extent of water-related ecosystems over time.*
**Data Source:** Sentinel-2 Multispectral Instrument (MSI) (10m Resolution) and CHIRPS Daily Precipitation (5km Resolution).

**The Challenge:** Standard water indices often miss muddy swamps, seasonal wetlands, and dense reeds, leading to inaccurate environmental tracking.
**The Solution:** We implement a multi-variable heuristic combining water, vegetation, and moisture indices.

*   **Primary Water Mask:** Normalized Difference Water Index (NDWI) from Sentinel-2.
    *   `NDWI = (Green - NIR) / (Green + NIR)`
    *   *Logic:* Identifies pure surface water where `NDWI > 0.1`.
*   **Moist Vegetation Mask:** Normalized Difference Vegetation Index (NDVI) + Normalized Difference Moisture Index (NDMI) from Sentinel-2.
    *   *Logic:* Identifies marshlands and swamps where `NDVI > 0.2` AND `NDMI > 0.1`.
*   **Climatic Context:** UCSB CHIRPS Daily Precipitation.
    *   *Logic:* We intersect the absolute wetland area loss ($km^2$) against localized rainfall data to deduce the primary driver (e.g., Drought vs. Urban Expansion).

---

## 2. Forest Cover Extraction (SDG 15.1.1)
**Target:** *Forest area as a proportion of total land area.*
**Data Source:** ESA WorldCover v200 (10m Resolution) and Sentinel-2 Multispectral Instrument (MSI) (10m Resolution).

**The Challenge:** Satellites record spectral signatures, not tree types. Relying solely on dense vegetation signatures (high NDVI) causes massive false positives from agricultural crops and golf courses.
**The Solution:** A dual-layer masking approach combining static machine learning with dynamic multispectral telemetry to extract exact spatial extents ($km^2$).

*   **Static Base Mask:** ESA WorldCover v200 (10m).
    *   *Logic:* We extract `Class 10 (Trees)` to establish a highly accurate baseline of where forests physically exist, eliminating false agricultural positives.
*   **Dynamic Health Mask:** Sentinel-2 NDVI.
    *   *Logic:* We calculate the historical NDVI for the specified year using Sentinel-2.
*   **Intersection:**
    *   *Logic:* A pixel is only counted as "Forest" if it exists in the WorldCover tree zone AND maintains an `NDVI > 0.6` for the given year. If the NDVI drops below 0.6, the area is classified as deforested or severely degraded. The result is returned in absolute square kilometers ($km^2$).

---

### Cloud Execution Note
All pixel-level math is executed server-side on Google Earth Engine clusters via the `ee.Image.pixelArea()` reducer. Our FastApi backend only receives the final aggregated square-kilometer JSON payloads, ensuring planetary-scale analysis occurs in real-time.
