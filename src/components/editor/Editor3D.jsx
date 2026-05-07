import React, { useRef, useCallback, useState, useEffect, Suspense, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF, Text } from "@react-three/drei";
import * as THREE from "three";
import { useEditorStore } from "../../stores/editorStore";
import { getMapObjects } from "../../data/mapObjects";
import { getActiveMapId, TERRAIN_COLORS, HEX_SIZE, getRegions, hexToWorld } from "../../data/regions";
import MountainHex from "../MountainHex";

const NUDGE = 0.1;
const ROTATE_STEP = Math.PI / 16;
const ELEVATE_STEP = 0.2;
const SCALE_STEP = 0.1;

// ── Visual meshes ──────────────────────────────────────────

function TowerMesh({ owner, ghost }) {
  const c = owner === "player-2" ? "#8b3030" : "#2a4478";
  const glow = owner === "player-2" ? "#cc4444" : "#4488dd";
  const op = ghost ? 0.35 : 1;
  return (
    <group>
      <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.28, 0.34, 0.44, 8]} /><meshStandardMaterial color="#1a1818" roughness={0.7} transparent opacity={op} /></mesh>
      <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.16, 0.24, 0.9, 8]} /><meshStandardMaterial color="#252322" roughness={0.6} transparent opacity={op} /></mesh>
      <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.21, 0.04, 8, 16]} /><meshStandardMaterial color="#3a3530" roughness={0.3} transparent opacity={op} /></mesh>
      <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.12, 0.18, 0.5, 8]} /><meshStandardMaterial color="#252322" roughness={0.6} transparent opacity={op} /></mesh>
      <mesh position={[0, 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.16, 0.035, 8, 16]} /><meshStandardMaterial color="#3a3530" roughness={0.3} transparent opacity={op} /></mesh>
      <mesh position={[0, 1.98, 0]}><coneGeometry args={[0.16, 0.36, 8]} /><meshStandardMaterial color={c} roughness={0.3} transparent opacity={op} /></mesh>
      {!ghost && (
        <>
          <mesh position={[0, 2.2, 0]}><sphereGeometry args={[0.07, 12, 12]} /><meshBasicMaterial color={glow} /></mesh>
          <pointLight position={[0, 2.2, 0]} color={glow} intensity={1} distance={5} />
        </>
      )}
    </group>
  );
}

function KingBaseMesh({ owner, ghost }) {
  const color = { "player-1": "#cc6633", "player-2": "#4488cc", gold: "#ccaa22", silver: "#aabbcc" }[owner] || "#888";
  const op = ghost ? 0.35 : 1;
  return (
    <group>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.5, 0.6, 0.6, 8]} /><meshStandardMaterial color="#1a1818" roughness={0.7} transparent opacity={op} /></mesh>
      <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.3, 0.45, 0.8, 8]} /><meshStandardMaterial color="#252322" roughness={0.6} transparent opacity={op} /></mesh>
      <mesh position={[0, 1.55, 0]}><cylinderGeometry args={[0.2, 0.3, 0.5, 8]} /><meshStandardMaterial color={color} roughness={0.3} transparent opacity={op} /></mesh>
      <mesh position={[0, 1.55, 0]}><sphereGeometry args={[0.12, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={op} /></mesh>
      {!ghost && <pointLight position={[0, 1.55, 0]} color={color} intensity={1.5} distance={8} />}
    </group>
  );
}

// ── Tower effects ──────────────────────────────────────────

function TowerGlow({ color, intensity, distance, yOffset }) {
  const lightRef = useRef();
  useFrame((state) => {
    if (lightRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.0) * 0.2;
      lightRef.current.intensity = intensity * pulse;
    }
  });
  return <pointLight ref={lightRef} position={[0, yOffset, 0]} color={color} intensity={intensity} distance={distance} />;
}

