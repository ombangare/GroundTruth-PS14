"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface MLAnalysisPanelProps {
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  districtName?: string;
}

export default function MLAnalysisPanel({ bounds, districtName }: MLAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [startYear, setStartYear] = useState("2017");
  const [endYear, setEndYear] = useState("2024");
  
  const fetchAnalysis = async () => {
    if (!bounds) return;
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
          districtName,
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

  const years = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];

  if (!bounds) {
    return (
      <div className="p-4 border border-dashed border-space-line/50 rounded-lg text-center mt-2 bg-[#050811]/50 backdrop-blur">
        <p className="text-xs font-mono text-ink-muted/70 uppercase tracking-widest">Awaiting spatial telemetry...</p>
      </div>
    );
  }

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
        <div className="p-4 bg-red-500/10 text-red-500 font-mono text-sm border-red-500/50 rounded-lg">{error}</div>
      ) : data && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* AI Report Column */}
            <div className="p-6 rounded-lg bg-[#050811] border border-space-line shadow-xl font-sans text-ink-muted">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mb-4 border-b border-space-line pb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold text-blue-400 mt-6 mb-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-md font-bold text-cyan-300 mt-4 mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-gray-300" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-gray-300" {...props} />,
                  li: ({node, ...props}) => <li {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />
                }}
              >
                {data.llm_analysis || "Analysis unavailable."}
              </ReactMarkdown>
            </div>
            
            {/* Visualization Column */}
            <div className="p-6 rounded-lg bg-[#050811] border border-space-line shadow-xl flex flex-col justify-center items-center">
              <h3 className="text-cyan-400 font-bold mb-6 font-mono text-sm uppercase tracking-widest border-b border-space-line/50 pb-2 w-full text-center">
                Wetland Surface Area Change
              </h3>
              <div className="w-full h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(data.raw_gee_data || data).time_series || [
                    { name: (data.raw_gee_data || data).start_year, area: (data.raw_gee_data || data).wetland_start },
                    { name: (data.raw_gee_data || data).end_year, area: (data.raw_gee_data || data).wetland_end }
                  ]}>
                    <XAxis dataKey="name" stroke="#8b949e" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{stroke: '#111827', strokeWidth: 2}} 
                      contentStyle={{ backgroundColor: '#0b1021', borderColor: '#30363d', color: '#fff', borderRadius: '8px' }}
                      formatter={(value) => [`${value} km²`, 'Water Extent']}
                    />
                    <Area type="monotone" dataKey="area" stroke="#38bdf8" strokeWidth={3} fillOpacity={0.2} fill="#38bdf8" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-8 w-full text-center font-mono">
                  <div className="flex flex-col bg-space-line/10 p-3 rounded-lg border border-space-line/30">
                      <span className="text-[10px] text-ink-muted uppercase">Primary Driver</span>
                      <span className="text-sm text-amber-400 font-bold truncate px-2">{(data.raw_gee_data || data).main_cause}</span>
                  </div>
                  <div className="flex flex-col bg-space-line/10 p-3 rounded-lg border border-space-line/30">
                      <span className="text-[10px] text-ink-muted uppercase">Net Change</span>
                      <span className={`text-lg font-bold ${(data.raw_gee_data || data).wetland_loss > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {(data.raw_gee_data || data).wetland_loss > 0 ? '-' : '+'}{Math.abs((data.raw_gee_data || data).wetland_loss || 0)} km²
                      </span>
                  </div>
              </div>
            </div>
          </div>
          <div className="text-[9px] font-mono text-ink-muted/60 text-right">
            Generated via LangGraph pipeline & Google Earth Engine APIs
          </div>
        </div>
      )}
    </div>
  );
}
