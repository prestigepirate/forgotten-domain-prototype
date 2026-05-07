import { useGameStore, useRegionMarkers, getRegionOwner, getRegionCreatures, getRegionTraps, getCard, TERRAIN_BONUSES, PLAYER_COLORS, PLAYER_NAMES } from "../data/gameState";
import { getRegionById, TERRAIN_COLORS } from "../data/regions";

const G = { light: "#c8aa4e", mid: "#8b7630", dim: "#5a4a20" };
const TX = "#e0d8c0";
const TX2 = "#9a9070";
const TX3 = "#6a6048";
const BG = "rgba(10, 8, 22, 0.97)";

export default function RegionPanel({ regionId, onClose }) {
  const region = getRegionById(regionId);
  const regionMarkers = useRegionMarkers();
  const stationedCreatures = useGameStore((s) => s.stationedCreatures);
  const trapsSet = useGameStore((s) => s.trapsSet);
  const playerHP = useGameStore((s) => s.playerHP);
  const equippedTo = useGameStore((s) => s.equippedTo);
  const creatureOwners = useGameStore((s) => s.creatureOwners);
  const immo = useGameStore((s) => s.immobilized);
  const state = { regionMarkers, stationedCreatures, trapsSet, playerHP, equippedTo, creatureOwners, immobilized: immo };

  if (!region) return null;

  const owner = getRegionOwner(state, regionId);
  const creatures = getRegionCreatures(state, regionId);
  const traps = getRegionTraps(state, regionId);
  const bonus = TERRAIN_BONUSES[region.terrain];
  const terrainColor = TERRAIN_COLORS[region.terrain];
  const playerColor = PLAYER_COLORS[owner];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          zIndex: 10, opacity: regionId ? 1 : 0,
          pointerEvents: regionId ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 340,
        background: BG,
        borderLeft: `1px solid ${G.dim}`,
        zIndex: 11,
        transform: regionId ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease",
        color: TX, fontFamily: "system-ui, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: `-4px 0 30px rgba(0,0,0,0.5)`,
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: `1px solid ${G.dim}`,
          background: "rgba(20, 14, 36, 0.6)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", color: G.light, fontWeight: 700, letterSpacing: "0.02em" }}>
                {region.name}
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: terrainColor, boxShadow: `0 0 4px ${terrainColor}`,
                }} />
                <span style={{ fontSize: "0.72rem", color: TX3, textTransform: "capitalize", letterSpacing: "0.04em" }}>
                  {region.terrain}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", color: TX3, fontSize: "1.3rem",
                cursor: "pointer", padding: 0, lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* Control Markers */}
          <Section title="Control Markers">
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              {(() => {
                const markers = state.regionMarkers[regionId];
                const p1 = markers?.["player-1"] ?? 0;
                const p2 = markers?.["player-2"] ?? 0;
                const neu = 5 - p1 - p2;
                const pipColors = [
                  ...Array(p1).fill(PLAYER_COLORS["player-1"]),
                  ...Array(p2).fill(PLAYER_COLORS["player-2"]),
                  ...Array(neu).fill(PLAYER_COLORS.neutral),
                ];
                return pipColors.map((color, i) => (
                  <span key={i} style={{
                    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                    background: color, boxShadow: `0 0 3px ${color}`,
                  }} />
                ));
              })()}
            </div>
            <div style={{ fontSize: "0.72rem", color: TX3, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: PLAYER_COLORS["player-1"] }}>
                {PLAYER_NAMES["player-1"]}: {state.regionMarkers[regionId]?.["player-1"] ?? 0}/5
              </span>
              <span>|</span>
              <span style={{ color: PLAYER_COLORS["player-2"] }}>
                {PLAYER_NAMES["player-2"]}: {state.regionMarkers[regionId]?.["player-2"] ?? 0}/5
              </span>
            </div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: playerColor, boxShadow: `0 0 4px ${playerColor}`,
              }} />
              <span style={{ color: TX2, fontSize: "0.78rem" }}>
                Controller: {PLAYER_NAMES[owner]}
              </span>
            </div>
          </Section>

          {/* Terrain bonus */}
          <Section title="Terrain Effect — " subtitle={bonus.name}>
            <p style={{ margin: 0, fontSize: "0.76rem", color: TX2, lineHeight: 1.5 }}>
              {bonus.effect}
            </p>
          </Section>

          {/* Stationed creatures */}
          <Section title={`Creatures (${creatures.length})`}>
            {creatures.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.76rem", color: TX3 }}>None stationed</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {creatures.map((c) => {
                  const cOwner = creatureOwners[c.id] || "neutral";
                  const cOwnerColor = PLAYER_COLORS[cOwner];
                  const equipped = equippedTo[c.id] || [];
                  let atkBonus = 0;
                  let defBonus = 0;
                  const equipmentCards = equipped.map((eid) => {
                    const eq = getCard(eid);
                    if (eq?.bonus) {
                      atkBonus += eq.bonus.atk || 0;
                      defBonus += eq.bonus.def || 0;
                    }
                    return eq;
                  }).filter(Boolean);

                  return (
                    <div key={c.id} style={{
                      background: "rgba(20, 16, 40, 0.6)",
                      border: `1px solid ${G.dim}44`,
                      borderRadius: 6, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                            background: cOwnerColor, boxShadow: `0 0 3px ${cOwnerColor}`,
                          }} />
                          <span style={{ fontSize: "0.82rem", color: TX, fontWeight: 600 }}>
                            {c.art} {c.name}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.65rem", color: TX3, textTransform: "capitalize" }}>
                          {c.type} · Lv.{c.level}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                        <Stat label="ATK" value={c.atk + atkBonus} color="#c44b3c" bonus={atkBonus} />
                        <Stat label="DEF" value={c.def + defBonus} color="#5b8cc4" bonus={defBonus} />
                        <span style={{ fontSize: "0.66rem", color: TX3, textTransform: "capitalize" }}>
                          {c.element}
                        </span>
                      </div>
                      {equipmentCards.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          {equipmentCards.map((eq) => (
                            <span key={eq.id} style={{
                              fontSize: "0.6rem", background: "rgba(140,120,60,0.12)",
                              border: `1px solid ${G.dim}44`, borderRadius: 3,
                              padding: "1px 6px", color: G.light,
                            }}>
                              {eq.art} {eq.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p style={{ margin: "6px 0 0", fontSize: "0.7rem", color: TX3, lineHeight: 1.4, fontStyle: "italic" }}>
                        {c.effect}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Traps */}
          <Section title={`Traps Set (${traps.length})`}>
            {traps.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.76rem", color: TX3 }}>No traps set</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {traps.map((tId) => {
                  const trapCard = getCard(tId);
                  return (
                    <div key={tId} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px",
                      background: "rgba(180, 40, 60, 0.06)",
                      border: "1px solid rgba(180, 40, 60, 0.18)",
                      borderRadius: 4, fontSize: "0.78rem",
                      color: "#b8456e",
                    }}>
                      <span>{trapCard?.art || "⚠"}</span>
                      <span style={{ color: TX }}>{trapCard?.name || tId}</span>
                      <span style={{ fontSize: "0.62rem", color: "#884466" }}>{trapCard?.trapEffect}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{
        margin: "0 0 8px", fontSize: "0.66rem", color: G.mid,
        textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700,
      }}>
        {title}{subtitle && <span style={{ color: G.light, textTransform: "none", letterSpacing: "0.02em" }}> — {subtitle}</span>}
      </h3>
      {children}
    </div>
  );
}

function Stat({ label, value, color, bonus }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: "0.62rem", color: TX3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: "0.78rem", color, fontWeight: 600 }}>{value}</span>
      {bonus > 0 && <span style={{ fontSize: "0.58rem", color: "#6aaa44" }}>(+{bonus})</span>}
    </div>
  );
}
