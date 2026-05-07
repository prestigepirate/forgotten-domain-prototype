import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import HexRegion from "./HexRegion";
import RockyHex from "./RockyHex";
import MountainHex from "./MountainHex";
import MapBridges from "./MapBridges";
import HexGridLines from "./HexGridLines";
import ReachableOverlay from "./ReachableOverlay";
import HexCrackGlow from "./HexCrackGlow";
import ObsidianMarsh from "./ObsidianMarsh";
import TheSpire from "./TheSpire";
import CrystalLake from "./CrystalLake";
import Ironwood from "./Ironwood";
import AzureSpire from "./AzureSpire";
import TerrainSurface from "./TerrainSurface";
import UnitToken from "./UnitToken";
import MoveTargets from "./MoveTargets";
import TrapEffect from "./TrapEffect";
import NotificationToast from "./NotificationToast";
import NyxEnvironment from "./NyxEnvironment";
import RegionPanel from "./RegionPanel";
import Editor3D from "./editor/Editor3D";
import EditorPanel from "./editor/EditorPanel";
import { useEditorStore } from "../stores/editorStore";
import { getRegions, getRegionById, getRegionByCoord, getActiveMapId, hexToWorld, getReachableHexes, getMovementRange, HEX_SIZE } from "../data/regions";
import { getMapObjects } from "../data/mapObjects";
import { startMovementAnim } from "../data/movementAnims";
import { useGameStore, useRegionMarkers, findCreatureRegion, PLAYER_COLORS, getCard, getCreature } from "../data/gameState";

import CreatureMenu from "./CreatureMenu";
import AbyssalWater from "./AbyssalWater";
import MiniMap from "./MiniMap";
import StatusBar from "./StatusBar";
import WaterTile from "./WaterTile";

// ── Tower HP Bar (3D overlay) ──────────────────────────────
const TOWER_WORLD = {
  silver: [-16.8, 1.0, -9.7],
  gold: [19.1, 4.65, 13.9],
};

function TowerHPBar({ towerId, position }) {
  const hp = useGameStore((s) => s.towerHP?.[towerId] ?? 8000);
  const maxHP = useGameStore((s) => s.towerMaxHP?.[towerId] ?? 8000);
  const ratio = hp / maxHP;
  const color = towerId === "silver" ? "#c0c0c0" : "#d4a017";
  const barWidth = 1.0;

  return (
    <group position={[position[0], position[1] + 4.5, position[2]]}>
      {/* HP background bar */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[barWidth, 0.12, 0.08]} />
        <meshBasicMaterial color="#333333" />
      </mesh>
      {/* HP fill bar */}
      <mesh position={[-(barWidth * (1 - ratio)) / 2, 0, 0]}>
        <boxGeometry args={[barWidth * ratio, 0.1, 0.06]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* HP text */}
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.2}
        color={color}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {hp}
      </Text>
      {/* Tower label */}
      <Text
        position={[0, -0.25, 0]}
        fontSize={0.16}
        color={color}
        anchorX="center"
        anchorY="top"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {towerId === "silver" ? "🏰 Silver Tower" : "👑 Gold Tower"}
      </Text>
    </group>
  );
}

// ── Summoning Circle Markers ──────────────────────────────
const SUMMON_GLOW_COLORS = {
  "player-1": "#c44b3c",
  "player-2": "#5b8cc4",
};

function SummonCircles() {
  const circles = useGameStore((s) => s.summonCircles);
  const regions = getRegions();
  const editMode = useEditorStore((st) => st.editMode);
  const addObject = useEditorStore((st) => st.addObject);
  const selectObject = useEditorStore((st) => st.selectObject);

  return (
    <>
      {circles.map((sc, i) => {
        const rgn = getRegionByCoord(sc.q, sc.r);
        if (!rgn) return null;
        const [x, , z] = hexToWorld(rgn.q, rgn.r);
        const y = rgn.height + 0.15;
        const color = SUMMON_GLOW_COLORS[sc.owner] || "#8844cc";
        return (
          <SummonCircleRing
            key={`sc-${i}`}
            position={[x, y, z]}
            color={color}
            editMode={editMode}
            onEditClick={() => {
              const id = `summon-circle-${sc.q}-${sc.r}`;
              if (!useEditorStore.getState().placedObjects.find(o => o.id === id)) {
                addObject({ type: "summon-circle", owner: sc.owner, position: [x, y, z], scale: [1, 1, 1], rotation: [0, 0, 0], q: sc.q, r: sc.r });
              }
              selectObject(id);
            }}
          />
        );
      })}
    </>
  );
}

