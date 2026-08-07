import type { IndicatorDetail } from "@/lib/api";

const SEVERITY_STYLES: Record<string, { text: string; bar: string; label: string }> = {
  good: { text: "text-good", bar: "bg-good", label: "Stable" },
  warn: { text: "text-warn", bar: "bg-warn", label: "Watch" },
  bad: { text: "text-bad", bar: "bg-bad", label: "Critical" },
  pending: { text: "text-ink-muted", bar: "bg-ink-muted", label: "Pending" },
};

// Each indicator gets its own accent from the aurora palette, so the panel
// reads as four distinct "signals" rather than one repeated card style.
const INDICATOR_ACCENT: Record<string, string> = {
  water: "#22D3EE",
  green_cover: "#A3E635",
  urban_heat: "#F472B6",
  climate_action: "#A855F7",
};

const ICON: Record<string, string> = {
  water: "〜",
  green_cover: "✦",
  urban_heat: "◉",
  climate_action: "▲",
};

interface Props {
  indicatorKey: string;
  data: IndicatorDetail;
}

export default function IndicatorCard({ indicatorKey, data }: Props) {
  const style = SEVERITY_STYLES[data.severity] ?? SEVERITY_STYLES.pending;
  const accent = INDICATOR_ACCENT[indicatorKey] ?? "#22D3EE";
  const isPending = data.severity === "pending" || data.pct_change == null;
  const magnitude = isPending ? 0 : Math.min(Math.abs(data.pct_change as number), 100);

  return (
    <div
      className={`hud-panel p-5 flex flex-col gap-3 ${isPending ? "opacity-70" : ""}`}
      style={{ borderLeft: `3px solid ${isPending ? "#4B5563" : accent}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" style={{ color: isPending ? "#6B7280" : accent }}>
            {ICON[indicatorKey] ?? "◆"}
          </span>
          <span className="font-display font-semibold text-ink text-sm tracking-wide uppercase">
            {data.label}
          </span>
        </div>
        <span
          className={`text-xs font-mono px-2 py-0.5 rounded-full border border-current ${style.text}`}
        >
          {style.label}
        </span>
      </div>

      <p className="text-ink/90 text-sm leading-relaxed">{data.verdict}</p>

      <div className="flex items-center gap-3 font-mono text-xs text-ink-muted">
        <span>{data.index_used}</span>
        <span className="opacity-40">•</span>
        <span>{data.sdg}</span>
      </div>

      {isPending ? (
        <div className="w-full h-1.5 bg-space-line rounded-full overflow-hidden">
          <div className="h-full w-full bg-ink-muted/20 animate-pulse rounded-full" />
        </div>
      ) : (
        <div className="w-full h-1.5 bg-space-line rounded-full overflow-hidden">
          <div className={`h-full ${style.bar} rounded-full`} style={{ width: `${magnitude}%` }} />
        </div>
      )}

      <div className="flex justify-between font-mono text-xs text-ink-muted">
        <span>Before: {data.before_value ?? "—"}</span>
        {isPending || data.pct_change === undefined ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className={
                (data.pct_change as number) < 0
                  ? "text-bad"
                  : (data.pct_change as number) > 0
                  ? "text-warn"
                  : "text-good"
              }
            >
              {(data.change_value as number) > 0 ? "+" : ""}
              {data.change_value} {indicatorKey === "urban_heat" ? "points" : "km²"}
            </span>
            <span className="text-[9px] opacity-60">({(data.pct_change as number) > 0 ? "+" : ""}{data.pct_change}%)</span>
          </div>
        )}
        <span>After: {data.after_value ?? "—"}</span>
      </div>
    </div>
  );
}
