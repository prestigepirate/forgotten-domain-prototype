import { useState, useEffect, useRef, useMemo } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { getRegions, hexToWorld } from "../../data/regions";

const TOOLS = [
  { id: "move",    label: "Move",    key: "M", icon: "↕" },
  { id: "scale",   label: "Scale",   key: "S", icon: "⤢" },
  { id: "rotate",  label: "Rotate",  key: "R", icon: "↻" },
  { id: "elevate", label: "Elevate", key: "E", icon: "↑↓" },
  { id: "brush",   label: "Place",   key: "B", icon: "🖌" },
  { id: "delete",  label: "Delete",  key: "D", icon: "✕" },
];

const TABS = [
  { id: "tools",  label: "Tools" },
  { id: "assets", label: "Assets" },
  { id: "props",  label: "Properties" },
  { id: "export", label: "Export" },
];

const HINTS = {
  move:    "Click to select · Click ground to move · Arrows nudge",
  scale:   "Shift+↑↓ to scale · Arrows to move",
  rotate:  "Shift+←→ to rotate Y · Shift+↑↓ to rotate X · Arrows to move",
  elevate: "Shift+↑ to raise · Shift+↓ to lower · Arrows to move",
  brush:   "Select asset → Click map to place · Click object to select",
  delete:  "Click any object to delete it instantly",
};

