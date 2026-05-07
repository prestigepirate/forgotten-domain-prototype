import { useGameStore } from "../data/gameState";

const TX = "#e0d8c0";
const TX3 = "#6a6048";
const G = { light: "#c8aa4e", dim: "#5a4a20" };

export default function StatusBar() {
  const hp = useGameStore((s) => s.playerHP["player-1"]);
  const enemyHP = useGameStore((s) => s.playerHP["player-2"]);
  const turn = useGameStore((s) => s.turn);
  const gameTime = useGameStore((s) => s.gameTime);
  const deckSize = useGameStore((s) => s.playerDeck["player-1"]?.length || 0);
  const endTurn = useGameStore((s) => s.endTurn);
  const autoPlay = useGameStore((s) => s.autoPlay);
  const startAutoPlay = useGameStore((s) => s.startAutoPlay);
  const stopAutoPlay = useGameStore((s) => s.stopAutoPlay);
  const apocalypseWave = useGameStore((s) => s.apocalypseWave);

  const mins = Math.floor(gameTime / 60);
  const secs = gameTime % 60;
  const timerStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const timerUrgent = gameTime <= 120;

  return (
    <div style={{
      position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
      zIndex: 30,
      display: "flex", gap: 10, alignItems: "center",
      background: "rgba(10, 8, 20, 0.78)",
      border: `1px solid ${G.dim}44`,
      borderRadius: 8,
      padding: "6px 16px",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      fontFamily: "system-ui, sans-serif",
      fontSize: "0.68rem",
    }}>
      {/* LP */}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c44b3c", boxShadow: "0 0 4px #c44b3c88" }} />
        <span style={{ color: "#c44b3c", fontWeight: "bold" }}>{hp}</span>
      </span>
      <span style={{ color: TX3 }}>│</span>

      {/* Enemy HP */}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5b8cc4", boxShadow: "0 0 4px #5b8cc488" }} />
        <span style={{ color: "#5b8cc4" }}>{enemyHP}</span>
      </span>
      <span style={{ color: TX3 }}>│</span>

      {/* Timer */}
      {apocalypseWave && (
        <span style={{ color: "#c44b3c", fontWeight: "bold", fontSize: "0.6rem" }}>⚡</span>
      )}
      <span style={{
        color: timerUrgent ? "#e04030" : G.light,
        fontWeight: "bold", fontVariantNumeric: "tabular-nums",
      }}>
        {timerStr}
      </span>
      <span style={{ color: TX3 }}>│</span>

      {/* Turn + SP */}
      <span style={{ color: TX }}>T{turn}</span>
      <span style={{ color: TX3, fontSize: "0.6rem" }}>🂭{deckSize}</span>

      <span style={{ color: TX3 }}>│</span>

      {/* Action buttons */}
      <button onClick={autoPlay ? stopAutoPlay : startAutoPlay} style={{
        background: autoPlay ? "rgba(200,60,60,0.18)" : "rgba(60,200,100,0.1)",
        border: `1px solid ${autoPlay ? "#8b3030" : "#3a6b3a"}`,
        color: autoPlay ? "#e05050" : "#50b860",
        padding: "2px 8px", borderRadius: 3,
        cursor: "pointer", fontSize: "0.6rem", fontWeight: "bold",
      }}>
        {autoPlay ? "Stop" : "AI"}
      </button>

      <button onClick={endTurn} disabled={autoPlay} style={{
        background: `linear-gradient(180deg, rgba(180,140,60,0.2), rgba(140,100,30,0.15))`,
        border: `1px solid ${G.dim}`,
        color: autoPlay ? TX3 : G.light,
        padding: "2px 10px", borderRadius: 3,
        cursor: autoPlay ? "not-allowed" : "pointer",
        fontSize: "0.6rem", fontWeight: "bold",
        opacity: autoPlay ? 0.5 : 1,
      }}>
        End Turn
      </button>
    </div>
  );
}
