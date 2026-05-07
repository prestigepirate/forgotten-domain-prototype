// ═══════════════════════════════════════════════════════════════
// ABYSSAL ARCHIPELAGO — Zombie dark corrupted archipelago map
// ~180-200 hexes, 17-19 wide, 1v1 strategic layout
// ═══════════════════════════════════════════════════════════════

export const HEX_SIZE = 1.6;

// ── Seeded RNG ─────────────────────────────────────────────────
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function hashCoord(q, r, seed) {
  let h = seed + q * 374761393 + r * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) / 2147483647 + 0.5) % 1;
}

const MAP_SEED = 77;
const rand = rng(MAP_SEED);

// ── Neighbor lookup ────────────────────────────────────────────
export function getNeighbors(q, r) {
  return [
    [q + 1, r], [q + 1, r - 1], [q, r - 1],
    [q - 1, r], [q - 1, r + 1], [q, r + 1],
  ];
}

function hexDist(q1, r1, q2, r2) {
  const dq = q1 - q2, dr = r1 - r2, ds = (-q1 - r1) - (-q2 - r2);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

export function hexToWorld(q, r, size = HEX_SIZE) {
  const x = size * (3 / 2 * q);
  const z = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, 0, z];
}

// ── Map shape: organic ragged archipelago ──────────────────────
function isInMapBoundary(q, r) {
  // Base elliptical shape: 22 wide x 18 tall (bigger map)
  const a = 10.5, b = 8.5;
  const ellipse = (q * q) / (a * a) + (r * r) / (b * b);
  if (ellipse > 1.05) return false;

  // Core area: everything inside 0.85 stays
  if (ellipse < 0.85) return true;

  // Edge zone: probabilistically remove for ragged archipelago feel
  const noise = hashCoord(q, r, MAP_SEED + 100);
  const cutoff = 0.15 + (ellipse - 0.85) * 3.0;
  return noise > cutoff;
}

function generateCoordSet() {
  const set = new Set();
  for (let q = -11; q <= 11; q++) {
    for (let r = -10; r <= 10; r++) {
      if (isInMapBoundary(q, r)) {
        set.add(`${q},${r}`);
      }
    }
  }
  // Flood fill from (0,0) for connectivity
  const visited = new Set();
  const queue = [[0, 0]];
  visited.add("0,0");
  while (queue.length > 0) {
    const [q, r] = queue.shift();
    for (const [nq, nr] of getNeighbors(q, r)) {
      const key = `${nq},${nr}`;
      if (visited.has(key)) continue;
      if (!set.has(key)) continue;
      visited.add(key);
      queue.push([nq, nr]);
    }
  }
  return visited;
}

const COORD_SET = generateCoordSet();

// ── Zone classification ────────────────────────────────────────
function classifyZone(q, r) {
  const absQ = Math.abs(q);
  const absR = Math.abs(r);

  // P1 Home: top-right (positive q) — Gold Tower side
  if (q >= 7 && r <= -1) return "P1_HOME";
  // P2 Home: bottom-left (negative q) — Silver Tower side
  if (q <= -7 && r >= 1) return "P2_HOME";

  // Home borders
  if (q <= -5 && q >= -8 && r >= 0 && r <= 5) return "P1_BORDER";
  if (q >= 5 && q <= 8 && r <= 0 && r >= -5) return "P2_BORDER";

  // Central contested zone
  if (absQ <= 3 && absR <= 3) return "CENTRAL";

  // Flanks
  if (q <= -4 && r <= -2) return "LEFT_FLANK";
  if (q >= 4 && r >= 2) return "RIGHT_FLANK";

  // North water (top edge)
  if (r <= -6) return "NORTH_SEA";
  // South water (bottom edge)
  if (r >= 6) return "SOUTH_SEA";

  return "MIDFIELD";
}

