import { useMemo } from "react";
import * as THREE from "three";
import { getRegions, hexToWorld, HEX_SIZE } from "../data/regions";

function hexCorners(cx, cz, radius) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push([cx + radius * Math.cos(angle), cz + radius * Math.sin(angle)]);
  }
  return pts;
}

export default function HexGridLines({ color = "#334466", opacity = 0.35, yOffset = 0.01, filter = null }) {
  const geo = useMemo(() => {
    const regions = getRegions();
    if (!regions || regions.length === 0) return null;

    const radius = HEX_SIZE * 0.89;
    const positions = [];
    const filterSet = filter instanceof Set ? filter : null;

    for (const region of regions) {
      if (filterSet && !filterSet.has(region.id)) continue;
      const [cx, , cz] = hexToWorld(region.q, region.r);
      const y = region.height + yOffset;
      const corners = hexCorners(cx, cz, radius);

      for (let i = 0; i < 6; i++) {
        const [x0, z0] = corners[i];
        const [x1, z1] = corners[(i + 1) % 6];
        positions.push(x0, y, z0, x1, y, z1);
      }
    }

    if (positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    return g;
  }, [yOffset, filter]);

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false,
    linewidth: 1,
  }), [color, opacity]);

  if (!geo) return null;

  return <lineSegments geometry={geo} material={mat} />;
}
