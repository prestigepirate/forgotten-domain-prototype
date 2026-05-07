const ABYSSAL_OBJECTS = [
  // ── King Towers ───────────────────────────────────────────
  // Silver Tower: q=-8, r=5 → hexToWorld → [-19.2, 0, 2.77] — P1 home zone
  { type: "king-base", owner: "silver", position: [-19.2, 1.0, 2.77], scale: [1, 1, 1], rotation: [0, 0, 0], id: "king-silver" },
  // Gold Tower: elevated position [19.1, 4.65, 13.9]
  { type: "king-base", owner: "gold",   position: [19.1,  4.65, 13.9], scale: [1, 1, 1], rotation: [0, 0, 0], id: "king-gold" },

  // ── Summoning Circles (3 hexes from towers) ───────────────
  // P1 circle: q=-5, r=3 → 3 hexes from Silver → hexToWorld → [-12.0, 0, 2.77]
  { type: "summon-circle", owner: "player-1", position: [-12.0, 0.15, 2.77], scale: [1, 1, 1], rotation: [0, 0, 0], id: "sc-p1" },
  // P2 circle: q=5, r=-3 → 3 hexes from Gold → hexToWorld → [12.0, 0, -2.77]
  { type: "summon-circle", owner: "player-2", position: [12.0,  0.15, -2.77], scale: [1, 1, 1], rotation: [0, 0, 0], id: "sc-p2" },

  // ── P2 Medium Towers (defensive triangle on Azure Coalition side) ──
  // Forward Outpost: q=-2, r=1, world [-4.8, 0, -1.39] — midfield edge, central approach
  { type: "tower", owner: "player-2", position: [-4.8, 0.35, -1.39], scale: [1, 1, 1], rotation: [0, 0, 0], id: "tower-p2-forward" },
  // North Watch: q=-7, r=-2, world [-16.8, 0, -15.24] — far northern flank
  { type: "tower", owner: "player-2", position: [-16.8, 0.35, -15.24], scale: [1, 1, 1], rotation: [0, 0, 0], id: "tower-p2-north" },
  // South Bastion: q=-6, r=5, world [-14.4, 0, 5.54] — far southern flank
  { type: "tower", owner: "player-2", position: [-14.4, 0.35, 5.54], scale: [1, 1, 1], rotation: [0, 0, 0], id: "tower-p2-south" },

  // ── P1 Medium Towers (defensive triangle on Crimson Dominion side) ──
  // Forward Outpost: q=2, r=-1, world [4.8, 0, 0] — midfield edge, 4 hexes from P2 forward
  { type: "tower", owner: "player-1", position: [4.8, 0.35, 0.0], scale: [1, 1, 1], rotation: [0, 0, 0], id: "tower-p1-forward" },
  // Southern Watch: q=7, r=2, world [16.8, 0, 15.24] — far southern P1 flank
  { type: "tower", owner: "player-1", position: [16.8, 0.35, 15.24], scale: [1, 1, 1], rotation: [0, 0, 0], id: "tower-p1-south" },
  // Northern Watch: q=6, r=-5, world [14.4, 0, -5.54] — far northern P1 flank
  { type: "tower", owner: "player-1", position: [14.4, 0.35, -5.54], scale: [1, 1, 1], rotation: [0, 0, 0], id: "tower-p1-north" },
];

const MAP_OBJECTS = {
  "abyssal-archipelago": ABYSSAL_OBJECTS,
  "ashen-wastes":        ABYSSAL_OBJECTS,
  "shadow-marshes":      ABYSSAL_OBJECTS,
  "iron-ridges":         ABYSSAL_OBJECTS,
  "blightwood":          ABYSSAL_OBJECTS,
};

export function getMapObjects(mapId = "abyssal-archipelago") {
  return MAP_OBJECTS[mapId] || ABYSSAL_OBJECTS;
}
