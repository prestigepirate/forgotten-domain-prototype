// ── PBR terrain texture generator ───────────────────────────────
// Generates canvas-based albedo, normal, and roughness maps for
// each terrain type. When real PNG files exist in
// /public/textures/terrain/{terrain}_{type}.png they take priority.
// Otherwise the procedural fallback renders immediately.

import * as THREE from "three";

const SIZE = 512;

// Seedable hash for deterministic patterns
function hash(x, y, seed) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) / 2147483647 + 0.5;
}

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy, seed);
  const n10 = hash(ix + 1, iy, seed);
  const n01 = hash(ix, iy + 1, seed);
  const n11 = hash(ix + 1, iy + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbm(x, y, seed, octaves = 5) {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * smoothNoise(x * freq, y * freq, seed + i);
    max += amp;
    freq *= 2.3;
    amp *= 0.5;
  }
  return v / max;
}

// Create canvas + context
function makeCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  return [c, c.getContext("2d")];
}

// ── Terrain generators ────────────────────────────────────────

function genVolcanic(seed) {
  const [c, ctx] = makeCanvas();
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 8, v * 8, seed, 5);
      const n2 = fbm(u * 4 + 3, v * 4 + 1, seed + 10, 4);
      // Dark basalt base
      const r = 50 + n * 60 + n2 * 30;
      const g = 30 + n * 40 + n2 * 20;
      const b = 28 + n * 45 + n2 * 15;
      // Glowing fissures
      const fissure = Math.max(0, (n2 - 0.55) * 3);
      img.data[i] = Math.min(255, r + fissure * 200);
      img.data[i + 1] = Math.min(255, g + fissure * 80);
      img.data[i + 2] = Math.min(255, b + fissure * 20);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Normal map
  const [cn, ctxn] = makeCanvas();
  const nm = ctxn.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const eps = 1 / SIZE;
      const hL = fbm(u - eps, v, seed, 5);
      const hR = fbm(u + eps, v, seed, 5);
      const hD = fbm(u, v - eps, seed, 5);
      const hU = fbm(u, v + eps, seed, 5);
      const strength = 6;
      const dx = (hR - hL) * strength;
      const dy = (hU - hD) * strength;
      nm.data[i] = Math.floor((dx * 0.5 + 0.5) * 255);
      nm.data[i + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
      nm.data[i + 2] = 255;
      nm.data[i + 3] = 255;
    }
  }
  ctxn.putImageData(nm, 0, 0);

  // Roughness — darker = shinier (fissure glow)
  const [cr, ctxr] = makeCanvas();
  const rm = ctxr.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 6, v * 6, seed, 4);
      const vR = 140 + n * 80;
      rm.data[i] = rm.data[i + 1] = rm.data[i + 2] = vR;
      rm.data[i + 3] = 255;
    }
  }
  ctxr.putImageData(rm, 0, 0);

  return { albedo: c, normal: cn, roughness: cr };
}

function genWater(seed) {
  const [c, ctx] = makeCanvas();
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 6, v * 6, seed, 5);
      const n2 = fbm(u * 3 + 2, v * 3, seed + 7, 4);
      const wave = Math.sin(u * 20 + n * 6) * Math.cos(v * 18 + n2 * 5) * 0.5 + 0.5;
      // Deep dark water
      const r = 15 + n * 25 + wave * 10;
      const g = 30 + n * 50 + n2 * 25 + wave * 15;
      const b = 60 + n * 70 + n2 * 35 + wave * 20;
      img.data[i] = Math.min(255, r);
      img.data[i + 1] = Math.min(255, g);
      img.data[i + 2] = Math.min(255, b);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Normal
  const [cn, ctxn] = makeCanvas();
  const nm = ctxn.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const eps = 1 / SIZE;
      const hL = fbm(u - eps, v, seed, 5);
      const hR = fbm(u + eps, v, seed, 5);
      const hD = fbm(u, v - eps, seed, 5);
      const hU = fbm(u, v + eps, seed, 5);
      const s = 4;
      nm.data[i] = Math.floor(((hR - hL) * s * 0.5 + 0.5) * 255);
      nm.data[i + 1] = Math.floor(((hU - hD) * s * 0.5 + 0.5) * 255);
      nm.data[i + 2] = 255;
      nm.data[i + 3] = 255;
    }
  }
  ctxn.putImageData(nm, 0, 0);

  // Roughness — water is shiny (low roughness)
  const [cr, ctxr] = makeCanvas();
  const rm = ctxr.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 4, v * 4, seed, 3);
      const vR = 50 + n * 40;
      rm.data[i] = rm.data[i + 1] = rm.data[i + 2] = vR;
      rm.data[i + 3] = 255;
    }
  }
  ctxr.putImageData(rm, 0, 0);

  return { albedo: c, normal: cn, roughness: cr };
}

