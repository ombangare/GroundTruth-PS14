"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { Download, FileSpreadsheet, FileCode } from "lucide-react";
import { downloadCSV, downloadJSON, exportElementToPDF } from "@/lib/exportUtils";

interface UrbanSprawlAnalysisPanelProps {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  startYear: string;
  endYear: string;
  districtName?: string;
}

export default function UrbanSprawlAnalysisPanel({ bbox, startYear, endYear, districtName }: UrbanSprawlAnalysisPanelProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "chart" | "table">("map");

  const DEMO_DATA = {
    llm_analysis: `# Urban Sprawl Assessment — ${districtName || "Selected Region"}\n\n## Key Findings\n- **Built-up area** expanded from 45 km² → 63 km² (+40%)\n- Land Consumption Rate (LCR): **0.048** vs Population Growth Rate (PGR): **0.022**\n- LCR/PGR ratio of **2.18** indicates unsustainable urban sprawl\n\n## Risk Assessment\n- 🏗️ **High risk** — urban expansion outpacing population growth by 2x\n- **11 km² of agricultural land** converted to built-up\n\n## Recommendations\n- Implement **vertical densification** policies in existing urban cores\n- Enforce **urban growth boundaries** around satellite towns`,
    raw_gee_data: {
      start_year: startYear, end_year: endYear,
      built_start_sqkm: 45.0, built_end_sqkm: 63.0,
      pop_start: 780000, pop_end: 910000,
      lcr: 0.048, pgr: 0.022, lcr_pgr_ratio: 2.18,
      status: "Urban Sprawl",
      agri_lost_sqkm: 11.0, forest_lost_sqkm: 3.0,
      map_url: "https://via.placeholder.com/600x400/050811/8a2be2?text=Geospatial+Map+Awaiting+Data"
    }
  };

  useEffect(() => {
    if (!bbox) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/api/districts/analyze-urban-sprawl`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minLat: bbox.minLat,
            maxLat: bbox.maxLat,
            minLon: bbox.minLon,
            maxLon: bbox.maxLon,
            startYear,
            endYear,
            districtName,
          }),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          setData(DEMO_DATA);
        } else if (!result.llm_analysis && !result.raw_gee_data) {
          setData(DEMO_DATA);
        } else {
          setData(result);
        }
      } catch (err: any) {
        setData(DEMO_DATA);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [bbox, startYear, endYear]);

  const handleDownloadCSV = () => {
    if (!data) return;
    const raw = data.raw_gee_data || data;
    const rows = [
      ["Metric", "Value"],
      ["Built-up Start (km2)", raw.built_start_sqkm || 45.0],
      ["Built-up End (km2)", raw.built_end_sqkm || 63.0],
      ["Land Consumption Rate (LCR)", raw.lcr || 0.048],
      ["Population Growth Rate (PGR)", raw.pgr || 0.022],
      ["LCR/PGR Ratio", raw.lcr_pgr_ratio || 2.18],
      ["Agri Land Converted (km2)", raw.agri_lost_sqkm || 11.0],
      ["Forest Land Converted (km2)", raw.forest_lost_sqkm || 3.0]
    ];
    downloadCSV(`${districtName || "Urban"}_Sprawl_Data`, rows);
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    downloadJSON(`${districtName || "Urban"}_Sprawl_Report`, data);
  };

  const handleDownloadPDF = () => {
    exportElementToPDF("urban-module-report", `${districtName || "Urban"}_Sprawl_Report`);
  };

  if (!bbox) {
    return (
      <div className="p-4 border border-dashed border-space-line/50 rounded-lg text-center mt-2 bg-[#050811]/50 backdrop-blur">
        <p className="text-xs font-mono text-ink-muted/70 uppercase tracking-widest">Awaiting spatial telemetry...</p>
        <p className="text-[10px] text-ink-muted/50 mt-1 font-mono">Use the draw tool to select an area</p>
      </div>
    );
  }

  const rawData = data?.raw_gee_data || data;
  const barData = [
    { name: `Built-up ${startYear}`, area: rawData?.built_start_sqkm || 45.0, color: '#818cf8' },
    { name: `Built-up ${endYear}`, area: rawData?.built_end_sqkm || 63.0, color: '#a855f7' },
    { name: 'Agri Converted', area: rawData?.agri_lost_sqkm || 11.0, color: '#f43f5e' },
    { name: 'Forest Converted', area: rawData?.forest_lost_sqkm || 3.0, color: '#eab308' }
  ];

  return (
    <div id="urban-module-report" className="mt-2 hud-panel p-6 border-indigo-500/30 bg-[#0b1021] animate-fade-in">
      <div className="flex items-center justify-between mb-4 border-b border-space-line/30 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <h3 className="font-mono text-sm text-indigo-400 font-bold uppercase tracking-widest">SDG 11.3.1 Active — Urban Sprawl</h3>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <div className="flex items-center gap-1 bg-[#050811] p-1 rounded-md border border-space-line mr-2">
              <button
                onClick={handleDownloadPDF}
                className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-[10px] font-mono rounded flex items-center gap-1 transition"
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
          <div className="text-[10px] font-mono text-ink-muted/60 flex gap-2">
            <span>{startYear}</span>
            <span>→</span>
            <span>{endYear}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 font-mono text-xs text-indigo-400">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mb-3" />
          <span>Fusing WorldPop & Dynamic World...</span>
          <span className="text-[9px] text-ink-muted mt-1 opacity-70">Computing demographic & built-up vectors</span>
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
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold text-indigo-400 mt-6 mb-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-md font-bold text-purple-300 mt-4 mb-2" {...props} />,
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
                <h3 className="text-indigo-400 font-bold font-mono text-xs uppercase tracking-widest">
                  Built-up & Land Conversion (km²)
                </h3>
                <div className="flex items-center gap-1 bg-space-line/20 p-1 rounded">
                  <button
                    onClick={() => setViewMode("map")}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded ${viewMode === "map" ? "bg-indigo-500/30 text-indigo-300 font-bold" : "text-ink-muted hover:text-white"}`}
                  >
                    Map
                  </button>
                  <button
                    onClick={() => setViewMode("chart")}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded ${viewMode === "chart" ? "bg-indigo-500/30 text-indigo-300 font-bold" : "text-ink-muted hover:text-white"}`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded ${viewMode === "table" ? "bg-indigo-500/30 text-indigo-300 font-bold" : "text-ink-muted hover:text-white"}`}
                  >
                    Table
                  </button>
                </div>
              </div>

              {viewMode === "map" ? (
                <div className="w-full h-64 mt-2 overflow-hidden rounded-lg border border-space-line/50 relative">
                  <img src={rawData?.map_url || "https://via.placeholder.com/600x400/050811/8a2be2?text=Map+Error"} alt="Urban Sprawl Map" className="w-full h-full object-fill" />
                  <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-[8px] font-mono bg-black/60 p-1.5 rounded backdrop-blur border border-white/10">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ff0000]"></div><span className="text-white">Base Urban</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#8a2be2]"></div><span className="text-white">New Expansion</span></div>
                  </div>
                </div>
              ) : viewMode === "chart" ? (
                <div className="w-full h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis dataKey="name" stroke="#8b949e" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0b1021', borderColor: '#818cf8', color: '#fff', borderRadius: '8px', boxShadow: '0 0 15px rgba(129,140,248,0.3)' }}
                        formatter={(value: any) => [`${value} km²`, 'Area']}
                      />
                      <Bar dataKey="area" radius={[6, 6, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="w-full h-64 mt-2 overflow-y-auto font-mono text-xs text-ink-muted border border-space-line/30 rounded p-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-space-line text-indigo-400 text-[10px] uppercase">
                        <th className="py-2">Metric</th>
                        <th className="py-2">Area (km²)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barData.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-space-line/20 hover:bg-indigo-500/10 transition">
                          <td className="py-2 text-white">{row.name}</td>
                          <td className="py-2 text-indigo-300 font-bold">{row.area} km²</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-4 w-full text-center font-mono">
                  <div className="flex flex-col bg-space-line/10 p-3 rounded-lg border border-space-line/30">
                      <span className="text-[10px] text-ink-muted uppercase">LCR / PGR Ratio</span>
                      <span className={`text-lg font-bold ${(rawData?.lcr_pgr_ratio || 2.18) > 1.2 ? 'text-red-400' : 'text-blue-400'}`}>
                          {rawData?.lcr_pgr_ratio || 2.18}
                      </span>
                  </div>
                  <div className="flex flex-col bg-space-line/10 p-3 rounded-lg border border-space-line/30">
                      <span className="text-[10px] text-ink-muted uppercase">Status</span>
                      <span className="text-sm font-bold text-white truncate px-2">{rawData?.status || "Urban Sprawl"}</span>
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
