"use client";

import { useState, useEffect, useRef } from "react";
import type { IndicatorDetail } from "@/lib/api";
import { Rnd } from "react-rnd";

interface Props {
  districtId: string;
  district?: any;
  beforeLabel: string;
  afterLabel: string;
  indicators: Record<string, IndicatorDetail>;
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
  aoiBounds?: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null;
  onImageClick?: (lat: number, lon: number) => void;
  onAreaSelect?: (bounds: {minLat: number, maxLat: number, minLon: number, maxLon: number}) => void;
}

export default function BeforeAfterSlider({
  districtId,
  district,
  beforeLabel,
  afterLabel,
  indicators,
  beforeImageUrl,
  afterImageUrl,
  aoiBounds,
  onImageClick,
  onAreaSelect,
}: Props) {
  const [split, setSplit] = useState(50);
  const [beforeError, setBeforeError] = useState(false);
  const [afterError, setAfterError] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{x: number, y: number} | null>(null);
  
  // Persisted Rnd box state
  const [box, setBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);

  useEffect(() => {
    setBeforeError(false);
    setAfterError(false);
  }, [beforeImageUrl, afterImageUrl]);

  const water = indicators.water;
  const green = indicators.green_cover;
  const heat = indicators.urban_heat;

  const triggerAreaSelect = (x: number, y: number, w: number, h: number) => {
    if (!district || !onAreaSelect || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Use the real AOI bounds from the backend if available, otherwise
    // fall back to the hardcoded ±0.045° estimate around the centroid
    const minLon = aoiBounds?.minLon ?? (district.lon - 0.045);
    const maxLon = aoiBounds?.maxLon ?? (district.lon + 0.045);
    const minLat = aoiBounds?.minLat ?? (district.lat - 0.045);
    const maxLat = aoiBounds?.maxLat ?? (district.lat + 0.045);

    const minXPct = x / rect.width;
    const maxXPct = (x + w) / rect.width;
    const minYPct = y / rect.height;
    const maxYPct = (y + h) / rect.height;

    // For longitude: x goes 0 -> width, longitude goes minLon -> maxLon
    const lon1 = minLon + (minXPct * (maxLon - minLon));
    const lon2 = minLon + (maxXPct * (maxLon - minLon));
    
    // For latitude: y goes 0 -> height, but latitude goes maxLat -> minLat
    // Top of image (y=0) is maxLat, bottom of image (y=height) is minLat
    const lat1 = maxLat - (maxYPct * (maxLat - minLat)); // bottom edge of box
    const lat2 = maxLat - (minYPct * (maxLat - minLat)); // top edge of box

    onAreaSelect({ minLat: lat1, maxLat: lat2, minLon: lon1, maxLon: lon2 });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!district || !containerRef.current) return;
    
    // Ignore clicks if they originate from the Rnd box (resize/drag handles)
    // Rnd automatically stops propagation for drags, but just in case:
    if ((e.target as HTMLElement).closest('.rnd-box')) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setBox(null);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawCurrent({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !drawCurrent || !containerRef.current) return;
    setIsDrawing(false);

    const rect = containerRef.current.getBoundingClientRect();
    const widthPx = Math.abs(drawCurrent.x - drawStart.x);
    const heightPx = Math.abs(drawCurrent.y - drawStart.y);

    if (widthPx < 5 && heightPx < 5) {
      if (onImageClick) {
        const minLon = aoiBounds?.minLon ?? (district.lon - 0.045);
        const maxLon = aoiBounds?.maxLon ?? (district.lon + 0.045);
        const minLat = aoiBounds?.minLat ?? (district.lat - 0.045);
        const maxLat = aoiBounds?.maxLat ?? (district.lat + 0.045);
        
        const xPct = drawStart.x / rect.width;
        const yPct = drawStart.y / rect.height;
        const clickLon = minLon + (xPct * (maxLon - minLon));
        // For latitude, y=0 is maxLat, y=1 is minLat
        const clickLat = maxLat - (yPct * (maxLat - minLat));
        onImageClick(clickLat, clickLon);
      }
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    setBox({ x, y, w: widthPx, h: heightPx });
    triggerAreaSelect(x, y, widthPx, heightPx);
    
    setDrawStart(null);
    setDrawCurrent(null);
  };

  return (
    <div className="hud-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] text-signal uppercase tracking-widest">
          Before / After — {water?.index_used} · {green?.index_used}
        </p>
        <span className="font-mono text-[10px] text-aurora-magenta animate-pulse">Draw area to analyze</span>
      </div>

      <div 
        ref={containerRef}
        className="relative w-full aspect-[16/9] rounded-lg overflow-hidden select-none"
      >
        <div 
          className="absolute inset-0 z-20 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setIsDrawing(false); setDrawStart(null); setDrawCurrent(null); }}
        />

        {/* Resizable/Draggable Persistent Box */}
        {box && (
          <Rnd
            className="rnd-box border-2 border-aurora-magenta bg-aurora-magenta/20 shadow-[0_0_20px_rgba(244,114,182,0.4)] z-30"
            bounds="parent"
            position={{ x: box.x, y: box.y }}
            size={{ width: box.w, height: box.h }}
            onDragStop={(e, d) => {
              setBox(prev => prev ? { ...prev, x: d.x, y: d.y } : null);
              triggerAreaSelect(d.x, d.y, box.w, box.h);
            }}
            onResizeStop={(e, direction, ref, delta, position) => {
              const newW = parseInt(ref.style.width, 10);
              const newH = parseInt(ref.style.height, 10);
              setBox({ x: position.x, y: position.y, w: newW, h: newH });
              triggerAreaSelect(position.x, position.y, newW, newH);
            }}
            resizeHandleClasses={{
              bottomRight: "bg-aurora-magenta w-3 h-3 rounded-full shadow-lg right-[-6px] bottom-[-6px]",
              bottomLeft: "bg-aurora-magenta w-3 h-3 rounded-full shadow-lg left-[-6px] bottom-[-6px]",
              topRight: "bg-aurora-magenta w-3 h-3 rounded-full shadow-lg right-[-6px] top-[-6px]",
              topLeft: "bg-aurora-magenta w-3 h-3 rounded-full shadow-lg left-[-6px] top-[-6px]",
            }}
          />
        )}

        {/* Visual Drawing Box (while creating) */}
        {isDrawing && drawStart && drawCurrent && (
          <div
            className="absolute border border-aurora-magenta bg-aurora-magenta/10 pointer-events-none z-30 shadow-[0_0_15px_rgba(244,114,182,0.4)]"
            style={{
              left: Math.min(drawStart.x, drawCurrent.x),
              top: Math.min(drawStart.y, drawCurrent.y),
              width: Math.abs(drawCurrent.x - drawStart.x),
              height: Math.abs(drawCurrent.y - drawStart.y),
            }}
          />
        )}

        <div className="absolute inset-0 pointer-events-none bg-[#050811] flex items-center justify-center">
          {afterImageUrl && !afterError ? (
            <img 
              src={afterImageUrl} 
              alt={`${afterLabel} satellite view`} 
              className="w-full h-full object-fill" 
              onError={() => setAfterError(true)} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-signal/50 font-mono text-[10px]">
              <div className="w-8 h-8 border-2 border-signal/20 border-t-signal rounded-full animate-spin mb-2" />
              <span>AWAITING {afterLabel} TELEMETRY</span>
            </div>
          )}
        </div>

        <div
          className="absolute inset-0 overflow-hidden pointer-events-none bg-[#050811] flex items-center justify-center"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        >
          {beforeImageUrl && !beforeError ? (
            <img 
              src={beforeImageUrl} 
              alt={`${beforeLabel} satellite view`} 
              className="w-full h-full object-fill" 
              onError={() => setBeforeError(true)} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-ink-muted/50 font-mono text-[10px]">
              <div className="w-8 h-8 border-2 border-ink-muted/20 border-t-ink-muted rounded-full animate-spin mb-2" />
              <span>AWAITING {beforeLabel} TELEMETRY</span>
            </div>
          )}
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-signal shadow-[0_0_12px_rgba(34,211,238,0.9)] pointer-events-none z-10"
          style={{ left: `${split}%` }}
        />

        <span className="absolute top-3 left-3 font-mono text-xs text-ink bg-space/80 px-2 py-1 rounded-md backdrop-blur border border-signal/20 pointer-events-none z-10">
          {beforeLabel}
        </span>
        <span className="absolute top-3 right-3 font-mono text-xs text-ink bg-space/80 px-2 py-1 rounded-md backdrop-blur border border-signal/20 pointer-events-none z-10">
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