function genForest(seed) {
  const [c, ctx] = makeCanvas();
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 7, v * 7, seed, 5);
      const n2 = fbm(u * 3 + 1, v * 3 + 2, seed + 8, 4);
      // Rich dark soil + mossy greens
      const soil = 65 + n * 55;
      const green = 55 + n2 * 70;
      img.data[i] = Math.min(255, soil * 0.5 + n * 20);
      img.data[i + 1] = Math.min(255, green);
      img.data[i + 2] = Math.min(255, soil * 0.2 + n * 8);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Normal
  const [cn, ctxn] = makeCanvas();
  const nm = ctxn.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const eps = 1 / SIZE;
      const hL = fbm(u - eps, v, seed, 5);
      const hR = fbm(u + eps, v, seed, 5);
      const hD = fbm(u, v - eps, seed, 5);
      const hU = fbm(u, v + eps, seed, 5);
      const s = 5;
      nm.data[i] = Math.floor(((hR - hL) * s * 0.5 + 0.5) * 255);
      nm.data[i + 1] = Math.floor(((hU - hD) * s * 0.5 + 0.5) * 255);
      nm.data[i + 2] = 255;
      nm.data[i + 3] = 255;
    }
  }
  ctxn.putImageData(nm, 0, 0);

  // Roughness — forest floor is matte
  const [cr, ctxr] = makeCanvas();
  const rm = ctxr.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 5, v * 5, seed, 4);
      const vR = 180 + n * 50;
      rm.data[i] = rm.data[i + 1] = rm.data[i + 2] = vR;
      rm.data[i + 3] = 255;
    }
  }
  ctxr.putImageData(rm, 0, 0);

  return { albedo: c, normal: cn, roughness: cr };
}

function genSwamp(seed) {
  const [c, ctx] = makeCanvas();
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 6, v * 6, seed, 5);
      const n2 = fbm(u * 3 + 2, v * 3 + 3, seed + 9, 4);
      // Murky purple-brown with algae green
      const r = 45 + n * 40 + n2 * 20;
      const g = 30 + n * 35 + n2 * 35;
      const b = 50 + n * 50 + n2 * 25;
      img.data[i] = Math.min(255, r);
      img.data[i + 1] = Math.min(255, g);
      img.data[i + 2] = Math.min(255, b);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Normal
  const [cn, ctxn] = makeCanvas();
  const nm = ctxn.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const eps = 1 / SIZE;
      const hL = fbm(u - eps, v, seed, 5);
      const hR = fbm(u + eps, v, seed, 5);
      const hD = fbm(u, v - eps, seed, 5);
      const hU = fbm(u, v + eps, seed, 5);
      const s = 3;
      nm.data[i] = Math.floor(((hR - hL) * s * 0.5 + 0.5) * 255);
      nm.data[i + 1] = Math.floor(((hU - hD) * s * 0.5 + 0.5) * 255);
      nm.data[i + 2] = 255;
      nm.data[i + 3] = 255;
    }
  }
  ctxn.putImageData(nm, 0, 0);

  // Roughness — murky water is somewhat glossy
  const [cr, ctxr] = makeCanvas();
  const rm = ctxr.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 4, v * 4, seed, 3);
      const vR = 100 + n * 50;
      rm.data[i] = rm.data[i + 1] = rm.data[i + 2] = vR;
      rm.data[i + 3] = 255;
    }
  }
  ctxr.putImageData(rm, 0, 0);

  return { albedo: c, normal: cn, roughness: cr };
}

