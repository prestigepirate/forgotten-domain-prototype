import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { getRegionById, getRegionByCoord, hexToWorld, getReachableHexes, getMovementRange, HEX_SIZE } from "../data/regions";
import { useGameStore, useRegionMarkers, findCreatureRegion, getRegionController, getCreature } from "../data/gameState";

// Movement cost by terrain — affects which regions are valid targets
const TERRAIN_MOVE_COST = {
  plains:   { cost: 1, color: "#44dd44", label: "Clear" },
  forest:   { cost: 1, color: "#44aa22", label: "Forest" },
  mountain: { cost: 2, color: "#ddaa44", label: "Slow" },
  swamp:    { cost: 2, color: "#aa66dd", label: "Mired" },
  water:    { cost: 2, color: "#4488dd", label: "Water" },
  volcanic: { cost: 3, color: "#dd4422", label: "Hazard" },
};

// Hex ring shape
function hexRing(radius) {
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

const ringShape = hexRing(HEX_SIZE * 0.88);

function MoveRing({ region, steps, cost, onClick }) {
  const ref = useRef();
  const costInfo = TERRAIN_MOVE_COST[region.terrain];

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.06;
      ref.current.scale.setScalar(pulse);
      ref.current.material.opacity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.2;
    }
  });

  return (
    <group position={[0, region.height + 0.08, 0]}>
      {/* Pulsing ring */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[ringShape]} />
        <meshBasicMaterial
          color={costInfo.color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {/* Step distance label */}
      <Text
        position={[0, 0.35, 0]}
        fontSize={0.22}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {steps}
      </Text>

      {/* Invisible click catcher */}
      <mesh
        position={[0, 0.3, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(region.id); }}
      >
        <shapeGeometry args={[ringShape]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

export default function MoveTargets({ selectedUnit, onMove }) {
  const immobilized = useGameStore((s) => s.immobilized);
  const stationedCreatures = useGameStore((s) => s.stationedCreatures);
  const regionMarkers = useRegionMarkers();
  const state = { immobilized, stationedCreatures, regionMarkers };

  const targets = useMemo(() => {
    if (!selectedUnit) return [];

    // Don't show move targets for immobilized creatures
    if (immobilized[selectedUnit]) return [];

    const fromRegionId = findCreatureRegion(state, selectedUnit);
    if (!fromRegionId) return [];

    const fromRegion = getRegionById(fromRegionId);
    if (!fromRegion) return [];

    const creature = getCreature(selectedUnit);
    const maxSteps = getMovementRange(creature?.level || 4);
    const reachable = getReachableHexes(fromRegion.q, fromRegion.r, maxSteps);
    const owner = getRegionController(state, fromRegionId);

    return reachable.map(({ region, steps }) => {
      const costInfo = TERRAIN_MOVE_COST[region.terrain];
      return {
        region,
        steps,
        cost: costInfo.cost,
        color: costInfo.color,
        label: costInfo.label,
        ownedBySelf: getRegionController(state, region.id) === owner,
      };
    });
  }, [selectedUnit, immobilized, stationedCreatures, regionMarkers]);

  if (!selectedUnit || targets.length === 0) return null;

  return (
    <group>
      {targets.map(({ region, steps, cost, color, label }) => {
        const [x, , z] = hexToWorld(region.q, region.r);
        return (
          <group key={region.id} position={[x, 0, z]}>
            <MoveRing
              region={region}
              steps={steps}
              cost={cost}
              onClick={(targetId) => onMove(selectedUnit, targetId)}
            />
          </group>
        );
      })}
    </group>
  );
}
