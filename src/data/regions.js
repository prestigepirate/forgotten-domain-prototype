// Region map: axial hex coords + terrain + names
// Axial coords: q (column), r (row)
// World conversion: x = size * (3/2 * q), z = size * (sqrt(3)/2 * q + sqrt(3) * r)

import { BATTLEFIELD_REGIONS, BATTLEFIELD_META } from "./battlefieldMap";

export const HEX_SIZE = 1.6;

// ── 61 shared region IDs (radius-4 hexagon) ──────────────────
const REGION_IDS = [
  "ashen-gate",   "black-bog",    "bleakmoor",    "blightwood",
  "bloodfen",     "bonefield",    "brimstone",    "charnel",
  "cinder-crest", "cinder-moor",  "corpse-mire",  "darkwater",
  "deadwood",     "deep-water",   "doomcrest",    "dragons-perch",
  "dreadmarsh",   "dreadpeak",    "duskwood",     "emberfall",
  "fire-hearth",  "forge-gate",   "frostpeak",    "gloomfen",
  "gloomwood",    "gravecrest",   "grey-marches", "grimhearth",
  "grimstone",    "high-plains",  "iron-peak",    "ironmaw",
  "ironwood",     "nightwood",    "obsidian-marsh","ravenwood",
  "rotwood",      "rustfield",    "shadowfen",    "shadowmoor",
  "silver-prairie","skyreach",    "sorrowfield",  "soulmere",
  "stillwater",   "stonewail",    "storm-bay",    "stormcrest",
  "sunken-hollow","the-spire",    "thornwood",    "twin-peaks",
  "voidmarsh",    "wastefield",   "widowwood",    "wildergrove",
  "wind-shear",   "witherfield",  "wolfs-wood",   "wraithpeak",
  "rustmaw",
];

