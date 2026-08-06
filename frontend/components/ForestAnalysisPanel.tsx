"use client";

import { useEffect, useState } from "react";

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export default function ForestAnalysisPanel({ bounds }: { bounds: Bounds }) {
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
      const res = await fetch(`${baseUrl}/api/districts/analyze-forest-cover`, {
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
    <div className="hud-panel p-6 border-emerald-500/30 bg-[#0b1021]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h3 className="font-display font-bold text-lg text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Forest Cover Module (SDG 15.1.1)
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
          <span>Extracting ESA WorldCover Tree Map & Computing NDVI...</span>
          <span className="text-[9px] text-ink-muted mt-1 opacity-70">Calculating SDG 15.1.1 Proportions</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-bad/10 text-bad font-mono text-sm border-bad/50 rounded-lg">{error}</div>
      ) : data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          
          {/* Main Stats Card */}
          <div className="flex flex-col gap-3 border border-space-line p-4 rounded-lg bg-[#050811] shadow-xl">
            <div className="flex items-center justify-between border-b border-space-line pb-2">
              <span className="font-bold text-sm text-emerald-400">Historical Forest Change</span>
              <span className="text-xl">🌲</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-2 font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-ink-muted uppercase">Total Change</span>
                <span className={`text-2xl font-bold ${data.forest_loss > 0 ? 'text-bad' : 'text-emerald-400'}`}>
                  {data.forest_loss > 0 ? '-' : '+'}{Math.abs(data.forest_loss)} <span className="text-xs font-normal text-ink-muted">km²</span>
                </span>
                <span className="text-[10px] text-ink-muted mt-1">Net {data.forest_loss > 0 ? 'reduction' : 'growth'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-ink-muted uppercase">Total Land Area</span>
                <span className="text-lg font-bold text-ink mt-1">{data.total_area} km²</span>
              </div>
            </div>

            <div className="mt-3 font-mono text-xs text-ink">
              <div className="flex justify-between mb-1">
                <span>{data?.start_year} Forest</span>
                <span className="text-emerald-400">{data?.forest_start} km²</span>
              </div>
              <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden mb-3">
                <div className="bg-emerald-600 h-full" style={{ width: '100%' }} />
              </div>

              <div className="flex justify-between mb-1">
                <span>{data?.end_year} Forest</span>
                <span className="text-emerald-400">{data?.forest_end} km²</span>
              </div>
              <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden mb-3">
                <div className="bg-emerald-500 h-full" style={{ width: `${Math.max(0, Math.min(100, (data?.forest_end / Math.max(0.001, data?.forest_start)) * 100))}%` }} />
              </div>
            </div>
          </div>

          {/* SDG 15.1.1 Target Indicator Card */}
          <div className="flex flex-col gap-2 border border-space-line p-4 rounded-lg bg-[#050811] shadow-xl justify-between">
            <div>
                <div className="flex items-center justify-between border-b border-space-line pb-2 mb-3">
                <span className="font-bold text-sm text-cyan-400">SDG 15.1.1 Indicator</span>
                <span className="text-xl">🎯</span>
                </div>
                <div className="font-mono text-[11px] text-gray-400 mt-1">
                    Forest area as a proportion of total land area. Calculated via ESA WorldCover and Sentinel-2 NDVI.
                </div>
            </div>
            
            <div className="flex flex-col items-center justify-center py-4 relative">
                <div className="text-4xl font-display font-bold text-ink mb-1">
                    {data.forest_end} <span className="text-xl">km²</span>
                </div>
                <div className="text-[10px] font-mono text-ink-muted mb-4 uppercase tracking-wider">
                    Current Forest Extent (Out of {data.total_area} km²)
                </div>
                <div className={`font-mono text-xs px-3 py-1 rounded border ${data.start_proportion > data.end_proportion ? 'bg-bad/10 border-bad/30 text-bad' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                    {data.start_proportion > data.end_proportion ? '↓ Decreased' : '↑ Increased'} from {data.forest_start} km² in {data.start_year}
                </div>
            </div>
          </div>

          {/* Data Sources Footer */}
          <div className="col-span-1 md:col-span-2 text-[9px] font-mono text-ink-muted/60 text-right mt-1">
            Data computed on-the-fly via Google Earth Engine API using Sentinel-2 MSI (10m) & ESA WorldCover.
          </div>
        </div>
      )}
    </div>
  );
}
