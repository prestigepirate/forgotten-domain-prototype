import { useMemo, memo } from "react";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";
import { getTerrainTextures, getSharedDiffuse } from "../data/terrainTextures";

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

const TerrainSurface = memo(function TerrainSurface({ terrain, regionHeight, overrideTerrain = null }) {
  const effectiveTerrain = overrideTerrain || terrain;
  const procTextures = useMemo(() => getTerrainTextures(effectiveTerrain), [effectiveTerrain]);
  const sharedDiffuse = getSharedDiffuse();

  const y = regionHeight + 0.04;

  // Nyx-0 terrain uses higher emissive for Fracture glow
  const isNyx = effectiveTerrain === "nyx0";

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[hexShape, 48]} />
      <meshStandardMaterial
        map={procTextures?.albedo || sharedDiffuse}
        normalMap={procTextures?.normal}
        roughnessMap={procTextures?.roughness}
        roughness={isNyx ? 0.85 : 0.7}
        metalness={isNyx ? 0.02 : 0.05}
        emissive={isNyx ? "#112244" : undefined}
        emissiveIntensity={isNyx ? 0.22 : undefined}
      />
    </mesh>
  );
});

export default TerrainSurface;
