"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface DistrictPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  severity: "good" | "warn" | "bad" | "pending";
}

const SEVERITY_COLOR: Record<string, string> = {
  good: "#34E89E",
  warn: "#FBBF24",
  bad: "#FB5A7C",
  pending: "#6B7280",
};

const TEX_BASE = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets";
const GLOBE_RADIUS = 1.6;

function latLonToVec3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}

const atmosphereVertex = `
  varying float vIntensity;
  void main() {
    vec3 vNormal = normalize(normalMatrix * normal);
    vec3 vNormel = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
    vIntensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmosphereFragment = `
  varying float vIntensity;
  void main() {
    vec3 glow = vec3(0.13, 0.83, 0.93) * vIntensity;
    gl_FragColor = vec4(glow, vIntensity * 0.9);
  }
`;

// Pin icon (teardrop + white circle) — same shape used on the 2D map, for
// visual consistency between globe and map markers.
const _pinTextureCache = new Map<string, THREE.CanvasTexture>();
function getPinTexture(color: string): THREE.CanvasTexture {
  const cached = _pinTextureCache.get(color);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;

  ctx.beginPath();
  ctx.moveTo(32, 78);
  ctx.quadraticCurveTo(6, 42, 6, 26);
  ctx.arc(32, 26, 26, Math.PI, 0, false);
  ctx.quadraticCurveTo(58, 42, 32, 78);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(32, 26, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  _pinTextureCache.set(color, texture);
  return texture;
}

/**
 * Shows ONLY the currently selected district — not all loaded districts.
 * Simpler, faster, and avoids the overlap/clutter problem entirely rather
 * than trying to manage it. The district name is attached directly next
 * to the pin (via Html anchored to the pin's 3D position), not a
 * separate fixed corner box.
 */
function SelectedMarker({ point }: { point: DistrictPoint }) {
  const ref = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => getPinTexture(SEVERITY_COLOR[point.severity]), [point.severity]);
  const position = latLonToVec3(point.lat, point.lon, GLOBE_RADIUS + 0.05);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1.15 + Math.sin(t * 3) * 0.1;
    ref.current.scale.set(0.15 * pulse, 0.19 * pulse, 1);
  });

  return (
    <group position={position}>
      <sprite ref={ref} scale={[0.15, 0.19, 1]}>
        <spriteMaterial map={texture} transparent depthTest={false} />
      </sprite>
      <Html distanceFactor={7} position={[0, 0.14, 0]} center>
        <div className="pointer-events-none px-2 py-1 rounded bg-space/90 border border-signal/50 text-xs font-mono text-ink whitespace-nowrap">
          📍 {point.name}
        </div>
      </Html>
    </group>
  );
}

function EarthWithClouds({ selected }: { selected: DistrictPoint | null }) {
  const [dayMap, cloudsMap, lightsMap] = useLoader(THREE.TextureLoader, [
    `${TEX_BASE}/earth_atmos_2048.jpg`,
    `${TEX_BASE}/earth_clouds_1024.png`,
    `${TEX_BASE}/earth_lights_2048.png`,
  ]);

  const earthRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.05;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.075;
  });

  return (
    <group ref={earthRef}>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
        <meshPhongMaterial
          map={dayMap}
          emissiveMap={lightsMap}
          emissive={new THREE.Color(0xffdd88)}
          emissiveIntensity={0.55}
          specular={new THREE.Color(0x223355)}
          shininess={6}
        />
      </mesh>

      <mesh ref={cloudsRef}>
        <sphereGeometry args={[GLOBE_RADIUS + 0.015, 48, 48]} />
        <meshStandardMaterial map={cloudsMap} alphaMap={cloudsMap} transparent opacity={0.35} depthWrite={false} />
      </mesh>

      <mesh scale={1.12}>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
        />
      </mesh>

      {selected && <SelectedMarker point={selected} />}
    </group>
  );
}

function Loading() {
  return (
    <Html center>
      <div className="font-mono text-xs text-ink-muted whitespace-nowrap">Loading Earth imagery...</div>
    </Html>
  );
}

export default function Globe3D({
  points,
  selectedId,
}: {
  points: DistrictPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = useMemo(
    () => points.find((p) => p.id === selectedId) ?? null,
    [points, selectedId]
  );

  // Always a single point now, so camera distance is a fixed close value
  // rather than a spread calculation — no more clutter to solve for.
  const cameraPosition = useMemo((): [number, number, number] => {
    if (!selected) return [0, 0, 4.2];
    return latLonToVec3(selected.lat, selected.lon, 2.4);
  }, [selected]);

  return (
    <div className="relative w-full h-full min-h-[360px]">
      <Canvas camera={{ position: cameraPosition, fov: 45 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 2, 5]} intensity={1.4} color="#fff8e8" />
        <Suspense fallback={<Loading />}>
          <EarthWithClouds selected={selected} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.9}
          maxDistance={4.5}
          autoRotate={false}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
