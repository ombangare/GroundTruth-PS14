export default function AboutPage() {
  return (
    <main className="min-h-screen px-6 md:px-10 py-10 max-w-2xl">
      <p className="font-mono text-xs text-signal uppercase tracking-widest mb-2">About</p>
      <h1 className="font-display font-bold text-2xl text-ink mb-6">How GroundTruth Works</h1>

      <div className="hud-panel p-6 space-y-4 text-sm text-ink-muted font-mono leading-relaxed">
        <p>
          GroundTruth queries real Sentinel-2 satellite imagery through Google
          Earth Engine's cloud — no raw imagery is downloaded, only computed
          results — and translates the output into plain-language
          environmental verdicts for each district.
        </p>
        <p>
          <span className="text-signal">Water bodies (SDG 6):</span> measured
          via NDWI (Normalized Difference Water Index).
        </p>
        <p>
          <span className="text-signal">Vegetation (SDG 15):</span> measured
          via NDVI (Normalized Difference Vegetation Index).
        </p>
        <p>
          <span className="text-signal">Urban heat (SDG 11):</span> measured
          via real Landsat 8/9 thermal imagery where available, falling back
          to an NDBI-based proxy otherwise.
        </p>
        <p>
          <span className="text-signal">Climate signal (SDG 13):</span> a
          composite score derived from the three indicators above — disclosed
          as derived, since no single satellite band measures "climate
          action" directly.
        </p>
        <p className="pt-2 border-t border-space-line">
          This is public information. No login is required to view district
          data — sign-in is only for administrative tooling (report
          generation, data management).
        </p>
      </div>
    </main>
  );
}
