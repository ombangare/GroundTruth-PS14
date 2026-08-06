"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

interface DegradationAnalysisPanelProps {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  startYear: string;
  endYear: string;
}

export default function DegradationAnalysisPanel({ bbox, startYear, endYear }: DegradationAnalysisPanelProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bbox) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/districts/analyze-land-degradation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minLat: bbox.minLat,
            maxLat: bbox.maxLat,
            minLon: bbox.minLon,
            maxLon: bbox.maxLon,
            startYear,
            endYear,
          }),
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.detail || "Analysis failed");
        
        // Handle mock fallback if GEE fails (same as others)
        if (result.error && result.error === "Earth Engine not initialized") {
           setTimeout(() => {
               setData({
                   start_year: startYear,
                   end_year: endYear,
                   total_area: 1250.0,
                   degraded_area: 185.0,
                   healthy_area: 1065.0,
                   main_cause: "Agricultural Expansion",
                   urban_degraded_sqkm: 30.0,
                   agri_degraded_sqkm: 155.0
               });
               setLoading(false);
           }, 1500);
           return;
        }

        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [bbox, startYear, endYear]);

  if (!bbox) {
    return (
      <div className="p-4 border border-dashed border-space-line/50 rounded-lg text-center mt-2 bg-[#050811]/50 backdrop-blur">
        <p className="text-xs font-mono text-ink-muted/70 uppercase tracking-widest">Awaiting spatial telemetry...</p>
        <p className="text-[10px] text-ink-muted/50 mt-1 font-mono">Use the draw tool to select an area</p>
      </div>
    );
  }

  return (
    <div className="mt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-3 border-b border-space-line/30 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <h3 className="font-mono text-xs text-orange-400 uppercase tracking-widest">SDG 15.3.1 Active</h3>
        </div>
        <div className="text-[10px] font-mono text-ink-muted/60 flex gap-2">
          <span>{startYear}</span>
          <span>→</span>
          <span>{endYear}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 font-mono text-xs text-orange-400">
          <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full mb-3" />
          <span>Computing Land Degradation Indices...</span>
          <span className="text-[9px] text-ink-muted mt-1 opacity-70">Cross-referencing NDVI & Dynamic World</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-bad/10 text-bad font-mono text-sm border-bad/50 rounded-lg">{error}</div>
      ) : data && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="p-6 rounded-lg bg-[#050811] border border-space-line shadow-xl font-sans text-ink-muted">
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mb-4 border-b border-space-line pb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-bold text-orange-400 mt-6 mb-3" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-md font-bold text-amber-300 mt-4 mb-2" {...props} />,
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
