"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { fetchDistricts, fetchDistrict, fetchDistrictImages, type DistrictSummary, type DistrictDetail } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import LoginModal from "@/components/LoginModal";
import { LogIn, LogOut, User, Download } from "lucide-react";
import IndicatorCard from "@/components/IndicatorCard";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import Link from "next/link";
import { exportElementToPDF } from "@/lib/exportUtils";

import PoiChartPanel from "@/components/PoiChartPanel";
import MLAnalysisPanel from "@/components/MLAnalysisPanel";
import ForestAnalysisPanel from "@/components/ForestAnalysisPanel";
import DegradationAnalysisPanel from "@/components/DegradationAnalysisPanel";
import UrbanSprawlAnalysisPanel from "@/components/UrbanSprawlAnalysisPanel";
import Globe3D from "@/components/Globe3D";

const DistrictMap = dynamic(() => import("@/components/DistrictMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-xl bg-space-panel flex items-center justify-center text-ink-muted font-mono text-sm">
      Acquiring orbital fix...
    </div>
  )
});

export default function DashboardPage() {
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [poiCoords, setPoiCoords] = useState<{lat: number, lon: number} | null>(null);
  const [areaBounds, setAreaBounds] = useState<{minLat: number, maxLat: number, minLon: number, maxLon: number} | null>(null);
  const [districtFilter, setDistrictFilter] = useState("");
  const [sortMode, setSortMode] = useState<"az" | "severity">("az");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserRole(session.user.app_metadata?.role || "viewer");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserRole(session.user.app_metadata?.role || "viewer");
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    fetchDistricts()
      .then((data) => {
        setDistricts(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setError("Couldn't reach the GroundTruth API. Is the backend running on :8000?"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetailError(null);
    setPoiCoords(null); // Reset POI chart when district changes
    setAreaBounds(null); // Reset ML Area chart when district changes
    fetchDistrict(selectedId)
      .then((d) => {
        setDetail(d);
        setDetailLoading(false);
        // Fetch real-time images in the background so the UI doesn't block!
        fetchDistrictImages(selectedId).then(imgs => {
          setDetail(prev => prev && prev.id === selectedId ? { ...prev, images: imgs } : prev);
        }).catch(err => console.error("Live image fetch failed:", err));
      })
      .catch((err) => {
        setDetail(null);
        setDetailLoading(false);
        setDetailError(err.message || "An unexpected error occurred while fetching the district data.");
      });
  }, [selectedId]);

  const globePoints = districts.map((d) => ({
    id: d.id,
    name: d.name,
    lat: d.lat,
    lon: d.lon,
    severity: d.overall_severity,
  }));

  const liveCount = districts.filter((d) => d.data_source === "live").length;
  
  const SEVERITY_RANK: Record<string, number> = { bad: 0, warn: 1, pending: 2, good: 3 };
  
  const filteredDistricts = districts
    .filter((d) => `${d.name} ${d.state}`.toLowerCase().includes(districtFilter.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === "az") {
        return a.name.localeCompare(b.name);
      }
      return SEVERITY_RANK[a.overall_severity] - SEVERITY_RANK[b.overall_severity];
    });

  return (


    <main className="min-h-screen flex flex-col bg-[#050811] text-gray-100">
      {/* ----------- Header ----------- */}
      <header className="px-6 md:px-10 pt-8 relative z-10 pb-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="text-2xl group-hover:scale-110 transition-transform">▲</span>
            <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-aurora-gradient">
              GroundTruth
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="hidden sm:inline-block font-mono text-xs text-neutral-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded border border-white/10"
            >
              ← Back to Overview
            </Link>
            {userRole ? (
              <div className="flex items-center gap-3 pointer-events-auto">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-signal/10 border border-signal/30 text-signal">
                  <User size={12} /> {userRole}
                </span>
                <button onClick={handleLogout} className="text-gray-400 hover:text-rose-400 transition-colors" title="Sign out">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded border border-white/20 text-gray-300 hover:text-white transition-colors pointer-events-auto"
              >
                <LogIn size={14} /> Access Node
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ----------- Hero ----------- */}
      <div className="px-6 md:px-10 py-6 w-full max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="hud-panel hud-corners p-2 h-[500px] w-full"
        >
          {loading ? (
            <div className="h-full flex items-center justify-center text-ink-muted font-mono text-sm">
              Loading Earth imagery...
            </div>
          ) : (
            <Globe3D points={globePoints} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </motion.div>
      </div>



      {error && (
        <div className="mx-6 md:mx-10 mt-6 hud-panel px-4 py-4 bg-bad/10 text-bad text-sm font-mono border-bad/50 flex items-center gap-3">
          <span className="text-xl">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* ----------- Body ----------- */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 px-6 md:px-10 py-6 relative z-10 pointer-events-none">
        
        <div className="flex flex-col gap-6 pointer-events-auto">
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-2 rounded-xl shadow-2xl h-[420px]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-ink-muted font-mono text-sm">
                Loading district signals...
              </div>
            ) : (
              <DistrictMap districts={districts} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>


        </div>

        <div className="flex flex-col gap-4 pointer-events-auto">

          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl h-[420px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-xs text-ink-muted uppercase">
                All districts ({filteredDistricts.length})
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setSortMode("az")}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${
                    sortMode === "az" 
                      ? "border-signal/50 text-signal" 
                      : "border-space-line text-ink-muted hover:text-ink"
                  }`}
                >
                  A-Z
                </button>
                <button
                  onClick={() => setSortMode("severity")}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${
                    sortMode === "severity" 
                      ? "border-signal/50 text-signal" 
                      : "border-space-line text-ink-muted hover:text-ink"
                  }`}
                >
                  Severity
                </button>
              </div>
            </div>
            
            <input
              type="text"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              placeholder="Search district..."
              className="w-full mb-3 px-3 py-2 rounded-lg bg-space-line/40 border border-space-line text-sm text-ink placeholder:text-ink-muted/60 font-mono focus:outline-none focus:border-signal/50"
            />
            
            <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1 hide-scrollbar">
              <style jsx>{`
                .hide-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                .hide-scrollbar {
                  scrollbar-width: none;
                  -ms-overflow-style: none;
                }
              `}</style>
              {filteredDistricts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-body flex items-center justify-between transition-colors ${
                    d.id === selectedId
                      ? "bg-signal/10 text-ink border border-signal/40"
                      : "text-ink-muted hover:bg-space-line/40 border border-transparent"
                  }`}
                >
                  <span>
                    {d.name}, <span className="text-xs">{d.state}</span>
                  </span>
                  <span className={`text-xs font-mono ${
                    d.overall_severity === "bad" ? "text-bad" :
                    d.overall_severity === "warn" ? "text-warn" :
                    d.overall_severity === "pending" ? "text-ink-muted" : "text-good"
                  }`}>
                    ● {d.overall_severity}
                  </span>
                </button>
              ))}
              
              {filteredDistricts.length === 0 && (
                <p className="text-ink-muted text-sm font-mono px-3 py-2">No districts match "{districtFilter}".</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ----------- Full Width Horizontal Selected District Section ----------- */}
      <div className="relative z-10 w-full pointer-events-auto bg-black/60 backdrop-blur-2xl border-y border-white/5 py-10 mt-6">
        <div className="px-6 md:px-10 mx-auto w-full">
          {detail ? (
            <div className="flex flex-col xl:flex-row gap-12 w-full items-center">
              {/* Left Side: Info */}
              <div className="flex flex-col w-full xl:w-1/3 justify-center">
                <div className="flex flex-wrap items-center gap-4 mb-2">
                  <h2 className="font-display font-black text-4xl md:text-5xl text-white tracking-tight">
                    {detailLoading ? "Scanning orbit..." : detail.name}
                  </h2>
                  <span className={`text-xs font-mono px-3 py-1.5 rounded-full border uppercase tracking-widest whitespace-nowrap mt-1 md:mt-0 ${
                    detail.data_source === "live" 
                      ? "text-cyan-400 border-cyan-400/50 bg-cyan-950/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]" 
                      : "text-gray-400 border-gray-400/50 bg-gray-900/50"
                  }`}>
                    {detail.data_source === "live" ? "● live Earth Engine" : "○ demo data"}
                  </span>
                </div>
                <p className="text-gray-400 font-mono text-sm uppercase tracking-widest mt-2">
                  {detailLoading ? "Re-aligning satellite arrays..." : `${detail.state}  |  ${detail.period_before} ➔ ${detail.period_after}`}
                </p>
                <div className="mt-8">
                  <Link
                    href={`/district/${selectedId}`}
                    className="inline-flex items-center justify-center bg-gradient-to-r from-cyan-600/30 to-emerald-600/30 hover:from-cyan-500/40 hover:to-emerald-500/40 text-cyan-300 border border-cyan-500/50 font-mono py-4 px-8 rounded-lg shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all uppercase tracking-widest text-sm font-bold w-full sm:w-auto"
                  >
                    Analyze District Health Score ➔
                  </Link>
                </div>
              </div>

              {/* Right Side: Horizontal Indicators */}
              <div className={`w-full xl:w-2/3 grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity duration-300 ${detailLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                {Object.entries(detail.indicators).map(([key, val]) => (
                  <div key={key} className="h-full">
                    <IndicatorCard indicatorKey={key} data={val} />
                  </div>
                ))}
              </div>
            </div>
          ) : detailLoading ? (
            <div className="text-cyan-400 font-mono text-sm flex items-center justify-center gap-3 h-full py-10">
              <span className="inline-block w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              Querying orbital telemetry for {selectedId}...
            </div>
          ) : detailError ? (
            <div className="bg-rose-950/20 p-4 text-rose-400 font-mono text-sm border border-rose-500/20 rounded-lg flex items-center justify-center gap-3 h-full py-10">
              <span className="text-xl">⚠</span>
              <p>{detailError}</p>
            </div>
          ) : (
            <div className="text-gray-500 font-mono text-sm flex items-center justify-center h-full py-10">
              Select a district on the globe or map to view its SDG signal breakdown.
            </div>
          )}
        </div>
      </div>

      {/* ----------- Full Width Reports ----------- */}
      {detail && (
        <div className="px-6 md:px-10 py-6 flex flex-col gap-8 pointer-events-auto relative z-10 w-full max-w-7xl mx-auto">
          <BeforeAfterSlider 
            district={detail}
            districtId={detail.id}
            beforeLabel={detail.period_before}
            afterLabel={detail.period_after}
            indicators={detail.indicators}
            beforeImageUrl={detail.images?.before}
            afterImageUrl={detail.images?.after}
            aoiBounds={detail.images?.aoi_bounds}
            onImageClick={(lat, lon) => { setPoiCoords({ lat, lon }); setAreaBounds(null); }}
            onAreaSelect={(bounds) => { setAreaBounds(bounds); setPoiCoords(null); }}
          />
          {poiCoords && (
            <PoiChartPanel lat={poiCoords.lat} lon={poiCoords.lon} />
          )}
          {areaBounds && (
            <div id="full-spatial-report" className="mt-8 flex flex-col gap-6">
              <div className="bg-black/50 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-[0_0_20px_rgba(8,145,178,0.2)]">
                <div>
                  <h3 className="font-display font-bold text-base text-cyan-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    Spatial Telemetry Analysis — {detail.name}
                  </h3>
                  <p className="font-mono text-xs text-gray-400 mt-1">
                    Bounding Box: [{areaBounds.minLat.toFixed(4)}, {areaBounds.minLon.toFixed(4)}] to [{areaBounds.maxLat.toFixed(4)}, {areaBounds.maxLon.toFixed(4)}]
                  </p>
                </div>
                <button
                  onClick={() => exportElementToPDF("full-spatial-report", `${detail.name}_Full_Spatial_Analysis_Report`)}
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 hover:from-cyan-500/40 hover:to-emerald-500/40 text-cyan-300 border border-cyan-400/60 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                >
                  <Download className="w-4 h-4" /> Download Complete Report (PDF)
                </button>
              </div>

              <MLAnalysisPanel bounds={areaBounds} districtName={detail.name} />
              <ForestAnalysisPanel bounds={areaBounds} districtName={detail.name} />
              <DegradationAnalysisPanel bbox={areaBounds} startYear="2018" endYear="2024" districtName={detail.name} />
              <UrbanSprawlAnalysisPanel bbox={areaBounds} startYear="2018" endYear="2020" districtName={detail.name} />
            </div>
          )}
        </div>
      )}

      <footer className="px-6 md:px-10 py-5 text-center text-ink-muted text-xs font-mono">
        Built for SDG tracking • India-wide • Powered by Sentinel-2 &amp; Google Earth Engine
      </footer>

      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(role) => setUserRole(role)}
        />
      )}
    </main>
  );
}
