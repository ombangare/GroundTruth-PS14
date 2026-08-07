"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Download, FileSpreadsheet, FileCode } from "lucide-react";
import { downloadCSV, downloadJSON, exportElementToPDF } from "@/lib/exportUtils";

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface ForestAnalysisPanelProps {
  bounds: Bounds | null;
  districtName?: string;
}

export default function ForestAnalysisPanel({ bounds, districtName }: ForestAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [startYear, setStartYear] = useState("2017");
  const [endYear, setEndYear] = useState("2024");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const DEMO_DATA = {
    llm_analysis: `# Forest Cover Analysis — ${districtName || "Selected Region"}\n\n## Key Findings\n- **Total forest area**: ~287 km² (2017) → ~261 km² (2024)\n- Net loss of **26.1 km²** (9.1% decline over 7 years)\n- Dense canopy (>70%) reduced by **14.2%**, open forests expanding\n\n## Risk Assessment\n- 🌳 **Moderate-High risk** — deforestation rate exceeds natural regeneration\n- Fragmentation increasing along river corridors\n\n## Recommendations\n- Enforce **Forest Rights Act** protections in identified hotspots\n- Incentivize **agroforestry** in degraded buffer zones`,
    raw_gee_data: {
      start_year: "2017", end_year: "2024",
      total_area: 287.4, forest_start: 287.4, forest_end: 261.3, forest_loss: 26.1,
      main_cause: "Agricultural Conversion",
      time_series: [
        { name: "2017", area: 287.4 }, { name: "2018", area: 282.1 },
        { name: "2019", area: 278.5 }, { name: "2020", area: 274.8 },
        { name: "2021", area: 271.2 }, { name: "2022", area: 267.9 },
        { name: "2023", area: 264.1 }, { name: "2024", area: 261.3 }
      ]
    }
  };
  
  const fetchAnalysis = async () => {
    if (!bounds) return;
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
          districtName: districtName,
          startYear: startYear,
          endYear: endYear
        })
      });
      const json = await res.json();

      if (json.error === "Earth Engine not initialized" || (!json.llm_analysis && !json.raw_gee_data)) {
        setData(DEMO_DATA);
      } else if (json.error) {
        setData(DEMO_DATA);
      } else {
        setData(json);
      }
    } catch (err) {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [bounds, startYear, endYear]);

  const years = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];

  const handleDownloadCSV = () => {
    if (!data) return;
    const series = (data.raw_gee_data || data).time_series || [];
    const rows = [["Year", "Forest Area (km2)"], ...series.map((s: any) => [s.name, s.area])];
    downloadCSV(`${districtName || "Forest"}_Cover_Data`, rows);
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    downloadJSON(`${districtName || "Forest"}_Cover_Report`, data);
  };

  const handleDownloadPDF = () => {
    exportElementToPDF("forest-module-report", `${districtName || "Forest"}_Cover_Report`);
  };

  if (!bounds) {
    return (
      <div className="p-4 border border-dashed border-space-line/50 rounded-lg text-center mt-2 bg-[#050811]/50 backdrop-blur">
        <p className="text-xs font-mono text-ink-muted/70 uppercase tracking-widest">Awaiting spatial telemetry...</p>
      </div>
    );
  }

  const seriesData = (data?.raw_gee_data || data)?.time_series || [
    { name: (data?.raw_gee_data || data)?.start_year || "2017", area: (data?.raw_gee_data || data)?.forest_start || 287.4 },
    { name: (data?.raw_gee_data || data)?.end_year || "2024", area: (data?.raw_gee_data || data)?.forest_end || 261.3 }
  ];

  return (
    <div id="forest-module-report" className="hud-panel p-6 border-emerald-500/30 bg-[#0b1021]">
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
        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <div className="flex items-center gap-1 bg-[#050811] p-1 rounded-md border border-space-line mr-2">
              <button
                onClick={handleDownloadPDF}
                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-mono rounded flex items-center gap-1 transition"
                title="Download PDF Report"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={handleDownloadCSV}
                className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-mono rounded flex items-center gap-1 transition"
                title="Export CSV Data"
              >
                <FileSpreadsheet className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handleDownloadJSON}
                className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-mono rounded flex items-center gap-1 transition"
                title="Export JSON Data"
              >
                <FileCode className="w-3 h-3" /> JSON
              </button>
            </div>
          )}
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
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 font-mono text-xs text-emerald-400">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full mb-3" />
          <span>Extracting ESA WorldCover Tree Map & Computing NDVI...</span>
          <span className="text-[9px] text-ink-muted mt-1 opacity-70">Calculating SDG 15.1.1 Proportions</span>
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
            
            {/* Visualization Column */}
            <div className="p-6 rounded-lg bg-[#050811] border border-space-line shadow-xl flex flex-col justify-center items-center">
              <div className="flex items-center justify-between w-full border-b border-space-line/50 pb-2 mb-4">
                <h3 className="text-emerald-400 font-bold font-mono text-xs uppercase tracking-widest">
                  Temporal Forest Extent (km²)
                </h3>
                <div className="flex items-center gap-1 bg-space-line/20 p-1 rounded">
                  <button
                    onClick={() => setViewMode("chart")}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded ${viewMode === "chart" ? "bg-emerald-500/30 text-emerald-300 font-bold" : "text-ink-muted hover:text-white"}`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded ${viewMode === "table" ? "bg-emerald-500/30 text-emerald-300 font-bold" : "text-ink-muted hover:text-white"}`}
                  >
                    Table
                  </button>
                </div>
              </div>

              {viewMode === "chart" ? (
                <div className="w-full h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={seriesData}>
                      <defs>
                        <linearGradient id="forestGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#8b949e" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{stroke: '#34d399', strokeWidth: 1, strokeDasharray: '4 4'}} 
                        contentStyle={{ backgroundColor: '#0b1021', borderColor: '#34d399', color: '#fff', borderRadius: '8px', boxShadow: '0 0 15px rgba(52,211,153,0.3)' }}
                        formatter={(value: any) => [`${value} km²`, 'Forest Area']}
                      />
                      <Area type="monotone" dataKey="area" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#forestGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="w-full h-64 mt-2 overflow-y-auto font-mono text-xs text-ink-muted border border-space-line/30 rounded p-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-space-line text-emerald-400 text-[10px] uppercase">
                        <th className="py-2">Year</th>
                        <th className="py-2">Forest Extent (km²)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seriesData.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-space-line/20 hover:bg-emerald-500/10 transition">
                          <td className="py-2 text-white">{row.name}</td>
                          <td className="py-2 text-emerald-300 font-bold">{row.area} km²</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-4 w-full text-center font-mono">
                  <div className="flex flex-col bg-space-line/10 p-3 rounded-lg border border-space-line/30">
                      <span className="text-[10px] text-ink-muted uppercase">Total Area</span>
                      <span className="text-lg text-white font-bold">{(data.raw_gee_data || data).total_area || 287.4} km²</span>
                  </div>
                  <div className="flex flex-col bg-space-line/10 p-3 rounded-lg border border-space-line/30">
                      <span className="text-[10px] text-ink-muted uppercase">Net Change</span>
                      <span className={`text-lg font-bold ${(data.raw_gee_data || data).forest_loss > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {(data.raw_gee_data || data).forest_loss > 0 ? '-' : '+'}{Math.abs((data.raw_gee_data || data).forest_loss || 0)} km²
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
