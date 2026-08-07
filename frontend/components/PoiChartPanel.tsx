"use client";

import { useEffect, useState } from "react";

export default function PoiChartPanel({ lat, lon }: { lat: number, lon: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYears, setSelectedYears] = useState<string[]>(["2017", "2020", "2024"]);

  useEffect(() => {
    let active = true;
    const fetchPoi = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_PRODUCTION_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
        const res = await fetch(`${baseUrl}/api/districts/analyze-point`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, years: selectedYears })
        });
        const json = await res.json();
        if (!active) return;
        
        if (json.error && json.error !== "Earth Engine not initialized") {
          setError(json.error);
        } else if (json.error) {
           setError("GEE disconnected. Need credentials.");
        } else {
          setData(json);
        }
      } catch (err) {
        if (active) setError("Failed to analyze point");
      } finally {
        if (active) setLoading(false);
      }
    };
    
    fetchPoi();
    return () => { active = false; };
  }, [lat, lon, selectedYears]);

  return (
    <div className="hud-panel p-6 border-aurora-magenta/30 bg-[#0b1021]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            Point Analysis (500m Radius)
          </h3>
          <p className="font-mono text-[10px] text-ink-muted">Coordinates: {lat.toFixed(4)}, {lon.toFixed(4)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 font-mono text-xs text-signal">
          <div className="animate-spin w-6 h-6 border-2 border-signal border-t-transparent rounded-full mb-3" />
          <span>Processing Multi-Spectral bands from Earth Engine...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-bad/10 text-bad font-mono text-sm border-bad/50">{error}</div>
      ) : data?.timeline ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.timeline.map((yr: any) => (
            <div key={yr.year} className="flex flex-col gap-1 border border-space-line p-4 rounded-lg bg-[#050811] shadow-xl">
              <div className="font-bold border-b border-space-line pb-2 mb-2 flex justify-between items-center">
                <span className="text-base text-cyan-50">{yr.year}</span>
                <span className="text-[9px] uppercase tracking-wider text-signal bg-signal/10 px-1.5 py-0.5 rounded border border-signal/20">
                  {yr.sensors?.sentinel_1_sar ? "S1+S2+S5P" : "Sentinel-2 Optical"}
                </span>
              </div>
              
              <div className="space-y-3 mt-1 font-mono">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>Water Coverage</span>
                    <span className="text-blue-400">{yr.water_pct}%</span>
                  </div>
                  <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, Math.max(0, yr.water_pct))}%` }} />
                  </div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>Green Vegetation</span>
                    <span className="text-emerald-400">{yr.veg_pct}%</span>
                  </div>
                  <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, Math.max(0, yr.veg_pct))}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>Built-up / Urban</span>
                    <span className="text-rose-400">{yr.built_pct}%</span>
                  </div>
                  <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full" style={{ width: `${Math.min(100, Math.max(0, yr.built_pct))}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