function SummonCircleRing({ position, color, editMode, onEditClick }) {
  const ringRef = useRef();
  const materialRef = useRef();

  const ringGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const innerR = 0.45;
    const outerR = 0.6;
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, steps: 1 });
  }, []);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.003;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
      ringRef.current.scale.setScalar(pulse);
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.25 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });

  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Click catcher for editor */}
      {editMode && (
        <mesh onClick={(e) => { e.stopPropagation(); onEditClick?.(); }} position={[0, 0, 0.05]}>
          <ringGeometry args={[0.35, 0.7, 32]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Base ring */}
      <mesh ref={ringRef} geometry={ringGeo}>
        <meshBasicMaterial ref={materialRef} color={color} transparent opacity={0.28} side={THREE.DoubleSide} depthTest={true} />
      </mesh>
      {/* Inner dot markers (rune-like dots around the circle) */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const rx = Math.cos(angle) * 0.52;
        const rz = Math.sin(angle) * 0.52;
        return (
          <mesh key={`dot-${i}`} position={[rx, 0.03, rz]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Camera controller ──────────────────────────────────────
const AERIAL_POS = [0, 9, 0.5];
const AERIAL_TARGET = [0, 0, 0];

// ── Discrete Zoom Presets ───────────────────────────────────
// Map extents: x -16.8..+16.8 (towers), z -11.1..+11.1 (hex grid)
// Each preset: camera pos + look target, ~40° cinematic tilt
const ZOOM_PRESETS = [
  { pos: [5,   3.5, 5],   target: [0, 0.5, 0] },  // Level 1 — Very close (~8u, inspect units)
  { pos: [10,  7,   9],   target: [0, 0.5, 0] },  // Level 2 — Default tactical (~15u)
  { pos: [16,  13,  15],  target: [0, 0.5, 0] },  // Level 3 — Medium overview (~26u)
  { pos: [22,  20,  22],  target: [0, 0.5, 0] },  // Level 4 — Wide view (~37u)
  { pos: [28,  28,  30],  target: [0, 0.5, 0] },  // Level 5 — Full map (~50u)
];
const DEFAULT_ZOOM = 1; // Level 2 (0-indexed)

// Map bounds with 15% padding beyond towers/hex extremes
const MAP_BOUNDS = { xMin: -19.5, xMax: 19.5, zMin: -13, zMax: 13 };

// Min/max camera distance from target (enforced)
const ZOOM_MIN_DIST = 6;
const ZOOM_MAX_DIST = 52;

// Polar angle limits (0 = top-down, PI/2 = horizon)
const ZOOM_POLAR_MIN = 0.26;   // ~15° from vertical — airplane view cap
const ZOOM_POLAR_MAX = 1.30;   // ~75° from vertical — nearly horizontal
const ZOOM_POLAR_DEFAULT = 0.70; // ~40° — tactical default
const DEFAULT_POS = [14, 12, 14];
const DEFAULT_TARGET = [0, 0, 0];

function CameraController({ focusTarget, aerialView, zoomLevel }) {
  const controlsRef = useRef();
  const { camera, gl } = useThree();
  const savedPos = useRef(null);
  const savedTarget = useRef(null);
  const transitioning = useRef(false);
  const targetPreset = useRef(DEFAULT_ZOOM);
  const initDone = useRef(false);
  const prevZoomRef = useRef(DEFAULT_ZOOM);
  const mouse = useRef({ x: 0, y: 0 });
  const zoomCursorPoint = useRef(null); // ground hit under cursor for zoom-to-cursor
  const zoomDirection = useRef(new THREE.Vector3()); // camera→target dir at zoom moment
  const dblClickTarget = useRef(null);  // ground point for double-click zoom
  const dblClickActive = useRef(false); // double-click zoom in progress
  const dblClickStartDist = useRef(0);  // camera distance at double-click moment
  const raycaster = useRef(new THREE.Raycaster());

  const _aerialPos = useRef(new THREE.Vector3());
  const _aerialTarget = useRef(new THREE.Vector3());
  const _savedPos = useRef(new THREE.Vector3());
  const _savedTarget = useRef(new THREE.Vector3());
  const _groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const _intersection = useRef(new THREE.Vector3());
  const _workVec = useRef(new THREE.Vector3());
  const _presetPos = useRef(new THREE.Vector3());
  const _presetTarget = useRef(new THREE.Vector3());
  const _cursorNDC = useRef(new THREE.Vector2());

  // Initial camera: smooth pan-in toward Gold Tower
  useEffect(() => {
    if (initDone.current || !controlsRef.current) return;
    initDone.current = true;
    const goldTarget = new THREE.Vector3(16.8, 1.5, 9.7);
    const startPos = new THREE.Vector3(30, 20, 25);
    const endPos = new THREE.Vector3(22, 9, 14);
    const startTarget = new THREE.Vector3(16.8, 5, 9.7);

    camera.position.copy(startPos);
    controlsRef.current.target.copy(startTarget);
    controlsRef.current.update();

    const startTime = performance.now();
    const duration = 2000;
    function animatePan(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startPos, endPos, ease);
      controlsRef.current.target.lerpVectors(startTarget, goldTarget, ease);
      controlsRef.current.update();
      if (t < 1) requestAnimationFrame(animatePan);
    }
    requestAnimationFrame(animatePan);
  }, [camera]);

  // Track mouse position
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e) => {
      mouse.current.x = (e.clientX / el.clientWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / el.clientHeight) * 2 + 1;
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [gl]);

  // Helper: raycast from mouse cursor to ground plane
  const getCursorGroundPoint = useCallback(() => {
    _cursorNDC.current.set(mouse.current.x, mouse.current.y);
    raycaster.current.setFromCamera(_cursorNDC.current, camera);
    const hit = new THREE.Vector3();
    const didHit = raycaster.current.ray.intersectPlane(_groundPlane.current, hit);
    return didHit ? hit : null;
  }, [camera]);

  // ── Edge scrolling ──────────────────────────────────────────
  // Move mouse to screen edges to auto-pan (RTS-style)
  const EDGE_SIZE = 24;        // px from edge that triggers pan
  const EDGE_SPEED = 14;       // units/sec at base zoom
  const edgeScrollDir = useRef(new THREE.Vector2());
  const edgeScrollActive = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const w = rect.width, h = rect.height;

      let dx = 0, dy = 0;
      if (mx < EDGE_SIZE) dx = -(1 - mx / EDGE_SIZE);
      else if (mx > w - EDGE_SIZE) dx = (1 - (w - mx) / EDGE_SIZE);
      if (my < EDGE_SIZE) dy = (1 - my / EDGE_SIZE);
      else if (my > h - EDGE_SIZE) dy = -(1 - (h - my) / EDGE_SIZE);

      edgeScrollDir.current.set(dx, dy);
      edgeScrollActive.current = dx !== 0 || dy !== 0;
    };
    const onLeave = () => { edgeScrollDir.current.set(0, 0); edgeScrollActive.current = false; };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl]);

  // Mouse wheel → raise / lower camera (elevation, not zoom)
  //   Scroll DOWN = lower camera (closer to the board)
  //   Scroll UP   = raise camera (see more of the map)
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const el = gl.domElement;
    const onWheel = (e) => {
      e.preventDefault();

      const isPinch = e.ctrlKey;
      const step = isPinch ? 0.3 : 0.8;
      const delta = e.deltaY > 0 ? -step : step;

      // Raise/lower camera Y, keeping XZ and target the same
      camera.position.y = THREE.MathUtils.clamp(
        camera.position.y + delta,
        3,   // min: don't go below the board
        48   // max: don't go into orbit
      );
      ctrl.update();

      // Abort any preset transition
      transitioning.current = false;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl, camera]);

  // Double-click → zoom camera to clicked point
  useEffect(() => {
    const el = gl.domElement;
    const onDblClick = (e) => {
      const ctrl = controlsRef.current;
      if (!ctrl) return;

      // Raycast from mouse to ground plane
      _cursorNDC.current.set(
        (e.clientX / el.clientWidth) * 2 - 1,
        -(e.clientY / el.clientHeight) * 2 + 1
      );
      raycaster.current.setFromCamera(_cursorNDC.current, camera);
      const hit = new THREE.Vector3();
      const didHit = raycaster.current.ray.intersectPlane(_groundPlane.current, hit);
      if (!didHit) return;

      // Clamp hit within map bounds
      hit.x = THREE.MathUtils.clamp(hit.x, MAP_BOUNDS.xMin, MAP_BOUNDS.xMax);
      hit.z = THREE.MathUtils.clamp(hit.z, MAP_BOUNDS.zMin, MAP_BOUNDS.zMax);

      dblClickTarget.current = hit.clone();
      dblClickStartDist.current = camera.position.distanceTo(ctrl.target);
      dblClickActive.current = true;
      transitioning.current = false; // abort any preset transition
    };
    el.addEventListener("dblclick", onDblClick);
    return () => el.removeEventListener("dblclick", onDblClick);
  }, [gl, camera]);

  // Handle focus target snap
  useEffect(() => {
    if (focusTarget && controlsRef.current) {
      const [tx, ty, tz] = focusTarget;
      controlsRef.current.target.set(tx, ty + 0.6, tz);
      camera.position.set(tx + 1.8, ty + 2.5, tz + 2.5);
      controlsRef.current.update();
    }
  }, [focusTarget, camera]);

  // Zoom level changed via buttons → snap to preset (zoom-to-cursor)
  useEffect(() => {
    if (zoomLevel === prevZoomRef.current) return;
    prevZoomRef.current = zoomLevel;
    targetPreset.current = zoomLevel;
    // Capture cursor ground point for zoom-to-cursor
    const pt = getCursorGroundPoint();
    zoomCursorPoint.current = pt ? pt.clone() : null;
    // Store current camera→target direction to preserve angle
    if (controlsRef.current) {
      zoomDirection.current.copy(camera.position).sub(controlsRef.current.target).normalize();
    }
    transitioning.current = true;
  }, [zoomLevel, camera, getCursorGroundPoint]);

  // Enter/exit aerial
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    if (aerialView) {
      savedPos.current = camera.position.toArray();
      savedTarget.current = ctrl.target.toArray();
      camera.position.set(AERIAL_POS[0], AERIAL_POS[1], AERIAL_POS[2]);
      ctrl.target.set(AERIAL_TARGET[0], AERIAL_TARGET[1], AERIAL_TARGET[2]);
      ctrl.update();
    } else if (savedPos.current) {
      camera.position.set(savedPos.current[0], savedPos.current[1], savedPos.current[2]);
      ctrl.target.set(savedTarget.current[0], savedTarget.current[1], savedTarget.current[2]);
      ctrl.update();
      savedPos.current = null;
      savedTarget.current = null;
    }
  }, [aerialView, camera]);

  // Smooth transitions + map bounds clamping
  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    // ── Edge scrolling ──────────────────────────────────────
    if (edgeScrollActive.current && !transitioning.current && !dblClickActive.current && !aerialView) {
      const dir = edgeScrollDir.current;
      // Speed scales with camera height — faster when zoomed out, slower when close
      const heightFactor = camera.position.y / 10;
      const speed = EDGE_SPEED * heightFactor * Math.min(1, delta * 60);
      const panX = dir.x * speed * delta * 10;
      const panZ = dir.y * speed * delta * 10;
      ctrl.target.x += panX;
      ctrl.target.z += panZ;
      camera.position.x += panX;
      camera.position.z += panZ;
      ctrl.update();
    }

    // After aerial exit: smooth restore
    if (!aerialView && savedPos.current) {
      const t = 1 - Math.exp(-delta * 4);
      camera.position.lerp(
        _savedPos.current.set(savedPos.current[0], savedPos.current[1], savedPos.current[2]),
        t
      );
      ctrl.target.lerp(
        _savedTarget.current.set(savedTarget.current[0], savedTarget.current[1], savedTarget.current[2]),
        t
      );
      if (camera.position.distanceTo(_savedPos.current) < 0.05) {
        savedPos.current = null;
        savedTarget.current = null;
      }
    }

    // Smooth zoom transition — zoom-to-cursor with preserved angle
    if (transitioning.current && !aerialView) {
      const preset = ZOOM_PRESETS[targetPreset.current];
      // Compute preset distance from camera to target
      _presetPos.current.set(preset.pos[0], preset.pos[1], preset.pos[2]);
      _presetTarget.current.set(preset.target[0], preset.target[1], preset.target[2]);
      const presetDist = _presetPos.current.distanceTo(_presetTarget.current);

      // Determine target point: cursor ground hit (clamped) or map center
      let targetPt;
      if (zoomCursorPoint.current) {
        targetPt = zoomCursorPoint.current.clone();
        // Clamp cursor point within map bounds
        targetPt.x = THREE.MathUtils.clamp(targetPt.x, MAP_BOUNDS.xMin, MAP_BOUNDS.xMax);
        targetPt.z = THREE.MathUtils.clamp(targetPt.z, MAP_BOUNDS.zMin, MAP_BOUNDS.zMax);
      } else {
        // Fallback: preset target
        targetPt = _presetTarget.current.clone();
      }

      // Use stored direction to preserve camera angle; if direction is stale, compute from current
      const dir = zoomDirection.current.length() > 0.01
        ? zoomDirection.current.clone()
        : _workVec.current.copy(camera.position).sub(ctrl.target).normalize();

      // Desired camera position: targetPt + direction * presetDist
      const desiredPos = targetPt.clone().addScaledVector(dir, presetDist);

      // Smooth lerp
      const t = 1 - Math.exp(-delta * 5.0); // ~0.3s feel
      camera.position.lerp(desiredPos, t);
      ctrl.target.lerp(targetPt, t);

      if (camera.position.distanceTo(desiredPos) < 0.05) {
        camera.position.copy(desiredPos);
        ctrl.target.copy(targetPt);
        transitioning.current = false;
        zoomCursorPoint.current = null;
      }
    }

    // ── Double-click zoom-to-point ──
    if (dblClickActive.current && !aerialView) {
      const targetPt = dblClickTarget.current;
      const targetDist = Math.max(ZOOM_MIN_DIST, dblClickStartDist.current * 0.35);

      // Smooth lerp target toward clicked point
      ctrl.target.lerp(targetPt, 1 - Math.exp(-delta * 6.0));

      // Dolly camera closer
      const currentDist = camera.position.distanceTo(ctrl.target);
      const newDist = currentDist + (targetDist - currentDist) * (1 - Math.exp(-delta * 4.0));
      const dir = _workVec.current.copy(camera.position).sub(ctrl.target).normalize();
      camera.position.copy(ctrl.target).addScaledVector(dir, newDist);

      ctrl.update();

      // Settle when close
      if (ctrl.target.distanceTo(targetPt) < 0.1 && Math.abs(currentDist - targetDist) < 0.15) {
        ctrl.target.copy(targetPt);
        dblClickActive.current = false;
        dblClickTarget.current = null;
      }
    }

    // ── Firm boundary clamp for panning (target + camera position) ──
    // Clamp the look-at target strictly within map bounds
    ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, MAP_BOUNDS.xMin, MAP_BOUNDS.xMax);
    ctrl.target.z = THREE.MathUtils.clamp(ctrl.target.z, MAP_BOUNDS.zMin, MAP_BOUNDS.zMax);

    // Also clamp camera position so it can't drift past the edges
    const camMargin = 3.0;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, MAP_BOUNDS.xMin - camMargin, MAP_BOUNDS.xMax + camMargin);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, MAP_BOUNDS.zMin - camMargin, MAP_BOUNDS.zMax + camMargin);

    // Prevent camera from going under the tiles — stay above terrain
    const CAM_Y_MIN = 1.5;
    if (camera.position.y < CAM_Y_MIN) camera.position.y = CAM_Y_MIN;
    if (ctrl.target.y < 0) ctrl.target.y = 0;

    // ── Enforce camera distance limits every frame ──
    const dist = camera.position.distanceTo(ctrl.target);
    if (dist < ZOOM_MIN_DIST) {
      const dir = _workVec.current.copy(camera.position).sub(ctrl.target).normalize();
      camera.position.copy(ctrl.target).addScaledVector(dir, ZOOM_MIN_DIST);
      ctrl.update();
    } else if (dist > ZOOM_MAX_DIST) {
      const dir = _workVec.current.copy(camera.position).sub(ctrl.target).normalize();
      camera.position.copy(ctrl.target).addScaledVector(dir, ZOOM_MAX_DIST);
      ctrl.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      enableZoom={false}
      enableRotate={false}
      maxPolarAngle={Math.PI / 3}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: null,
        RIGHT: null,
      }}
    />
  );
}

