import { useRef, useState, useMemo, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HEX_SIZE, TERRAIN_COLORS } from "../data/regions";
import { PLAYER_COLORS } from "../data/gameState";
import { getTerrainTextures } from "../data/terrainTextures";

// Create a flat-top hexagon shape
export function hexShape(size) {
  const shape = new THREE.Shape();
  const corners = 6;
  for (let i = 0; i < corners; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

const NYX_COLORS = {
  plains:   "#1a1a28",
  forest:   "#141422",
  mountain: "#181828",
  swamp:    "#161630",
  water:    "#101022",
  volcanic: "#1c1c30",
};

// Hex body wall tint — subtle color overlay on top of the texture
const BODY_TINTS = {
  plains:      "#887766",
  forest:      "#556644",
  mountain:    "#777788",
  swamp:       "#665566",
  water:       "#445566",
  volcanic:    "#664433",
  "high-ground":"#665544",
};

function MarkerPips({ p1Markers, p2Markers, height, nyxMode }) {
  const pipR = 0.075;
  const ringR = 0.42;
  const pipY = height + 0.12;
  const count = 5;
  const angleStep = (Math.PI * 2) / count;
  const startAngle = -Math.PI / 2;

  const pips = [];
  for (let i = 0; i < p1Markers; i++) pips.push(nyxMode ? "#88aacc" : PLAYER_COLORS["player-1"]);
  for (let i = 0; i < p2Markers; i++) pips.push(nyxMode ? "#ff6644" : PLAYER_COLORS["player-2"]);
  for (let i = pips.length; i < count; i++) pips.push(nyxMode ? "#333355" : PLAYER_COLORS.neutral);

  return (
    <group>
      {pips.map((color, i) => {
        const angle = startAngle + angleStep * i;
        return (
          <mesh key={i} position={[Math.cos(angle) * ringR, pipY, Math.sin(angle) * ringR]}>
            <sphereGeometry args={[pipR, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

const HexRegion = memo(function HexRegion({
  region,
  position,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onUnhover,
  ownerColor = null,
  p1Markers = 0,
  p2Markers = 0,
  nyxMode = false,
}) {
  const meshRef = useRef();
  const _scaleVec = useRef(new THREE.Vector3());
  const [hoveredLocal, setHoveredLocal] = useState(false);
  const shape = useMemo(() => hexShape(HEX_SIZE * 0.9), []);

  const terrainColor = nyxMode
    ? (NYX_COLORS[region.terrain] || "#161628")
    : TERRAIN_COLORS[region.terrain];
  const active = isHovered || hoveredLocal;

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = active ? 1.025 : 1;
      meshRef.current.scale.lerp(
        _scaleVec.current.set(targetScale, targetScale, targetScale),
        delta * 6
      );
    }
  });

  // ── Terrain textures for body walls ──────────────────────────
  const bodyTextures = useMemo(() => {
    const terrain = nyxMode ? "nyx0" : region.terrain;
    const src = getTerrainTextures(terrain);
    if (!src) return null;

    // Clone so each hex can have independent repeat settings
    const albedo = src.albedo.clone();
    albedo.needsUpdate = true;
    const vertRepeat = Math.max(1, region.height / 0.65);
    albedo.repeat.set(1.5, vertRepeat);

    const normal = src.normal.clone();
    normal.needsUpdate = true;
    normal.repeat.copy(albedo.repeat);

    const roughness = src.roughness.clone();
    roughness.needsUpdate = true;
    roughness.repeat.copy(albedo.repeat);

    return { albedo, normal, roughness };
  }, [region.terrain, region.height, nyxMode]);

  // Dispose cloned textures on cleanup
  useEffect(() => {
    return () => {
      if (bodyTextures) {
        bodyTextures.albedo?.dispose();
        bodyTextures.normal?.dispose();
        bodyTextures.roughness?.dispose();
      }
    };
  }, [bodyTextures]);

  const bodyTint = nyxMode ? "#1e1e32" : (BODY_TINTS[region.terrain] || "#666666");

  // ── Bevel quality scales with height for taller hexes ───────
  const bevelSize = 0.06 + region.height * 0.02;
  const bevelThickness = 0.06 + region.height * 0.02;
  const extrudeSettings = useMemo(() => ({
    steps: Math.max(2, Math.ceil(region.height * 3)),
    depth: region.height,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 6,
  }), [region.height, bevelSize, bevelThickness]);

  return (
    <group position={position}>
      {/* Invisible hover catcher */}
      <mesh
        position={[0, region.height / 2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => { e.stopPropagation(); setHoveredLocal(true); onHover(region.id); }}
        onPointerOut={() => { setHoveredLocal(false); onUnhover(); }}
        onClick={(e) => { e.stopPropagation(); onSelect(region.id); }}
      >
        <shapeGeometry args={[hexShape(HEX_SIZE * 0.95)]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Hex prism body — terrain-textured walls */}
      <mesh ref={meshRef} position={[0, region.height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial
          map={bodyTextures?.albedo}
          normalMap={bodyTextures?.normal}
          roughnessMap={bodyTextures?.roughness}
          color={bodyTint}
          roughness={nyxMode ? 0.35 : 0.7}
          metalness={nyxMode ? 0.12 : 0.04}
          emissive={bodyTint}
          emissiveIntensity={nyxMode ? 0.16 : 0.08}
        />
      </mesh>

      {/* Owner ring */}
      {ownerColor && (
        <mesh position={[0, region.height + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[hexShape(HEX_SIZE * 0.94)]} />
          <meshBasicMaterial color={ownerColor} side={THREE.BackSide} transparent opacity={0.35} />
        </mesh>
      )}

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, region.height + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[hexShape(HEX_SIZE * 0.92)]} />
          <meshBasicMaterial color="#ffd700" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Marker pips */}
      <MarkerPips p1Markers={p1Markers} p2Markers={p2Markers} height={region.height} nyxMode={nyxMode} />

      {/* Terrain icon marker */}
      <mesh position={[0, region.height + 0.2, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={terrainColor} />
      </mesh>
    </group>
  );
});

export default HexRegion;