export default function EditorPanel() {
  const editMode = useEditorStore((s) => s.editMode);
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const placedObjects = useEditorStore((s) => s.placedObjects);
  const removeObject = useEditorStore((s) => s.removeObject);
  const addObject = useEditorStore((s) => s.addObject);
  const toggleEditMode = useEditorStore((s) => s.toggleEditMode);

  // Brush
  const brushType = useEditorStore((s) => s.brushType);
  const setBrushType = useEditorStore((s) => s.setBrushType);
  const brushAssetId = useEditorStore((s) => s.brushAssetId);
  const setBrushAssetId = useEditorStore((s) => s.setBrushAssetId);
  const brushOwner = useEditorStore((s) => s.brushOwner);
  const setBrushOwner = useEditorStore((s) => s.setBrushOwner);
  const brushTerrain = useEditorStore((s) => s.brushTerrain);
  const setBrushTerrain = useEditorStore((s) => s.setBrushTerrain);
  const brushHeight = useEditorStore((s) => s.brushHeight);
  const setBrushHeight = useEditorStore((s) => s.setBrushHeight);

  // Loaded assets
  const loadedAssets = useEditorStore((s) => s.loadedAssets);
  const addLoadedAsset = useEditorStore((s) => s.addLoadedAsset);

  const [activeTab, setActiveTab] = useState("tools");
  const [scannedAssets, setScannedAssets] = useState([]);
  const fileInputRef = useRef();

  // Region objects for editor panel lookup (same as Editor3D)
  const regionObjects = useMemo(() => {
    const regions = getRegions();
    return regions.map(r => {
      const [x, , z] = hexToWorld(r.q, r.r);
      return { id: r.id, type: "hex", terrain: r.terrain, height: r.height, position: [x, 0, z], scale: [1,1,1], rotation: [0,0,0], _isRegion: true };
    });
  }, []);

  // Auto-switch to props tab when something is selected
  useEffect(() => {
    if (selectedObjectId) setActiveTab("props");
  }, [selectedObjectId]);

  // Scan available GLB assets from /models/
  useEffect(() => {
    fetch("/models/")
      .then(r => r.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const links = [...doc.querySelectorAll("a")].map(a => a.getAttribute("href")).filter(Boolean);
        const glbs = links.filter(l => l.endsWith(".glb")).map(l => l.replace(/^\//, "").replace("models/", ""));
        const subdirs = links.filter(l => l.endsWith("/") && l !== "../");
        Promise.all(subdirs.map(async dir => {
          try {
            const r = await fetch("/models/" + dir);
            const t = await r.text();
            const d = parser.parseFromString(t, "text/html");
            return [...d.querySelectorAll("a")]
              .map(a => a.getAttribute("href"))
              .filter(Boolean)
              .filter(l => l.endsWith(".glb"))
              .map(l => dir + l);
          } catch { return []; }
        })).then(subResults => {
          setScannedAssets([...glbs, ...subResults.flat()].sort());
        });
      })
      .catch(() => setScannedAssets([]));
  }, []);

  // Keyboard shortcuts for tools
  useEffect(() => {
    if (!editMode) return;
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      const t = TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
      if (t) setTool(t.id);
      // Tab key cycles through tabs
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const idx = TABS.findIndex(t => t.id === activeTab);
        setActiveTab(TABS[(idx + 1) % TABS.length].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editMode, setTool, activeTab]);

  // Load GLB from computer
  const handleFileLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".glb")) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(".glb", "");
    addLoadedAsset(name, url);
    // Auto-select this asset for brush
    setBrushType("asset");
    setBrushAssetId(name);
    setTool("brush");
    setActiveTab("assets");
    // Reset input so same file can be re-loaded
    e.target.value = "";
  };

  if (!editMode) return null;

  // Find selected object — check placedObjects first, then region objects
  const selectedObj = placedObjects.find(o => o.id === selectedObjectId) || regionObjects.find(o => o.id === selectedObjectId) || null;
  const allAssets = [...scannedAssets, ...loadedAssets.map(a => a.name + ".glb")];

  return (
    <div style={panel}>
      <button style={closeBtn} onClick={toggleEditMode}>✕</button>
      <div style={header}>MAP EDITOR</div>

      {/* Tabs */}
      <div style={tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={activeTab === t.id ? tabActive : tabInactive}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.id === "props" && selectedObj && <span style={tabDot}>●</span>}
          </button>
        ))}
      </div>

      {/* ── TOOLS TAB ────────────────────────────────────── */}
      {activeTab === "tools" && (
        <div style={section}>
          <div style={toolGrid}>
            {TOOLS.map(t => (
              <button
                key={t.id}
                style={tool === t.id ? toolBtnActive : toolBtn}
                onClick={() => setTool(t.id)}
                title={`${t.label} (${t.key})`}
              >
                <span style={toolIcon}>{t.icon}</span>
                <span style={toolLabel}>{t.label}</span>
                <span style={toolKey}>{t.key}</span>
              </button>
            ))}
          </div>
          <div style={hint}>{HINTS[tool]}</div>
        </div>
      )}

      {/* ── ASSETS TAB ───────────────────────────────────── */}
      {activeTab === "assets" && (
        <div style={section}>
          <div style={sectionTitle}>BRUSH TYPE</div>
          <select style={select} value={brushType} onChange={e => setBrushType(e.target.value)}>
            <option value="king-base">King Base</option>
            <option value="summon-circle">Summon Circle</option>
            <option value="tower">Tower</option>
            <option value="hex">Hex Tile</option>
            <option value="asset">3D Asset</option>
          </select>

          {["king-base", "summon-circle", "tower"].includes(brushType) && (
            <select style={select} value={brushOwner} onChange={e => setBrushOwner(e.target.value)}>
              <option value="player-1">Player 1</option>
              <option value="player-2">Player 2</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
            </select>
          )}

          {brushType === "hex" && (
            <>
              <select style={select} value={brushTerrain} onChange={e => {
                setBrushTerrain(e.target.value);
                if (e.target.value === "high-ground") setBrushHeight(1.5);
              }}>
                <option value="plains">Plains</option>
                <option value="forest">Forest</option>
                <option value="mountain">Mountain</option>
                <option value="swamp">Swamp</option>
                <option value="water">Water</option>
                <option value="volcanic">Volcanic</option>
                <option value="high-ground">⚠ High Ground</option>
              </select>
              <div style={sliderRow}>
                <span style={dim}>Height: {brushHeight.toFixed(1)}</span>
                <input type="range" min="0.1" max="3" step="0.1" value={brushHeight}
                  onChange={e => setBrushHeight(parseFloat(e.target.value))} style={slider} />
              </div>
            </>
          )}

          {/* Asset browser */}
          {brushType === "asset" && (
            <>
              <div style={sectionTitle} className="mt-2">BUILT-IN MODELS</div>
              <div style={assetList}>
                {scannedAssets.length === 0 && <div style={dim}>Loading…</div>}
                {scannedAssets.slice(0, 60).map(a => {
                  const name = a.replace(/\.glb$/, "").replace(/^.*\//, "");
                  const isActive = brushAssetId === name;
                  return (
                    <button key={a} style={isActive ? assetBtnActive : assetBtn}
                      onClick={() => { setBrushAssetId(isActive ? null : name); setTool("brush"); }}
                      title={a}>
                      {name}
                    </button>
                  );
                })}
              </div>

              <div style={sectionTitle} className="mt-2">LOAD FROM COMPUTER</div>
              <input ref={fileInputRef} type="file" accept=".glb" onChange={handleFileLoad}
                style={fileInput} />
              <div style={dim}>Select a .glb file from your computer</div>

              {loadedAssets.length > 0 && (
                <>
                  <div style={sectionTitle} className="mt-2">YOUR ASSETS</div>
                  <div style={assetList}>
                    {loadedAssets.map(a => {
                      const isActive = brushAssetId === a.name;
                      return (
                        <button key={a.url} style={isActive ? assetBtnActive : assetBtn}
                          onClick={() => { setBrushAssetId(isActive ? null : a.name); setTool("brush"); }}>
                          {a.name} 📁
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PROPERTIES TAB ────────────────────────────────── */}
      {activeTab === "props" && (
        <div style={section}>
          {selectedObj ? (
            <>
              <div style={sectionTitle}>SELECTED OBJECT</div>
              <div style={labelRow}>
                <span style={typeBadge}>{selectedObj.type?.toUpperCase()}</span>
                <span style={dim}>#{selectedObj.id.slice(-6)}</span>
              </div>
              <InfoRow label="POS" value={selectedObj.position?.map(v => v.toFixed(1)).join(" / ")} />
              <InfoRow label="SCL" value={(selectedObj.scale || [1,1,1]).map(v => v.toFixed(2)).join(" / ")} />
              <InfoRow label="ROT" value={(selectedObj.rotation || [0,0,0]).map(v => (v / Math.PI).toFixed(2) + "π").join(" / ")} />
              {selectedObj.terrain && <InfoRow label="TER" value={selectedObj.terrain} />}
              {selectedObj.owner && <InfoRow label="OWN" value={selectedObj.owner} />}
              {selectedObj.assetId && <InfoRow label="MDL" value={selectedObj.assetId} />}
              <button style={delBtn} onClick={() => {
                const inPlaced = placedObjects.find(o => o.id === selectedObj.id);
                if (inPlaced) {
                  removeObject(selectedObj.id);
                } else {
                  // Region hex or baked object not yet in placedObjects — add to hide it
                  addObject({ ...selectedObj, _bakedId: selectedObj.id });
                }
              }}>
                🗑 Delete Object
              </button>
            </>
          ) : (
            <div style={dim}>Click any object to inspect it</div>
          )}
        </div>
      )}

      {/* ── EXPORT TAB ───────────────────────────────────── */}
      {activeTab === "export" && (
        <div style={section}>
          <div style={sectionTitle}>EXPORT MAP</div>
          <div style={dim}>Auto-saves to browser. Export for permanent save.</div>
          <button style={exportBtn} onClick={() => {
            const objects = useEditorStore.getState().placedObjects;
            const cleaned = objects.map(({ _bakedId, ...rest }) => rest);
            const json = JSON.stringify(cleaned, null, 2);
            navigator.clipboard.writeText(json).then(() => {
              const el = document.getElementById("export-feedback");
              if (el) { el.style.opacity = "1"; setTimeout(() => el.style.opacity = "0", 1500); }
            });
          }}>
            📋 Copy to Clipboard
          </button>
          <span id="export-feedback" style={{ color: "#00dd88", fontSize: "0.55rem", opacity: 0, transition: "opacity 0.2s" }}>Copied!</span>
        </div>
      )}

      {/* Footer */}
      <div style={footer}>
        <span style={dim}>{placedObjects.length} objects</span>
        <button style={clearBtn} onClick={() => {
          if (confirm("Remove all placed objects?")) useEditorStore.getState().clearAll();
        }}>
          Clear All
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.63rem" }}>
      <span style={{ color: "#555", fontFamily: "monospace" }}>{label}</span>
      <span style={{ color: "#999", fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────

const panel = {
  position: "absolute", top: 0, left: 0, width: 230,
  maxHeight: "100vh", overflowY: "auto",
  background: "rgba(8,8,20,0.96)", borderRight: "1px solid #1a1a2e",
  padding: "10px", zIndex: 25,
  fontFamily: "system-ui, sans-serif",
  display: "flex", flexDirection: "column", gap: 6,
  scrollbarWidth: "thin",
};

const header = {
  color: "#ddd", fontWeight: 700, fontSize: "0.75rem",
  letterSpacing: 2, textTransform: "uppercase",
  borderBottom: "1px solid #1a1a2e", paddingBottom: 6, paddingTop: 14,
};

const closeBtn = {
  position: "absolute", top: 6, right: 6,
  background: "none", border: "none", color: "#555", cursor: "pointer",
  fontSize: "0.8rem", padding: "2px 5px",
};

const section = {
  display: "flex", flexDirection: "column", gap: 4,
};

const sectionTitle = {
  color: "#444", fontSize: "0.55rem", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: 1.5,
  borderBottom: "1px solid #111", paddingBottom: 2,
  marginTop: 2,
};

const labelRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
};

const typeBadge = {
  color: "#ffd700", fontSize: "0.62rem", fontWeight: 600,
  background: "rgba(255,215,0,0.1)", padding: "1px 5px",
  borderRadius: 3, border: "1px solid rgba(255,215,0,0.2)",
};

const dim = {
  color: "#555", fontSize: "0.6rem",
};

const hint = {
  color: "#3a3a4a", fontSize: "0.55rem", fontStyle: "italic", lineHeight: 1.4,
};

const delBtn = {
  marginTop: 2, padding: "3px 8px",
  background: "rgba(200,40,40,0.12)", border: "1px solid rgba(200,40,40,0.25)",
  borderRadius: 3, color: "#cc5555", cursor: "pointer",
  fontFamily: "system-ui, sans-serif", fontSize: "0.6rem",
};

// ── Tabs ────────────────────────────────────────────────────

const tabBar = {
  display: "flex", gap: 2,
  borderBottom: "1px solid #1a1a2e", paddingBottom: 4,
};

const tabBase = {
  flex: 1, padding: "4px 0", border: "none", cursor: "pointer",
  fontFamily: "system-ui, sans-serif", fontSize: "0.58rem",
  fontWeight: 600, textTransform: "uppercase", letterSpacing: 1,
  borderRadius: 3, transition: "all 0.15s",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
};

const tabActive = {
  ...tabBase,
  background: "rgba(0,160,120,0.15)", color: "#00dd88",
};

const tabInactive = {
  ...tabBase,
  background: "transparent", color: "#444",
};

const tabDot = {
  color: "#ffd700", fontSize: "0.4rem",
};

// ── Tools ───────────────────────────────────────────────────

const toolGrid = {
  display: "flex", flexDirection: "column", gap: 2,
};

const toolBtnBase = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "5px 8px", borderRadius: 3,
  border: "1px solid transparent", cursor: "pointer",
  fontFamily: "system-ui, sans-serif", fontSize: "0.65rem",
  width: "100%", textAlign: "left",
};

const toolBtn = {
  ...toolBtnBase,
  background: "rgba(20,20,40,0.5)", color: "#666",
  border: "1px solid rgba(30,30,50,0.5)",
};

const toolBtnActive = {
  ...toolBtnBase,
  background: "rgba(0,160,120,0.15)", color: "#00dd88",
  border: "1px solid rgba(0,180,120,0.4)", fontWeight: 600,
};

const toolIcon = { fontSize: "0.8rem", width: 18, textAlign: "center" };
const toolLabel = { flex: 1 };
const toolKey = {
  color: "#333", fontSize: "0.5rem", fontWeight: 700,
  background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: 2,
};

// ── Assets ──────────────────────────────────────────────────

const select = {
  background: "rgba(15,15,30,0.9)", color: "#aaa",
  border: "1px solid #222", borderRadius: 3,
  padding: "3px 6px", fontSize: "0.6rem",
  fontFamily: "system-ui, sans-serif", cursor: "pointer",
};

const sliderRow = { display: "flex", alignItems: "center", gap: 6 };
const slider = { flex: 1, accentColor: "#00aa66" };

const assetList = {
  display: "flex", flexDirection: "column", gap: 1,
  maxHeight: 180, overflowY: "auto",
  border: "1px solid #111", borderRadius: 3, padding: 4,
};

const assetBtnBase = {
  background: "none", border: "none", cursor: "pointer",
  color: "#777", fontSize: "0.55rem", fontFamily: "monospace",
  padding: "2px 4px", borderRadius: 2, textAlign: "left",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const assetBtn = { ...assetBtnBase };
const assetBtnActive = {
  ...assetBtnBase,
  background: "rgba(0,180,120,0.2)", color: "#00dd88",
};

const fileInput = {
  background: "rgba(15,15,30,0.9)", color: "#888",
  border: "1px solid #222", borderRadius: 3,
  padding: "3px 6px", fontSize: "0.55rem",
  fontFamily: "monospace", cursor: "pointer",
};

// ── Footer ──────────────────────────────────────────────────

const footer = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  paddingTop: 4, borderTop: "1px solid #111", marginTop: 2,
};

const clearBtn = {
  background: "rgba(200,40,40,0.08)", border: "1px solid rgba(200,40,40,0.15)",
  borderRadius: 3, color: "#884444", cursor: "pointer",
  fontFamily: "system-ui, sans-serif", fontSize: "0.55rem", padding: "2px 6px",
};

const exportBtn = {
  padding: "4px 8px",
  background: "rgba(0,160,120,0.15)", border: "1px solid rgba(0,180,120,0.3)",
  borderRadius: 3, color: "#00cc88", cursor: "pointer",
  fontFamily: "system-ui, sans-serif", fontSize: "0.6rem",
};
