import { useEffect, useRef } from "react";
import { useGameStore, getCreature } from "../data/gameState";

export default function CreatureMenu({ creatureId, screenX, screenY, onClose, onMove, onToggleDefense }) {
  const menuRef = useRef(null);
  const creature = getCreature(creatureId);
  const isDefense = useGameStore((s) => !!s.defensePositions[creatureId]);
  const creatureOwner = useGameStore((s) => s.creatureOwners[creatureId] || "neutral");
  const isPlayerCreature = creatureOwner === "player-1";

  // Close on outside click (delayed to avoid same-click closure)
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener("click", handler), 60);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!creature) return null;

  const cs = {
    position: "absolute",
    left: Math.min(screenX, window.innerWidth - 170),
    top: Math.min(screenY, window.innerHeight - 180),
    background: "rgba(12, 8, 28, 0.95)",
    border: "1px solid #3a3060",
    borderRadius: 8,
    padding: "6px 0",
    minWidth: 155,
    zIndex: 100,
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.84rem",
    color: "#ccc",
    boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
    userSelect: "none",
  };

  const item = (disabled = false) => ({
    padding: "8px 14px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
  });

  return (
    <div ref={menuRef} style={cs}>
      <div style={{ padding: "6px 14px 8px", borderBottom: "1px solid #2a2050", marginBottom: 2, fontWeight: "bold", fontSize: "0.8rem", color: "#888" }}>
        {creature.art} {creature.name} <span style={{ color: "#666" }}>Lv.{creature.level}</span>
        <span style={{ marginLeft: 6, fontSize: "0.7rem", color: isDefense ? "#88aaff" : "#ff8866" }}>
          {isDefense ? "🛡️ DEF" : "⚔️ ATK"}
        </span>
      </div>

      {isPlayerCreature ? (
        <>
          <div style={item()} onClick={() => { onClose(); onMove(creatureId); }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(80,140,220,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            🚶 Move
          </div>
          <div style={item()} onClick={() => { onClose(); onToggleDefense(creatureId); }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(80,140,220,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {isDefense ? "⚔️ Switch to Attack" : "🛡️ Switch to Defense"}
          </div>
          <div style={item(true)}>
            ✨ Invoke <span style={{ fontSize: "0.6rem", color: "#555", marginLeft: "auto" }}>soon</span>
          </div>
        </>
      ) : (
        <>
          <div style={item(true)}>⚔️ ATK {creature.atk}  |  🛡️ DEF {creature.def}</div>
          <div style={{ ...item(), fontSize: "0.7rem", color: "#666", paddingTop: 4 }}>{creature.effect || ""}</div>
        </>
      )}
    </div>
  );
}
