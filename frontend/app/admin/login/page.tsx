"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const { login, isAdmin } = useAuth();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      router.push("/reports");
    } else {
      setError(true);
    }
  };

  if (isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="hud-panel p-8 max-w-sm w-full text-center">
          <p className="text-good font-mono text-sm mb-3">● Already signed in as admin</p>
          <button
            onClick={() => router.push("/reports")}
            className="px-4 py-2 rounded-lg bg-signal/10 border border-signal/50 text-signal font-mono text-sm hover:bg-signal/20"
          >
            Go to Reports
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="hud-panel p-8 max-w-sm w-full">
        <p className="font-mono text-xs text-signal uppercase tracking-widest mb-2">Restricted Access</p>
        <h1 className="font-display font-bold text-xl text-ink mb-6">Admin Sign In</h1>

        <label className="block text-xs font-mono text-ink-muted mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          className="w-full mb-2 px-3 py-2 rounded-lg bg-space-line/40 border border-space-line text-sm text-ink font-mono focus:outline-none focus:border-signal/50"
          autoFocus
        />
        {error && <p className="text-bad text-xs font-mono mb-3">Incorrect password.</p>}

        <button
          type="submit"
          className="w-full mt-4 px-4 py-2.5 rounded-lg bg-signal/10 border border-signal/50 text-signal font-mono text-sm hover:bg-signal/20 transition-colors"
        >
          Sign In
        </button>

        <p className="text-ink-muted text-xs font-mono mt-4 text-center">
          Citizens don't need an account — public data is on the{" "}
          <a href="/districts" className="text-signal underline">
            District Monitoring
          </a>{" "}
          page.
        </p>
      </form>
    </main>
  );
}
