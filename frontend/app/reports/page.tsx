"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAdmin) router.push("/admin/login");
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-ink-muted font-mono text-sm">Redirecting to sign in...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 md:px-10 py-10">
      <p className="font-mono text-xs text-signal uppercase tracking-widest mb-2">Admin Only</p>
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Reports</h1>

      <div className="hud-panel p-6 max-w-2xl">
        <p className="text-ink-muted text-sm font-mono mb-4">
          This page is only reachable when signed in as an admin — it's the
          template for report generation, historical data export, and other
          admin tooling your team builds out. Not implemented yet, this is
          the access-control scaffold: try opening this page in a private/
          incognito window (no session) and you'll get bounced to the login
          page automatically.
        </p>
        <div className="border-t border-space-line pt-4 mt-4">
          <p className="text-xs font-mono text-ink-muted uppercase mb-2">Planned for this page</p>
          <ul className="text-sm text-ink-muted space-y-1 font-mono">
            <li>— Generate a district PDF report (indicators + before/after imagery)</li>
            <li>— Export historical trend data as CSV</li>
            <li>— District health score breakdown</li>
            <li>— Bulk re-run / cache management for all tracked districts</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
