"use client";

import { useEffect, useState } from "react";

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export default function MLAnalysisPanel({ bounds }: { bounds: Bounds }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [startYear, setStartYear] = useState("2017");
  const [endYear, setEndYear] = useState("2024");
  
  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
      const res = await fetch(`${baseUrl}/api/districts/analyze-wetland-health`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minLat: bounds.minLat,
          maxLat: bounds.maxLat,
          minLon: bounds.minLon,
          maxLon: bounds.maxLon,
          startYear: startYear,
          endYear: endYear
        })
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      setError("Failed to communicate with Earth Engine.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [bounds, startYear, endYear]);

  const years = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];



  return (
    <div className="hud-panel p-6 border-aurora-magenta/30 bg-[#0b1021]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h3 className="font-display font-bold text-lg text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Wetland Health Module (Area Analysis)
          </h3>
          <p className="font-mono text-[10px] text-ink-muted mt-1">
            Bounds: [{bounds.minLat.toFixed(4)}, {bounds.minLon.toFixed(4)}] to [{bounds.maxLat.toFixed(4)}, {bounds.maxLon.toFixed(4)}]
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#050811] p-1.5 rounded-md border border-space-line">
            <select 
              value={startYear} 
              onChange={(e) => setStartYear(e.target.value)}
              className="bg-transparent text-signal text-xs font-mono outline-none cursor-pointer"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-ink-muted text-[10px]">→</span>
            <select 
              value={endYear} 
              onChange={(e) => setEndYear(e.target.value)}
              className="bg-transparent text-emerald-400 text-xs font-mono outline-none cursor-pointer"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] uppercase tracking-wider rounded">
            Earth Engine Live
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 font-mono text-xs text-emerald-400">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full mb-3" />
          <span>Extracting Random Forest wetland polygons & intersecting climatic features...</span>
          <span className="text-[9px] text-ink-muted mt-1 opacity-70">Processing Sentinel-2 & CHIRPS datasets</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-bad/10 text-bad font-mono text-sm border-bad/50 rounded-lg">{error}</div>
      ) : data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          
          {/* Main Stats Card */}
          <div className="flex flex-col gap-3 border border-space-line p-4 rounded-lg bg-[#050811] shadow-xl md:col-span-2">
            <div className="flex items-center justify-between border-b border-space-line pb-2">
              <span className="font-bold text-sm text-blue-400">Wetland Shrinkage & Causes</span>
              <span className="text-xl">🦆</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-2 font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-ink-muted uppercase">Total Loss</span>
                <span className={`text-2xl font-bold ${data.wetland_loss > 0 ? 'text-bad' : 'text-emerald-400'}`}>
                  {data.wetland_loss > 0 ? '-' : '+'}{Math.abs(data.wetland_loss)} <span className="text-xs font-normal text-ink-muted">km²</span>
                </span>
                <span className="text-[10px] text-ink-muted mt-1">{data.wetland_loss_pct}% reduction</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-ink-muted uppercase">Primary Driver</span>
                <span className="text-lg font-bold text-amber-400 mt-1">{data.main_cause}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-space-line/50 font-mono text-xs">
              
              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Rainfall</span>
                <div className="flex gap-2">
                  <span className="text-ink line-through opacity-50">{data.rain_start}</span>
                  <span className="text-cyan-400">{data.rain_end} mm</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Built-up Area</span>
                <div className="flex gap-2">
                  <span className="text-ink line-through opacity-50">{data.urban_start}</span>
                  <span className="text-rose-400">{data.urban_end} km²</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Vegetation (NDVI)</span>
                <div className="flex gap-2">
                  <span className="text-ink line-through opacity-50">{data.ndvi_start}</span>
                  <span className={`${data.ndvi_end < data.ndvi_start ? 'text-bad' : 'text-emerald-400'}`}>{data.ndvi_end}</span>
                </div>
              </div>

            </div>
          </div>

          {/* SDG 6.6.1 Target Indicator Card */}
          <div className="flex flex-col gap-2 border border-space-line p-4 rounded-lg bg-[#050811] shadow-xl justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-space-line pb-2 mb-3">
                <span className="font-bold text-sm text-cyan-400 z-10">SDG 6.6.1 Indicator</span>
                <span className="text-xl z-10">🎯</span>
              </div>
              <div className="font-mono text-[11px] text-gray-400 mt-1 z-10 relative">
                Change in the spatial extent of water-related ecosystems over time.
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center py-4 relative z-10">
              <div className={`text-5xl font-display font-bold mb-1 ${data.wetland_loss > 0 ? 'text-bad' : 'text-emerald-400'}`}>
                {data.wetland_loss > 0 ? '-' : '+'}{Math.abs(data.wetland_loss)} km²
              </div>
              <div className="text-[10px] font-mono text-ink-muted mb-4 uppercase tracking-wider">
                Recorded Spatial Change
              </div>
              <div className={`font-mono text-xs px-3 py-1 rounded border ${data.wetland_loss > 0 ? 'bg-bad/10 border-bad/30 text-bad' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                {data.wetland_loss > 0 ? 'Negative trend detected' : 'Positive trend detected'}
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 p-3 opacity-[0.03] text-9xl pointer-events-none">💧</div>
          </div>

        </div>
      )}
    </div>
  );
}
