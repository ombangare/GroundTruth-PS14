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
*   **Climatic Context & Driver Deduction:** UCSB CHIRPS Daily Precipitation & Sentinel-2 NDBI.
    *   *Logic:* We calculate the absolute wetland area loss ($km^2$) against other spectral factors to automatically deduce the primary driver of the shrinkage using the following heuristic:
        1.  **Urban Expansion:** If Built-Up Surface (NDBI) grew by an area greater than 5% of the original wetland extent.
        2.  **Agricultural Conversion:** If Vegetation (NDVI) increased while water extent decreased.
        3.  **Drought / Climate Change:** If localized daily precipitation (CHIRPS) dropped by more than 20% compared to the baseline year.
    *   *Scientific Validation & Methodology:* This heuristic is based on established remote sensing methodologies for attributing wetland loss, specifically the multi-index integration approach. Studies validate that negative temporal correlations between NDWI (Water) and NDBI (Built-up) accurately isolate urban encroachment, while NDWI to NDVI transitions indicate agricultural conversion. By integrating localized precipitation datasets (CHIRPS), the algorithm isolates anthropogenic drivers from natural hydrological stress (drought). 
        *Reference: [Monitoring of dynamic wetland changes using NDVI and NDWI based landsat imagery](https://doi.org/10.1016/j.rsase.2021.100547) (Remote Sensing Applications: Society and Environment).*

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

## 3. Land Degradation Assessment (SDG 15.3.1)
**Target:** *Proportion of land that is degraded over total land area.*
**Data Source:** Sentinel-2 MSI (10m Resolution), Google Dynamic World (10m Resolution), and CHIRPS Precipitation (5km Resolution).

**The Challenge:** Land degradation is highly complex, officially requiring Soil Organic Carbon (SOC) analysis which changes too slowly for short-term satellite detection. 
**The Solution:** We implement a modified SDG 15.3.1 tracker strictly targeting the two most dynamic sub-indicators: Land Productivity (NDVI) and Land Cover Change.

*   **Land Productivity Mask:** Sentinel-2 NDVI
    *   *Logic:* We compare historical NDVI against current NDVI. A severe absolute drop ($> 0.15$) signals vegetation stress, drought, or degradation.
*   **Land Cover Transition Mask:** Google Dynamic World
    *   *Logic:* We compare historic classification against current classification. A pixel is flagged as degraded if it undergoes a negative transition (e.g., Forest or Grassland $\rightarrow$ Bare Soil or Built-up area).
*   **Intersection & Driver Deduction:**
    *   *Logic:* If a pixel triggers EITHER the Productivity decline OR the negative Land Cover transition, it is counted as degraded land. The degraded footprint ($km^2$) is then cross-referenced against NDBI (Urbanization) and Agricultural land cover expansion (Dynamic World crops) to deduce the primary anthropogenic driver of the degradation.

---

## 4. Urban Sprawl Assessment (SDG 11.3.1)
**Target:** *Ratio of land consumption rate (LCR) to population growth rate (PGR).*
**Data Source:** Google Dynamic World (10m Resolution) and WorldPop (100m Resolution).

**The Challenge:** Measuring urban sprawl requires tracking both physical built-up expansion and demographic shifts simultaneously.
**The Solution:** We implement the official UN LCR/PGR formula by fetching spatial data and population grids concurrently over the AOI.

*   **Land Consumption Rate (LCR):**
    *   *Logic:* We isolate the "Built" class (6) in Dynamic World for the start and end years. LCR is calculated using the logarithmic growth formula: `LCR = ln(Built_end / Built_start) / years`.
*   **Population Growth Rate (PGR):**
    *   *Logic:* We sum the total population within the AOI using the WorldPop grid for the start and end years. PGR is calculated similarly: `PGR = ln(Pop_end / Pop_start) / years`.
*   **The SDG Ratio (LCR / PGR):**
    *   *Logic:* We divide LCR by PGR to interpret the urban expansion style.
        *   **Ratio > 1:** Urban Sprawl (land consumed faster than population growth).
        *   **Ratio ≈ 1:** Balanced Growth.
        *   **Ratio < 1:** Densification.
    *   *Attribution:* We cross-reference the newly built pixels with historical Dynamic World data to quantify exactly how much agricultural land ($km^2$) or forest land ($km^2$) was lost to the urban expansion.

---

### Cloud Execution Note
All pixel-level math is executed server-side on Google Earth Engine clusters via the `ee.Image.pixelArea()` reducer. Our FastApi backend only receives the final aggregated square-kilometer JSON payloads, ensuring planetary-scale analysis occurs in real-time.
