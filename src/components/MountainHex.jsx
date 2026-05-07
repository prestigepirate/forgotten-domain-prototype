import { useMemo, useRef, useEffect, memo } from "react";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";

// ── Noise helpers ────────────────────────────────────────────
function hash(x, y, seed) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) / 2147483647 + 0.5;
}

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy, seed);
  const n10 = hash(ix + 1, iy, seed);
  const n01 = hash(ix, iy + 1, seed);
  const n11 = hash(ix + 1, iy + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbm(x, y, seed, octaves = 5) {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * smoothNoise(x * freq, y * freq, seed + i * 17);
    max += amp;
    freq *= 2.2;
    amp *= 0.55;
  }
  return v / max;
}

// ── Is point inside flat-top hex? ────────────────────────────
function insideHex(px, pz, radius) {
  const absPx = Math.abs(px);
  const absPz = Math.abs(pz);
  if (absPx > radius) return false;
  if (absPz > radius * 0.866) return false;
  const edgeZ = (radius - absPx * 0.5) * 0.8660254;
  return absPz <= edgeZ;
}

// ── Build mountain geometry ──────────────────────────────────
function createMountainGeometry(radius, height, seed) {
  const GRID = 32; // med-poly: 32x32 grid
  const cellSize = (radius * 2) / GRID;
  const halfGrid = GRID / 2;

  // Peak position: offset from center for organic feel
  const peakOffsetX = (hash(seed, 1, 99) - 0.5) * radius * 0.55;
  const peakOffsetZ = (hash(seed, 2, 99) - 0.5) * radius * 0.55;

  // Secondary peak (smaller but still imposing)
  const peak2X = (hash(seed, 3, 99) - 0.5) * radius * 0.8;
  const peak2Z = (hash(seed, 4, 99) - 0.5) * radius * 0.6;
  const peak2Strength = height * 0.7;

  // ── Gather grid points ──────────────────────────────────
  const points = [];
  const idxMap = new Map();

  for (let ix = 0; ix <= GRID; ix++) {
    for (let iz = 0; iz <= GRID; iz++) {
      const x = (ix - halfGrid) * cellSize;
      const z = (iz - halfGrid) * cellSize;
      const inside = insideHex(x, z, radius * 0.98);
      const key = `${ix},${iz}`;
      idxMap.set(key, points.length);
      points.push({ x, z, ix, iz, inside });
    }
  }

  // ── Compute heights ─────────────────────────────────────
  for (const p of points) {
    if (!p.inside) {
      p.y = 0;
      continue;
    }

    // Distance from main peak
    const dx = p.x - peakOffsetX;
    const dz = p.z - peakOffsetZ;
    const dist1 = Math.sqrt(dx * dx + dz * dz);

    // Distance from secondary peak
    const dx2 = p.x - peak2X;
    const dz2 = p.z - peak2Z;
    const dist2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);

    // Radial mountain shape: peaks at 0, falls to 0 at edges
    const maxDist = radius * 1.1;
    const radial1 = Math.max(0, 1 - dist1 / maxDist);
    const radial2 = Math.max(0, 1 - dist2 / maxDist);

    // Blend: main peak + secondary (steeper for sharper, scarier peaks)
    const radialFactor = Math.pow(radial1, 2.0) * height + Math.pow(radial2, 2.2) * peak2Strength;

    // Distance from hex edge (fade to 0 at boundary)
    const edgeDist = radius - Math.sqrt(p.x * p.x + p.z * p.z);
    const edgeFade = THREE.MathUtils.smoothstep(Math.abs(edgeDist), 0, 0.08);

    // FBM noise for rocky texture
    const noise = fbm(p.x * 2.8, p.z * 2.8, seed, 4);
    const ridgeNoise = Math.abs(fbm(p.x * 4.5 + 2.3, p.z * 4.5 + 1.7, seed + 21, 3)) * 0.5;

    // Combine: radial shape + noise displacement + ridge detail
    const rockyFactor = 0.7 + noise * 0.3 + ridgeNoise * 0.25;
    p.y = radialFactor * rockyFactor * edgeFade;

    // Ensure minimum height for mountain feel
    if (p.y < 0.03 && edgeDist > 0.1) p.y = 0.03;
  }

  // ── Build vertices and triangles ─────────────────────────
  const verts = [];
  const normals = [];
  const vertMap = new Map();

  // Add top surface vertices
  for (const p of points) {
    if (!p.inside) continue;
    const key = `${p.ix},${p.iz}`;
    vertMap.set(key, verts.length / 3);
    verts.push(p.x, p.y, p.z);
    normals.push(0, 1, 0); // placeholder, computed after
  }

  const triIndices = [];
  // Triangulate grid cells
  for (let ix = 0; ix < GRID; ix++) {
    for (let iz = 0; iz < GRID; iz++) {
      const a = vertMap.get(`${ix},${iz}`);
      const b = vertMap.get(`${ix + 1},${iz}`);
      const c = vertMap.get(`${ix + 1},${iz + 1}`);
      const d = vertMap.get(`${ix},${iz + 1}`);
      if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
        triIndices.push(a, b, c);
        triIndices.push(a, c, d);
      }
    }
  }

  // ── Build side walls ────────────────────────────────────
  const topVertCount = verts.length / 3;

  // Find boundary: interior verts adjacent to exterior
  const boundaryVerts = [];
  for (const p of points) {
    if (!p.inside) continue;
    const k = `${p.ix},${p.iz}`;
    const vi = vertMap.get(k);
    if (vi === undefined) continue;

    // Check 4 neighbors
    const neighbors = [
      `${p.ix - 1},${p.iz}`,
      `${p.ix + 1},${p.iz}`,
      `${p.ix},${p.iz - 1}`,
      `${p.ix},${p.iz + 1}`,
    ];
    const onBoundary = neighbors.some(nk => {
      const n = idxMap.get(nk);
      return n !== undefined && !points[n].inside;
    });

    if (onBoundary) {
      boundaryVerts.push({ vi, x: p.x, z: p.z, y: p.y });
    }
  }

  // Sort boundary vertices by angle around center
  boundaryVerts.sort((a, b) => {
    const angleA = Math.atan2(a.z, a.x);
    const angleB = Math.atan2(b.z, b.x);
    return angleA - angleB;
  });

  // Build wall quads (two triangles each)
  const baseY = 0;
  for (let i = 0; i < boundaryVerts.length; i++) {
    const curr = boundaryVerts[i];
    const next = boundaryVerts[(i + 1) % boundaryVerts.length];

    const vTopA = curr.vi;
    const vTopB = next.vi;
    const vBotA = verts.length / 3;
    verts.push(curr.x, baseY, curr.z);
    normals.push(0, 0, -1); // placeholder
    const vBotB = verts.length / 3;
    verts.push(next.x, baseY, next.z);
    normals.push(0, 0, -1);

    triIndices.push(vTopA, vBotA, vBotB);
    triIndices.push(vTopA, vBotB, vTopB);
  }

  // ── Compute normals ─────────────────────────────────────
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(triIndices);
  geo.computeVertexNormals();

  return geo;
}

