"use client";

import { useState } from "react";
import SatelliteTile from "./SatelliteTile";
import type { IndicatorDetail } from "@/lib/api";

interface Props {
  districtId: string;
  beforeLabel: string;
  afterLabel: string;
  indicators: Record<string, IndicatorDetail>;
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
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
  beforeLabel,
  afterLabel,
  indicators,
  beforeImageUrl,
  afterImageUrl,
}: Props) {
  const [split, setSplit] = useState(50);

  const water = indicators.water;
  const green = indicators.green_cover;
  const heat = indicators.urban_heat;

  return (
    <div className="hud-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] text-signal uppercase tracking-widest">
          Before / After — {water?.index_used} · {green?.index_used} · {heat?.index_used}
        </p>
        {!beforeImageUrl && (
          <span className="font-mono text-[10px] text-ink-muted/70">data-driven preview</span>
        )}
      </div>

      <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden select-none">
        <div className="absolute inset-0">
          {afterImageUrl ? (
            <img src={afterImageUrl} alt={`${afterLabel} satellite view`} className="w-full h-full object-cover" />
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
          {beforeImageUrl ? (
            <img src={beforeImageUrl} alt={`${beforeLabel} satellite view`} className="w-full h-full object-cover" />
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
