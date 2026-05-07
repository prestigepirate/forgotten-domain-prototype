import { useState, useCallback, useEffect } from "react";
import DeckBuilder from "./DeckBuilder";
import GameMap from "./GameMap";
import GameHUD from "./GameHUD";
import GameOver from "./GameOver";
import { useGameStore } from "../data/gameState";
import { THEMED_DECKS, getDeckCardIds, DEFAULT_DECK } from "../data/themedDecks";

export default function GameShell() {
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [deck, setDeck] = useState([]);
  const gameStarted = useGameStore((s) => s.gameStarted);
  const initGame = useGameStore((s) => s.initGame);
  const tickTimer = useGameStore((s) => s.tickTimer);
  const timerActive = useGameStore((s) => s.timerActive);

  // Tick the game clock every second
  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => tickTimer(), 1000);
    return () => clearInterval(id);
  }, [timerActive, tickTimer]);

  const handleSelectTheme = useCallback((deckId) => {
    setSelectedTheme(deckId);
    setDeck([...getDeckCardIds(deckId)]);
  }, []);

  const handleBackToThemes = useCallback(() => {
    setSelectedTheme(null);
    setDeck([]);
  }, []);

  const handleAddCard = useCallback((id) => {
    setDeck((prev) => {
      if (prev.length >= 30) return prev;
      return [...prev, id];
    });
  }, []);

  const handleRemoveCard = useCallback((id) => {
    setDeck((prev) => {
      const idx = prev.lastIndexOf(id);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    initGame(deck);
  }, [deck, initGame]);

  const handleQuickStart = useCallback(() => {
    initGame([...getDeckCardIds(DEFAULT_DECK)]);
  }, [initGame]);

  if (!gameStarted && !selectedTheme) {
    return <ThemePicker onSelect={handleSelectTheme} onQuickStart={handleQuickStart} />;
  }

  if (!gameStarted) {
    return (
      <DeckBuilder
        deck={deck}
        onAddCard={handleAddCard}
        onRemoveCard={handleRemoveCard}
        onConfirm={handleConfirm}
        minCards={20}
        maxCards={30}
        themeName={THEMED_DECKS[selectedTheme]?.name}
        themeColor={THEMED_DECKS[selectedTheme]?.color}
        onBack={handleBackToThemes}
      />
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <GameMap />
      <GameHUD />
      <GameOver />
    </div>
  );
}

const G = { light: "#c8aa4e", mid: "#8b7630", dim: "#5a4a20" };
const TX = "#e0d8c0";
const TX2 = "#9a9070";
const TX3 = "#6a6048";

function ThemePicker({ onSelect, onQuickStart }) {
  const themes = Object.values(THEMED_DECKS);

  return (
    <div style={{
      width: "100vw", height: "100vh", background: "#0d0a1c", color: TX,
      fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 36px", borderBottom: `1px solid ${G.dim}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(20, 14, 36, 0.6)",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", color: G.light, fontWeight: 700, letterSpacing: "0.02em" }}>
            Choose Your Deck
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: TX3 }}>
            Select an archetype to customize, or quick-start with the default deck
          </p>
        </div>
        <button
          onClick={onQuickStart}
          style={{
            background: `linear-gradient(180deg, rgba(180,140,60,0.18), rgba(140,100,30,0.1))`,
            border: `1px solid ${G.mid}`, color: G.light,
            padding: "10px 26px", borderRadius: 6,
            fontSize: "0.84rem", cursor: "pointer", fontWeight: "bold",
            letterSpacing: "0.04em",
          }}
        >
          Quick Start
        </button>
      </div>

      {/* Theme cards grid */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "28px 36px",
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 18, alignContent: "start",
      }}>
        {themes.map((theme) => (
          <div
            key={theme.id}
            onClick={() => onSelect(theme.id)}
            style={{
              background: "rgba(18, 14, 34, 0.85)",
              border: `1px solid ${theme.color}33`,
              borderRadius: 10,
              padding: "22px",
              cursor: "pointer",
              transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.color;
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = `0 6px 24px ${theme.color}18`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${theme.color}33`;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: theme.color,
            }} />
            {/* Deck cover image */}
            <div style={{
              width: "100%", height: 160, marginTop: 4, borderRadius: 6,
              overflow: "hidden", background: "rgba(0,0,0,0.4)",
            }}>
              <img
                src={`${import.meta.env.BASE_URL}decks/${theme.id}.jpg`}
                alt={theme.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem", color: G.light, fontWeight: 700, letterSpacing: "0.02em" }}>
                  {theme.name}
                </h2>
                <span style={{
                  display: "inline-block", marginTop: 8, padding: "3px 10px",
                  background: `${theme.color}18`, border: `1px solid ${theme.color}44`,
                  borderRadius: 4, fontSize: "0.68rem", color: theme.color,
                  textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
                }}>
                  {theme.playstyle.split(" — ")[0]}
                </span>
              </div>
              <span style={{
                fontSize: "0.68rem", color: TX3, background: "rgba(0,0,0,0.3)",
                padding: "2px 8px", borderRadius: 3,
              }}>20 cards</span>
            </div>
            <p style={{ margin: "14px 0 0", fontSize: "0.78rem", color: TX2, lineHeight: 1.5 }}>
              {theme.description}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "0.7rem", color: TX3, fontStyle: "italic" }}>
              {theme.playstyle}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