// ── Landmark definitions ───────────────────────────────────────
const LANDMARKS = [
  { id: "the-spire",      q: 0,  r: 0,  name: "The Spire",        terrain: "volcanic", heightRange: [0.8, 1.2] },
  { id: "drowned-gate",   q: -4, r: -3, name: "Drowned Gate",     terrain: "water",    heightRange: [0.1, 0.3] },
  { id: "rotwood-hollow", q: 4,  r: 3,  name: "Rotwood Hollow",   terrain: "swamp",    heightRange: [0.3, 0.6] },
  { id: "bone-reef",      q: 0,  r: -5, name: "Bone Reef",        terrain: "water",    heightRange: [0.1, 0.2] },
  { id: "wailing-deep",   q: 0,  r: 5,  name: "Wailing Deep",     terrain: "water",    heightRange: [0.1, 0.2] },
  { id: "cinder-peak",    q: -2, r: 3,  name: "Cinder Peak",      terrain: "volcanic", heightRange: [0.6, 1.0] },
  { id: "corpse-bog",     q: 3,  r: -1, name: "Corpse Bog",       terrain: "swamp",    heightRange: [0.2, 0.5] },
  { id: "shatter-isle",   q: 5,  r: -4, name: "Shatter Isle",     terrain: "volcanic", heightRange: [1.0, 1.8] },
  { id: "ghoul-spire",    q: -5, r: 4,  name: "Ghoul Spire",      terrain: "mountain", heightRange: [1.2, 2.0] },
];

const LANDMARK_BY_COORD = {};
for (const lm of LANDMARKS) {
  LANDMARK_BY_COORD[`${lm.q},${lm.r}`] = lm;
}
const LANDMARK_IDS = new Set(LANDMARKS.map(l => l.id));

// ── Mountain chokepoints ───────────────────────────────────────
const MOUNTAIN_HEXES = new Set([
  // Central diagonal spine (creates 2 gaps for center path)
  "-3,-3", "-2,-3", "-1,-2", "0,-1",
  "1,1",  "2,2",  "3,3",
  // North barrier wall (left side)
  "-5,-2", "-4,-2", "-3,-1",
  // South barrier wall (right side)
  "5,2",  "4,2",  "3,1",
  // Left flank wall
  "-5,-4", "-4,-5", "-3,-5", "-2,-5",
  // Right flank wall
  "5,4",  "4,5",  "3,5",  "2,5",
  // Scattered impassable peaks
  "-6,-3", "6,3", "-7,1", "7,-1",
]);

// ── Water hexes (shallow sea, archipelago feel) ────────────────
const WATER_HEXES = new Set([
  // North sea
  "-3,-6", "-2,-6", "-1,-6", "0,-6", "1,-6", "2,-6", "3,-6",
  "-4,-5", "-1,-5", "1,-5", "4,-5",
  "-5,-3", "5,-3",
  // South sea
  "-3,6",  "-2,6",  "-1,6",  "0,6",  "1,6",  "2,6",  "3,6",
  "-4,5",  "-1,5",  "1,5",  "4,5",
  "-5,3",  "5,3",
  // Central waterways
  "-3,4", "3,-4",
  "-5,0", "5,0",
  "-2,5", "2,-5",
]);

// ── Swamp hexes ────────────────────────────────────────────────
const SWAMP_HEXES = new Set([
  "-4,1", "-3,2", "-2,1",
  "4,-1", "3,-2", "2,-1",
  "-1,3", "0,2", "1,-3", "0,-2",
  "-4,3", "4,-3",
  "-6,2", "6,-2",
]);

// ── Floating high-ground islands ───────────────────────────────
const HIGH_GROUND_HEXES = new Set([
  "-7,4", "7,-4",   // Tower hexes elevated
  "-2,-4", "2,4",   // Flank islands
  "-6,-5", "6,5",   // Edge peaks
]);

