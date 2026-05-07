import { useEffect, useState } from "react";
import { useGameStore } from "../data/gameState";

export default function NotificationToast() {
  const notifications = useGameStore((s) => s.notifications);
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (notifications.length === 0) {
      setVisible([]);
      return;
    }
    const latest = notifications[0];
    if (visible.find((v) => v.id === latest.id)) return;
    setVisible((prev) => [latest, ...prev].slice(0, 3));
    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((v) => v.id !== latest.id));
    }, 4000);
    return () => clearTimeout(timer);
  }, [notifications]);

  if (visible.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: 78, left: 24, zIndex: 20,
      display: "flex", flexDirection: "column", gap: 6,
      pointerEvents: "none",
    }}>
      {visible.map((n, i) => (
        <div key={n.id} style={{
          background: "rgba(14, 10, 26, 0.94)",
          border: "1px solid rgba(180, 140, 60, 0.25)",
          borderRadius: 8,
          padding: "10px 18px",
          color: "#e0d8c0",
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.8rem",
          maxWidth: 340,
          animation: "mtgSlideIn 0.3s ease",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          opacity: 1 - i * 0.15,
        }}>
          {n.message}
        </div>
      ))}
      <style>{`
        @keyframes mtgSlideIn {
          from { transform: translateX(-80px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
