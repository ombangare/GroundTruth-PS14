import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- GroundTruth "Aurora" design tokens ---
        // Deep violet-black backdrop, not navy — the night sky behind the aurora
        space: {
          DEFAULT: "#05070D",
          panel: "#0A0E1A",
          line: "#1B2536",
        },
        // Signal cyan: live data / active state / primary accent
        signal: {
          DEFAULT: "#22D3EE",
          dim: "#0EA5C4",
          glow: "#67E8F9",
        },
        // Secondary accents used across the aurora gradient + per-indicator theming
        aurora: {
          violet: "#A855F7",
          magenta: "#F472B6",
          lime: "#A3E635",
        },
        // Severity bands — kept vivid, not desaturated
        good: "#34E89E",
        warn: "#FBBF24",
        bad: "#FB5A7C",
        // Text
        ink: {
          DEFAULT: "#F4F1FB",
          muted: "#A99FC7",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "aurora-mesh":
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(168,85,247,0.35), transparent), radial-gradient(ellipse 60% 50% at 80% 0%, rgba(34,211,238,0.28), transparent), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(244,114,182,0.18), transparent)",
      },
    },
  },
  plugins: [],
};

export default config;
