"use client";

/**
 * Renders a stylized "satellite tile" whose water body size, vegetation
 * density, and built-up density are DRIVEN BY THE ACTUAL INDICATOR NUMBERS
 * for that district/period — this isn't a decorative gradient, it's a real
 * (if simplified) visualization of the underlying data. Terrain layout is
 * seeded by district ID so before/after share the same base shape and only
 * the data-driven elements change, making the comparison meaningful.
 *
 * When a real GEE-exported thumbnail URL is available (`imageUrl` prop),
 * BeforeAfterSlider uses that <img> instead of this component — this is
 * purely the fallback for when live imagery isn't wired up yet.
 */

interface Props {
  seed: string; // district id — keeps terrain shape stable across before/after
  waterValue: number; // sq km
  waterMax?: number;
  greenPct: number; // 0-100
  heatValue: number; // 0-10ish
  heatMax?: number;
  label: string;
}

// Simple deterministic PRNG so the same seed always produces the same layout.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export default function SatelliteTile({
  seed,
  waterValue,
  waterMax = 45,
  greenPct,
  heatValue,
  heatMax = 10,
  label,
}: Props) {
  const rand = mulberry32(hashSeed(seed));
  const baseHue = 25 + rand() * 20; // sandy/terrain base hue, stable per district

  const waterFrac = clamp01(waterValue / waterMax);
  const greenFrac = clamp01(greenPct / 50);
  const heatFrac = clamp01(heatValue / heatMax);

  // Water blob — position stable per district, radius driven by real value
  const waterCx = 30 + rand() * 20;
  const waterCy = 55 + rand() * 15;
  const waterRx = 6 + waterFrac * 26;
  const waterRy = 4 + waterFrac * 16;

  // Vegetation speckle pool — fixed positions, count driven by green_cover
  const vegPool = Array.from({ length: 40 }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: 1 + rand() * 2.2,
  }));
  const vegCount = Math.round(greenFrac * vegPool.length);

  // Built-up/heat speckle pool — count driven by heat intensity
  const heatPool = Array.from({ length: 24 }, () => ({
    x: rand() * 100,
    y: 60 + rand() * 38,
    w: 2 + rand() * 3,
    h: 2 + rand() * 3,
  }));
  const heatCount = Math.round(heatFrac * heatPool.length);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      <defs>
        <radialGradient id={`terrain-${seed}-${label}`} cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor={`hsl(${baseHue}, 28%, 22%)`} />
          <stop offset="100%" stopColor="#0B0618" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill={`url(#terrain-${seed}-${label})`} />

      {/* vegetation — count scales with real green cover % */}
      {vegPool.slice(0, vegCount).map((v, i) => (
        <circle key={`v-${i}`} cx={v.x} cy={v.y} r={v.r} fill="#A3E635" opacity={0.55} />
      ))}

      {/* built-up / heat — count scales with real urban heat intensity */}
      {heatPool.slice(0, heatCount).map((h, i) => (
        <rect key={`h-${i}`} x={h.x} y={h.y} width={h.w} height={h.h} fill="#F472B6" opacity={0.5} rx={0.4} />
      ))}

      {/* water body — size scales with real NDWI-derived surface area */}
      <ellipse cx={waterCx} cy={waterCy} rx={waterRx} ry={waterRy} fill="#22D3EE" opacity={0.75} />
      <ellipse cx={waterCx} cy={waterCy} rx={waterRx} ry={waterRy} fill="none" stroke="#67E8F9" strokeWidth={0.4} opacity={0.9} />

      {/* HUD grid overlay */}
      {[20, 40, 60, 80].map((v) => (
        <line key={`gx-${v}`} x1={v} y1={0} x2={v} y2={100} stroke="#22D3EE" strokeWidth={0.15} opacity={0.15} />
      ))}
      {[20, 40, 60, 80].map((v) => (
        <line key={`gy-${v}`} x1={0} y1={v} x2={100} y2={v} stroke="#22D3EE" strokeWidth={0.15} opacity={0.15} />
      ))}
    </svg>
  );
}
