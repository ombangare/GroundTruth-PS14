"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

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
        <div className="mt-4 flex flex-col gap-4">
          <div className="p-6 rounded-lg bg-[#050811] border border-space-line shadow-xl font-sans text-ink-muted">
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mb-4 border-b border-space-line pb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-bold text-emerald-400 mt-6 mb-3" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-md font-bold text-indigo-300 mt-4 mb-2" {...props} />,
                p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-gray-300" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-gray-300" {...props} />,
                li: ({node, ...props}) => <li {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />
              }}
            >
              {data.llm_analysis || "Analysis unavailable."}
            </ReactMarkdown>
          </div>
          <div className="text-[9px] font-mono text-ink-muted/60 text-right">
            Generated via LangGraph pipeline & Google Earth Engine APIs
          </div>
        </div>
      )}
    </div>
  );
}
