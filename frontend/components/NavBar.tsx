"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/districts", label: "District Monitoring" },
  { href: "/reports", label: "Reports" },
  { href: "/about", label: "About" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, logout } = useAuth();

  return (
    <nav className="hud-panel mx-6 md:mx-10 mt-6 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🛰️</span>
        <span className="font-display font-extrabold text-lg tracking-tight text-aurora-gradient">
          GroundTruth
        </span>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
              pathname === link.href
                ? "bg-signal/10 text-signal border border-signal/40"
                : "text-ink-muted hover:text-ink hover:bg-space-line/40"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {isAdmin ? (
          <>
            <span className="text-[10px] font-mono px-2 py-1 rounded-full border border-good text-good uppercase">
              ● Admin
            </span>
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-space-line text-ink-muted hover:text-ink hover:border-signal/40 transition-colors"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            href="/admin/login"
            className="text-xs font-mono px-3 py-1.5 rounded-lg border border-space-line text-ink-muted hover:text-ink hover:border-signal/40 transition-colors"
          >
            Admin Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
