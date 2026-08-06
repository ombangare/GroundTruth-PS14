import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (role: string) => void;
}

export default function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const role = data.session?.user?.app_metadata?.role || "viewer";
      onLoginSuccess(role);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-sm p-6 rounded-lg bg-space-panel border border-space-line shadow-lg">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink transition-colors">
          <X size={20} />
        </button>
        <h2 className="text-2xl font-display font-bold text-ink mb-2">Access Node</h2>
        <p className="text-sm font-mono text-ink-muted mb-6">Authenticate to access restricted network data.</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Operator Email"
            className="w-full px-3 py-2 rounded bg-space-line/40 border border-space-line text-sm text-ink placeholder:text-ink-muted/60 font-mono focus:outline-none focus:border-signal/50"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-3 py-2 rounded bg-space-line/40 border border-space-line text-sm text-ink placeholder:text-ink-muted/60 font-mono focus:outline-none focus:border-signal/50"
            required
          />
          {error && <p className="text-xs text-bad font-mono bg-bad/10 p-2 rounded border border-bad/30">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2 rounded bg-signal hover:bg-signal/80 text-[#000] font-mono font-bold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : "Authenticate"}
          </button>
        </form>
      </div>
    </div>
  );
}