// ── 3D Scene ───────────────────────────────────────────────
function MapScene({ selectedRegion, onSelectRegion, focusTarget, selectedUnit, onSelectUnit, onMoveUnit, onContextMenu, trapTrigger, onTrapComplete, aerialView, hexOutlinesOn, zoomLevel }) {
  const [hoveredRegion, setHoveredRegion] = useState(null);
  // Targeted selectors — only re-render when these specific slices change
  const regionMarkers = useRegionMarkers();
  const stationedCreatures = useGameStore(s => s.stationedCreatures);
  const creatureOwners = useGameStore(s => s.creatureOwners);
  const editMode = useEditorStore((s) => s.editMode);
  const regions = getRegions();

  // Movement range filter for HexGridLines when a unit is selected + outlines on
  const outlineFilter = useMemo(() => {
    if (!hexOutlinesOn || !selectedUnit) return null;
    const state = useGameStore.getState();
    const regionId = findCreatureRegion(state, selectedUnit);
    if (!regionId) return null;
    const fromRegion = getRegionById(regionId);
    if (!fromRegion) return null;
    const creature = getCreature(selectedUnit);
    const maxSteps = getMovementRange(creature?.level || 4);
    const reachable = getReachableHexes(fromRegion.q, fromRegion.r, maxSteps);
    // Include the current region too
    const ids = new Set(reachable.map(r => r.region.id));
    ids.add(regionId);
    return ids;
  }, [hexOutlinesOn, selectedUnit]);

  const handleHover = useCallback((id) => setHoveredRegion(id), []);
  const handleUnhover = useCallback(() => setHoveredRegion(null), []);

  return (
    <>
      {/* Nyx-0: dark void sky, dead Earth, fog, ash, debris */}
      <NyxEnvironment />

      {/* Deep abyss ambient — blue-purple, cavernous */}
      <ambientLight intensity={0.22} color="#1a1a48" />
      {/* Hemisphere — cold teal sky, abyss floor */}
      <hemisphereLight intensity={0.14} color="#335588" groundColor="#080818" />
      {/* Primary rim key light from upper-left */}
      <directionalLight
        position={[-8, 12, -4]}
        intensity={0.4}
        color="#8899cc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Faint top-down — sculpts hex terrain without brightening */}
      <directionalLight
        position={[0, 16, 0]}
        intensity={0.15}
        color="#446688"
      />
      {/* Fracture glow fill from below — cyan-teal */}
      <pointLight position={[0, 2, 0]} intensity={0.2} color="#336688" />
      {/* Warm intrusion from right — orange ember rim */}
      <pointLight position={[12, 4, 0]} intensity={0.13} color="#442211" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#080820" roughness={0.98} emissive="#0a0a20" emissiveIntensity={0.3} />
      </mesh>

      {/* Fracture crack glow — light seeping up through hex gaps */}
      <HexCrackGlow />

      {/* Hex grid outlines — faint cyan, or bright white when toggled */}
      <HexGridLines
        color={hexOutlinesOn && outlineFilter ? "#ffcc44" : hexOutlinesOn ? "#ffffff" : "#334466"}
        opacity={hexOutlinesOn ? 0.9 : 0.35}
        yOffset={0.055}
        filter={outlineFilter}
      />

      {/* Green overlay on reachable hexes when unit selected + outlines on */}
      {outlineFilter && (
        <ReachableOverlay hexIds={outlineFilter} />
      )}

      <MapBridges regions={regions} />

      {/* Region hexes — only render in game mode (editor handles them in edit mode) */}
      {!editMode && regions.map((region, idx) => {
        const [x, , z] = hexToWorld(region.q, region.r);
        const regionOwner = (() => {
          const markers = regionMarkers[region.id];
          if (!markers) return "neutral";
          const p1 = markers["player-1"] || 0;
          const p2 = markers["player-2"] || 0;
          if (p1 > p2) return "player-1";
          if (p2 > p1) return "player-2";
          return "neutral";
        })();
        const ownerColor = PLAYER_COLORS[regionOwner];
        const markers = regionMarkers[region.id];

        // Mountain terrain: use MountainHex
        const isMountain = region.terrain === "mountain" || region.terrain === "volcanic";
        if (isMountain) {
          return (
            <group key={region.id}>
              <MountainHex
                region={region}
                position={[x, 0, z]}
                nyxMode
              />
              {/* Invisible click surface for selection */}
              <mesh
                position={[x, region.height + 0.4, z]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={(e) => { e.stopPropagation(); onSelectRegion(region.id); }}
                onPointerOver={(e) => { e.stopPropagation(); handleHover(region.id); }}
                onPointerOut={handleUnhover}
              >
                <circleGeometry args={[HEX_SIZE * 0.85, 6]} />
                <meshBasicMaterial transparent opacity={0} depthTest={false} />
              </mesh>
            </group>
          );
        }

        // Prototype: first 8 hexes use RockyHex
        if (idx < 8) {
          return (
            <RockyHex
              key={region.id}
              region={region}
              position={[x, 0, z]}
              isSelected={selectedRegion === region.id}
              isHovered={hoveredRegion === region.id}
              onSelect={onSelectRegion}
              onHover={handleHover}
              onUnhover={handleUnhover}
              nyxMode
            />
          );
        }

        return (
          <HexRegion
            key={region.id}
            region={region}
            position={[x, 0, z]}
            isSelected={selectedRegion === region.id}
            isHovered={hoveredRegion === region.id}
            onSelect={onSelectRegion}
            onHover={handleHover}
            onUnhover={handleUnhover}
            ownerColor={ownerColor !== PLAYER_COLORS.neutral ? ownerColor : null}
            p1Markers={markers?.["player-1"] ?? 0}
            p2Markers={markers?.["player-2"] ?? 0}
            nyxMode
          />
        );
      })}

      {/* Terrain surfaces + Water tiles */}
      {!editMode && regions.map((region) => {
        if (region.terrain === "mountain" || region.terrain === "volcanic" || region.terrain === "high-ground") return null;
        const [x, , z] = hexToWorld(region.q, region.r);

        // Water tiles: GLB dark water model
        if (region.terrain === "water") {
          return (
            <group key={`terrain-${region.id}`} position={[x, 0, z]}>
              <WaterTile regionY={region.height} />
            </group>
          );
        }

        // Swamp: abyssal water shader
        if (region.terrain === "swamp") {
          return (
            <group key={`terrain-${region.id}`} position={[x, 0, z]}>
              <AbyssalWater regionY={region.height} swampMode />
            </group>
          );
        }

        // Other terrain: standard procedural surface
        return (
          <group key={`terrain-${region.id}`} position={[x, 0, z]}>
            <TerrainSurface terrain={region.terrain} regionHeight={region.height} overrideTerrain="nyx0" />
          </group>
        );
      })}

      {/* Summoning circle markers */}
      <SummonCircles />

      {/* Unit tokens on regions */}
      {regions.map((region) => {
        const creatures = (stationedCreatures[region.id] || []).map(getCreature).filter(Boolean);
        if (creatures.length === 0) return null;
        const [rx, , rz] = hexToWorld(region.q, region.r);
        const y = region.height + 0.02;
        return (
          <group key={`units-${region.id}`}>
            {creatures.map((creature, i) => {
              const creatureOwner = creatureOwners[creature.id] || "neutral";
              return (
                <UnitToken
                  key={creature.id}
                  creature={creature}
                  owner={creatureOwner}
                  position={[rx, y, rz]}
                  index={i}
                  total={creatures.length}
                  isSelected={selectedUnit === creature.id}
                  onSelect={onSelectUnit}
                  onContextMenu={onContextMenu}
                />
              );
            })}
          </group>
        );
      })}

      {/* Move targets — highlight adjacent regions when a unit is selected */}
      <MoveTargets selectedUnit={selectedUnit} onMove={onMoveUnit} />

      {/* Trap trigger effect */}
      {trapTrigger && (
        <TrapEffect
          position={trapTrigger.position}
          regionHeight={trapTrigger.regionHeight}
          trapColor={trapTrigger.color}
          active={true}
          onComplete={onTrapComplete}
        />
      )}

      {/* Detailed region layers */}
      <DetailRegionSection regionId="obsidian-marsh" Component={ObsidianMarsh} />
      <DetailRegionSection regionId="the-spire" Component={TheSpire} />
      <DetailRegionSection regionId="crystal-lake" Component={CrystalLake} />
      <DetailRegionSection regionId="ironwood" Component={Ironwood} />
      <DetailRegionSection regionId="forge-gate" Component={AzureSpire} />

      {/* Editor-placed hex regions + baked map objects — Editor3D handles all rendering */}
      <Editor3D />

      {/* King tower HP bars */}
      <TowerHPBar towerId="silver" position={TOWER_WORLD.silver} />
      <TowerHPBar towerId="gold" position={TOWER_WORLD.gold} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.6}
          intensity={1.3}
          radius={0.6}
          mipmapBlur
        />
      </EffectComposer>

      <CameraController focusTarget={focusTarget} aerialView={aerialView} zoomLevel={zoomLevel} />
    </>
  );
}