// ── Terrain assignment ─────────────────────────────────────────
function assignTerrain(q, r, zone) {
  const key = `${q},${r}`;

  // Landmarks override
  const lm = LANDMARK_BY_COORD[key];
  if (lm) return { terrain: lm.terrain, heightRange: lm.heightRange };

  // Explicit terrain maps
  if (MOUNTAIN_HEXES.has(key))
    return { terrain: "mountain", heightRange: [1.2, 2.2] };
  if (WATER_HEXES.has(key))
    return { terrain: "water", heightRange: [0.05, 0.2] };
  if (SWAMP_HEXES.has(key))
    return { terrain: "swamp", heightRange: [0.15, 0.4] };
  if (HIGH_GROUND_HEXES.has(key))
    return { terrain: "high-ground", heightRange: [1.0, 1.8] };

  const h = hashCoord(q, r, MAP_SEED + 200);

  switch (zone) {
    case "P1_HOME":
    case "P2_HOME":
      return { terrain: "plains", heightRange: [0.6, 1.0] };

    case "P1_BORDER":
    case "P2_BORDER":
      if (h < 0.70) return { terrain: "plains", heightRange: [0.5, 0.9] };
      if (h < 0.90) return { terrain: "forest", heightRange: [0.4, 0.8] };
      return { terrain: "volcanic", heightRange: [0.3, 0.7] };

    case "CENTRAL":
      if (h < 0.35) return { terrain: "plains", heightRange: [0.3, 0.5] };
      if (h < 0.60) return { terrain: "volcanic", heightRange: [0.4, 0.8] };
      if (h < 0.80) return { terrain: "swamp", heightRange: [0.15, 0.35] };
      return { terrain: "forest", heightRange: [0.3, 0.6] };

    case "LEFT_FLANK":
    case "RIGHT_FLANK":
      if (h < 0.45) return { terrain: "plains", heightRange: [0.3, 0.6] };
      if (h < 0.70) return { terrain: "forest", heightRange: [0.4, 0.8] };
      if (h < 0.88) return { terrain: "swamp", heightRange: [0.2, 0.4] };
      return { terrain: "volcanic", heightRange: [0.3, 0.6] };

    case "NORTH_SEA":
    case "SOUTH_SEA":
      if (h < 0.55) return { terrain: "water", heightRange: [0.05, 0.15] };
      if (h < 0.75) return { terrain: "swamp", heightRange: [0.1, 0.3] };
      if (h < 0.90) return { terrain: "plains", heightRange: [0.2, 0.4] };
      return { terrain: "mountain", heightRange: [0.8, 1.4] };

    case "MIDFIELD":
    default:
      if (h < 0.42) return { terrain: "plains", heightRange: [0.3, 0.6] };
      if (h < 0.62) return { terrain: "forest", heightRange: [0.4, 0.9] };
      if (h < 0.78) return { terrain: "swamp", heightRange: [0.2, 0.5] };
      if (h < 0.90) return { terrain: "volcanic", heightRange: [0.3, 0.7] };
      return { terrain: "mountain", heightRange: [0.6, 1.2] };
  }
}

// ── Name generation ────────────────────────────────────────────
const ZONE_PREFIXES = {
  P1_HOME:     ["Crimson", "Bastion", "Guard", "Hearth", "Blight"],
  P2_HOME:     ["Azure", "Citadel", "Watch", "Sanctum", "Rot"],
  P1_BORDER:   ["Bulwark", "Rampart", "Shield", "Outpost", "Sorrow"],
  P2_BORDER:   ["Fortress", "Redoubt", "Bastion", "Castle", "Torment"],
  CENTRAL:     ["Scarred", "Cinder", "Shattered", "Blight", "Ashen"],
  LEFT_FLANK:  ["Shadow", "Whisper", "Veiled", "Twilight", "Murky"],
  RIGHT_FLANK: ["Gloom", "Dusk", "Hidden", "Murky", "Grave"],
  NORTH_SEA:   ["Drowned", "Sunken", "Abyssal", "Deep", "Fathom"],
  SOUTH_SEA:   ["Wailing", "Churning", "Black", "Frozen", "Hollow"],
  MIDFIELD:    ["Broken", "Windswept", "Fallow", "Withered", "Bleak", "Ashen", "Corpse"],
};

