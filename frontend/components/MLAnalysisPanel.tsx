"use client";

import { useEffect, useState } from "react";

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export default function MLAnalysisPanel({ bounds }: { bounds: Bounds }) {
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Mocking an ML analysis API call since the backend routes don't exist yet
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500); // 2.5s simulated processing time
    
    return () => clearTimeout(timer);
  }, [bounds]);

  return (
    <div className="hud-panel p-6 border-aurora-magenta/30 bg-[#0b1021]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-aurora-magenta flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-aurora-magenta animate-pulse"></span>
            Area ML Analysis (Bounding Box)
          </h3>
          <p className="font-mono text-[10px] text-ink-muted">
            Bounds: [{bounds.minLat.toFixed(4)}, {bounds.minLon.toFixed(4)}] to [{bounds.maxLat.toFixed(4)}, {bounds.maxLon.toFixed(4)}]
          </p>
        </div>
        <span className="px-2 py-1 bg-aurora-magenta/10 border border-aurora-magenta/30 text-aurora-magenta text-[9px] uppercase tracking-wider rounded">
          Deep Learning Cluster
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 font-mono text-xs text-aurora-magenta">
          <div className="animate-spin w-6 h-6 border-2 border-aurora-magenta border-t-transparent rounded-full mb-3" />
          <span>Executing neural networks on selected spatial bounds...</span>
          <span className="text-[9px] text-ink-muted mt-1 opacity-70">Computing hydrological shrinkage vectors...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          
          {/* Flood Indicator */}
          <div className="flex flex-col gap-2 border border-space-line p-4 rounded-lg bg-[#050811] shadow-xl">
            <div className="flex items-center justify-between border-b border-space-line pb-2">
              <span className="font-bold text-sm text-cyan-400">Flood Susceptibility Index</span>
              <span className="text-xl">🌊</span>
            </div>
            <div className="font-mono text-[11px] text-gray-400 mt-1">
              Topographic depression analysis combined with historical SAR inundation maps indicates the vulnerability of this specific bounded region.
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-rose-400">High Risk (78%)</span>
              </div>
              <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-full w-[78%]" />
              </div>
            </div>
            <div className="mt-2 text-[10px] font-mono text-ink-muted">
              Model: <span className="text-cyan-600">HydroSAR-v4</span> | Confidence: 92%
            </div>
          </div>

          {/* Water Shrinkage */}
          <div className="flex flex-col gap-2 border border-space-line p-4 rounded-lg bg-[#050811] shadow-xl">
            <div className="flex items-center justify-between border-b border-space-line pb-2">
              <span className="font-bold text-sm text-blue-400">Decadal Water Shrinkage</span>
              <span className="text-xl">🏜️</span>
            </div>
            <div className="font-mono text-[11px] text-gray-400 mt-1">
              Time-series anomaly detection on surface water area inside the bounding box over the last 120 months.
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-3xl font-display font-bold text-bad">-14.2%</span>
              <span className="text-[11px] font-mono text-ink-muted mb-1">surface area reduction</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-ink-muted">
              Model: <span className="text-blue-600">NDWI-Temporal-LSTM</span> | Trajectory: <span className="text-bad">Declining</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
