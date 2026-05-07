import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";

const WATER_MODEL = `${import.meta.env.BASE_URL}models/water.glb`;

// Shared hex geometry
const HEX_RADIUS = HEX_SIZE * 0.92;
let _hexGeo = null;
function getHexGeometry() {
  if (!_hexGeo) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = HEX_RADIUS * Math.cos(angle);
      const y = HEX_RADIUS * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    _hexGeo = new THREE.ShapeGeometry(shape, 48);
  }
  return _hexGeo;
}

export default function WaterTile({ regionY = 0 }) {
  const { scene } = useGLTF(WATER_MODEL);

  const material = useMemo(() => {
    // Find the material from the GLB model
    let found = null;
    scene.traverse((child) => {
      if (child.isMesh && child.material && !found) {
        found = child.material.clone();
      }
    });
    if (found) return found;
    // Fallback dark water
    return new THREE.MeshStandardMaterial({
      color: "#0a1628",
      roughness: 0.2,
      metalness: 0.1,
    });
  }, [scene]);

  const geo = useMemo(() => getHexGeometry(), []);

  return (
    <mesh
      geometry={geo}
      material={material}
      position={[0, regionY + 0.03, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  );
}