const TERRAIN_SUFFIXES = {
  plains:      ["Field", "Prairie", "Heath", "Steppe", "Meadow"],
  forest:      ["Thicket", "Wood", "Grove", "Copse", "Briar"],
  mountain:    ["Ridge", "Peak", "Crag", "Cliff", "Spur"],
  swamp:       ["Mire", "Fen", "Bog", "Marsh", "Quag"],
  water:       ["Pool", "Lake", "Reach", "Deep", "Bay"],
  volcanic:    ["Wastes", "Caldron", "Fissure", "Vent", "Scar"],
  "high-ground":["Isle", "Plateau", "Mesa", "Rise", "Knoll"],
};

let _nameCounter = {};
function generateName(q, r, terrain, zone) {
  const h = hashCoord(q, r, MAP_SEED + 400);
  const lm = LANDMARK_BY_COORD[`${q},${r}`];
  if (lm) return lm.name;

  const prefixes = ZONE_PREFIXES[zone] || ZONE_PREFIXES.MIDFIELD;
  const suffixes = TERRAIN_SUFFIXES[terrain] || TERRAIN_SUFFIXES.plains;

  const pIdx = Math.floor(h * prefixes.length);
  const sIdx = Math.floor(hashCoord(q, r, MAP_SEED + 401) * suffixes.length);
  const name = `${prefixes[pIdx]} ${suffixes[sIdx]}`;

  const key = name;
  _nameCounter[key] = (_nameCounter[key] || 0) + 1;
  if (_nameCounter[key] > 1) return `${name} ${_nameCounter[key]}`;
  return name;
}

// ── Build all regions ──────────────────────────────────────────
function buildRegions() {
  _nameCounter = {};
  const regions = [];
  const coordList = Array.from(COORD_SET).map(s => {
    const [q, r] = s.split(",").map(Number);
    return { q, r };
  });
  coordList.sort((a, b) => a.q - b.q || a.r - b.r);

  for (const { q, r } of coordList) {
    const zone = classifyZone(q, r);
    const { terrain, heightRange } = assignTerrain(q, r, zone);
    const h = hashCoord(q, r, MAP_SEED + 500);
    const height = Math.round((heightRange[0] + h * (heightRange[1] - heightRange[0])) * 100) / 100;

    const lm = LANDMARK_BY_COORD[`${q},${r}`];
    const id = lm ? lm.id : `hex-${q}-${r}`;
    const name = generateName(q, r, terrain, zone);
    const isHome = zone === "P1_HOME" ? "player-1" : zone === "P2_HOME" ? "player-2" : null;

    const chokes = new Set([
      "-2,-2", "-1,-1", "2,2", "1,1",  // central gaps
      "-3,-4", "-4,-3", "3,4", "4,3",  // flank chokes
    ]);
    const isChokepoint = chokes.has(`${q},${r}`);

    regions.push({
      id, q, r, terrain, name, height, zone,
      isChokepoint,
      isCorridor: false,
      coverBonus: terrain === "forest" ? 0.4 : terrain === "swamp" ? 0.3 : terrain === "high-ground" ? 0.5 : 0,
      isHome,
      isLandmark: LANDMARK_IDS.has(id),
    });
  }

  return regions;
}

const BATTLEFIELD_REGIONS = buildRegions();
const BATTLEFIELD_COORD_SET = COORD_SET;

export { BATTLEFIELD_REGIONS, BATTLEFIELD_COORD_SET, LANDMARKS, LANDMARK_IDS, LANDMARK_BY_COORD };

// ── Map metadata ───────────────────────────────────────────────
export const BATTLEFIELD_META = {
  name: "Abyssal Archipelago",
  description: "A shattered realm of dark rocky islands, drowned seas, and corrupted peaks. Flank through the shadow channels, breach the central spire, or hold the high ground.",
  regionCount: BATTLEFIELD_REGIONS.length,
};
