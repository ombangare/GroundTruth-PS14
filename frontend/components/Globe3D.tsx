"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
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

// Pin-shaped marker texture (teardrop + white circle), drawn once per
// color and cached — replaces the plain floating-sphere-with-ring look.
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

function Marker({
  position,
  color,
  onClick,
  active,
}: {
  position: [number, number, number];
  color: string;
  onClick: () => void;
  active: boolean;
}) {
  const ref = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => getPinTexture(color), [color]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = active ? 1.35 + Math.sin(t * 3) * 0.15 : 1;
    ref.current.scale.set(0.14 * pulse, 0.175 * pulse, 1);
  });

  return (
    <sprite
      ref={ref}
      position={position}
      scale={[0.14, 0.175, 1]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function EarthWithClouds({
  points,
  selectedId,
  onSelect,
}: {
  points: DistrictPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [dayMap, cloudsMap, lightsMap] = useLoader(THREE.TextureLoader, [
    `${TEX_BASE}/earth_atmos_2048.jpg`,
    `${TEX_BASE}/earth_clouds_1024.png`,
    `${TEX_BASE}/earth_lights_2048.png`,
  ]);

  const earthRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const rotationSpeed = points.length > 5 ? 0.006 : 0.06;

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * rotationSpeed;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * (rotationSpeed + 0.025);
  });

  const radius = 1.6;

  return (
    <group ref={earthRef}>
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
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
        <sphereGeometry args={[radius + 0.015, 48, 48]} />
        <meshStandardMaterial map={cloudsMap} alphaMap={cloudsMap} transparent opacity={0.35} depthWrite={false} />
      </mesh>

      <mesh scale={1.12}>
        <sphereGeometry args={[radius, 48, 48]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
        />
      </mesh>

      {points.map((p) => (
        <Marker
          key={p.id}
          position={latLonToVec3(p.lat, p.lon, radius + 0.05)}
          color={SEVERITY_COLOR[p.severity]}
          active={p.id === selectedId}
          onClick={() => onSelect(p.id)}
        />
      ))}
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
  onSelect,
}: {
  points: DistrictPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const safePoints = useMemo(() => points ?? [], [points]);

  const initialCameraPosition = useMemo((): [number, number, number] => {
    if (safePoints.length === 0) return [0, 0, 4.2];
    const avgLat = safePoints.reduce((s, p) => s + p.lat, 0) / safePoints.length;
    const avgLon = safePoints.reduce((s, p) => s + p.lon, 0) / safePoints.length;
    const distance = safePoints.length > 5 ? 2.6 : 4.2;
    return latLonToVec3(avgLat, avgLon, distance);
  }, [safePoints]);

  // Selected district's name — shown as a FIXED corner overlay, not
  // anchored to the 3D marker position, so it never covers the globe
  // itself regardless of rotation/zoom.
  const selectedName = safePoints.find((p) => p.id === selectedId)?.name;

  return (
    <div className="relative w-full h-full min-h-[360px]">
      {selectedName && (
        <div className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-space/90 border border-signal/50 backdrop-blur pointer-events-none">
          <span className="font-mono text-sm text-ink whitespace-nowrap">{selectedName}</span>
        </div>
      )}
      <Canvas camera={{ position: initialCameraPosition, fov: 45 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 2, 5]} intensity={1.4} color="#fff8e8" />
        <Suspense fallback={<Loading />}>
          <EarthWithClouds points={safePoints} selectedId={selectedId} onSelect={onSelect} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.8}
          maxDistance={7}
          autoRotate={false}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
