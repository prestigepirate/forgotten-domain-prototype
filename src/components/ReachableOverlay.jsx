import { useMemo } from "react";
import * as THREE from "three";
import { getRegions, hexToWorld, HEX_SIZE } from "../data/regions";

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

const HEX_RADIUS = HEX_SIZE * 0.92;
const hexShape = makeHexShape(HEX_RADIUS);

export default function ReachableOverlay({ hexIds, regionHeight = 0, yOffset = 0.06 }) {
  const regions = getRegions();
  const idSet = hexIds instanceof Set ? hexIds : null;

  const geo = useMemo(() => {
    return new THREE.ShapeGeometry(hexShape, 48);
  }, []);

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#33aa44",
    transparent: true,
    opacity: 0.28,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  if (!idSet || idSet.size === 0) return null;

  return (
    <>
      {regions.map((r) => {
        if (!idSet.has(r.id)) return null;
        const [x, , z] = hexToWorld(r.q, r.r);
        return (
          <mesh
            key={`reach-${r.id}`}
            geometry={geo}
            material={mat}
            position={[x, r.height + yOffset, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        );
      })}
    </>
  );
}
