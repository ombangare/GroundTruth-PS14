"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col px-6 md:px-10">
      <section className="py-14 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="font-mono text-xs text-signal uppercase tracking-widest mb-3">
            Earth Observation for Public Good
          </p>
          <h1 className="font-display font-extrabold text-3xl md:text-5xl leading-tight text-ink mb-4">
            See what satellites already know
            <br />
            about <span className="text-aurora-gradient">your district.</span>
          </h1>
          <p className="text-ink-muted text-base md:text-lg max-w-xl mb-8">
            GroundTruth translates real satellite imagery into plain-language
            environmental updates — water bodies, green cover, and urban heat —
            for every district we track. Open to everyone: administrators,
            NGOs, researchers, and citizens.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/districts"
              className="px-5 py-3 rounded-lg bg-signal/10 border border-signal/50 text-signal font-mono text-sm hover:bg-signal/20 transition-colors"
            >
              🌍 Explore District Monitoring
            </Link>
            <Link
              href="/about"
              className="px-5 py-3 rounded-lg border border-space-line text-ink-muted font-mono text-sm hover:text-ink hover:border-signal/30 transition-colors"
            >
              How this works
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-14 max-w-4xl">
        <div className="hud-panel p-5">
          <span className="text-2xl">〜</span>
          <h3 className="font-display font-semibold text-ink mt-2 mb-1">Water Bodies</h3>
          <p className="text-ink-muted text-sm">
            Tracks shrinkage or growth of lakes, rivers, and reservoirs using
            real satellite water-index data. (SDG 6)
          </p>
        </div>
        <div className="hud-panel p-5">
          <span className="text-2xl">✦</span>
          <h3 className="font-display font-semibold text-ink mt-2 mb-1">Green Cover</h3>
          <p className="text-ink-muted text-sm">
            Vegetation health and coverage change over time — deforestation,
            regrowth, farmland stress. (SDG 15)
          </p>
        </div>
        <div className="hud-panel p-5">
          <span className="text-2xl">◉</span>
          <h3 className="font-display font-semibold text-ink mt-2 mb-1">Urban Heat</h3>
          <p className="text-ink-muted text-sm">
            Real thermal satellite data showing where cities are heating up
            fastest. (SDG 11)
          </p>
        </div>
      </section>

      <section className="pb-16 max-w-2xl">
        <div className="hud-panel p-5 text-sm text-ink-muted font-mono">
          This is a public information view. Signed-in administrators have
          access to additional tools — historical report generation, district
          health scoring, and data management — via{" "}
          <Link href="/admin/login" className="text-signal underline">
            Admin Sign In
          </Link>
          .
        </div>
      </section>
    </main>
  );
}
