"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { fetchDistricts, fetchDistrict, type DistrictSummary, type DistrictDetail } from "@/lib/api";
import IndicatorCard from "@/components/IndicatorCard";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";

const DistrictMap = dynamic(() => import("@/components/DistrictMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-xl bg-space-panel flex items-center justify-center text-ink-muted font-mono text-sm">
      Acquiring orbital fix...
    </div>
  ),
});

const Globe3D = dynamic(() => import("@/components/Globe3D"), { ssr: false });

export default function Home() {
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [districtFilter, setDistrictFilter] = useState("");
  const [sortMode, setSortMode] = useState<"az" | "severity">("az");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    fetchDistrict(selectedId)
      .then((d) => {
        setDetail(d);
        setDetailLoading(false);
      })
      .catch((err) => {
        setDetail(null);
        setDetailLoading(false);
        setDetailError(
          err.message || "An unexpected error occurred while fetching the district data."
        );
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
    .sort((a, b) =>
      sortMode === "az"
        ? a.name.localeCompare(b.name)
        : SEVERITY_RANK[a.overall_severity] - SEVERITY_RANK[b.overall_severity]
    );

  return (
    <main className="min-h-screen flex flex-col">
      {/* ---------- Header + ticker ---------- */}
      <header className="px-6 md:px-10 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛰️</span>
            <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-aurora-gradient">
              GroundTruth
            </h1>
          </div>
          <div className="hidden md:flex flex-col items-end font-mono text-xs text-ink-muted">
            <span>SOURCE: Sentinel-2 / Bhuvan / Earth Engine</span>
            <span>ENGINE: NDWI · NDVI · NDBI</span>
          </div>
        </div>

        {/* Live ticker strip — instrument-panel detail, not decoration */}
        <div className="mt-4 hud-panel overflow-hidden py-1.5 px-3">
          <div className="ticker-track font-mono text-[11px] text-signal/90">
            {Array.from({ length: 2 }).map((_, rep) => (
              <span key={rep} className="inline-flex items-center gap-8 pr-8">
                <span>DISTRICTS TRACKED: {districts.length}</span>
                <span className="opacity-40">◆</span>
                <span>LIVE GEE FEEDS: {liveCount}</span>
                <span className="opacity-40">◆</span>
                <span>DEMO FEEDS: {districts.length - liveCount}</span>
                <span className="opacity-40">◆</span>
                <span>INDICES: NDWI · NDVI · NDBI</span>
                <span className="opacity-40">◆</span>
                <span>SDG 6 · 11 · 13 · 15</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ---------- Hero: real spinning Earth, click a marker to select ---------- */}
      <section className="px-6 md:px-10 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="font-mono text-xs text-signal uppercase tracking-widest mb-3">
            SDG Tracking, from orbit to ground
          </p>
          <h2 className="font-display font-extrabold text-3xl md:text-5xl leading-tight text-ink mb-4">
            What satellites already know
            <br />
            about <span className="text-aurora-gradient">your district.</span>
          </h2>
          <p className="text-ink-muted text-base md:text-lg max-w-lg">
            Free satellite imagery, translated into plain-language SDG progress —
            water, green cover, and urban heat — for administrators, NGOs, and
            citizens across India.
          </p>
          <p className="font-mono text-xs text-ink-muted/70 mt-4">
            ↳ Drag the globe, or click a glowing marker to select a district.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="hud-panel hud-corners p-2 h-[420px]"
        >
          {loading ? (
            <div className="h-full flex items-center justify-center text-ink-muted font-mono text-sm">
              Loading Earth imagery...
            </div>
          ) : (
            <Globe3D points={globePoints} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </motion.div>
      </section>

      <div className="orbit-line mx-6 md:mx-10" />

      {error && (
        <div className="mx-6 md:mx-10 mt-6 hud-panel px-4 py-4 bg-bad/10 text-bad text-sm font-mono border-bad/50 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ---------- Body ---------- */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 px-6 md:px-10 py-6">
        <div className="flex flex-col gap-6">
          <div className="hud-panel hud-corners p-2 h-[420px]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-ink-muted font-mono text-sm">
                Loading district signals...
              </div>
            ) : (
              <DistrictMap districts={districts} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>

          {detail && (
            <BeforeAfterSlider
              districtId={detail.id}
              beforeLabel={detail.period_before}
              afterLabel={detail.period_after}
              indicators={detail.indicators}
              beforeImageUrl={detail.images?.before}
              afterImageUrl={detail.images?.after}
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {detail ? (
            <>
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="font-display font-bold text-xl text-ink">{detail.name}</h2>
                  <p className="text-ink-muted text-sm font-mono">
                    {detail.state} · {detail.period_before} → {detail.period_after}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-1 rounded-full border uppercase tracking-wide ${
                    detail.data_source === "live"
                      ? "text-good border-good"
                      : "text-ink-muted border-ink-muted/40"
                  }`}
                >
                  {detail.data_source === "live" ? "● Live Earth Engine" : "○ Demo data"}
                </span>
              </div>

              {Object.entries(detail.indicators).map(([key, val]) => (
                <IndicatorCard key={key} indicatorKey={key} data={val} />
              ))}
            </>
          ) : detailLoading ? (
            <div className="hud-panel p-6 text-signal font-mono text-sm flex items-center gap-3">
              <span className="inline-block w-3 h-3 border-2 border-signal border-t-transparent rounded-full animate-spin" />
              Querying satellite indicators for {selectedId ?? "district"}...
            </div>
          ) : detailError ? (
            <div className="hud-panel p-6 bg-bad/10 text-bad font-mono text-sm border-bad/50 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <p className="mt-1">{detailError}</p>
            </div>
          ) : (
            <div className="hud-panel p-6 text-ink-muted font-mono text-sm">
              Select a district on the globe or map to view its SDG signal breakdown.
            </div>
          )}

          <div className="hud-panel p-4">
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
                  A–Z
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
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {filteredDistricts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-body flex items-center justify-between transition-colors ${
                    d.id === selectedId
                      ? "bg-signal/10 text-ink border border-signal/40"
                      : "text-ink-muted hover:bg-space-line/40"
                  }`}
                >
                  <span>
                    {d.name}, {d.state}
                  </span>
                  <span
                    className={`text-xs font-mono ${
                      d.overall_severity === "bad"
                        ? "text-bad"
                        : d.overall_severity === "warn"
                        ? "text-warn"
                        : d.overall_severity === "pending"
                        ? "text-ink-muted"
                        : "text-good"
                    }`}
                  >
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

      <footer className="px-6 md:px-10 py-5 text-center text-ink-muted text-xs font-mono">
        Built for SDG tracking · India-wide · Powered by Sentinel-2 &amp; Google Earth Engine
      </footer>
    </main>
  );
}
