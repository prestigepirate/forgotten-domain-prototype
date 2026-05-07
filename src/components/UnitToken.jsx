import { useRef, useState, memo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore, PLAYER_COLORS } from "../data/gameState";
import CreatureModel from "./CreatureModel";
import UnitEffects from "./UnitEffects";
import GroundRing from "./GroundRing";
import { getMovementAnim, clearMovementAnim } from "../data/movementAnims";

function creatureBaseScale(level) {
  if (level <= 2) return 1.2;
  if (level <= 3) return 1.5;
  if (level <= 4) return 1.8;
  if (level <= 5) return 2.2;
  if (level <= 6) return 2.8;
  if (level <= 7) return 3.5;
  if (level <= 8) return 4.4;
  return 5.5;
}

const UnitToken = memo(function UnitToken({ creature, owner, position, index = 0, total = 1, isSelected, onSelect, onContextMenu }) {
  const groupRef = useRef();
  const _scaleVec = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);
  const active = hovered || isSelected;
  const immobilized = useGameStore((s) => s.immobilized[creature.id]);
  const buff = useGameStore((s) => s.tempBuffs[creature.id]);
  const isDefense = useGameStore((s) => !!s.defensePositions[creature.id]);

  const s = creatureBaseScale(creature.level || 4);

  // Offset multiple units on same region so they don't overlap — scales with creature size
  const spacing = 0.4 * s;
  const offsetX = total > 1 ? (index - (total - 1) / 2) * spacing : 0;
  const offsetZ = total > 1 ? 0.15 * s : 0;

  const animRef = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const anim = getMovementAnim(creature.id);
    const baseX = position[0] + offsetX;
    const baseY = position[1];
    const baseZ = position[2] + offsetZ;

    if (anim) {
      animRef.current = true;
      const elapsed = performance.now() - anim.startTime;
      if (elapsed >= anim.duration) {
        clearMovementAnim(creature.id);
        groupRef.current.position.x = baseX;
        groupRef.current.position.z = baseZ;
      } else {
        const t = elapsed / anim.duration;
        const eased = t * (2 - t); // ease-out
        groupRef.current.position.x = anim.fromX + (baseX - anim.fromX) * eased;
        groupRef.current.position.z = anim.fromZ + (baseZ - anim.fromZ) * eased;
      }
    } else if (animRef.current) {
      animRef.current = false;
      groupRef.current.position.x = baseX;
      groupRef.current.position.z = baseZ;
    }

    // Hover/selection Y float + scale
    const targetY = active ? baseY + 0.2 * s : baseY;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * delta * 6;
    const targetScale = active ? s * 1.15 : s;
    groupRef.current.scale.lerp(
      _scaleVec.current.set(targetScale, targetScale, targetScale),
      delta * 6
    );
  });

  const ringRadius = 0.16 * s;

  return (
    <group
      ref={groupRef}
      position={[position[0] + offsetX, position[1], position[2] + offsetZ]}
      onClick={(e) => { e.stopPropagation(); onSelect(creature.id); }}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault?.();
        if (onContextMenu) onContextMenu(creature.id, e.nativeEvent);
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 3D model (glb) with faction rim glow */}
      <CreatureModel creature={creature} active={active} scale={s} owner={owner} />

      {/* Defense position indicator — blue shield ring */}
      {isDefense && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.22 * s, 0.26 * s, 32]} />
          <meshBasicMaterial color="#4488ff" transparent opacity={0.6} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
      )}

      {/* Unit effects: glow ring, selection beam, faction particles */}
      <UnitEffects owner={owner} scale={s} isHovered={hovered} isSelected={isSelected} />

      {/* Level indicator pips */}
      <LevelPips level={creature.level || 4} ringRadius={ringRadius} scale={s} />

      {/* Selection ring — premium pulsing gold with inner/outer glow */}
      {isSelected && (
        <GroundRing
          radius={ringRadius * 1.3}
          theme="selection"
          pulseSpeed={1.2}
          yOffset={0.02}
        />
      )}

      {/* Hover ring — softer, faster pulse */}
      {hovered && !isSelected && (
        <GroundRing
          radius={ringRadius * 1.2}
          theme={owner === "player-1" ? "friendly" : "enemy"}
          pulseSpeed={1.8}
          scaleRange={[0.96, 1.04]}
          opacityRange={[0.3, 0.55]}
          yOffset={0.02}
        />
      )}

      {/* Immobilized indicator — red chain ring */}
      {immobilized && (
        <mesh position={[0, 0.06 * s, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 1.15, ringRadius * 1.25, 16]} />
          <meshBasicMaterial color="#ff4444" side={THREE.DoubleSide} transparent opacity={0.7} />
        </mesh>
      )}

      {/* Buff indicator — green glow sphere */}
      {buff && buff.atk > 0 && (
        <mesh position={[0, 0.52 * s, 0]}>
          <sphereGeometry args={[0.04 * s, 8, 8]} />
          <meshBasicMaterial color="#44ff44" />
        </mesh>
      )}

      {/* Creature name floating above */}
      <Text
        position={[0, 0.55 * s, 0]}
        fontSize={0.08 * s}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.015}
        outlineColor="#000000"
      >
        {creature.name}
      </Text>

      {/* ATK / DEF stats */}
      <Text
        position={[0, 0.48 * s, 0]}
        fontSize={0.09 * s}
        color={buff ? "#44ff44" : "#ffcc66"}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {buff ? `${creature.atk + buff.atk} / ${creature.def}` : `${creature.atk} / ${creature.def}`}
      </Text>
    </group>
  );
});

export default UnitToken;

function LevelPips({ level, ringRadius, scale }) {
  const pips = [];
  const maxPips = Math.min(level, 10);
  const pipR = 0.025 * scale;
  for (let i = 0; i < maxPips; i++) {
    const angle = (i / maxPips) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * (ringRadius + 0.04 * scale);
    const pz = Math.sin(angle) * (ringRadius + 0.04 * scale);
    const intensity = 1 - i / maxPips * 0.5;
    pips.push(
      <mesh key={i} position={[px, 0.15 * scale, pz]}>
        <sphereGeometry args={[pipR, 6, 6]} />
        <meshBasicMaterial color={`hsl(${40 - i * 3}, 80%, ${50 + intensity * 20}%)`} />
      </mesh>
    );
  }
  return <group>{pips}</group>;
}
