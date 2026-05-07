import { useRef, Suspense, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { getMovementAnim } from "../data/movementAnims";

const KNOWN_MODELS = new Set([
  // Classic Yu-Gi-Oh
  "dark-magician",
  "blue-eyes",
  "red-eyes",
  "kuriboh",
  "celtic-guardian",
  "giant-soldier",
  "aqua-madoor",
  "luster-dragon",
  "flame-swordsman",
  "zombie-dragon",
  "harpie-lady",
  "beaver-warrior",
  "summoned-skull",
  // Fracture Protocol — Nyx-0
  "echo-warden",
  "null-specter",
  "entropic-colossus",
  // Fracture Protocol — Vermilion
  "fracture-born-ravager",
  "magma-reaver",
  "abyssal-drake",
]);

// Meshy-generated models live under models/meshy/creatures/
const MESHY_CREATURES = new Set([
  "echo-warden",
  "null-specter",
  "entropic-colossus",
  "fracture-born-ravager",
  "magma-reaver",
  "abyssal-drake",
]);

// Humanoids that have _rigged.glb with skeleton + animations
const RIGGED_CREATURES = new Set([
  "echo-warden",
  "null-specter",
  "fracture-born-ravager",
  "magma-reaver",
]);

function getModelPath(creatureId) {
  if (!MESHY_CREATURES.has(creatureId)) {
    return `${import.meta.env.BASE_URL}models/${creatureId}.glb`;
  }
  const suffix = RIGGED_CREATURES.has(creatureId) ? "_rigged" : "";
  return `${import.meta.env.BASE_URL}models/meshy/creatures/${creatureId}${suffix}.glb`;
}

const FACTION_GLOW = {
  "player-1": "#4488ff",
  "player-2": "#ff5533",
};

// ── Rim glow: backface-scaled clone creates outline ─────────
function RimGlowMeshes({ scene, color, glowIntensity }) {
  const groupRef = useRef();

  const glowMeshes = useMemo(() => {
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const g = child.geometry.clone();
        const m = new THREE.MeshBasicMaterial({
          color,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.25,
          depthTest: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.scale.set(1.06, 1.06, 1.06);
        mesh.position.copy(child.position);
        mesh.rotation.copy(child.rotation);
        mesh.userData = { baseOpacity: 0.25 };
        meshes.push(mesh);
      }
    });
    return meshes;
  }, [scene, color]);

  // Dispose cloned geometries and materials on cleanup
  useEffect(() => {
    return () => {
      for (const mesh of glowMeshes) {
        mesh.geometry?.dispose();
        mesh.material?.dispose();
      }
    };
  }, [glowMeshes]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = glowIntensity;
    for (const child of groupRef.current.children) {
      if (child.material) {
        child.material.opacity +=
          (target * (child.userData?.baseOpacity || 0.15) -
            child.material.opacity) *
          delta *
          6;
      }
    }
  });

  if (glowMeshes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {glowMeshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}

// ── Animated model (rigged creatures) ────────────────────────
function AnimatedModelMesh({
  scene,
  animations,
  creatureId,
  active,
  scale,
  owner,
}) {
  const groupRef = useRef();
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const { actions, mixer } = useAnimations(animations, groupRef);
  const glowColor = FACTION_GLOW[owner] || FACTION_GLOW["player-1"];
  const currentAnim = useRef(null);
  const idleStarted = useRef(false);

  // Find the animation clip — Meshy provides walking/running
  const clipNames = Object.keys(actions);
  const animClipName =
    clipNames.find((n) => n.toLowerCase().includes("walk")) ||
    clipNames.find((n) => n.toLowerCase().includes("run")) ||
    clipNames[0] ||
    null;

  // Start idle animation on mount
  useEffect(() => {
    if (!animClipName || idleStarted.current) return;
    const action = actions[animClipName];
    if (action) {
      action.reset().play();
      action.timeScale = 0.3; // slow idle
      idleStarted.current = true;
      currentAnim.current = animClipName;
    }
  }, [animClipName, actions]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Rotation when selected
    if (active) {
      groupRef.current.rotation.y += delta * 1.5;
    }

    // Movement animation — speed up during movement, slow idle otherwise
    const anim = getMovementAnim(creatureId);
    const action = animClipName ? actions[animClipName] : null;

    if (action && action.isRunning()) {
      const targetSpeed = anim ? 1.2 : 0.3;
      action.timeScale += (targetSpeed - action.timeScale) * delta * 4;
    }

    mixer?.update(delta);
  });

  return (
    <group ref={groupRef} scale={0.22 * scale} position={[0, 0.18, 0]}>
      <RimGlowMeshes
        scene={clonedScene}
        color={glowColor}
        glowIntensity={active ? 1.0 : 0.4}
      />
      <primitive object={clonedScene} />
    </group>
  );
}

// ── Static model (no skeleton) ───────────────────────────────
function StaticModelMesh({ scene, active, scale, owner }) {
  const ref = useRef();
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const glowColor = FACTION_GLOW[owner] || FACTION_GLOW["player-1"];

  useFrame((_, delta) => {
    if (ref.current && active) {
      ref.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <group ref={ref} scale={0.22 * scale} position={[0, 0.18, 0]}>
      <RimGlowMeshes
        scene={clonedScene}
        color={glowColor}
        glowIntensity={active ? 1.0 : 0.4}
      />
      <primitive object={clonedScene} />
    </group>
  );
}

// ── GLB loader + dispatcher ──────────────────────────────────
function ModelMesh({ creatureId, active, scale, owner, onLoaded }) {
  const modelPath = getModelPath(creatureId);
  const { scene, animations } = useGLTF(modelPath);
  const hasFiredLoaded = useRef(false);

  useEffect(() => {
    if (scene && !hasFiredLoaded.current) {
      hasFiredLoaded.current = true;
      onLoaded?.();
    }
  }, [scene, onLoaded]);

  const hasAnimations = animations && animations.length > 0;

  if (!scene) return null;

  return hasAnimations ? (
    <AnimatedModelMesh
      scene={scene}
      animations={animations}
      creatureId={creatureId}
      active={active}
      scale={scale}
      owner={owner}
    />
  ) : (
    <StaticModelMesh
      scene={scene}
      active={active}
      scale={scale}
      owner={owner}
    />
  );
}

export default function CreatureModel({
  creature,
  active,
  scale = 1,
  owner = "player-1",
  onLoaded,
}) {
  if (!KNOWN_MODELS.has(creature.id)) return null;

  return (
    <Suspense fallback={null}>
      <ModelMesh
        creatureId={creature.id}
        active={active}
        scale={scale}
        owner={owner}
        onLoaded={onLoaded}
      />
    </Suspense>
  );
}
