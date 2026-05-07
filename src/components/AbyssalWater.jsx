import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";

// ── Hex shape ───────────────────────────────────────────────
function makeHexShape(radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}
const HEX_RADIUS = HEX_SIZE * 0.89;
const hexShape = makeHexShape(HEX_RADIUS);

// ── Procedural water normal map (Canvas 2D) ─────────────────
function createWaterNormalMap(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Neutral base: RGB(128,128,255) = flat surface normal pointing up
  ctx.fillStyle = "rgb(128, 128, 255)";
  ctx.fillRect(0, 0, size, size);

  // Layer 1: many small ripples
  for (let i = 0; i < 200; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 5 + Math.random() * 25;
    const angle = Math.random() * Math.PI * 2;
    const strength = 0.4 + Math.random() * 0.6;

    // Perturb R and G channels (B stays ~255 for "up" direction)
    const rVal = 128 + Math.cos(angle) * 80 * strength;
    const gVal = 128 + Math.sin(angle) * 80 * strength;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${Math.floor(rVal)},${Math.floor(gVal)},255,0.6)`);
    grad.addColorStop(0.7, `rgba(${Math.floor(rVal)},${Math.floor(gVal)},255,0.2)`);
    grad.addColorStop(1, "rgba(128,128,255,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Layer 2: larger swells
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 40 + Math.random() * 80;
    const angle = Math.random() * Math.PI * 2;
    const strength = 0.3 + Math.random() * 0.5;

    const rVal = 128 + Math.cos(angle) * 60 * strength;
    const gVal = 128 + Math.sin(angle) * 60 * strength;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    grad.addColorStop(0, `rgba(${Math.floor(rVal)},${Math.floor(gVal)},255,0.35)`);
    grad.addColorStop(0.6, `rgba(${Math.floor(rVal)},${Math.floor(gVal)},255,0.15)`);
    grad.addColorStop(1, "rgba(128,128,255,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

// ── Shared caches ───────────────────────────────────────────
let _geoCache = null;
function getWaterGeometry() {
  if (!_geoCache) {
    _geoCache = new THREE.ShapeGeometry(hexShape, 72);
  }
  return _geoCache;
}

let _normalMapCache = null;
function getWaterNormalMap() {
  if (!_normalMapCache) {
    const canvas = createWaterNormalMap(512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.repeat.set(2.5, 2.5);
    tex.needsUpdate = true;
    _normalMapCache = tex;
  }
  return _normalMapCache;
}

// Second normal map (different scale, for multi-layer wave effect)
let _normalMap2Cache = null;
function getWaterNormalMap2() {
  if (!_normalMap2Cache) {
    const canvas2 = document.createElement("canvas");
    canvas2.width = 512;
    canvas2.height = 512;
    const ctx2 = canvas2.getContext("2d");

    // Fill neutral
    ctx2.fillStyle = "rgb(128, 128, 255)";
    ctx2.fillRect(0, 0, 512, 512);

    // Larger, slower swell patterns
    for (let i = 0; i < 25; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const r = 120 + Math.random() * 280;
      const angle = Math.random() * Math.PI * 2;
      const strength = 0.4 + Math.random() * 0.6;

      const rVal = 128 + Math.cos(angle) * 50 * strength;
      const gVal = 128 + Math.sin(angle) * 50 * strength;

      const grad = ctx2.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
      grad.addColorStop(0, `rgba(${Math.floor(rVal)},${Math.floor(gVal)},255,0.3)`);
      grad.addColorStop(0.6, `rgba(${Math.floor(rVal)},${Math.floor(gVal)},255,0.1)`);
      grad.addColorStop(1, "rgba(128,128,255,0)");
      ctx2.fillStyle = grad;
      ctx2.beginPath();
      ctx2.arc(cx, cy, r, 0, Math.PI * 2);
      ctx2.fill();
    }
    const tex = new THREE.CanvasTexture(canvas2);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.repeat.set(1.5, 1.5);
    tex.needsUpdate = true;
    _normalMap2Cache = tex;
  }
  return _normalMap2Cache;
}

// ── Component ───────────────────────────────────────────────
export default function AbyssalWater({ regionY = 0, swampMode = false }) {
  const meshRef = useRef(null);
  const normalMapRef = useRef(null);
  const normalMap2Ref = useRef(null);

  // Get shared textures
  const normalMap = useMemo(() => getWaterNormalMap(), []);
  const normalMap2 = useMemo(() => getWaterNormalMap2(), []);

  // Store refs for animation
  useEffect(() => {
    normalMapRef.current = normalMap;
    normalMap2Ref.current = normalMap2;
  }, [normalMap, normalMap2]);

  // Animate normal map offsets — this creates the moving wave effect
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (normalMapRef.current) {
      normalMapRef.current.offset.x = t * 0.04;
      normalMapRef.current.offset.y = t * 0.03;
    }
    if (normalMap2Ref.current) {
      normalMap2Ref.current.offset.x = -t * 0.025;
      normalMap2Ref.current.offset.y = t * 0.035;
    }
  });

  // Water surface material — dark, shiny, with animated normals
  const waterMat = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: swampMode ? "#0a1a10" : "#061420",
      metalness: 0.05,
      roughness: 0.15,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(swampMode ? 0.7 : 1.2, swampMode ? 0.7 : 1.2),
      emissive: swampMode ? "#020804" : "#010810",
      emissiveIntensity: 0.3,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 0.15,
    });
  }, [swampMode, normalMap]);

  // Depth floor material
  const depthMat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: swampMode ? "#061008" : "#020610",
      transparent: true,
      opacity: 0.9,
    });
  }, [swampMode]);

  // Glowing rim material
  const rimMat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: swampMode ? "#1a3020" : "#153040",
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
  }, [swampMode]);

  const y = regionY + 0.04;

  return (
    <group>
      {/* Glowing rim ring */}
      <mesh
        position={[0, regionY + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[HEX_RADIUS - 0.1, HEX_RADIUS + 0.02, 48]} />
        <primitive object={rimMat} attach="material" />
      </mesh>

      {/* Depth floor */}
      <mesh
        position={[0, regionY - 0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={getWaterGeometry()}
      >
        <primitive object={depthMat} attach="material" />
      </mesh>

      {/* Water surface */}
      <mesh
        ref={meshRef}
        position={[0, y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={getWaterGeometry()}
        renderOrder={1}
      >
        <primitive object={waterMat} attach="material" />
      </mesh>
    </group>
  );
}