function nameToLabel(id) {
  return id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// Terrain height ranges
const H = { plains: [0.3,0.7], forest: [0.5,1.1], mountain: [1.2,2.2], swamp: [0.2,0.5], water: [0.1,0.3], volcanic: [1.0,2.6] };

function h(terrain, rand) {
  const [lo, hi] = H[terrain];
  return Math.round((lo + rand() * (hi - lo)) * 100) / 100;
}

// ── Map 1: Ashen Wastes ──────────────────────────────────────
function ashenWastes(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  const absQ = Math.abs(q);
  // Central volcanic spine
  if (absQ <= 1 && Math.abs(r) <= 2) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Mountain ridges flanking center
  if ((absQ === 2 && Math.abs(r) <= 2) || (absQ === 3 && Math.abs(r) <= 1)) return { terrain: "mountain", height: h("mountain", rand) };
  // Swamp pockets in corners
  if (dist > 3.5 && rand() > 0.5) return { terrain: "swamp", height: h("swamp", rand) };
  // Forest on mid-edges
  if (dist > 2.8 && absQ >= 2) return { terrain: "forest", height: h("forest", rand) };
  // Water features
  if (((q === -3 && r === 3) || (q === 3 && r === -3) || (q === -3 && r === -2) || (q === 3 && r === 2))) return { terrain: "water", height: h("water", rand) };
  // Plains elsewhere
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 2: Shadow Marshes ────────────────────────────────────
function shadowMarshes(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  // Central swamp basin
  if (dist < 2.5) return { terrain: "swamp", height: h("swamp", rand) };
  // Water ring at mid-distance creating chokepoints
  if (dist > 2.3 && dist < 3.3 && (Math.abs(q) < 2 || Math.abs(r) < 2)) return { terrain: "water", height: h("water", rand) };
  // Forest on outer ring
  if (dist > 2.8) return { terrain: "forest", height: h("forest", rand) };
  // Volcanic pockets
  if ((Math.abs(q) === 3 && r === 0) || (q === 0 && Math.abs(r) === 3)) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Mountain corners
  if (dist > 3.5) return { terrain: "mountain", height: h("mountain", rand) };
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 3: Iron Ridges ───────────────────────────────────────
function ironRidges(q, r, rand) {
  const absQ = Math.abs(q);
  // Three mountain lanes creating corridors
  if (absQ === 3 && Math.abs(r) <= 2) return { terrain: "mountain", height: h("mountain", rand) };
  if (absQ === 1 && Math.abs(r) <= 3 && Math.abs(r) >= 1) return { terrain: "mountain", height: h("mountain", rand) };
  // Volcanic center
  if (absQ <= 1 && Math.abs(r) <= 1) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Water in low valleys
  if ((q === -2 && r === -1) || (q === 2 && r === 1) || (q === 0 && r === -3) || (q === 0 && r === 3)) return { terrain: "water", height: h("water", rand) };
  // Swamp in depressions
  if ((q === -2 && r === 2) || (q === 2 && r === -2)) return { terrain: "swamp", height: h("swamp", rand) };
  // Forest on edge positions
  if (Math.abs(r) >= 3) return { terrain: "forest", height: h("forest", rand) };
  // Plains corridors between mountains
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 4: Blightwood ────────────────────────────────────────
function blightwood(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  // Dense forest everywhere
  if (dist > 1.2) return { terrain: "forest", height: h("forest", rand) };
  // Central blighted volcanic clearing
  if (dist < 0.8) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Scattered swamp clearings
  if ((Math.abs(q) === 2 && Math.abs(r) === 2) || (q === 3 && r === -1) || (q === -3 && r === 1)) return { terrain: "swamp", height: h("swamp", rand) };
  // Water features
  if ((q === 1 && r === -3) || (q === -1 && r === 3) || (q === -2 && r === -3)) return { terrain: "water", height: h("water", rand) };
  // A few mountain peaks rising above the canopy
  if ((Math.abs(q) === 3 && r === 0) || (q === 0 && Math.abs(r) === 3)) return { terrain: "mountain", height: h("mountain", rand) };
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 5: Cinder Plains ─────────────────────────────────────
function cinderPlains(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  // Mostly open plains
  if (dist < 3.5 && rand() > 0.3) return { terrain: "plains", height: h("plains", rand) };
  // Scattered volcanic pockets
  if (rand() > 0.6) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Mountain rim
  if (dist > 3.2) return { terrain: "mountain", height: h("mountain", rand) };
  // Water oases
  if ((Math.abs(q) === 3 && r === 0) || (q === 0 && Math.abs(r) === 3) || (q === 2 && r === -3) || (q === -2 && r === 3)) return { terrain: "water", height: h("water", rand) };
  // Forest patches
  if (dist > 2 && dist < 3 && rand() > 0.5) return { terrain: "forest", height: h("forest", rand) };
  return { terrain: "swamp", height: h("swamp", rand) };
}

// ── Build all maps ───────────────────────────────────────────
const MAP_GENERATORS = {
  "ashen-wastes":      { name: "Ashen Wastes",      desc: "Volcanic spine flanked by mountain ridges. Control the high ground.",        fn: ashenWastes },
  "shadow-marshes":    { name: "Shadow Marshes",    desc: "A sunken swamp basin ringed by water. Chokepoints define the battle.",      fn: shadowMarshes },
  "iron-ridges":       { name: "Iron Ridges",       desc: "Parallel mountain ranges form three corridors. Lane control is everything.", fn: ironRidges },
  "blightwood":        { name: "Blightwood",        desc: "Dense dark forest with a blighted volcanic heart. Close-quarters combat.",  fn: blightwood },
  "cinder-plains":     { name: "Cinder Plains",     desc: "Open plains dotted with volcanic pockets. Mobility is key.",                 fn: cinderPlains },
};

const MAP_POOL = {};

for (const [mapId, def] of Object.entries(MAP_GENERATORS)) {
  const rand = rng(mapId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const regions = [];
  let idx = 0;
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) > 4) continue;
      const { terrain, height } = def.fn(q, r, rand);
      regions.push({
        id: REGION_IDS[idx],
        q, r, terrain,
        name: nameToLabel(REGION_IDS[idx]),
        height,
      });
      idx++;
    }
  }
  MAP_POOL[mapId] = { name: def.name, description: def.desc, regions };
}

// ── Map: Abyssal Archipelago (battlefield map — currently the ONLY active map) ──
MAP_POOL["abyssal-archipelago"] = {
  name: BATTLEFIELD_META.name,
  description: BATTLEFIELD_META.description,
  regions: BATTLEFIELD_REGIONS,
};

// Keep old ID working as alias
MAP_POOL["shattered-realm"] = MAP_POOL["abyssal-archipelago"];

// All map IDs
export const MAP_IDS = Object.keys(MAP_POOL);

// Currently active map
let activeMapId = "abyssal-archipelago";

export function getActiveMapId() {
  return activeMapId;
}

export function pickRandomMap() {
  const id = "abyssal-archipelago";
  setActiveMapId(id);
  return id;
}

export function getActiveMap() {
  return MAP_POOL[activeMapId] || MAP_POOL[MAP_IDS[0]];
}

export function getRegions() {
  return _regionsArray;
}

// ── When active map changes, rebuild O(1) lookup indices ──
export function setActiveMapId(mapId) {
  activeMapId = mapId;
  _rebuildLookups();
  _coordSet = buildCoordSet();
  // Invalidate blocked coords cache
  _blockedCoords = null;
  _blockedCoordsTimestamp = 0;
}

// ── Terrain colors (lighter for battlefield map visibility) ──
export const TERRAIN_COLORS = {
  plains:      "#7a6a4a",
  forest:      "#2a4a1e",
  mountain:    "#5a5a6a",
  swamp:       "#4a3a5a",
  water:       "#2a4666",
  volcanic:    "#6a2a1a",
  "high-ground": "#4a3828",   // dark brown cliff edge
};

// ── Precomputed lookup indices (O(1) instead of O(n) .find()) ──
// Rebuilt whenever the active map changes
let _regionById = new Map();
let _regionByCoord = new Map();
let _regionsArray = [];

function _rebuildLookups() {
  _regionsArray = getActiveMap().regions;
  _regionById.clear();
  _regionByCoord.clear();
  for (const r of _regionsArray) {
    _regionById.set(r.id, r);
    _regionByCoord.set(`${r.q},${r.r}`, r);
  }
}

// Eagerly build for initial map
_rebuildLookups();

export function getRegionById(id) {
  return _regionById.get(id) || null;
}

export function getRegionByCoord(q, r) {
  return _regionByCoord.get(`${q},${r}`) || null;
}

// ── Impassable terrain set (used by BFS, created once) ──
const IMPASSABLE = new Set(["mountain", "water", "volcanic", "high-ground"]);

// ── Cache for editor-placed blocked hexes (refreshed lazily) ──
let _blockedCoords = null;
let _blockedCoordsTimestamp = 0;
const BLOCKED_CACHE_TTL = 2000; // 2 second cache

function _getBlockedCoords() {
  const now = Date.now();
  if (_blockedCoords && now - _blockedCoordsTimestamp < BLOCKED_CACHE_TTL) {
    return _blockedCoords;
  }
  const blocked = new Set();
  try {
    const raw = localStorage.getItem("duel-realms-editor-objects");
    if (raw) {
      const placed = JSON.parse(raw);
      for (const obj of placed) {
        if (obj.type === "hex" && obj.terrain && obj.terrain !== "plains") {
          const [hx, , hz] = obj.position;
          const [bq, br] = worldToHex(hx, hz);
          blocked.add(`${Math.round(bq)},${Math.round(br)}`);
        }
      }
    }
  } catch { /* ignore */ }
  _blockedCoords = blocked;
  _blockedCoordsTimestamp = now;
  return blocked;
}

// Convert axial hex coords to world position
export function hexToWorld(q, r, size = HEX_SIZE) {
  const x = size * (3 / 2 * q);
  const z = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, 0, z];
}

// Reverse: world position → nearest hex coordinates
export function worldToHex(wx, wz, size = HEX_SIZE) {
  const q = (2 / 3 * wx) / size;
  const r = (-1 / 3 * wx + Math.sqrt(3) / 3 * wz) / size;
  // Round to nearest hex
  return hexRound(q, r);
}

function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

// Get neighbors of a hex
export function getNeighbors(q, r) {
  return HEX_DIRECTIONS.map(([dq, dr]) => [q + dq, r + dr]);
}

function buildCoordSet() {
  const set = new Set();
  for (const r of getRegions()) {
    set.add(`${r.q},${r.r}`);
  }
  return set;
}

let _coordSet = buildCoordSet();

export function getAdjacentRegions(region) {
  return getNeighbors(region.q, region.r)
    .filter(([q, r]) => _coordSet.has(`${q},${r}`))
    .map(([q, r]) => getRegionByCoord(q, r))
    .filter(Boolean);
}

// ── Movement range ──────────────────────────────────────
// Levels 1-4 move 2 hexes, levels 5+ move 3 hexes
export function getMovementRange(level) {
  if (level <= 4) return 2;
  return 3;
}

// ── Static neighbors directions (avoids array creation per call) ──
const HEX_DIRECTIONS = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1],
];

// BFS from a hex, returning all reachable regions within maxSteps
export function getReachableHexes(fromQ, fromR, maxSteps) {
  const blockedCoords = _getBlockedCoords();

  const result = [];
  const visited = new Set([`${fromQ},${fromR}`]);
  let frontier = [[fromQ, fromR]];

  for (let step = 1; step <= maxSteps; step++) {
    const nextFrontier = [];
    for (const [q, r] of frontier) {
      for (const [dq, dr] of HEX_DIRECTIONS) {
        const nq = q + dq;
        const nr = r + dr;
        const key = `${nq},${nr}`;
        if (visited.has(key)) continue;
        if (!_coordSet.has(key)) continue;
        if (blockedCoords.has(key)) continue;
        visited.add(key);
        const region = getRegionByCoord(nq, nr);
        if (region) {
          if (IMPASSABLE.has(region.terrain)) continue;
          result.push({ region, steps: step });
          nextFrontier.push([nq, nr]);
        }
      }
    }
    frontier = nextFrontier;
  }
  return result;
}