function TowerSmoke({ color, count, yBase, yRange, spread }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6,
      radius: spread * (0.15 + Math.random() * 0.85),
      speed: 0.25 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      size: 0.015 + Math.random() * 0.035,
    }));
  }, [count, spread]);

  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const child = groupRef.current.children[i];
      if (!child) continue;
      const cycle = (t * p.speed + p.phase) % (yRange * 2);
      const y = yBase + (cycle > yRange ? yRange * 2 - cycle : cycle);
      const alpha = 1 - cycle / yRange;
      child.position.set(
        Math.cos(p.angle) * p.radius,
        y,
        Math.sin(p.angle) * p.radius,
      );
      child.material.opacity = Math.max(0, alpha * 0.5);
      child.scale.setScalar(0.5 + alpha * 0.5);
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i}>
          <sphereGeometry args={[p.size, 4, 4]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Tower GLB models ───────────────────────────────────────

const GOLD_TOWER_URL = `${import.meta.env.BASE_URL}models/gold-tower.glb`;
function GoldTowerGLB(props) {
  const { scene } = useGLTF(GOLD_TOWER_URL);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <group {...props}>
      <primitive object={cloned} />
      <TowerGlow color="#ffaa22" intensity={2.0} distance={14} yOffset={2.5} />
      <TowerSmoke color="#cc9933" count={70} yBase={0.5} yRange={3.5} spread={1.8} />
    </group>
  );
}

const SILVER_TOWER_URL = `${import.meta.env.BASE_URL}models/silver-tower.glb`;
function SilverTowerGLB(props) {
  const { scene } = useGLTF(SILVER_TOWER_URL);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <group {...props}>
      <primitive object={cloned} />
      <TowerGlow color="#ff3333" intensity={2.0} distance={14} yOffset={2.5} />
      <TowerSmoke color="#cc4444" count={70} yBase={0.5} yRange={3.5} spread={1.8} />
    </group>
  );
}

const GOLD_MEDIUM_TOWER_URL = `${import.meta.env.BASE_URL}models/gold-medium-tower.glb`;
function GoldMediumTowerGLB(props) {
  const { scene } = useGLTF(GOLD_MEDIUM_TOWER_URL);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <group {...props}>
      <primitive object={cloned} />
      <TowerGlow color="#ffaa22" intensity={1.2} distance={8} yOffset={1.5} />
      <TowerSmoke color="#cc9933" count={40} yBase={0.3} yRange={2.5} spread={1.0} />
    </group>
  );
}

const SILVER_MEDIUM_TOWER_URL = `${import.meta.env.BASE_URL}models/silver-medium-tower.glb`;
function SilverMediumTowerGLB(props) {
  const { scene } = useGLTF(SILVER_MEDIUM_TOWER_URL);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <group {...props}>
      <primitive object={cloned} />
      <TowerGlow color="#ff3333" intensity={1.2} distance={8} yOffset={1.5} />
      <TowerSmoke color="#cc4444" count={40} yBase={0.3} yRange={2.5} spread={1.0} />
    </group>
  );
}

// Preload all tower models
useGLTF.preload(GOLD_TOWER_URL);
useGLTF.preload(SILVER_TOWER_URL);
useGLTF.preload(GOLD_MEDIUM_TOWER_URL);
useGLTF.preload(SILVER_MEDIUM_TOWER_URL);

function hexShape(size) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    if (i === 0) shape.moveTo(size * Math.cos(angle), size * Math.sin(angle));
    else shape.lineTo(size * Math.cos(angle), size * Math.sin(angle));
  }
  shape.closePath();
  return shape;
}

