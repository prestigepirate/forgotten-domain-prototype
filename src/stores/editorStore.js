import { create } from 'zustand';

let nextId = 1;
const STORAGE_KEY = 'duel-realms-editor-objects';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        const maxId = Math.max(...arr.map(o => {
          const n = parseInt(String(o.id).replace(/\D/g, ''), 10);
          return Number.isNaN(n) ? 0 : n;
        }));
        nextId = maxId + 1;
        return arr;
      }
    }
  } catch { /* ignore */ }
  return [];
}

function persist(arr) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
}

const TOOLS = ['move', 'scale', 'rotate', 'elevate', 'brush', 'delete'];
const TYPES = ['king-base', 'summon-circle', 'tower', 'hex', 'asset'];

export const useEditorStore = create((set, get) => ({
  editMode: false,
  tool: 'move',           // move | scale | rotate | elevate | brush | delete
  selectedObjectId: null,
  placedObjects: loadSaved(),
  loadedAssets: [],       // GLB files loaded from user's computer [{ name, url }]

  // Brush settings
  brushType: 'asset',     // king-base | summon-circle | tower | hex | asset
  brushAssetId: null,     // GLB filename when brushType='asset'
  brushOwner: 'player-1',  // owner for king-base/summon-circle/tower
  brushTerrain: 'plains',  // terrain for hex brush
  brushHeight: 0.5,        // height for hex brush

  toggleEditMode: () =>
    set(s => ({
      editMode: !s.editMode,
      tool: 'move',
      selectedObjectId: !s.editMode ? s.selectedObjectId : null,
    })),

  setTool: (tool) => set({ tool }),
  setBrushType: (brushType) => set({ brushType }),
  setBrushAssetId: (brushAssetId) => set({ brushAssetId }),
  setBrushOwner: (brushOwner) => set({ brushOwner }),
  setBrushTerrain: (brushTerrain) => set({ brushTerrain }),
  setBrushHeight: (brushHeight) => set({ brushHeight }),

  selectObject: (id) => set({ selectedObjectId: id }),

  addObject: (obj) => {
    const id = `eobj-${nextId++}`;
    const newObj = { ...obj, id };
    set(s => {
      const updated = [...s.placedObjects, newObj];
      persist(updated);
      return { placedObjects: updated };
    });
    return id;
  },

  updateObject: (id, updates) =>
    set(s => {
      const updated = s.placedObjects.map(o => (o.id === id ? { ...o, ...updates } : o));
      persist(updated);
      return { placedObjects: updated };
    }),

  removeObject: (id) =>
    set(s => {
      const updated = s.placedObjects.filter(o => o.id !== id);
      persist(updated);
      return {
        placedObjects: updated,
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
      };
    }),

  clearAll: () => {
    persist([]);
    set({ placedObjects: [], selectedObjectId: null });
  },

  addLoadedAsset: (name, url) =>
    set(s => ({ loadedAssets: [...s.loadedAssets, { name, url }] })),

  removeLoadedAsset: (url) =>
    set(s => ({ loadedAssets: s.loadedAssets.filter(a => a.url !== url) })),
}));
