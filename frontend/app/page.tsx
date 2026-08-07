'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Link from 'next/link';
import { motion } from 'framer-motion';
import LoginModal from '@/components/LoginModal';

// Fast 3D Simplex-style Noise Generator for organic fluid flow
function createNoise3D() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = Math.floor(Math.random() * 256);
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return function (x: number, y: number, z: number) {
    const F3 = 1.0 / 3.0, G3 = 1.0 / 6.0;
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let gX = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453;
    let gY = Math.cos(i * 26.3121 + j * 41.612 + k * 19.123) * 21981.1234;
    let gZ = Math.sin(i * 81.1231 + j * 11.123 + k * 93.123) * 31238.1234;
    return (gX - Math.floor(gX) + gY - Math.floor(gY) + gZ - Math.floor(gZ) - 1.5) * 0.35;
  };
}

const noise3D = createNoise3D();

export default function GroundTruthLandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // --- 1. THREE.JS SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030308, 0.012);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    
    container.appendChild(renderer.domElement);

    const createGlowTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, 'rgba(0, 240, 255, 0.85)');
      grad.addColorStop(0.6, 'rgba(180, 0, 255, 0.3)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(canvas);
    };

    const glowTexture = createGlowTexture();
    const SECTION_SPACING = 20;

    // --- 2. SECTION 1: ROTATING 3D EARTH GLOBE ---
    const globeGroup = new THREE.Group();
    const sphereCount = 8500;
    const sphereGeo = new THREE.BufferGeometry();
    const spherePos = new Float32Array(sphereCount * 3);
    const sphereColors = new Float32Array(sphereCount * 3);

    const radius = 6.0;
    for (let i = 0; i < sphereCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / sphereCount);
      const theta = Math.sqrt(sphereCount * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi) + (Math.random() - 0.5) * 0.15;
      const y = radius * Math.sin(theta) * Math.sin(phi) + (Math.random() - 0.5) * 0.15;
      const z = radius * Math.cos(phi) + (Math.random() - 0.5) * 0.15;

      spherePos[i * 3] = x;
      spherePos[i * 3 + 1] = y;
      spherePos[i * 3 + 2] = z;

      const color = new THREE.Color();
      color.setHSL(Math.random() < 0.65 ? 0.52 + Math.random() * 0.06 : 0.8 + Math.random() * 0.1, 1, 0.65);
      sphereColors[i * 3] = color.r;
      sphereColors[i * 3 + 1] = color.g;
      sphereColors[i * 3 + 2] = color.b;
    }

    sphereGeo.setAttribute('position', new THREE.BufferAttribute(spherePos, 3));
    sphereGeo.setAttribute('color', new THREE.BufferAttribute(sphereColors, 3));

    const sphereMat = new THREE.PointsMaterial({
      size: 0.35,
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false,
    });

    const sphereMesh = new THREE.Points(sphereGeo, sphereMat);
    globeGroup.add(sphereMesh);

    // Glowing Pinpoint
    const pinGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.set(2.2, 1.8, 5.5);
    globeGroup.add(pinMesh);

    globeGroup.position.set(5.5, 0, -3); 
    scene.add(globeGroup);

    // --- 3. SECTION 2: SATELLITE DATA STREAM ---
    const helixCount = 4500;
    const helixGeo = new THREE.BufferGeometry();
    const helixPos = new Float32Array(helixCount * 3);
    const helixColors = new Float32Array(helixCount * 3);

    for (let i = 0; i < helixCount; i++) {
      const strand = i % 2 === 0 ? 1 : -1;
      const t = (i / helixCount) * Math.PI * 14;
      const hRadius = 2.2; 

      const x = Math.cos(t + (strand === 1 ? 0 : Math.PI)) * hRadius + (Math.random() - 0.5) * 0.5;
      const y = (i / helixCount) * 22 - 11;
      const z = Math.sin(t + (strand === 1 ? 0 : Math.PI)) * hRadius + (Math.random() - 0.5) * 0.5;

      helixPos[i * 3] = x;
      helixPos[i * 3 + 1] = y;
      helixPos[i * 3 + 2] = z;

      const color = new THREE.Color(strand === 1 ? 0x00f0ff : 0x00ff88);
      helixColors[i * 3] = color.r;
      helixColors[i * 3 + 1] = color.g;
      helixColors[i * 3 + 2] = color.b;
    }

    helixGeo.setAttribute('position', new THREE.BufferAttribute(helixPos, 3));
    helixGeo.setAttribute('color', new THREE.BufferAttribute(helixColors, 3));

    const helixMat = new THREE.PointsMaterial({
      size: 0.36,
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false,
    });

    const helixMesh = new THREE.Points(helixGeo, helixMat);
    helixMesh.position.set(0, -SECTION_SPACING, -2);
    scene.add(helixMesh);

    // --- 4. SECTION 3: TOPOGRAPHIC LANDSCAPE ---
    const gridCols = 90;
    const gridRows = 90;
    const gridCount = gridCols * gridRows;
    const gridGeo = new THREE.BufferGeometry();
    const gridPos = new Float32Array(gridCount * 3);
    const gridColors = new Float32Array(gridCount * 3);

    let gIdx = 0;
    for (let i = 0; i < gridCols; i++) {
      for (let j = 0; j < gridRows; j++) {
        const x = (i - gridCols / 2) * 0.5;
        const z = (j - gridRows / 2) * 0.5;
        const y = 0;

        gridPos[gIdx * 3] = x;
        gridPos[gIdx * 3 + 1] = y;
        gridPos[gIdx * 3 + 2] = z;

        const color = new THREE.Color();
        color.setHSL(0.42 + (j / gridRows) * 0.3, 1, 0.6);
        gridColors[gIdx * 3] = color.r;
        gridColors[gIdx * 3 + 1] = color.g;
        gridColors[gIdx * 3 + 2] = color.b;

        gIdx++;
      }
    }

    gridGeo.setAttribute('position', new THREE.BufferAttribute(gridPos, 3));
    gridGeo.setAttribute('color', new THREE.BufferAttribute(gridColors, 3));

    const gridMat = new THREE.PointsMaterial({
      size: 0.3,
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false,
    });

    const gridMesh = new THREE.Points(gridGeo, gridMat);
    gridMesh.rotation.x = 1.25;
    gridMesh.position.set(0, -SECTION_SPACING * 2 - 4, -4);
    scene.add(gridMesh);

    // --- 5. SECTION 4: ORBITAL FOCUS ---
    const bhGroup = new THREE.Group();

    const voidGeo = new THREE.SphereGeometry(3.2, 32, 32);
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x010103 });
    const voidMesh = new THREE.Mesh(voidGeo, voidMat);
    bhGroup.add(voidMesh);

    const bhCount = 6000;
    const bhGeo = new THREE.BufferGeometry();
    const bhPos = new Float32Array(bhCount * 3);
    const bhColors = new Float32Array(bhCount * 3);

    for (let i = 0; i < bhCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rVal = 3.6 + Math.pow(Math.random(), 1.5) * 8.5;
      const x = Math.cos(angle) * rVal;
      const y = (Math.random() - 0.5) * 0.4;
      const z = Math.sin(angle) * rVal;

      bhPos[i * 3] = x;
      bhPos[i * 3 + 1] = y;
      bhPos[i * 3 + 2] = z;

      const color = new THREE.Color();
      color.setHSL(0.5 + (rVal / 12) * 0.4, 1, 0.65);
      bhColors[i * 3] = color.r;
      bhColors[i * 3 + 1] = color.g;
      bhColors[i * 3 + 2] = color.b;
    }

    bhGeo.setAttribute('position', new THREE.BufferAttribute(bhPos, 3));
    bhGeo.setAttribute('color', new THREE.BufferAttribute(bhColors, 3));

    const bhMat = new THREE.PointsMaterial({
      size: 0.35,
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false,
    });

    const bhParticles = new THREE.Points(bhGeo, bhMat);
    bhGroup.add(bhParticles);
    bhGroup.rotation.x = Math.PI * 0.25;
    bhGroup.position.set(0, -SECTION_SPACING * 3, -8);
    scene.add(bhGroup);

    // --- 6. PERFECT SCROLL LERP ENGINE ---
    let targetCamY = 0;
    let currentCamY = 0;

    const handleScroll = () => {
      const vh = window.innerHeight || 1;
      const scrollY = window.scrollY;
      const sectionProgress = scrollY / vh;
      targetCamY = -sectionProgress * SECTION_SPACING;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // --- 7. ANIMATION RENDER LOOP ---
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      const time = clock.getElapsedTime();

      currentCamY += (targetCamY - currentCamY) * 0.08;
      camera.position.y = currentCamY;

      globeGroup.rotation.y = time * 0.18;
      globeGroup.rotation.x = Math.sin(time * 0.1) * 0.08;

      helixMesh.rotation.y = time * 0.45;

      const gPos = gridGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < gridCount; i++) {
        const x = gPos[i * 3];
        const z = gPos[i * 3 + 2];
        gPos[i * 3 + 1] = Math.sin(time * 2.0 + x * 0.4) * 0.7 + Math.cos(time * 1.6 + z * 0.4) * 0.7;
      }
      gridGeo.attributes.position.needsUpdate = true;

      bhParticles.rotation.y = time * 0.35;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      handleScroll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative bg-[#030308] text-white font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden min-h-screen">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0 w-full h-full overflow-hidden" />

      {/* Humanified Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-4">
        <nav className="flex items-center justify-between px-6 py-3.5 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_#00f0ff]" />
            <span className="text-sm font-semibold tracking-wide text-white group-hover:text-cyan-300 transition-colors">
              GroundTruth
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-8 text-xs font-medium text-neutral-300">
            <a href="#overview" className="hover:text-cyan-300 transition-colors">Overview</a>
            <a href="#problem-solution" className="hover:text-cyan-300 transition-colors">Problem &amp; Solution</a>
            <a href="#sdg-pillars" className="hover:text-cyan-300 transition-colors">SDG Pillars</a>
            <Link href="/dashboard" className="hover:text-cyan-300 transition-colors">Dashboard</Link>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="text-xs font-medium px-4 py-2 text-neutral-300 hover:text-white transition-colors"
            >
              Sign in
            </button>
            <Link 
              href="/dashboard"
              className="text-xs font-semibold px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-black hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]"
            >
              Launch Dashboard
            </Link>
          </div>
        </nav>
      </header>

      {/* OVERLAY CONTENT SECTIONS WITH FRAMER MOTION SCROLL ANIMATIONS */}
      <main className="relative z-10 w-full">
        {/* SECTION 1: HERO OVERVIEW */}
        <section id="overview" className="min-h-screen flex flex-col items-start justify-center text-left px-8 md:px-24 max-w-7xl mx-auto w-full pt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-xs font-medium text-cyan-300 mb-6 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>🌍 Planet Earth, Tracked Daily</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extralight tracking-tight leading-[1.1] mb-6">
              See what satellites reveal about your district’s <br />
              <span className="font-normal bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-emerald-300">
                water, forests, and climate.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-300 leading-relaxed mb-10 font-light">
              GroundTruth turns complex satellite imagery into clear, plain-language stories so local leaders, NGOs, and citizens can protect their ecosystems.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link 
                href="/dashboard"
                className="w-full sm:w-auto text-center px-8 py-3.5 rounded-full bg-cyan-400 text-black font-semibold text-xs tracking-wide hover:bg-cyan-300 transition-all shadow-[0_0_30px_rgba(0,240,255,0.4)]"
              >
                Explore District Dashboard
              </Link>
              <Link 
                href="/district/kolhapur"
                className="w-full sm:w-auto text-center px-8 py-3.5 rounded-full bg-white/[0.06] border border-white/15 text-white font-medium text-xs tracking-wide hover:bg-white/10 transition-all backdrop-blur-md"
              >
                See Kolhapur in Action →
              </Link>
            </div>
          </motion.div>
        </section>

        {/* SECTION 2: PROBLEM VS SOLUTION */}
        <section id="problem-solution" className="min-h-screen max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between w-full py-24">
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-xl space-y-6 md:pr-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-400/20 text-xs font-medium text-purple-300 backdrop-blur-md">
              <span>💡 Making Space Data Simple</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-light leading-tight">
              Complex GIS maps shouldn't stand in the way of saving local ecosystems.
            </h2>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed font-light">
              Raw satellite feeds are packed with vital environmental signals, but they’re usually locked behind specialized tools. GroundTruth translates raw multispectral data into plain summaries anyone can act on instantly.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            className="space-y-6 w-full max-w-md z-20 mt-12 md:mt-0"
          >
            {/* The Problem Card */}
            <div className="p-7 rounded-3xl bg-[#080c16]/85 backdrop-blur-2xl border border-rose-500/30 shadow-2xl hover:border-rose-500/60 transition-all group">
              <div className="flex items-center gap-2.5 text-xs font-semibold tracking-wider text-rose-400 uppercase mb-3">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                The Old Way: Technical &amp; Heavy
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed font-light">
                Raw multispectral satellite bands and GIS files are difficult for non-technical administrators and local citizens to interpret.
              </p>
            </div>

            {/* The GroundTruth Solution Card */}
            <div className="p-7 rounded-3xl bg-[#080c16]/85 backdrop-blur-2xl border border-cyan-500/40 shadow-2xl hover:border-cyan-400 transition-all group">
              <div className="flex items-center gap-2.5 text-xs font-semibold tracking-wider text-cyan-300 uppercase mb-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                The GroundTruth Way: Clear &amp; Instant
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed font-light">
                We automatically convert satellite feeds into a simple 0–100 District Health Score with instant AI-generated insights.
              </p>
            </div>
          </motion.div>
        </section>

        {/* SECTION 3: THREE SDG PILLARS */}
        <section id="sdg-pillars" className="min-h-screen flex flex-col items-center justify-center px-6 max-w-7xl mx-auto w-full py-24">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center max-w-3xl mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-xs font-medium text-emerald-300 mb-6 backdrop-blur-md">
              <span>🌱 What We Track Every Day</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-light leading-tight mb-4">
              Three vital indicators keeping your community resilient.
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 font-light">
              Continuous orbital monitoring across water bodies, urban communities, and forest cover.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="p-7 rounded-3xl bg-[#080c16]/85 backdrop-blur-2xl border border-white/10 hover:border-cyan-400 transition-all group hover:-translate-y-1 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">SDG 6</span>
                <span className="text-xl">💧</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2 group-hover:text-cyan-300 transition-colors">
                Clean Water &amp; Reservoirs
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-light">
                Monitor surface water extent and catch reservoir shrinkage using high-precision NDWI satellite spectral indices.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="p-7 rounded-3xl bg-[#080c16]/85 backdrop-blur-2xl border border-white/10 hover:border-purple-400 transition-all group hover:-translate-y-1 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">SDG 11</span>
                <span className="text-xl">🏙️</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2 group-hover:text-purple-300 transition-colors">
                Green Spaces &amp; Heat Islands
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-light">
                Map concrete urban expansion, protect parks, and identify localized heat pockets before they escalate.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="p-7 rounded-3xl bg-[#080c16]/85 backdrop-blur-2xl border border-white/10 hover:border-emerald-400 transition-all group hover:-translate-y-1 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">SDG 15</span>
                <span className="text-xl">🌳</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2 group-hover:text-emerald-300 transition-colors">
                Healthy Forests &amp; Vegetation
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-light">
                Track canopy cover density, detect early forest degradation, and support community reforestation projects.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 4: CALL TO ACTION */}
        <section id="dashboard" className="min-h-screen flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto w-full py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-xs font-medium text-cyan-300 backdrop-blur-md">
              <span>🚀 Ready to Dive In?</span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-light leading-tight">
              Put real-time satellite intelligence <br /> to work for your district.
            </h2>

            <p className="max-w-2xl mx-auto text-sm sm:text-base text-neutral-300 leading-relaxed font-light">
              Skip complex GIS toolchains. Get instant satellite analytics and Gemini AI summaries in seconds.
            </p>

            <div>
              <Link 
                href="/dashboard"
                className="inline-block px-10 py-4 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-semibold text-xs tracking-wider uppercase hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-[0_0_35px_rgba(0,240,255,0.5)]"
              >
                Open District Dashboard
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 px-6 text-center text-xs text-neutral-400 bg-black/90 backdrop-blur-md">
        <p>© 2026 GroundTruth. Powered by Google Earth Engine &amp; Gemini 2.0 Flash.</p>
      </footer>

      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={() => {}}
        />
      )}
    </div>
  );
}