function HexMesh({ terrain, height, ghost }) {
  const shape = useMemo(() => hexShape(HEX_SIZE * 0.9), []);
  const tc = TERRAIN_COLORS[terrain] || "#888";
  const isHighGround = terrain === "high-ground";
  const op = ghost ? 0.35 : 1;
  const wallH = isHighGround ? Math.max(height, 1.2) : height;
  const ext = { steps: 1, depth: wallH, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06 };
  return (
    <group>
      {/* Side walls (dark) */}
      <mesh position={[0, wallH / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[shape, ext]} />
        <meshStandardMaterial color={isHighGround ? "#1a1008" : "#1a1818"} roughness={0.75} transparent opacity={op} />
      </mesh>
      {/* Top surface */}
      <mesh position={[0, wallH + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={tc} roughness={0.6} transparent opacity={op} />
      </mesh>
      {/* High ground rim/boundary */}
      {isHighGround && !ghost && (
        <mesh position={[0, wallH + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[HEX_SIZE * 0.85, HEX_SIZE * 0.92, 6]} />
          <meshBasicMaterial color="#886644" side={THREE.DoubleSide} transparent opacity={0.7} depthTest={false} />
        </mesh>
      )}
      <Text position={[0, wallH + 0.25, 0]} fontSize={0.18} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="#000000">{terrain === "high-ground" ? "HIGH" : terrain}</Text>
    </group>
  );
}

function AssetMesh({ assetId, scale, ghost }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/${assetId}.glb`);
  const s = scale ? scale[0] * 0.22 : 0.22;
  const clonedScene = useMemo(() => {
    const c = scene.clone();
    if (ghost) {
      c.traverse((child) => {
        if (child.isMesh?.material) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.35;
          child.material.depthWrite = false;
        }
      });
    }
    return c;
  }, [scene, ghost]);
  return <primitive object={clonedScene} scale={s} position={[0, 0.2, 0]} />;
}

function SummonCircleMesh({ owner, ghost }) {
  const color = { "player-1": "#4488ff", "player-2": "#ff5533", gold: "#ffd700", silver: "#aabbcc" }[owner] || "#8844cc";
  const op = ghost ? 0.25 : 0.4;
  const ringGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.6, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.45, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, steps: 1 });
  }, []);
  return (
    <group position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={ringGeo}>
        <meshBasicMaterial color={color} transparent opacity={op} side={THREE.DoubleSide} depthTest />
      </mesh>
    </group>
  );
}

// ── Placed Object ──────────────────────────────────────────

function PlacedObject({ obj, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const editMode = useEditorStore((st) => st.editMode);
  const tool = useEditorStore((st) => st.tool);
  const rotation = useMemo(() => obj.rotation ? new THREE.Euler(...obj.rotation) : undefined, [obj.rotation]);

  const handleClick = (e) => {
    if (!editMode) return;
    e.stopPropagation();
    onSelect(obj);
  };

  return (
    <group position={obj.position} scale={obj.scale || [1, 1, 1]} rotation={rotation}>
      <mesh position={[0, 1, 0]} onClick={handleClick} onPointerOver={(e) => { if (editMode) { e.stopPropagation(); setHovered(true); } }} onPointerOut={() => setHovered(false)}>
        <boxGeometry args={[1, 2, 1]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} />
      </mesh>

      {obj.type === "tower" && obj.owner === "player-1" && (
        <Suspense fallback={<TowerMesh owner="player-1" />}>
          <GoldMediumTowerGLB scale={[2.5, 2.5, 2.5]} position={[0, 0.1, 0]} />
        </Suspense>
      )}
      {obj.type === "tower" && obj.owner === "player-2" && (
        <Suspense fallback={<TowerMesh owner="player-2" />}>
          <SilverMediumTowerGLB scale={[2.5, 2.5, 2.5]} position={[0, 0.1, 0]} />
        </Suspense>
      )}
      {obj.type === "tower" && obj.owner !== "player-1" && obj.owner !== "player-2" && <TowerMesh owner={obj.owner} />}
      {obj.type === "king-base" && obj.owner === "gold" && (
        <Suspense fallback={<KingBaseMesh owner="gold" />}>
          <GoldTowerGLB scale={[3.5, 3.5, 3.5]} position={[0, 0.4, 0]} />
        </Suspense>
      )}
      {obj.type === "king-base" && obj.owner === "silver" && (
        <Suspense fallback={<KingBaseMesh owner="silver" />}>
          <SilverTowerGLB scale={[3.5, 3.5, 3.5]} position={[0, 0.4, 0]} />
        </Suspense>
      )}
      {obj.type === "king-base" && obj.owner !== "gold" && obj.owner !== "silver" && <KingBaseMesh owner={obj.owner || "player-1"} />}
      {obj.type === "hex" && (obj.terrain === "mountain" || obj.terrain === "volcanic") && (
        <MountainHex region={{ terrain: obj.terrain, height: Math.max(obj.height, 0.8), q: obj.q ?? 0, r: obj.r ?? 0 }} position={[0, 0, 0]} nyxMode />
      )}
      {obj.type === "hex" && obj.terrain !== "mountain" && obj.terrain !== "volcanic" && <HexMesh terrain={obj.terrain} height={obj.height} />}
      {obj.type === "summon-circle" && <SummonCircleMesh owner={obj.owner} />}
      {obj.type === "asset" && <Suspense fallback={null}><AssetMesh assetId={obj.assetId} scale={obj.scale} /></Suspense>}

      {(isSelected || hovered) && editMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.45, 0.52, 32]} />
          <meshBasicMaterial
            color={tool === "delete" ? "#ff3333" : isSelected ? "#ffd700" : "#ffffff"}
            side={THREE.DoubleSide} transparent
            opacity={tool === "delete" ? 0.8 : isSelected ? 0.9 : 0.4}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Preview Ghosts ─────────────────────────────────────────

function PreviewGhost({ obj, position }) {
  const rotation = useMemo(() => obj?.rotation ? new THREE.Euler(...obj.rotation) : undefined, [obj?.rotation]);
  if (!obj || !position) return null;
  return (
    <group position={position} scale={obj.scale || [1, 1, 1]} rotation={rotation}>
      {obj.type === "tower" && <TowerMesh owner={obj.owner} ghost />}
      {obj.type === "king-base" && <KingBaseMesh owner={obj.owner || "player-1"} ghost />}
      {obj.type === "hex" && (obj.terrain === "mountain" || obj.terrain === "volcanic") && (
        <group>
          <MountainHex region={{ terrain: obj.terrain, height: Math.max(obj.height, 0.8), q: obj.q ?? 0, r: obj.r ?? 0 }} position={[0, 0, 0]} nyxMode />
          <mesh position={[0, Math.max(obj.height, 0.8), 0]}>
            <boxGeometry args={[HEX_SIZE * 2, Math.max(obj.height, 0.8) * 2, HEX_SIZE * 2]} />
            <meshBasicMaterial color="#000" transparent opacity={0.65} depthWrite={false} />
          </mesh>
        </group>
      )}
      {obj.type === "hex" && obj.terrain !== "mountain" && obj.terrain !== "volcanic" && <HexMesh terrain={obj.terrain} height={obj.height} ghost />}
      {obj.type === "summon-circle" && <SummonCircleMesh owner={obj.owner} ghost />}
      {obj.type === "asset" && <Suspense fallback={null}><AssetMesh assetId={obj.assetId} scale={obj.scale} ghost /></Suspense>}
    </group>
  );
}

function BrushPreview({ position, brushDef }) {
  const rotation = useMemo(() => brushDef?.rotation ? new THREE.Euler(...brushDef.rotation) : undefined, [brushDef?.rotation]);
  if (!position || !brushDef) return null;
  return (
    <group position={position} scale={brushDef.scale || [1, 1, 1]} rotation={rotation}>
      {brushDef.type === "tower" && <TowerMesh owner={brushDef.owner} ghost />}
      {brushDef.type === "king-base" && <KingBaseMesh owner={brushDef.owner} ghost />}
      {brushDef.type === "hex" && (brushDef.terrain === "mountain" || brushDef.terrain === "volcanic") && (
        <group>
          <MountainHex region={{ terrain: brushDef.terrain, height: Math.max(brushDef.height, 0.8), q: 0, r: 0 }} position={[0, 0, 0]} nyxMode />
          <mesh position={[0, Math.max(brushDef.height, 0.8), 0]}>
            <boxGeometry args={[HEX_SIZE * 2, Math.max(brushDef.height, 0.8) * 2, HEX_SIZE * 2]} />
            <meshBasicMaterial color="#000" transparent opacity={0.65} depthWrite={false} />
          </mesh>
        </group>
      )}
      {brushDef.type === "hex" && brushDef.terrain !== "mountain" && brushDef.terrain !== "volcanic" && <HexMesh terrain={brushDef.terrain} height={brushDef.height} ghost />}
      {brushDef.type === "summon-circle" && <SummonCircleMesh owner={brushDef.owner} ghost />}
      {brushDef.type === "asset" && brushDef.assetId && <Suspense fallback={null}><AssetMesh assetId={brushDef.assetId} scale={brushDef.scale} ghost /></Suspense>}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.25, 0.32, 32]} />
        <meshBasicMaterial color="#00dd88" side={THREE.DoubleSide} transparent opacity={0.5} depthTest={false} />
      </mesh>
    </group>
  );
}

// ── Main Editor3D ──────────────────────────────────────────

export default function Editor3D() {
  const editMode = useEditorStore((st) => st.editMode);
  const tool = useEditorStore((st) => st.tool);
  const selectedObjectId = useEditorStore((st) => st.selectedObjectId);
  const placedObjects = useEditorStore((st) => st.placedObjects);

  // Brush store values
  const brushType = useEditorStore((st) => st.brushType);
  const brushAssetId = useEditorStore((st) => st.brushAssetId);
  const brushOwner = useEditorStore((st) => st.brushOwner);
  const brushTerrain = useEditorStore((st) => st.brushTerrain);
  const brushHeight = useEditorStore((st) => st.brushHeight);

  const { camera, raycaster, pointer, gl } = useThree();
  const groundRef = useRef();
  const [previewPos, setPreviewPos] = useState(null);

  // ── Refs to avoid stale closures ────────────────────────
  const stateRef = useRef({ editMode, tool, selectedObj: null, brushDef: null, bakedIds: new Set(), placedObjects: [] });
  stateRef.current.editMode = editMode;
  stateRef.current.tool = tool;
  stateRef.current.placedObjects = placedObjects;

  // ── Merge baked-in + editor objects ─────────────────────
  const mapObjects = getMapObjects(getActiveMapId());
  const movedBakedIds = new Set(placedObjects.filter(o => o._bakedId).map(o => o._bakedId));
  const visibleBaked = mapObjects.filter(o => !movedBakedIds.has(o.id));
  const editorOnly = placedObjects.filter(o => !o._bakedId);
  // Moved objects: baked objects that have been picked up — render at their new position
  const movedObjects = placedObjects.filter(o => o._bakedId);

  // Virtual objects for hex regions — editable in editor mode
  const regions = getRegions();
  const regionObjects = useMemo(() => regions.map(r => {
    const [x, , z] = hexToWorld(r.q, r.r);
    return {
      id: r.id,
      type: "hex",
      terrain: r.terrain,
      height: r.height,
      q: r.q,
      r: r.r,
      position: [x, 0, z],
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
      _isRegion: true,
    };
  }), [regions]);

  // Filter region hexes: hide ones that have been picked up (in placedObjects with _bakedId)
  const movedRegionIds = useMemo(
    () => new Set(placedObjects.filter(o => o._bakedId && o.type === 'hex').map(o => o._bakedId)),
    [placedObjects]
  );
  const visibleRegions = useMemo(
    () => regionObjects.filter(r => !movedRegionIds.has(r.id)),
    [regionObjects, movedRegionIds]
  );

  const bakedIds = new Set(mapObjects.map(o => o.id));
  // Add region IDs too so handleSelect works for them
  const allBakedIds = new Set([...bakedIds, ...regionObjects.map(r => r.id)]);
  stateRef.current.bakedIds = allBakedIds;

  const selectedObj =
    placedObjects.find(o => o.id === selectedObjectId) ||
    visibleBaked.find(o => o.id === selectedObjectId) ||
    regionObjects.find(o => o.id === selectedObjectId) ||
    null;
  stateRef.current.selectedObj = selectedObj;

  // ── Build brush definition ──────────────────────────────
  const brushDef = useMemo(() => {
    if (tool !== "brush") return null;
    const base = { type: brushType, scale: [1, 1, 1], rotation: [0, 0, 0] };
    if (brushType === "king-base" || brushType === "summon-circle" || brushType === "tower") {
      return { ...base, owner: brushOwner };
    }
    if (brushType === "hex") {
      return { ...base, terrain: brushTerrain, height: brushHeight };
    }
    if (brushType === "asset") {
      return { ...base, assetId: brushAssetId };
    }
    return null;
  }, [tool, brushType, brushOwner, brushTerrain, brushHeight, brushAssetId]);
  stateRef.current.brushDef = brushDef;

  // ── Raycast to ground (stable, reads fresh values) ──────
  const getPlacementPoint = useCallback(() => {
    if (!groundRef.current) return null;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(groundRef.current, false);
    if (hits.length > 0) {
      const p = hits[0].point;
      return [Math.round(p.x * 10) / 10, 0.05, Math.round(p.z * 10) / 10];
    }
    return null;
  }, [camera, pointer, raycaster]);

  // ── Preview follows cursor ──────────────────────────────
  useFrame(() => {
    if (!stateRef.current.editMode) { setPreviewPos(null); return; }
    if (stateRef.current.tool === "brush") {
      setPreviewPos(getPlacementPoint());
      return;
    }
    if (!stateRef.current.selectedObj) { setPreviewPos(null); return; }
    setPreviewPos(getPlacementPoint());
  });

  // ── Canvas-level click handler for placement (bypasses R3F event issues) ──
  useEffect(() => {
    if (!editMode) return;
    const el = gl.domElement;
    const canvasRaycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
      // Don't process if clicking on UI panel
      if (e.target !== el) return;

      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      canvasRaycaster.setFromCamera(mouse, camera);
      const hits = canvasRaycaster.intersectObject(groundRef.current, false);

      if (hits.length > 0) {
        const p = hits[0].point;
        const pt = [Math.round(p.x * 10) / 10, 0.05, Math.round(p.z * 10) / 10];
        placeObject(pt);
      }
    };

    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [editMode, camera, gl]);

  // ── Placement logic (shared by canvas click + ground click) ──
  const placeObject = useCallback((pt) => {
    const s = stateRef.current;
    const store = useEditorStore.getState();

    // Brush: paint new object
    if (s.tool === "brush") {
      if (!s.brushDef) return;
      if (s.brushDef.type === "asset" && !s.brushDef.assetId) return;
      const newObj = { ...s.brushDef, position: pt };
      const newId = store.addObject(newObj);
      store.selectObject(newId);
      return;
    }

    // Move: place selected object at new position
    const sel = s.selectedObj;
    if (!sel) {
      store.selectObject(null);
      return;
    }

    const inPlaced = s.placedObjects.find(o => o.id === sel.id);
    if (!inPlaced) {
      const newId = store.addObject({ ...sel, _bakedId: sel.id, position: pt });
      store.selectObject(newId);
    } else {
      store.updateObject(sel.id, { position: pt });
    }
  }, []);

  // ── Click object → select (or delete if in delete mode) ──
  const handleSelect = useCallback((obj) => {
    const s = stateRef.current;
    if (!s.editMode) return;
    const store = useEditorStore.getState();

    // Delete tool: click to remove
    if (s.tool === "delete") {
      const placed = s.placedObjects.find(o => o.id === obj.id || o._bakedId === obj.id);
      if (placed) {
        // Has a placed version — remove it (restores baked original or truly deletes editor-only)
        store.removeObject(placed.id);
      } else if (s.bakedIds.has(obj.id)) {
        // Baked object with no placed override — add to placedObjects to hide it from visibleBaked/visibleRegions
        store.addObject({ ...obj, _bakedId: obj.id });
      }
      return;
    }

    // Move tool: pick up baked objects (add to placedObjects to hide original, ghost follows)
    if (s.tool === "move" && s.bakedIds.has(obj.id) && !s.placedObjects.find(o => o.id === obj.id || o._bakedId === obj.id)) {
      const newId = store.addObject({ ...obj, _bakedId: obj.id });
      store.selectObject(newId);
      return;
    }

    // All other tools: just select (don't pick up)
    store.selectObject(obj.id);
  }, []);

  // ── Arrow key handler ───────────────────────────────────
  useEffect(() => {
    if (!editMode) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") { useEditorStore.getState().selectObject(null); return; }
      if (e.key === "Backspace" || e.key === "Delete") {
        const sid = useEditorStore.getState().selectedObjectId;
        if (sid) useEditorStore.getState().removeObject(sid);
        return;
      }

      const store = useEditorStore.getState();
      const sid = store.selectedObjectId;
      if (!sid) return;
      const obj = store.placedObjects.find(o => o.id === sid);
      if (!obj) return;
      const currentTool = store.tool;

      // ── Tool-specific Shift behavior ──────────────────
      if (e.shiftKey) {
        if (currentTool === "scale" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          const cur = obj.scale || [1, 1, 1];
          const delta = e.key === "ArrowUp" ? SCALE_STEP : -SCALE_STEP;
          store.updateObject(sid, { scale: cur.map(v => Math.max(0.1, v + delta)) });
          return;
        }

        if (currentTool === "rotate") {
          e.preventDefault();
          const rot = obj.rotation || [0, 0, 0];
          if (e.key === "ArrowLeft") store.updateObject(sid, { rotation: [rot[0], rot[1] + ROTATE_STEP, rot[2]] });
          else if (e.key === "ArrowRight") store.updateObject(sid, { rotation: [rot[0], rot[1] - ROTATE_STEP, rot[2]] });
          else if (e.key === "ArrowUp") store.updateObject(sid, { rotation: [rot[0] + ROTATE_STEP, rot[1], rot[2]] });
          else if (e.key === "ArrowDown") store.updateObject(sid, { rotation: [rot[0] - ROTATE_STEP, rot[1], rot[2]] });
          return;
        }

        if (currentTool === "elevate" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          const delta = e.key === "ArrowUp" ? ELEVATE_STEP : -ELEVATE_STEP;
          store.updateObject(sid, { position: [obj.position[0], obj.position[1] + delta, obj.position[2]] });
          return;
        }
      }

      // ── Always: arrows move XZ ────────────────────────
      let dx = 0, dz = 0;
      if (e.key === "ArrowLeft") dx = -NUDGE;
      else if (e.key === "ArrowRight") dx = NUDGE;
      else if (e.key === "ArrowUp") dz = -NUDGE;
      else if (e.key === "ArrowDown") dz = NUDGE;
      else return;

      e.preventDefault();
      store.updateObject(sid, { position: [obj.position[0] + dx, obj.position[1], obj.position[2] + dz] });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode]);

  if (!editMode) {
    return (
      <>
        {visibleBaked.map(obj => (
          <PlacedObject key={obj.id} obj={obj} isSelected={false} onSelect={() => {}} />
        ))}
        {editorOnly.map(obj => (
          <PlacedObject key={obj.id} obj={obj} isSelected={false} onSelect={() => {}} />
        ))}
        {/* Moved objects — render at their new positions in game mode */}
        {movedObjects.map(obj => (
          <PlacedObject key={obj.id} obj={obj} isSelected={false} onSelect={() => {}} />
        ))}
        {/* Region hexes in game mode — hide picked-up ones */}
        {visibleRegions.map(obj => (
          <HexMesh key={obj.id} terrain={obj.terrain} height={obj.height} />
        ))}
      </>
    );
  }

  return (
    <>
      {/* Ground plane for raycasting */}
      <mesh ref={groundRef} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} />
      </mesh>

      {/* Preview ghost or brush preview */}
      {tool === "brush" ? (
        <BrushPreview position={previewPos} brushDef={brushDef} />
      ) : (
        selectedObj && <PreviewGhost obj={selectedObj} position={previewPos} />
      )}

      {/* Placement ring — non-raycastable */}
      {previewPos && (tool === "brush" || selectedObj) && (
        <mesh position={previewPos} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.22, 0.28, 32]} />
          <meshBasicMaterial
            color={tool === "brush" ? "#00dd88" : "#ffd700"}
            side={THREE.DoubleSide} transparent opacity={0.7} depthTest={false}
          />
        </mesh>
      )}

      {/* Rendered objects */}
      {visibleBaked.map(obj => (
        <PlacedObject key={obj.id} obj={obj} isSelected={selectedObjectId === obj.id} onSelect={handleSelect} />
      ))}
      {editorOnly.map(obj => (
        <PlacedObject key={obj.id} obj={obj} isSelected={selectedObjectId === obj.id} onSelect={handleSelect} />
      ))}
      {/* Moved objects — render at their new positions */}
      {movedObjects.map(obj => (
        <PlacedObject key={obj.id} obj={obj} isSelected={selectedObjectId === obj.id} onSelect={handleSelect} />
      ))}
      {/* Region hexes — editable in editor mode, hide picked-up ones */}
      {visibleRegions.map(obj => (
        <PlacedObject key={obj.id} obj={obj} isSelected={selectedObjectId === obj.id} onSelect={handleSelect} />
      ))}
    </>
  );
}
