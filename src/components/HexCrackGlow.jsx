import { useMemo } from "react";
import * as THREE from "three";
import { getRegions, hexToWorld, HEX_SIZE } from "../data/regions";

// ── HexCrackGlow — emissive under-glow shining through hex cracks ──
export default function HexCrackGlow() {
  const geo = useMemo(() => {
    const regions = getRegions();
    if (!regions || regions.length === 0) return null;

    const radius = HEX_SIZE * 0.92; // slightly larger than hex top for edge glow
    const positions = [];

    for (const region of regions) {
      const [cx, , cz] = hexToWorld(region.q, region.r);
      const y = 0.03; // just above ground plane

      // 6 edges per hex
      const corners = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        corners.push([cx + radius * Math.cos(angle), cz + radius * Math.sin(angle)]);
      }
      for (let i = 0; i < 6; i++) {
        const [x0, z0] = corners[i];
        const [x1, z1] = corners[(i + 1) % 6];
        positions.push(x0, y, z0, x1, y, z1);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    return g;
  }, []);

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: "#4488bb",
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    depthWrite: false,
    linewidth: 1,
  }), []);

  if (!geo) return null;

  return <lineSegments geometry={geo} material={mat} />;
}
