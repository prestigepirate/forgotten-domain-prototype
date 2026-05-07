import { useRef, useMemo, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";
import { getTerrainTextures } from "../data/terrainTextures";

// ── Seedable hash (same algo as terrainTextures.js) ──────────
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

function fbm(x, y, seed, octaves = 4) {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * smoothNoise(x * freq, y * freq, seed + i);
    max += amp;
    freq *= 2.3;
    amp *= 0.5;
  }
  return v / max;
}

// ── Is point inside flat-top hex? ────────────────────────────
function insideHex(px, pz, radius) {
  const absPx = Math.abs(px);
  const absPz = Math.abs(pz);
  // Flat-top hex: half-plane test for the two angled edges
  if (absPx > radius) return false;
  if (absPz > radius * 0.866) return false;
  // Diagonal edge: |z| < sqrt(3)/2 * (radius - |x|/2) — simplified
  const edgeZ = (radius - absPx * 0.5) * 0.8660254;
  return absPz <= edgeZ;
}

// ── Build rocky hex geometry ──────────────────────────────────
function createRockyHexGeometry(radius, height, seed, nyxMode) {
  const GRID = 28; // subdivisions — higher = more detail
  const cellSize = (radius * 2) / GRID;
  const halfGrid = GRID / 2;

  // ── Pass 1: gather grid points inside the hex ───────────────
  const points = []; // { x, z, ix, iz, inside, boundaryDist }
  const idxMap = new Map(); // "ix,iz" → array index

  for (let ix = 0; ix <= GRID; ix++) {
    for (let iz = 0; iz <= GRID; iz++) {
      const x = (ix - halfGrid) * cellSize;
      const z = (iz - halfGrid) * cellSize;
      const inside = insideHex(x, z, radius * 0.96); // slight inset
      const boundaryDist = radius - Math.sqrt(x * x + z * z);
      const key = `${ix},${iz}`;
      idxMap.set(key, points.length);
      points.push({ x, z, ix, iz, inside, boundaryDist });
    }
  }

  // ── Pass 2: compute displacement for interior points ────────
  const dispScale = nyxMode ? 0.22 : 0.28;
  for (const p of points) {
    if (!p.inside) {
      p.displaced = false;
      p.y = 0;
      continue;
    }
    const n = fbm(p.x * 2.5, p.z * 2.5, seed, 4);
    const n2 = fbm(p.x * 5 + 3, p.z * 5 + 1, seed + 10, 3);
    // Edge transition: displacement fades to zero at hex boundary
    const edgeFade = THREE.MathUtils.smoothstep(Math.abs(p.boundaryDist), 0, 0.15);
    const disp = (n * 0.6 + n2 * 0.4) * dispScale * edgeFade;
    p.y = disp;
    p.displaced = true;

    // Cracks: thin lines where noise crosses a threshold
    p.crack = n2 > 0.62 && n2 < 0.66 && p.boundaryDist > 0.1;
  }

  // ── Pass 3: build triangles (top surface) ───────────────────
  const verts = [];
  const uvs = [];
  const triIndices = [];
  const vertMap = new Map(); // "ix,iz" → vertex index (only for interior points)

  // Add top surface vertices
  for (const p of points) {
    if (!p.inside) continue;
    const key = `${p.ix},${p.iz}`;
    let y = p.y;
    if (p.crack) y += 0.03; // raise cracks slightly
    vertMap.set(key, verts.length / 3);
    verts.push(p.x, p.y || 0, p.z);
    // UV: map from hex space to 0-1
    uvs.push((p.x / radius) * 0.5 + 0.5, (p.z / radius) * 0.5 + 0.5);
  }

  // Triangulate: for each grid cell, create 2 triangles if all 4 corners are interior
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

  // ── Pass 4: build side walls ────────────────────────────────
  // Find boundary vertices (those on the edge of the interior)
  const topVertCount = verts.length / 3;
  const boundaryVerts = []; // ordered around perimeter

  // Walk the perimeter by finding interior vertices adjacent to exterior ones
  // For each interior vertex, check if any neighbor is exterior → it's a boundary vertex
  const boundarySet = new Set();
  for (const p of points) {
    if (!p.inside) continue;
    const key = `${p.ix},${p.iz}`;
    const vi = vertMap.get(key);
    if (vi === undefined) continue;
    // Check 4 neighbors
    const neighbors = [
      `${p.ix - 1},${p.iz}`,
      `${p.ix + 1},${p.iz}`,
      `${p.ix},${p.iz - 1}`,
      `${p.ix},${p.iz + 1}`,
    ];
    for (const nk of neighbors) {
      const np = idxMap.get(nk);
      if (np !== undefined && !points[np].inside) {
        boundarySet.add(vi);
        break;
      }
    }
  }

  // Build side quads by walking the perimeter
  // Sort boundary vertices by angle around center
  const boundaryArr = Array.from(boundarySet).map((vi) => {
    const x = verts[vi * 3];
    const z = verts[vi * 3 + 2];
    const angle = Math.atan2(z, x);
    return { vi, angle, x, z };
  });
  boundaryArr.sort((a, b) => a.angle - b.angle);

  // Build quads: top boundary → bottom boundary
  const floorY = -height;
  for (let i = 0; i < boundaryArr.length; i++) {
    const curr = boundaryArr[i];
    const next = boundaryArr[(i + 1) % boundaryArr.length];

    const t0 = verts.length / 3;
    const t1 = t0 + 1;
    const b0 = t0 + 2;
    const b1 = t0 + 3;

    // Top edge vertices
    verts.push(curr.x, verts[curr.vi * 3 + 1], curr.z);
    verts.push(next.x, verts[next.vi * 3 + 1], next.z);
    // Bottom edge vertices (flat floor)
    const bx = (curr.x + next.x) / 2;
    const bz = (curr.z + next.z) / 2;
    // Use actual hex boundary for bottom
    const angle = Math.atan2(curr.z, curr.x);
    const floorR = radius * 0.94;
    verts.push(Math.cos(angle) * floorR, floorY, Math.sin(angle) * floorR);
    // Next bottom
    const nextAngle = Math.atan2(next.z, next.x);
    verts.push(Math.cos(nextAngle) * floorR, floorY, Math.sin(nextAngle) * floorR);

    // UVs for side
    uvs.push(i / boundaryArr.length, 1); // top-left
    uvs.push((i + 1) / boundaryArr.length, 1); // top-right
    uvs.push(i / boundaryArr.length, 0); // bottom-left
    uvs.push((i + 1) / boundaryArr.length, 0); // bottom-right

    // Two triangles for quad
    triIndices.push(t0, b0, t1);
    triIndices.push(t1, b0, b1);
  }

  // ── Build final BufferGeometry ───────────────────────────────
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(triIndices);
  geo.computeVertexNormals();

  return geo;
}

