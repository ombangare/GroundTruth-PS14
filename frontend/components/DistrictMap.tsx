"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DistrictSummary } from "@/lib/api";

const SEVERITY_COLOR: Record<string, string> = {
  good: "#34E89E",
  warn: "#FBBF24",
  bad: "#FB5A7C",
  pending: "#6B7280",
};

interface Props {
  districts: DistrictSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Auto-fits the map view to whatever districts are actually loaded.
 * Fixes the bug where 30+ Maharashtra districts rendered clustered into an
 * unclickable clump because the map was still framed for all-India zoom —
 * now it zooms to fit exactly the loaded set, so markers spread out and
 * become individually clickable.
 */
function FitBoundsToDistricts({ districts }: { districts: DistrictSummary[] }) {
  const map = useMap();

  useEffect(() => {
    if (districts.length === 0) return;
    const bounds = L.latLngBounds(districts.map((d) => [d.lat, d.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [districts, map]);

  return null;
}

export default function DistrictMap({ districts, selectedId, onSelect }: Props) {
  const fallbackCenter: [number, number] = [20.5937, 78.9629];
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch("/districts.geojson")
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error("Failed to load geojson", err));
  }, []);

  const districtMap = new Map(districts.map((d) => [d.id, d]));

  const geoStyle = (feature: any) => {
    const id = feature.properties.id;
    const isSelected = id === selectedId;
    const d = districtMap.get(id);
    const severity = d?.overall_severity || "pending";
    const isPending = severity === "pending";

    return {
      color: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.15)",
      weight: isSelected ? 2.5 : 0.5,
      fillColor: SEVERITY_COLOR[severity] || SEVERITY_COLOR.pending,
      fillOpacity: isSelected ? 0.6 : (isPending ? 0 : 0.35),
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const id = feature.properties.id;
    const name = feature.properties.name;
    const state = feature.properties.state;
    
    layer.on({
      click: () => onSelect(id),
    });
    
    layer.bindTooltip(`<span class="font-semibold">${name}</span>, ${state}`, { sticky: true });
  };

  return (
    <MapContainer
      center={fallbackCenter}
      zoom={5}
      scrollWheelZoom={true}
      className="h-full w-full rounded-xl"
      style={{ background: "#0b0618" }}
    >
      <FitBoundsToDistricts districts={districts} />

      {/* Real satellite/aerial imagery (Esri World Imagery — free, no API
          key required) instead of a flat vector basemap. */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        opacity={0.9}
      />
      {geoData ? (
        <GeoJSON
          key={selectedId} // Force re-render on selection change to update styles
          data={geoData}
          style={geoStyle}
          onEachFeature={onEachFeature}
        />
      ) : (
        districts.map((d) => {
          const isSelected = d.id === selectedId;
          return (
            <CircleMarker
              key={d.id}
              center={[d.lat, d.lon]}
              radius={isSelected ? 12 : 7}
              pathOptions={{
                color: "#ffffff",
                fillColor: SEVERITY_COLOR[d.overall_severity],
                fillOpacity: isSelected ? 0.95 : 0.85,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{ click: () => onSelect(d.id) }}
            >
              <Tooltip sticky>
                <span className="font-semibold">{d.name}</span>, {d.state}
              </Tooltip>
            </CircleMarker>
          );
        })
      )}
    </MapContainer>
  );
}
