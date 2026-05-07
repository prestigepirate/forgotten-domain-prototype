import { useState } from "react";
import { useGameStore, getCard } from "../data/gameState";

// ── Theme palette ──────────────────────────────────────
const G = {
  light: "#c8aa4e",
  mid:   "#8b7630",
  dim:   "#5a4a20",
};
const BG  = "rgba(10, 8, 20, 0.78)";
const BGL = "rgba(16, 12, 28, 0.75)";
const TX  = "#e0d8c0";
const TX2 = "#9a9070";
const TX3 = "#6a6048";

export default function GameHUD() {
  const [open, setOpen] = useState(false);
  const [cardDetail, setCardDetail] = useState(null);

  const hand = useGameStore((s) => s.playerHand["player-1"]);
  const selectedCardId = useGameStore((s) => s.selectedHandCard);
  const handMode = useGameStore((s) => s.handMode);
  const setSelectedHandCard = useGameStore((s) => s.setSelectedHandCard);
  const clearHandSelection = useGameStore((s) => s.clearHandSelection);

  const handCards = (hand || []).map((id) => getCard(id)).filter(Boolean);
  const selectedCard = selectedCardId ? getCard(selectedCardId) : null;

  const handleCardClick = (card) => {
    if (selectedCardId === card.id) {
      clearHandSelection();
      return;
    }
    if (card.type === "creature") {
      setSelectedHandCard(card.id, "deploy");
    } else if (card.type === "trap") {
      setSelectedHandCard(card.id, "trap");
    } else if (card.type === "equipment") {
      setSelectedHandCard(card.id, "equip");
    } else if (card.type === "spell") {
      if (card.target === "self" || card.target === "deck") {
        const state = useGameStore.getState();
        if (card.target === "deck") {
          setSelectedHandCard(card.id, "spell");
        } else {
          state.castSpell("player-1", card.id, null, null);
        }
      } else {
        setSelectedHandCard(card.id, "spell");
      }
    } else if (card.type === "field") {
      setSelectedHandCard(card.id, "field");
    }
  };

  const handleCardDetail = (card) => {
    setCardDetail(cardDetail?.id === card.id ? null : card);
  };

  return (
    <>
      {/* ── Mode indicator ── */}
      {handMode && selectedCard && (
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          background: "rgba(40, 20, 60, 0.92)", border: `1px solid ${G.dim}`,
          borderRadius: 6, padding: "6px 18px", fontFamily: "system-ui, sans-serif",
          fontSize: "0.78rem", color: G.light, pointerEvents: "none", zIndex: 30,
        }}>
          {handMode === "deploy" && `Select a region to deploy ${selectedCard.name}`}
          {handMode === "trap" && `Select a region to set ${selectedCard.name}`}
          {handMode === "equip" && `Select a friendly creature to equip ${selectedCard.name}`}
          {handMode === "spell" && selectedCard?.target === "region" && `Select a region to cast ${selectedCard.name}`}
          {handMode === "spell" && selectedCard?.target === "creature" && `Select a creature to cast ${selectedCard.name}`}
          {handMode === "spell" && selectedCard?.target === "deck" && `Select a region to summon from deck`}
          {handMode === "field" && `Select a region to deploy ${selectedCard.name}`}
          <span style={{ marginLeft: 10, color: TX3, fontSize: "0.65rem" }}>(click card again to cancel)</span>
        </div>
      )}

      {/* ── Terminal toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "absolute", bottom: 24, left: 180, width: 130,
          zIndex: 35,
          background: open ? "rgba(200,170,78,0.12)" : "rgba(12, 14, 22, 0.85)",
          border: open ? `1px solid ${G.dim}` : "1px solid rgba(120,140,170,0.25)",
          borderTop: `1px solid rgba(120,140,170,0.25)`,
          color: open ? G.light : "#bcc8d8",
          padding: "5px 10px",
          borderRadius: 2,
          fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
          fontSize: "0.6rem",
          fontWeight: 400,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(200,170,78,0.12)";
          e.currentTarget.style.borderColor = "rgba(180,170,140,0.5)";
          e.currentTarget.style.color = G.light;
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = "rgba(12, 14, 22, 0.85)";
            e.currentTarget.style.borderColor = "rgba(120,140,170,0.25)";
            e.currentTarget.style.color = "#bcc8d8";
          }
        }}
      >
        {open ? "— TERMINAL —" : "TERMINAL"}
      </button>

      {/* ── Collapsible bottom overlay ── */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        zIndex: 10,
        transform: open ? "translateY(0)" : "translateY(105%)",
        opacity: open ? 1 : 0,
        transition: "transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.35s ease",
        pointerEvents: open ? "auto" : "none",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{
          background: BG,
          borderTop: `1px solid ${G.dim}`,
          boxShadow: `0 -4px 24px rgba(0,0,0,0.6), 0 -1px 0 ${G.dim}44`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}>
          {/* ── Hand cards row ── */}
          <div style={{
            display: "flex", gap: 8, justifyContent: "center",
            padding: "26px 20px 34px",
            minHeight: 235,
            alignItems: handCards.length === 0 ? "center" : "flex-end",
          }}>
            {handCards.length === 0 && (
              <span style={{ color: TX3, fontSize: "0.75rem" }}>
                No cards in hand
              </span>
            )}
            {handCards.map((card) => {
              const isSelected = selectedCardId === card.id;
              const typeColors = {
                creature: "#c9a84c", spell: "#5c9e6d", trap: "#c45470",
                equipment: "#9e8b6e", field: "#4d8f8a",
              };
              const tc = typeColors[card.type] || TX2;
              return (
                <div
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  onContextMenu={(e) => { e.preventDefault(); handleCardDetail(card); }}
                  style={{
                    width: 100, height: 175,
                    background: isSelected
                      ? `linear-gradient(180deg, rgba(180,140,60,0.15) 0%, rgba(20,16,36,0.9) 100%)`
                      : `linear-gradient(180deg, rgba(24,20,42,0.95) 0%, rgba(14,12,28,0.95) 100%)`,
                    border: isSelected
                      ? `1px solid ${tc}88`
                      : "1px solid rgba(255,255,255,0.06)",
                    borderTop: isSelected ? `3px solid ${tc}` : "3px solid rgba(255,255,255,0.06)",
                    borderRadius: 8, cursor: "pointer",
                    display: "flex", flexDirection: "column",
                    alignItems: "center",
                    padding: "10px 6px 8px",
                    transition: "all 0.2s ease",
                    position: "relative",
                    transform: isSelected ? "translateY(-14px)" : "none",
                    boxShadow: isSelected
                      ? `0 8px 24px ${tc}22, 0 2px 8px rgba(0,0,0,0.4)`
                      : "0 2px 8px rgba(0,0,0,0.3)",
                    overflow: "hidden",
                  }}
                >
                  {/* Subtle inner glow at top */}
                  <div style={{
                    position: "absolute", top: 0, left: "10%", right: "10%",
                    height: 1, background: `linear-gradient(90deg, transparent, ${tc}44, transparent)`,
                  }} />

                  {/* Card thumbnail image */}
                  <div style={{
                    width: "100%", height: 58, overflow: "hidden",
                    borderRadius: 4, marginBottom: 2,
                    background: "rgba(0,0,0,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <img
                      src={`${import.meta.env.BASE_URL}cards/${card.id}.jpg`}
                      alt={card.name}
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                      onError={(e) => {
                        e.target.style.display = "none";
                        // Show stat fallback below
                        e.target.parentElement.innerHTML = card.type === "creature"
                          ? `<span style="display:flex;align-items:center;justify-content:center;gap:6px;height:100%;font-family:system-ui,sans-serif"><span style="font-size:1rem;font-weight:700;color:#d4705a">${card.atk || "?"}</span><span style="font-size:0.5rem;color:#6a6048">/</span><span style="font-size:1rem;font-weight:700;color:#5a8cc4">${card.def || "?"}</span></span>`
                          : `<span style="display:flex;align-items:center;justify-content:center;height:100%;font-family:system-ui,sans-serif;font-size:0.65rem;font-weight:600;color:#6a6048;text-transform:uppercase;letter-spacing:0.06em">${card.type}</span>`;
                      }}
                    />
                  </div>

                  {/* Card name */}
                  <span style={{
                    fontSize: "0.62rem", color: "#d8d0c0", marginTop: 6,
                    textAlign: "center", lineHeight: 1.2, fontWeight: 500,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    letterSpacing: "0.01em",
                    padding: "0 2px",
                  }}>
                    {card.name}
                  </span>

                  {/* Type pill */}
                  <span style={{
                    fontSize: "0.5rem",
                    color: tc,
                    background: `${tc}14`,
                    border: `1px solid ${tc}33`,
                    padding: "2px 8px",
                    borderRadius: 3,
                    textTransform: "uppercase",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    fontFamily: "system-ui, sans-serif",
                    marginTop: 4,
                  }}>
                    {card.type}
                  </span>

                  {/* Cost — bottom center */}
                  <span style={{
                    fontSize: "0.58rem", color: "#b8a4d0", marginTop: 4,
                    fontWeight: 600, fontFamily: "system-ui, sans-serif",
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <span style={{ fontSize: "0.5rem", opacity: 0.5 }}>SP</span>
                    {card.cost}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Card detail popup ── */}
      {cardDetail && (
        <div onClick={() => setCardDetail(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: `linear-gradient(180deg, #1e1a38, #121024)`,
            border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 12,
            padding: "32px", maxWidth: 380, width: "90%",
            boxShadow: `0 0 60px rgba(0,0,0,0.7)`,
          }}>
            {/* Card image */}
            <div style={{
              width: "100%", height: 140, overflow: "hidden",
              borderRadius: 6, marginBottom: 16,
              background: "rgba(0,0,0,0.4)",
            }}>
              <img
                src={`${import.meta.env.BASE_URL}cards/${cardDetail.id}.jpg`}
                alt={cardDetail.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>

            {/* Top accent line */}
            <div style={{
              height: 3, borderRadius: "3px 3px 0 0",
              background: (() => {
                const tc = { creature: "#c9a84c", spell: "#5c9e6d", trap: "#c45470", equipment: "#9e8b6e", field: "#4d8f8a" }[cardDetail.type] || "#888";
                return tc;
              })(),
              marginBottom: 16, width: "40%",
            }} />

            {cardDetail.type === "creature" && (
              <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#d4705a", fontFamily: "system-ui, sans-serif", lineHeight: 1 }}>{cardDetail.atk}</div>
                  <div style={{ fontSize: "0.55rem", color: TX3, fontWeight: 400 }}>ATK</div>
                </div>
                <div style={{ fontSize: "0.7rem", color: TX3 }}>/</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#5a8cc4", fontFamily: "system-ui, sans-serif", lineHeight: 1 }}>{cardDetail.def}</div>
                  <div style={{ fontSize: "0.55rem", color: TX3, fontWeight: 400 }}>DEF</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", color: TX3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Lv.{cardDetail.level}</div>
                  <div style={{ fontSize: "0.7rem", color: TX2, fontWeight: 500, textTransform: "capitalize" }}>{cardDetail.element}</div>
                </div>
              </div>
            )}

            <h2 style={{ margin: "0 0 4px", color: "#d8d0c0", fontSize: "1.1rem", fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "0.01em" }}>
              {cardDetail.name}
            </h2>
            <span style={{
              fontSize: "0.58rem", color: (() => {
                const tc = { creature: "#c9a84c", spell: "#5c9e6d", trap: "#c45470", equipment: "#9e8b6e", field: "#4d8f8a" }[cardDetail.type] || "#888";
                return tc;
              })(),
              background: (() => {
                const tc = { creature: "#c9a84c", spell: "#5c9e6d", trap: "#c45470", equipment: "#9e8b6e", field: "#4d8f8a" }[cardDetail.type] || "#888";
                return `${tc}18`;
              })(),
              border: (() => {
                const tc = { creature: "#c9a84c", spell: "#5c9e6d", trap: "#c45470", equipment: "#9e8b6e", field: "#4d8f8a" }[cardDetail.type] || "#888";
                return `1px solid ${tc}33`;
              })(),
              padding: "3px 10px", borderRadius: 3,
              textTransform: "uppercase",
              letterSpacing: "0.08em", fontWeight: 600,
              display: "inline-block", marginTop: 6,
            }}>
              {cardDetail.type}
            </span>

            {cardDetail.type === "trap" && (
              <div style={{ marginTop: 12, fontSize: "0.8rem", color: "#c45470", fontFamily: "system-ui, sans-serif" }}>
                <span style={{ color: TX3 }}>Trigger: </span>{cardDetail.trigger}<br />
                <span style={{ color: TX3 }}>Effect: </span>{cardDetail.trapEffect}
              </div>
            )}

            <p style={{ margin: "16px 0 0", fontSize: "0.82rem", color: TX2, lineHeight: 1.6, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              {cardDetail.effect}
            </p>
            <p style={{ fontSize: "0.72rem", color: "#b8a4d0", marginTop: 10, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ opacity: 0.5 }}>SP</span> {cardDetail.cost}
            </p>
            <button onClick={() => setCardDetail(null)} style={{
              marginTop: 20, width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: TX2,
              padding: "10px 20px", borderRadius: 6, cursor: "pointer",
              fontSize: "0.8rem", fontWeight: 500,
              fontFamily: "system-ui, sans-serif",
            }}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