// ── Mountain colors by terrain type ──────────────────────────
function getMountainColors(terrain) {
  switch (terrain) {
    case "volcanic":
      return { body: "#33221a", peak: "#554433", accent: "#772211" };
    case "mountain":
    default:
      return { body: "#2a2828", peak: "#4a4545", accent: "#5a5252" };
  }
}

const MountainHex = memo(function MountainHex({ region, position, nyxMode }) {
  const radius = HEX_SIZE * 0.92;
  const mHeight = Math.max(region.height * 1.8, 1.6); // big mountains, minimum 1.6
  const seed = region.q * 1000 + region.r;

  const geo = useMemo(
    () => createMountainGeometry(radius, mHeight, seed),
    [radius, mHeight, seed]
  );

  const meshRef = useRef();

  // ── Create vertex colors for rocky shading ──────────────────
  const colors = useMemo(() => {
    const cols = getMountainColors(region.terrain);
    const pos = geo.attributes.position;
    const colorArr = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(nyxMode ? "#0e0e18" : cols.body);
    const c2 = new THREE.Color(nyxMode ? "#1a1a2a" : cols.peak);
    const c3 = new THREE.Color(nyxMode ? "#11111c" : cols.accent);

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const ratio = y / mHeight;

      let color;
      if (ratio > 0.7) {
        // Peak: lighter rock
        color = c2.clone().lerp(new THREE.Color("#888888"), (ratio - 0.7) / 0.3 * 0.3);
      } else if (ratio < 0.2) {
        // Base: darker
        color = c3;
      } else {
        // Mid: rocky body
        const t = (ratio - 0.2) / 0.5;
        color = c3.clone().lerp(c2, t);
      }

      // Add subtle noise variation
      const r = color.r + (Math.random() - 0.5) * 0.04;
      const g = color.g + (Math.random() - 0.5) * 0.04;
      const b = color.b + (Math.random() - 0.5) * 0.04;
      colorArr[i * 3] = Math.max(0, Math.min(1, r));
      colorArr[i * 3 + 1] = Math.max(0, Math.min(1, g));
      colorArr[i * 3 + 2] = Math.max(0, Math.min(1, b));
    }

    return new THREE.BufferAttribute(colorArr, 3);
  }, [geo, region.terrain, mHeight, nyxMode]);

  // Apply colors after mount
  useEffect(() => {
    if (meshRef.current && !meshRef.current.geometry.attributes.color) {
      meshRef.current.geometry.setAttribute("color", colors);
      meshRef.current.material.vertexColors = true;
    }
  }, [colors]);

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geo}>
        <meshStandardMaterial
          color={nyxMode ? "#141420" : "#2a2520"}
          roughness={0.75}
          metalness={0.08}
          flatShading={false}
        />
      </mesh>
      {/* Menacing rim glow at peaks */}
      <mesh geometry={geo} scale={[1.01, 1.01, 1.01]}>
        <meshBasicMaterial
          color={nyxMode ? "#221144" : "#443322"}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          depthTest
        />
      </mesh>
    </group>
  );
});

export default MountainHex;