function genMountain(seed) {
  const [c, ctx] = makeCanvas();
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 7, v * 7, seed, 6);
      const n2 = fbm(u * 3 + 1, v * 3 - 1, seed + 6, 4);
      const ridges = Math.abs(n - 0.5) * 2;
      const ridgeV = Math.pow(ridges, 2);
      // Gray stone with strata lines
      const gray = 75 + ridgeV * 105 + n2 * 40;
      // Ore vein subtle tint
      const r = gray + n2 * 12;
      const g = gray;
      const b = gray + n2 * 8;
      img.data[i] = Math.min(255, r);
      img.data[i + 1] = Math.min(255, g);
      img.data[i + 2] = Math.min(255, b);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Normal — strong ridges
  const [cn, ctxn] = makeCanvas();
  const nm = ctxn.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const eps = 1 / SIZE;
      const hL = fbm(u - eps, v, seed, 6);
      const hR = fbm(u + eps, v, seed, 6);
      const hD = fbm(u, v - eps, seed, 6);
      const hU = fbm(u, v + eps, seed, 6);
      const s = 7;
      nm.data[i] = Math.floor(((hR - hL) * s * 0.5 + 0.5) * 255);
      nm.data[i + 1] = Math.floor(((hU - hD) * s * 0.5 + 0.5) * 255);
      nm.data[i + 2] = 255;
      nm.data[i + 3] = 255;
    }
  }
  ctxn.putImageData(nm, 0, 0);

  // Roughness — rough stone
  const [cr, ctxr] = makeCanvas();
  const rm = ctxr.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 6, v * 6, seed, 4);
      const vR = 160 + n * 60;
      rm.data[i] = rm.data[i + 1] = rm.data[i + 2] = vR;
      rm.data[i + 3] = 255;
    }
  }
  ctxr.putImageData(rm, 0, 0);

  return { albedo: c, normal: cn, roughness: cr };
}

function genPlains(seed) {
  const [c, ctx] = makeCanvas();
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 6, v * 6, seed, 5);
      const n2 = fbm(u * 4 + 2, v * 4, seed + 5, 3);
      // Golden-green grassland
      const r = 90 + n * 50 + n2 * 25;
      const g = 75 + n * 55 + n2 * 25;
      const b = 30 + n * 30 + n2 * 15;
      img.data[i] = Math.min(255, r);
      img.data[i + 1] = Math.min(255, g);
      img.data[i + 2] = Math.min(255, b);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Normal — gentle wind-swept ripples
  const [cn, ctxn] = makeCanvas();
  const nm = ctxn.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const eps = 1 / SIZE;
      const hL = fbm(u - eps, v, seed, 5);
      const hR = fbm(u + eps, v, seed, 5);
      const hD = fbm(u, v - eps, seed, 5);
      const hU = fbm(u, v + eps, seed, 5);
      const s = 3;
      nm.data[i] = Math.floor(((hR - hL) * s * 0.5 + 0.5) * 255);
      nm.data[i + 1] = Math.floor(((hU - hD) * s * 0.5 + 0.5) * 255);
      nm.data[i + 2] = 255;
      nm.data[i + 3] = 255;
    }
  }
  ctxn.putImageData(nm, 0, 0);

  // Roughness — matte grassland
  const [cr, ctxr] = makeCanvas();
  const rm = ctxr.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 5, v * 5, seed, 3);
      const vR = 170 + n * 55;
      rm.data[i] = rm.data[i + 1] = rm.data[i + 2] = vR;
      rm.data[i + 3] = 255;
    }
  }
  ctxr.putImageData(rm, 0, 0);

  return { albedo: c, normal: cn, roughness: cr };
}

