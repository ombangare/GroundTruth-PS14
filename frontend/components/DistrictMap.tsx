"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
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

/** Pin-shaped icon (matches the globe marker style) instead of a plain circle. */
function pinIcon(color: string, size: number): L.DivIcon {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
      <circle cx="12" cy="9" r="2.6" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

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

  return (
    <MapContainer
      center={fallbackCenter}
      zoom={5}
      scrollWheelZoom={true}
      className="h-full w-full rounded-xl"
      style={{ background: "#0b0618" }}
    >
      <FitBoundsToDistricts districts={districts} />

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
      {districts.map((d) => {
        const isSelected = d.id === selectedId;
        const size = isSelected ? 38 : 24;
        return (
          <Marker
            key={d.id}
            position={[d.lat, d.lon]}
            icon={pinIcon(SEVERITY_COLOR[d.overall_severity], size)}
            eventHandlers={{ click: () => onSelect(d.id) }}
          >
            {/* Selected district's name stays visible; others show on hover
                only, to avoid 36 permanent labels cluttering the map. */}
            <Tooltip
              permanent={isSelected}
              direction="top"
              offset={[0, -size + 4]}
              opacity={1}
              className="!bg-[#0a0e1a]/90 !border !border-signal/50 !text-white !font-mono !text-xs !px-2 !py-1 !rounded-md"
            >
              📍 {d.name}
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
