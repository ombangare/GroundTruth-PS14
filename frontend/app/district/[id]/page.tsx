"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchDistrict, type DistrictDetail } from '@/lib/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import dynamic from 'next/dynamic';

const LocalPoiMap = dynamic(() => import('@/components/LocalPoiMap'), { ssr: false });

export default function DistrictReportPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<DistrictDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    fetchDistrict(params.id)
      .then((d) => setData(d))
      .catch((err) => console.error("Failed to load district:", err))
      .finally(() => setLoading(false));
  }, [params.id]);

  const downloadPDF = async () => {
    // We target the HIDDEN white paper for the PDF
    const reportElement = document.getElementById("pdf-report-content");
    if (!reportElement || !data) return;

    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        backgroundColor: "#ffffff", 
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${data.name.replace(/\s+/g, '_')}_GroundTruth_Report.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-cyan-400 p-8 font-mono flex items-center justify-center">
        <div className="animate-spin inline-block w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mr-3"></div>
        <span className="tracking-widest uppercase text-sm">Loading District Telemetry...</span>
      </div>
    );
  }

  if (!data) return null;

  const healthScore = (data as any).health_score ?? null;

  // --- Helpers for Visible Dark UI ---
  const getDarkScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-500 border-gray-700 bg-gray-900/50";
    if (score >= 75) return "text-emerald-400 border-emerald-500/40 bg-emerald-950/20";
    if (score >= 50) return "text-amber-400 border-amber-500/40 bg-amber-950/20";
    return "text-rose-400 border-rose-500/40 bg-rose-950/20";
  };

  const getDarkSeverityBadge = (severity?: string) => {
    switch (severity) {
      case "good": return <span className="px-2.5 py-1 text-xs font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">Optimal</span>;
      case "warn": return <span className="px-2.5 py-1 text-xs font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">Watch</span>;
      case "bad": return <span className="px-2.5 py-1 text-xs font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded">Critical</span>;
      default: return <span className="px-2.5 py-1 text-xs font-mono uppercase bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded">Pending</span>;
    }
  };

  // --- Helpers for Hidden White Paper PDF ---
  const getPdfExecutiveSummary = () => {
    if (healthScore === null) return "Telemetry data is currently pending computation.";
    let tone = "demonstrates robust ecological stability and sustainable resource management";
    if (healthScore < 75) tone = "shows moderate environmental stress requiring continuous geospatial monitoring and preventative policy interventions";
    if (healthScore < 50) tone = "is experiencing critical environmental degradation, demanding immediate remediation efforts to stabilize ecological baselines";

    return `This official GroundTruth environmental intelligence report provides a satellite-derived analytical framework for ${data.name}, ${data.state}. Based on high-resolution multispectral telemetry ingested from Sentinel-2 and computed via the Google Earth Engine API, the district ${tone}. The composite Environmental Health Score of ${healthScore}/100 serves as a quantitative baseline for evaluating physical changes in localized ecosystems.`;
  };

  const getPdfScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-500";
    if (score >= 75) return "text-emerald-700";
    if (score >= 50) return "text-amber-600";
    return "text-rose-700";
  };

  return (
    <div className="min-h-screen bg-[#050811] text-gray-100 p-6 md:p-12 font-sans relative overflow-hidden">
      
      {/* Background Subtle Grid Pattern (Visible UI) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>

      {/* =========================================================
          VISIBLE UI: THE DARK MISSION CONTROL DASHBOARD 
          ========================================================= */}
      <div className="max-w-6xl mx-auto relative z-10 space-y-8">

        <div className="flex justify-between items-center">
          <Link href="/" className="inline-flex items-center text-xs font-mono tracking-widest text-cyan-400 hover:text-cyan-300 uppercase transition-all">
            ← Back to Mission Control
          </Link>
          <button 
            onClick={downloadPDF}
            disabled={generatingPdf}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono text-xs uppercase tracking-wider py-2.5 px-6 rounded shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2"
          >
            {generatingPdf ? "Compiling Telemetry..." : "Download Official PDF 📄"}
          </button>
        </div>

        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-cyan-900/40 pb-6 gap-4">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-sora">
                {data.name}
              </h1>
              <p className="text-sm font-mono text-cyan-500/80 mt-1">
                {data.state} • Satellite Telemetry ({data.period_before} → {data.period_after})
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono rounded-full uppercase tracking-wider">
                Source: {data.data_source}
              </span>
              {getDarkSeverityBadge(data.overall_severity)}
            </div>
          </div>
        </div>

        {/* Health Score Box */}
        <div className={`p-8 rounded-xl border backdrop-blur-md transition-all shadow-xl ${getDarkScoreColor(healthScore)}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-gray-400">Composite Index</span>
              <h2 className="text-2xl font-bold font-sora text-white">District Ecological Health Score</h2>
              <p className="text-sm text-gray-300 max-w-xl">Calculated using non-linear quadratic loss functions across Water Surface, Green Cover, and Urban Heat derived from satellite imagery.</p>
            </div>
            <div className="flex items-baseline space-x-2 font-mono">
              <span className="text-6xl md:text-7xl font-extrabold tracking-tighter">{healthScore !== null ? healthScore : "--"}</span>
              <span className="text-xl text-gray-400 font-normal">/ 100</span>
            </div>
          </div>
          {healthScore !== null && (
            <div className="mt-6 w-full bg-black/40 h-3 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-current transition-all duration-1000" style={{ width: `${healthScore}%` }}></div>
            </div>
          )}
        </div>

        {/* SDG Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(data.indicators).map(([key, ind]: [string, any]) => (
            <div key={key} className="bg-[#0b1021] border border-cyan-900/30 p-6 rounded-xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono text-cyan-400/80 uppercase">{ind.sdg}</span>
                  <h4 className="text-lg font-bold text-white font-sora">{ind.label}</h4>
                </div>
                {getDarkSeverityBadge(ind.severity)}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{ind.verdict}</p>
              <div className="pt-2 border-t border-gray-800/60 flex justify-between items-center text-xs font-mono text-gray-400">
                <span>Index: <strong className="text-gray-200">{ind.index_used}</strong></span>
                <span>Change: <strong className={ind.pct_change < 0 ? "text-rose-400" : "text-emerald-400"}>{ind.pct_change !== null ? `${ind.pct_change}%` : "N/A"}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Local POI Analysis Map */}
        <div className="mt-8 bg-[#0b1021] border border-cyan-900/30 p-6 rounded-xl">
          <LocalPoiMap 
            districtLat={data.lat} 
            districtLon={data.lon} 
            districtName={data.name} 
          />
        </div>
      </div>


      {/* =========================================================
          INVISIBLE UI: THE WHITE PAPER PDF RENDER TARGET
          (This is strictly for html2canvas to capture)
          ========================================================= */}
      <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none w-[210mm] overflow-hidden">
        <div id="pdf-report-content" className="bg-white text-gray-900 p-12 md:p-16 font-serif relative" style={{ minHeight: "297mm", width: "210mm" }}>
          
          <div className="border-b-2 border-gray-900 pb-6 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 font-sans uppercase">GROUNDTRUTH</h1>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1 font-sans">Environmental Intelligence Platform</p>
            </div>
            <div className="text-right font-sans text-xs text-gray-500 uppercase tracking-wider space-y-1">
              <p><strong>District:</strong> {data.name}</p>
              <p><strong>State:</strong> {data.state}</p>
              <p><strong>Source:</strong> Sentinel-2 / Earth Engine</p>
            </div>
          </div>

          <div className="mb-10 flex flex-col justify-between items-center bg-gray-50 p-6 border border-gray-200">
            <div className="w-full flex justify-between items-center">
              <div className="max-w-md">
                <h2 className="text-2xl font-bold text-gray-900 mb-2 font-sans">Ecological Health Assessment</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Composite index generated via non-linear quadratic loss functions across independent spectral domains.
                </p>
              </div>
              <div className="text-center border-l-2 border-gray-200 pl-6">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-sans font-bold mb-1">Composite Score</div>
                <div className={`text-6xl font-extrabold font-sans ${getPdfScoreColor(healthScore)}`}>
                  {healthScore !== null ? healthScore : "--"}
                  <span className="text-2xl text-gray-400">/100</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wider font-sans mb-3 border-l-4 border-gray-900 pl-3">Executive Summary</h3>
            <p className="text-gray-800 leading-relaxed text-justify">{getPdfExecutiveSummary()}</p>
          </div>

          <div className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wider font-sans mb-3 border-l-4 border-gray-900 pl-3">Methodological Context</h3>
            <p className="text-gray-800 leading-relaxed text-justify text-sm">
              The SDG metrics presented below are computed autonomously by the GroundTruth engine. The Normalized Difference Water Index (NDWI) tracks variations in hydric resources, critical for assessing localized drought vulnerability. The Normalized Difference Vegetation Index (NDVI) serves as a proxy for carbon-capture potential and biomass vitality. Lastly, the Normalized Difference Built-up Index (NDBI) highlights shifts in microclimate anomalies and urban heat island propagation. Shifts in these indices correlate directly with long-term climate resilience.
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wider font-sans mb-4 border-l-4 border-gray-900 pl-3">SDG Telemetry Breakdown</h3>
            {Object.entries(data.indicators).map(([key, ind]: [string, any]) => (
              <div key={key} className="flex flex-col border-b border-gray-200 pb-5 last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-bold text-gray-900 font-sans">{ind.label}</h4>
                  <span className={`text-xs font-bold font-sans uppercase tracking-wider px-3 py-1 rounded ${
                    ind.pct_change < 0 && key !== 'urban_heat' ? 'bg-rose-100 text-rose-800' : 
                    ind.pct_change > 0 && key === 'urban_heat' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>{ind.severity}</span>
                </div>
                
                <div className="flex flex-wrap gap-4 text-xs text-gray-600 font-sans mb-3">
                  <div className="bg-gray-100 px-3 py-1 rounded"><strong>Target:</strong> {ind.sdg}</div>
                  <div className="bg-gray-100 px-3 py-1 rounded"><strong>Satellite Index:</strong> {ind.index_used}</div>
                  <div className="bg-gray-100 px-3 py-1 rounded">
                    <strong>Recorded Change:</strong> <span className={ind.pct_change < 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
                      {ind.pct_change !== null ? `${ind.pct_change > 0 ? '+' : ''}${ind.pct_change}%` : "Pending"}
                    </span>
                  </div>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed text-justify">{ind.verdict}</p>
              </div>
            ))}
          </div>

          <div className="absolute bottom-12 left-12 right-12 border-t border-gray-300 pt-4 text-center text-[10px] text-gray-500 font-sans uppercase tracking-widest">
            <p>Generated by GroundTruth AI Architecture • Verified via Google Earth Engine API</p>
            <p className="mt-1">Report strictly maps to analytical periods {data.period_before} to {data.period_after}</p>
          </div>
        </div>
      </div>

    </div>
  );
}