// ── Cache ────────────────────────────────────────────────────

// ── Nyx-0: Dark cracked charcoal with Fracture vein glow ──────
function genNyx0(seed) {
  const [c, ctx] = makeCanvas();
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 8, v * 8, seed, 5);
      const n2 = fbm(u * 5 + 3, v * 5 + 1, seed + 10, 4);
      const n3 = fbm(u * 9 + 7, v * 9 + 5, seed + 20, 3);
      // Deep charcoal base (near-black with subtle variation)
      const base = 12 + n * 18 + n2 * 8;
      const r = base + n3 * 6;
      const g = base + n3 * 4;
      const b = base + n3 * 10;

      // Fracture veins — glowing cyan/purple cracks
      const fracture = Math.max(0, (n2 - 0.58) * 4);
      const veinColor = n3 > 0.5
        ? [40 + fracture * 200, 60 + fracture * 180, 80 + fracture * 175] // cyan
        : [60 + fracture * 150, 20 + fracture * 100, 80 + fracture * 175]; // purple

      img.data[i] = Math.min(255, r + veinColor[0]);
      img.data[i + 1] = Math.min(255, g + veinColor[1]);
      img.data[i + 2] = Math.min(255, b + veinColor[2]);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Normal map
  const [cn, ctxn] = makeCanvas();
  const nm = ctxn.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const eps = 1 / SIZE;
      const hL = fbm(u - eps, v, seed, 5);
      const hR = fbm(u + eps, v, seed, 5);
      const hD = fbm(u, v - eps, seed, 5);
      const hU = fbm(u, v + eps, seed, 5);
      const s = 5;
      nm.data[i] = Math.floor(((hR - hL) * s * 0.5 + 0.5) * 255);
      nm.data[i + 1] = Math.floor(((hU - hD) * s * 0.5 + 0.5) * 255);
      nm.data[i + 2] = 255;
      nm.data[i + 3] = 255;
    }
  }
  ctxn.putImageData(nm, 0, 0);

  // Roughness — matte cracked surface
  const [cr, ctxr] = makeCanvas();
  const rm = ctxr.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u * 6, v * 6, seed, 4);
      const vR = 170 + n * 50;
      rm.data[i] = rm.data[i + 1] = rm.data[i + 2] = vR;
      rm.data[i + 3] = 255;
    }
  }
  ctxr.putImageData(rm, 0, 0);

  return { albedo: c, normal: cn, roughness: cr };
}

const GENERATORS = {
  volcanic: genVolcanic,
  water: genWater,
  forest: genForest,
  swamp: genSwamp,
  mountain: genMountain,
  plains: genPlains,
  nyx0: genNyx0,
};

// Eagerly preload all textures at module init (sync, no suspense)
const textureCache = new Map();

function buildTextures(terrain) {
  const gen = GENERATORS[terrain];
  if (!gen) return null;
  const seed = terrain.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const canvases = gen(seed);

  const albedo = new THREE.CanvasTexture(canvases.albedo);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.needsUpdate = true;

  const normal = new THREE.CanvasTexture(canvases.normal);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  normal.needsUpdate = true;

  const roughness = new THREE.CanvasTexture(canvases.roughness);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.needsUpdate = true;

  return { albedo, normal, roughness };
}

// Preload all textures so they're ready before any component renders
for (const t of Object.keys(GENERATORS)) {
  textureCache.set(t, buildTextures(t));
}

// ── Real diffuse texture (shared across all terrains) ────────
const loader = new THREE.TextureLoader();
const sharedDiffuse = loader.load(`${import.meta.env.BASE_URL}textures/terrain/hex_diffuse.jpg`);
sharedDiffuse.wrapS = THREE.RepeatWrapping;
sharedDiffuse.wrapT = THREE.RepeatWrapping;
sharedDiffuse.colorSpace = THREE.SRGBColorSpace;

export function getTerrainTextures(terrain) {
  return textureCache.get(terrain) || null;
}

export function getSharedDiffuse() {
  return sharedDiffuse;
}