// ═══════════════════════════════════════════════════════════════
// RockyHex Component
// ═══════════════════════════════════════════════════════════════

const RockyHex = memo(function RockyHex({
  region,
  position,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onUnhover,
  nyxMode = true,
}) {
  const meshRef = useRef();
  const _scaleVec = useRef(new THREE.Vector3());
  const hoveredRef = useRef(false);
  const active = isHovered || hoveredRef.current;

  const radius = HEX_SIZE * 0.9;

  // Generate geometry — seeded per region for unique shape
  const geo = useMemo(() => {
    const seed = region.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return createRockyHexGeometry(radius, region.height, seed, nyxMode);
  }, [region.id, region.height, radius, nyxMode]);

  // Terrain textures
  const textures = useMemo(() => {
    const terrain = nyxMode ? "nyx0" : region.terrain;
    const src = getTerrainTextures(terrain);
    if (!src) return null;
    const albedo = src.albedo.clone();
    albedo.needsUpdate = true;
    albedo.repeat.set(2, 2);

    const normal = src.normal.clone();
    normal.needsUpdate = true;
    normal.repeat.set(2, 2);

    const roughness = src.roughness.clone();
    roughness.needsUpdate = true;
    roughness.repeat.set(2, 2);

    return { albedo, normal, roughness };
  }, [region.terrain, nyxMode]);

  // Dispose cloned textures on cleanup
  useEffect(() => {
    return () => {
      if (textures) {
        textures.albedo?.dispose();
        textures.normal?.dispose();
        textures.roughness?.dispose();
      }
    };
  }, [textures]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = active ? 1.02 : 1;
      meshRef.current.scale.lerp(
        _scaleVec.current.set(targetScale, targetScale, targetScale),
        delta * 6
      );
    }
  });

  const bodyTint = nyxMode ? "#1e1e32" : "#666666";

  return (
    <group position={position}>
      {/* Invisible hover catcher — flat hex above the rock */}
      <mesh
        position={[0, region.height / 2 + 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          hoveredRef.current = true;
          onHover(region.id);
        }}
        onPointerOut={() => {
          hoveredRef.current = false;
          onUnhover();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(region.id);
        }}
      >
        <shapeGeometry args={[hexShape(radius * 1.02)]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Rocky hex body */}
      <mesh ref={meshRef} geometry={geo}>
        <meshStandardMaterial
          map={textures?.albedo}
          normalMap={textures?.normal}
          roughnessMap={textures?.roughness}
          color={bodyTint}
          roughness={nyxMode ? 0.35 : 0.7}
          metalness={nyxMode ? 0.12 : 0.04}
          emissive={bodyTint}
          emissiveIntensity={nyxMode ? 0.16 : 0.08}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh
          position={[0, region.height + 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <shapeGeometry args={[hexShape(radius * 0.92)]} />
          <meshBasicMaterial color="#ffd700" side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
});

export default RockyHex;

// Helper: flat-top hex shape (same as HexRegion.jsx)
function hexShape(size) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}
