import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Dead Earth texture (procedural canvas) ──────────────────
function createDeadEarthTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  // Hash function
  const seed = 42;
  const hash = (x, y) => {
    let h = seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) / 2147483647 + 0.5);
  };

  // Deep void base
  ctx.fillStyle = "#080818";
  ctx.fillRect(0, 0, size, size);

  // Planet body — dark charcoal sphere
  const cx = size / 2, cy = size / 2, r = size * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;

      const n = hash(x, y);
      // Dark grey-brown dead surface
      const shade = 20 + n * 35;
      const rC = shade + n * 15;
      const gC = shade - 5 + n * 8;
      const bC = shade + n * 20;

      // Fracture glow — cyan/purple cracks
      const crackNoise = Math.abs(hash(Math.floor(x / 4), Math.floor(y / 4)) - 0.5) * 2;
      const isCrack = crackNoise > 0.85 && dist < r * 0.95;
      const crackGlow = isCrack ? 0.6 : 0;

      ctx.fillStyle = `rgb(${Math.min(255, rC + crackGlow * 80)},${Math.min(255, gC + crackGlow * 120)},${Math.min(255, bC + crackGlow * 200)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Atmosphere rim
  const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.08);
  rimGrad.addColorStop(0, "rgba(20,40,80,0)");
  rimGrad.addColorStop(0.5, "rgba(30,60,120,0.15)");
  rimGrad.addColorStop(1, "rgba(10,20,60,0)");
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Cache the texture
let _deadEarthTex = null;
function getDeadEarthTex() {
  if (!_deadEarthTex) _deadEarthTex = createDeadEarthTexture();
  return _deadEarthTex;
}

// ── Dead Earth planet ───────────────────────────────────────
function DeadEarth({ position, scale }) {
  const ref = useRef();
  const tex = useMemo(() => getDeadEarthTex(), []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.015;
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshStandardMaterial
        map={tex}
        roughness={0.9}
        metalness={0.0}
        emissive="#111133"
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

// ── Void sky dome ───────────────────────────────────────────
function VoidSky({ radius = 60 }) {
  const tex = useMemo(() => {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");

    // Deep navy-purple-black gradient
    const grad = ctx.createRadialGradient(size / 2, size / 3, 0, size / 2, size / 2, size * 0.7);
    grad.addColorStop(0, "#0a0a1e");
    grad.addColorStop(0.3, "#08081a");
    grad.addColorStop(0.6, "#060618");
    grad.addColorStop(0.85, "#040412");
    grad.addColorStop(1, "#020208");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle nebula wisps
    for (let i = 0; i < 40; i++) {
      const nx = Math.random() * size;
      const ny = Math.random() * size;
      const nr = 20 + Math.random() * 60;
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      const hue = Math.random() > 0.5 ? "60,60,180" : "80,30,120";
      ng.addColorStop(0, `rgba(${hue},0.06)`);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, size, size);
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, []);

  return (
    <mesh>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} />
    </mesh>
  );
}

// ── Floating debris / ruins ─────────────────────────────────
function FloatingDebris({ count = 15 }) {
  const debris = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      pos: [
        (Math.random() - 0.5) * 50,
        5 + Math.random() * 25,
        (Math.random() - 0.5) * 50,
      ],
      rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
      scale: 0.3 + Math.random() * 2.5,
      speed: 0.1 + Math.random() * 0.4,
      shape: Math.floor(Math.random() * 3), // 0=box, 1=pillar, 2=shard
    })), [count]
  );

  const boxGeo = useMemo(() => new THREE.BoxGeometry(0.6, 0.9, 0.4), []);
  const pillarGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.25, 2.0, 6), []);
  const shardGeo = useMemo(() => new THREE.ConeGeometry(0.3, 1.5, 4), []);

  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#151520",
    roughness: 0.85,
    metalness: 0.1,
    emissive: "#050510",
    emissiveIntensity: 0.1,
  }), []);

  return (
    <group>
      {debris.map((d, i) => {
        const geo = d.shape === 0 ? boxGeo : d.shape === 1 ? pillarGeo : shardGeo;
        return (
          <mesh
            key={i}
            position={d.pos}
            rotation={d.rot}
            scale={[d.scale, d.scale, d.scale]}
            geometry={geo}
            material={darkMat}
          />
        );
      })}
    </group>
  );
}

// ── Ash / ambient particles ─────────────────────────────────
function AshParticles({ count = 120 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 1] = Math.random() * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return arr;
  }, [count]);

  const speeds = useMemo(() =>
    Array.from({ length: count }, () => ({
      y: -0.02 - Math.random() * 0.08,
      x: (Math.random() - 0.5) * 0.03,
      z: (Math.random() - 0.5) * 0.03,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.2 + Math.random() * 0.5,
    })), [count]
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speeds[i].y * 0.016;
      pos[i * 3] += Math.sin(clock.elapsedTime * speeds[i].wobbleSpeed + speeds[i].wobble) * 0.004;
      pos[i * 3 + 2] += Math.cos(clock.elapsedTime * speeds[i].wobbleSpeed + speeds[i].wobble) * 0.004;

      // Loop particles
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 18 + Math.random() * 2;
        pos[i * 3] = (Math.random() - 0.5) * 40;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#5566aa"
        size={0.08}
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── NyxEnvironment — composes all Nyx-0 atmosphere ──────────
export default function NyxEnvironment() {
  return (
    <>
      {/* Void sky dome */}
      <VoidSky />

      {/* Dead Earth in the distance */}
      <DeadEarth position={[15, 22, -35]} scale={[8, 8, 8]} />

      {/* Floating ruins */}
      <FloatingDebris count={18} />

      {/* Atmospheric ash particles */}
      <AshParticles count={100} />

      {/* Dark teal-purple fog — depth without crushing visibility */}
      <fog attach="fog" args={["#0a0e1a", 5, 32]} />
    </>
  );
}