function DetailRegionSection({ regionId, Component }) {
  const region = getRegionById(regionId);
  if (!region) return null;
  const [x, , z] = hexToWorld(region.q, region.r);
  return (
    <group position={[x, 0, z]}>
      <Component regionHeight={region.height} />
    </group>
  );
}

// ── Styles ──────────────────────────────────────────────────
const zoomBtn = {
  width: 30,
  height: 28,
  background: "rgba(10, 8, 20, 0.75)",
  color: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  fontFamily: "system-ui, sans-serif",
  fontSize: "0.95rem",
  cursor: "pointer",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  transition: "all 0.2s ease",
};

// ── Main App ───────────────────────────────────────────────
export default function GameMap() {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [trapTrigger, setTrapTrigger] = useState(null);
  const [aerialView, setAerialView] = useState(false);
  const [hexOutlinesOn, setHexOutlinesOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [panelRegion, setPanelRegion] = useState(null); // double-click to open side panel
  const clickTimer = useRef(null);
  const [creatureMenu, setCreatureMenu] = useState(null); // { creatureId, x, y }
  const editMode = useEditorStore((s) => s.editMode);
  const toggleEditMode = useEditorStore((s) => s.toggleEditMode);

  const focusOn = (regionId) => {
    const region = getRegionById(regionId);
    if (region) {
      const [x, y, z] = hexToWorld(region.q, region.r);
      setFocusTarget([x, y, z]);
      setTimeout(() => setFocusTarget(null), 100);
    }
  };

  const handleSelectRegion = (id) => {
    if (editMode) return;
    const state = useGameStore.getState();

    // If a card from hand is selected, deploy/set/cast instead of opening panel
    if (state.selectedHandCard && state.handMode) {
      const cardId = state.selectedHandCard;

      if (state.handMode === "deploy") {
        const success = state.deployCreature("player-1", cardId, id);
        if (success) state.clearHandSelection();
      } else if (state.handMode === "trap") {
        const success = state.setTrapFromHand("player-1", cardId, id);
        if (success) state.clearHandSelection();
      } else if (state.handMode === "spell") {
        const spellCard = getCard(cardId);
        if (spellCard?.target === "region" || spellCard?.target === "deck") {
          const success = state.castSpell("player-1", cardId, id, null);
          if (success) state.clearHandSelection();
        }
      } else if (state.handMode === "field") {
        const success = state.deployFieldSpell("player-1", cardId, id);
        if (success) state.clearHandSelection();
      }
      return;
    }

    // Double-click detection: single-click highlights, double-click opens panel
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setSelectedRegion(id);
      setPanelRegion(id);
      setSelectedUnit(null);
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setSelectedRegion(id === selectedRegion ? null : id);
      setSelectedUnit(null);
    }, 280);
  };

  const handleSelectUnit = (id) => {
    if (editMode) return;
    const state = useGameStore.getState();

    // If hand card selected, handle equipment or creature-targeting spell
    if (state.selectedHandCard && state.handMode) {
      if (state.handMode === "equip") {
        const creatureOwner = state.creatureOwners[id];
        if (creatureOwner === "player-1") {
          state.equipCreature("player-1", state.selectedHandCard, id);
          state.clearHandSelection();
        }
        return;
      }
      if (state.handMode === "spell") {
        const spellCard = getCard(state.selectedHandCard);
        if (spellCard?.target === "creature") {
          // For monster-reborn: need region too — use the creature's current region
          const regionId = findCreatureRegion(state, id);
          const success = state.castSpell("player-1", state.selectedHandCard, regionId, id);
          if (success) state.clearHandSelection();
        }
        return;
      }
      return;
    }

    state.clearHandSelection();
    setSelectedUnit(id === selectedUnit ? null : id);
  };

  const handleMoveUnit = (creatureId, targetRegionId) => {
    if (editMode) return;
    const state = useGameStore.getState();
    if (state.immobilized[creatureId]) {
      state.addNotification(`${getCreature(creatureId)?.name || creatureId} is immobilized and cannot move.`);
      setSelectedUnit(null);
      return;
    }

    // 1 move per turn
    const creatureOwner = state.creatureOwners[creatureId] || "neutral";
    if (creatureOwner !== "neutral" && (state.movesUsed[creatureOwner] || 0) >= 1) {
      state.addNotification(`You have already moved a creature this turn.`);
      setSelectedUnit(null);
      return;
    }

    const fromRegionId = findCreatureRegion(state, creatureId);
    if (!fromRegionId || targetRegionId === fromRegionId) {
      setSelectedUnit(null);
      return;
    }

    // Validate target is within movement range
    const fromRegion = getRegionById(fromRegionId);
    const toRegion = getRegionById(targetRegionId);
    if (!fromRegion || !toRegion) {
      setSelectedUnit(null);
      return;
    }

    const creature = getCreature(creatureId);
    const maxSteps = getMovementRange(creature?.level || 4);
    const reachable = getReachableHexes(fromRegion.q, fromRegion.r, maxSteps);
    const inRange = reachable.some(({ region }) => region.id === targetRegionId);
    if (!inRange) {
      state.addNotification(`${creature?.name || creatureId} (Lv${creature?.level || "?"}) can only move ${maxSteps} step(s). Target is out of range.`);
      setSelectedUnit(null);
      return;
    }

    // Start movement animation before the state update
    const [fx, , fz] = hexToWorld(fromRegion.q, fromRegion.r);
    const [tx, , tz] = hexToWorld(toRegion.q, toRegion.r);
    const fromY = fromRegion.height + 0.02;
    const toY = toRegion.height + 0.02;
    startMovementAnim(creatureId, [fx, fromY, fz], [tx, toY, tz], 600);

    const result = useGameStore.getState().moveCreatureWithTraps(creatureId, fromRegionId, targetRegionId);

    // Show trap effect if one triggered
    if (result?.triggered) {
      const targetRegion = getRegionById(targetRegionId);
      const trapColor = result.result?.trapId === "mirror-force" ? "#ff4444" : "#8844cc";
      const [tx, , tz] = hexToWorld(targetRegion?.q || 0, targetRegion?.r || 0);
      setTrapTrigger({
        position: [tx, 0, tz],
        regionHeight: targetRegion?.height || 0.4,
        color: trapColor,
      });
    }

    setSelectedUnit(null);
  };

  const handleTrapComplete = () => setTrapTrigger(null);

  const handleCreatureContextMenu = (creatureId, event) => {
    event?.stopPropagation?.();
    setCreatureMenu({ creatureId, x: event?.clientX || 0, y: event?.clientY || 0 });
  };

  const handleDefenseToggle = (creatureId) => {
    useGameStore.getState().toggleDefense(creatureId);
  };

  const handleClosePanel = () => {
    setPanelRegion(null);
    setSelectedUnit(null);
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", background: "#000000",
      border: "2px solid #1a1028",
      boxShadow: "inset 0 0 0 1px rgba(90, 40, 140, 0.25), 0 0 0 1px #000",
      boxSizing: "border-box",
    }}>
      <Canvas
        shadows
        camera={{ position: [30, 20, 25], fov: 45 }}
        gl={{ antialias: true }}
      >
        <MapScene
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
          focusTarget={focusTarget}
          selectedUnit={selectedUnit}
          onSelectUnit={handleSelectUnit}
          onMoveUnit={handleMoveUnit}
          onContextMenu={handleCreatureContextMenu}
          trapTrigger={trapTrigger}
          onTrapComplete={handleTrapComplete}
          aerialView={aerialView}
          hexOutlinesOn={hexOutlinesOn}
          zoomLevel={zoomLevel}
        />
      </Canvas>

      {/* Status bar — top center */}
      <StatusBar />

      {/* Mini-map — bottom-left, always visible */}
      <div style={{
        position: "absolute", bottom: 24, left: 24, zIndex: 28,
      }}>
        <MiniMap />
      </div>

      {/* Editor panel overlay */}
      <EditorPanel />

      {/* Edit Map toggle button */}
      <button
        onClick={toggleEditMode}
        style={{
          position: "absolute",
          bottom: 214,
          right: 24,
          zIndex: 25,
          background: editMode ? "rgba(100,140,220,0.3)" : "rgba(20,10,40,0.85)",
          color: editMode ? "#aaccff" : "#888",
          border: editMode ? "1px solid rgba(100,140,220,0.5)" : "1px solid #333",
          padding: "8px 14px",
          borderRadius: 6,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.75rem",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {editMode ? "Exit Editor" : "Edit Map"}
      </button>

      {/* Aerial view toggle */}
      <button
        onClick={() => setAerialView((v) => !v)}
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          zIndex: 25,
          background: aerialView ? "rgba(100,200,140,0.3)" : "rgba(20,10,40,0.85)",
          color: aerialView ? "#aaffcc" : "#888",
          border: aerialView ? "1px solid rgba(100,200,140,0.5)" : "1px solid #333",
          padding: "8px 14px",
          borderRadius: 6,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.75rem",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {aerialView ? "▼ Aerial On" : "▲ Aerial View"}
      </button>

      {/* Zoom controls */}
      <div style={{
        position: "absolute",
        bottom: 256,
        left: 24,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        <button
          onClick={() => setZoomLevel((z) => Math.max(z - 1, 0))}
          style={zoomBtn}
          title="Zoom In (Level 1-5)"
        >+</button>
        <button
          onClick={() => setZoomLevel((z) => Math.min(z + 1, 4))}
          style={zoomBtn}
          title="Zoom Out (Level 1-5)"
        >−</button>
      </div>

      {/* Hex outlines toggle */}
      <button
        onClick={() => setHexOutlinesOn((v) => !v)}
        style={{
          position: "absolute",
          bottom: 150,
          right: 24,
          zIndex: 25,
          background: hexOutlinesOn ? "rgba(255,255,255,0.2)" : "rgba(20,10,40,0.85)",
          color: hexOutlinesOn ? "#ffffff" : "#666",
          border: hexOutlinesOn ? "1px solid rgba(255,255,255,0.5)" : "1px solid #333",
          padding: "6px 10px",
          borderRadius: 6,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.65rem",
          cursor: "pointer",
          fontWeight: "bold",
          whiteSpace: "nowrap",
        }}
      >
        {hexOutlinesOn ? "⬡ Outlines ON" : "⬡ Outlines OFF"}
      </button>

      {/* Focus buttons for detailed regions — right of minimap, full height */}
      <div style={{
        position: "absolute", bottom: 24, left: 180,
        width: 130, height: 200,
        display: "flex", flexDirection: "column", gap: 5, zIndex: 27,
      }}>
        {[
          { id: "the-spire", label: "The Spire", color: "#dd4422" },
          { id: "crystal-lake", label: "Crystal Lake", color: "#4488dd" },
          { id: "obsidian-marsh", label: "Obsidian Marsh", color: "#8844cc" },
          { id: "forge-gate", label: "Forge Gate", color: "#44aacc" },
        ].map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => focusOn(id)}
            style={{
              background: "rgba(12, 14, 22, 0.85)",
              color: "#bcc8d8",
              border: `1px solid rgba(120,140,170,0.25)`,
              borderLeft: `2px solid ${color}`,
              padding: "5px 12px 5px 10px",
              borderRadius: 2,
              fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.06em",
              cursor: "pointer",
              fontWeight: 400,
              textTransform: "uppercase",
              textAlign: "left",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              transition: "all 0.2s ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notification toasts */}
      <NotificationToast />

      {/* Region detail panel */}
      <RegionPanel regionId={panelRegion} onClose={handleClosePanel} />

      {/* Creature context menu */}
      {creatureMenu && (
        <CreatureMenu
          creatureId={creatureMenu.creatureId}
          screenX={creatureMenu.x}
          screenY={creatureMenu.y}
          onClose={() => setCreatureMenu(null)}
          onMove={(id) => { setSelectedUnit(id); setCreatureMenu(null); }}
          onToggleDefense={handleDefenseToggle}
        />
      )}
    </div>
  );
}
