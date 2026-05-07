import { useRef, useEffect } from "react";
import { useGameStore } from "../data/gameState";
import { getRegions, worldToHex } from "../data/regions";
import { getMapObjects } from "../data/mapObjects";

const SIZE_W = 140;
const SIZE_H = 200;
const PADDING = 6;
const THREAT_RANGE = 4; // hexes from gold tower to trigger pulsing ring

export default function MiniMap() {
  const canvasRef = useRef(null);
  const regions = getRegions();
  const stationedCreatures = useGameStore((s) => s.stationedCreatures);
  const creatureOwners = useGameStore((s) => s.creatureOwners);
  const towerRegions = useGameStore((s) => s.towerRegions);

  // Keep latest data in refs so the animation loop doesn't re-subscribe
  const dataRef = useRef({ stationedCreatures, creatureOwners, towerRegions });
  dataRef.current = { stationedCreatures, creatureOwners, towerRegions };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE_W * dpr;
    canvas.height = SIZE_H * dpr;
    canvas.style.width = SIZE_W + "px";
    canvas.style.height = SIZE_H + "px";
    ctx.scale(dpr, dpr);

    // Find axial bounds
    let qMin = Infinity, qMax = -Infinity, rMin = Infinity, rMax = -Infinity;
    for (const r of regions) {
      if (r.q < qMin) qMin = r.q;
      if (r.q > qMax) qMax = r.q;
      if (r.r < rMin) rMin = r.r;
      if (r.r > rMax) rMax = r.r;
    }
    const qSpan = qMax - qMin || 1;
    const rSpan = rMax - rMin || 1;

    const mapW = SIZE_W - PADDING * 2;
    const mapH = SIZE_H - PADDING * 2;
    const hexR = Math.min(mapW / (qSpan + 1), mapH / (rSpan + 1)) * 0.62;

    function axialToPixel(q, r) {
      const x = PADDING + mapW / 2 + (r - (rMin + rMax) / 2) * hexR * 1.8;
      const y = PADDING + mapH / 2 + (q - (qMin + qMax) / 2) * hexR * 1.6;
      return [x, y];
    }

    function hexDist(q1, r1, q2, r2) {
      const dq = q1 - q2, dr = r1 - r2;
      return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
    }

    let animId;

    function draw(ts) {
      ctx.clearRect(0, 0, SIZE_W, SIZE_H);

      const { stationedCreatures, creatureOwners, towerRegions } = dataRef.current;

      // Draw hex grid outlines
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5;
      for (const r of regions) {
        const [cx, cy] = axialToPixel(r.q, r.r);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hx = cx + hexR * Math.cos(angle);
          const hy = cy + hexR * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Creature dots — green for P1, red for P2, gray for neutral
      for (const r of regions) {
        const creatures = stationedCreatures[r.id];
        if (creatures && creatures.length > 0) {
          const [px, py] = axialToPixel(r.q, r.r);
          for (const cid of creatures) {
            const owner = creatureOwners[cid];
            ctx.fillStyle = owner === "player-1" ? "#44cc66" : owner === "player-2" ? "#ee4444" : "#888888";
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Tower dots — gold for P1, silver for P2
      if (towerRegions?.gold) {
        const [gx, gy] = axialToPixel(towerRegions.gold.q, towerRegions.gold.r);
        ctx.fillStyle = "#d4a017";
        ctx.shadowColor = "#d4a017";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pulsing ring around enemy dots near gold tower
        const pulse = Math.sin(ts * 0.004) * 0.5 + 0.5; // 0..1, ~4s cycle
        for (const r of regions) {
          const creatures = stationedCreatures[r.id];
          if (!creatures || creatures.length === 0) continue;
          const d = hexDist(r.q, r.r, towerRegions.gold.q, towerRegions.gold.r);
          if (d > THREAT_RANGE) continue;
          // Only pulse for enemy (player-2) creatures
          const hasEnemy = creatures.some(cid => creatureOwners[cid] === "player-2");
          if (!hasEnemy) continue;
          const [px, py] = axialToPixel(r.q, r.r);
          const ringR = 4 + pulse * 4;
          const alpha = 0.8 - pulse * 0.5;
          ctx.strokeStyle = `rgba(238,68,68,${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(px, py, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (towerRegions?.silver) {
        const [sx, sy] = axialToPixel(towerRegions.silver.q, towerRegions.silver.r);
        ctx.fillStyle = "#c0c0c0";
        ctx.shadowColor = "#c0c0c0";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Medium tower dots — fine dots at tower positions
      const mapObjects = getMapObjects();
      for (const obj of mapObjects) {
        if (obj.type !== "tower") continue;
        const [q, r] = worldToHex(obj.position[0], obj.position[2]);
        const [tx, ty] = axialToPixel(q, r);
        const color = obj.owner === "player-1" ? "#d4a017" : "#c0c0c0";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(tx, ty, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [regions]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: SIZE_W, height: SIZE_H,
        background: "rgba(8, 6, 18, 0.82)",
        border: "1px solid rgba(90, 74, 50, 0.3)",
        borderRadius: 8,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "block",
      }}
    />
  );
}
