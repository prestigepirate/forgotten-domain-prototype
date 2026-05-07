# Forgotten Domain Prototype

> Vite + React + Three.js (R3F) strategy card game with 3D hex battlefield.

## Quick Start

```bash
cd ~/ygo-strategy
npm run dev        # → http://localhost:5173/ygo-strategy/
npm run build      # production build → dist/
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Build | Vite 8 |
| UI | React 19, inline styles (no CSS framework) |
| 3D | React Three Fiber (`@react-three/fiber`), Drei (`@react-three/drei`), Postprocessing (`@react-three/postprocessing`) |
| State | Zustand (`src/data/gameState.js`) |
| 3D lib | Three.js 0.184 |

## Architecture

```
src/
├── App.jsx                  # Entry → ErrorBoundary → GameShell
├── main.jsx                 # ReactDOM mount
├── index.css                # Global reset
├── components/
│   ├── GameShell.jsx        # Top-level router: ThemePicker → DeckBuilder → Game
│   ├── GameMap.jsx          # ★ Main 3D battlefield — R3F Canvas, camera, zoom, overlays
│   ├── GameHUD.jsx          # Collapsible bottom overlay (Terminal button → stats + hand)
│   ├── GameOver.jsx         # Victory/defeat screen
│   ├── DeckBuilder.jsx      # Card selection before game
│   ├── HexRegion.jsx        # Individual hex tile (terrain mesh + extrude)
│   ├── UnitToken.jsx        # Creature unit on board
│   ├── CreatureMenu.jsx     # Right-click context menu on creatures
│   ├── MoveTargets.jsx      # Reachable hex highlights
│   ├── RegionPanel.jsx      # Selected region info panel
│   ├── TrapEffect.jsx       # Trap activation visual
│   ├── NotificationToast.jsx# Floating notifications
│   ├── BattlefieldBoundary.jsx # Map edge fencing
│   ├── NyxEnvironment.jsx   # Scene fog/lighting/atmosphere
│   └── editor/
│       ├── Editor3D.jsx     # 3D editor mode
│       └── EditorPanel.jsx  # Editor UI panel
├── data/
│   ├── gameState.js         # ★ Zustand store: HP, SP, hands, turns, creatures, towers
│   ├── regions.js           # Hex grid generation, terrain, world coords
│   ├── battlefieldMap.js    # Map layout data
│   ├── cards.js             # Card definitions (creatures, spells, traps, equipment, fields)
│   ├── themedDecks.js       # Pre-built deck archetypes
│   ├── mapObjects.js        # Prop/object placement
│   ├── movementAnims.js     # Unit movement animation system
│   └── traps.js             # Trap card logic
├── stores/
│   └── editorStore.js       # Editor mode state
└── shaders/
    └── terrainShaders.js    # Custom GLSL for terrain
```

## Camera System (GameMap.jsx)

The camera lives in `CameraController` inside GameMap.jsx. There are **three separate zoom modes**:

### 1. Preset Zoom (Buttons + / −)
- 5 discrete zoom levels defined in `ZOOM_PRESETS[]`
- Default: Level 2 (tactical, ~15u distance)
- Level 1: Close inspection (~8u), Level 5: Full map (~50u)
- Zoom-to-cursor: raycasts ground plane under cursor, snaps target to hit point
- Smooth ~0.3s lerp transition

### 2. Wheel/Trackpad Zoom (Asymmetric)
- **Scroll UP** → zoom IN toward cursor (dolly closer, restore tactical angle)
- **Scroll DOWN** → tilt UP toward airplane view (decrease polar angle, increase distance)
- Trackpad pinch automatically detected (`e.ctrlKey`)
- Smooth exponential ease, cursor-following
- During wheel zoom, OrbitControls update() is skipped to prevent fighting

### 3. Aerial View Toggle
- Pure top-down, separate from zoom system
- Toggle saves/restores camera position
- Button at bottom-right: "▲ Aerial View"

### Camera Bounds
- Map bounds: x ±19.5, z ±13 (15% padding beyond towers/hex grid)
- Distance clamped: 6–52 units
- Polar angle: 0.26–1.30 rad (~15° to ~75° from vertical)
- Soft boundary push-back on pan edges (exponential force)
- Hard clamp as safety net

### Key Constants (in GameMap.jsx)
```js
ZOOM_PRESETS = [
  { pos: [5, 3.5, 5],   target: [0, 0.5, 0] },  // Level 1
  { pos: [10, 7, 9],    target: [0, 0.5, 0] },  // Level 2 ★ default
  { pos: [16, 13, 15],  target: [0, 0.5, 0] },  // Level 3
  { pos: [22, 20, 22],  target: [0, 0.5, 0] },  // Level 4
  { pos: [28, 28, 30],  target: [0, 0.5, 0] },  // Level 5
];
ZOOM_MIN_DIST = 6;
ZOOM_MAX_DIST = 52;
ZOOM_POLAR_MIN = 0.26;   // ~15° airplane view cap
ZOOM_POLAR_MAX = 1.30;   // ~75° near-horizontal
ZOOM_POLAR_DEFAULT = 0.70; // ~40° tactical
MAP_BOUNDS = { xMin: -19.5, xMax: 19.5, zMin: -13, zMax: 13 };
```

## UI Layout

- **Full viewport border**: 2px dark purple-black (`#1a1028`) with inner glow
- **Terminal button**: bottom-center, semi-transparent glass, toggles the GameHUD overlay
- **HUD overlay**: slides up from bottom with cubic-bezier ease (0.45s)
  - Stats row: LP, enemy HP, tower HP, timer, turn, SP, deck count
  - Action buttons: AI vs AI, End Turn
  - Hand cards: 5 cards with click-to-select, right-click for detail
- **Zoom buttons**: top-right, z-index 40 (above everything)
- **Edit Map / Aerial View / Hex Outlines**: bottom corners

## Map Data

- 61 hex regions (radius-4 hexagon), `HEX_SIZE = 1.6`
- Towers: Silver [-16.8, -9.7], Gold [16.8, 9.7]
- Map extents: x ~ -16.8 to +16.8, z ~ -11.1 to +11.1
- Terrain types: plains, forest, mountain, swamp, water, volcanic
- Multiple map layouts in `battlefieldMap.js`

## Recent Changes (May 2026)

1. **Removed top navbar** — GameHUD is now a collapsible bottom overlay
2. **"Terminal" toggle** at bottom-center with smooth slide animation
3. **Full viewport border** — subtle purple-black frame around entire map
4. **5 discrete zoom levels** with preset snapping (buttons)
5. **Asymmetric scroll zoom** — scroll up zooms in, scroll down tilts to airplane view
6. **Zoom-to-cursor** — camera targets the ground point under mouse
7. **Soft pan boundaries** — rubber-band push-back at map edges
8. **Strict zoom bounds** — distance 6-52u, polar angle 15°-75°
9. **OrbitControls zoom disabled** — all zoom handled manually to prevent fighting
10. **Trackpad pinch detection** — smaller speed for precise control
