"use client";

import { useState, useEffect } from "react";
import SatelliteTile from "./SatelliteTile";
import type { IndicatorDetail } from "@/lib/api";

interface Props {
  districtId: string;
  district?: any;
  beforeLabel: string;
  afterLabel: string;
  indicators: Record<string, IndicatorDetail>;
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
  onImageClick?: (lat: number, lon: number) => void;
}

/**
 * Shows a real GEE-exported <img> when available (afterImageUrl/beforeImageUrl
 * come from the backend once USE_GEE=true). Falls back to SatelliteTile — a
 * visualization actually driven by this district's real water/vegetation/heat
 * numbers — rather than a decorative gradient, so the fallback still means
 * something instead of just being a color-drag toy.
 */
export default function BeforeAfterSlider({
  districtId,
  district,
  beforeLabel,
  afterLabel,
  indicators,
  beforeImageUrl,
  afterImageUrl,
  onImageClick,
}: Props) {
  const [split, setSplit] = useState(50);
  const [beforeError, setBeforeError] = useState(false);
  const [afterError, setAfterError] = useState(false);

  useEffect(() => {
    setBeforeError(false);
    setAfterError(false);
  }, [beforeImageUrl, afterImageUrl]);

  const water = indicators.water;
  const green = indicators.green_cover;
  const heat = indicators.urban_heat;

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onImageClick || !district || !beforeImageUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    
    // In gee_service, we use a 5000m buffer.
    // 5000m is ~0.045 degrees.
    const boundsSizeDeg = 0.045;
    const minLon = district.lon - boundsSizeDeg;
    const maxLon = district.lon + boundsSizeDeg;
    const minLat = district.lat - boundsSizeDeg;
    const maxLat = district.lat + boundsSizeDeg;
    
    // Y is inverted (0 is top, which is maxLat)
    const clickLon = minLon + (xPct * (maxLon - minLon));
    const clickLat = maxLat - (yPct * (maxLat - minLat));
    
    onImageClick(clickLat, clickLon);
  };

  return (
    <div className="hud-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] text-signal uppercase tracking-widest">
          Before / After — {water?.index_used} · {green?.index_used} · {heat?.index_used}
        </p>
        <span className="font-mono text-[10px] text-aurora-magenta animate-pulse">Click image to analyze point</span>
      </div>

      <div 
        className="relative w-full aspect-[16/9] rounded-lg overflow-hidden select-none cursor-crosshair"
        onClick={handleImageClick}
      >
        <div className="absolute inset-0">
          {afterImageUrl && !afterError ? (
            <img 
              src={afterImageUrl} 
              alt={`${afterLabel} satellite view`} 
              className="w-full h-full object-cover" 
              onError={() => setAfterError(true)} 
            />
          ) : (
            <SatelliteTile
              seed={districtId}
              label="after"
              waterValue={water?.after_value ?? 0}
              greenPct={green?.after_value ?? 0}
              heatValue={heat?.after_value ?? 0}
            />
          )}
        </div>

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        >
          {beforeImageUrl && !beforeError ? (
            <img 
              src={beforeImageUrl} 
              alt={`${beforeLabel} satellite view`} 
              className="w-full h-full object-cover" 
              onError={() => setBeforeError(true)} 
            />
          ) : (
            <SatelliteTile
              seed={districtId}
              label="before"
              waterValue={water?.before_value ?? 0}
              greenPct={green?.before_value ?? 0}
              heatValue={heat?.before_value ?? 0}
            />
          )}
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-signal shadow-[0_0_12px_rgba(34,211,238,0.9)]"
          style={{ left: `${split}%` }}
        />

        <span className="absolute top-3 left-3 font-mono text-xs text-ink bg-space/80 px-2 py-1 rounded-md backdrop-blur border border-signal/20">
          {beforeLabel}
        </span>
        <span className="absolute top-3 right-3 font-mono text-xs text-ink bg-space/80 px-2 py-1 rounded-md backdrop-blur border border-signal/20">
          {afterLabel}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        className="w-full mt-3 accent-signal"
      />
      <p className="text-center text-xs font-mono text-ink-muted mt-1">
        Drag to compare {beforeLabel} → {afterLabel}
      </p>
    </div>
  );
}
