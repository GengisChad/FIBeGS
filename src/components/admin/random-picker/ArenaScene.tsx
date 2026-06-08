import { useEffect, useRef } from "react";
import {
  BeybladeState,
  createInitialState,
  stepSimulation,
} from "./simulation";
import { Participant, SimParams, TYPE_COLORS } from "./types";
import defaultArena from "@/assets/random-picker/arena-default.png";

interface ArenaSceneProps {
  participants: Participant[];
  params: SimParams;
  arenaTextureUrl: string | null;
  running: boolean;
  resetKey: number;
  onFinish: (winner: Participant | null) => void;
}

/**
 * Canvas 2D top-down. L'arena è una "conca": il centro dell'immagine è il punto
 * più profondo (gravità verso il centro). Le coordinate di simulazione sono in
 * unità arena (raggio = params.arenaRadius); le mappiamo in pixel rispetto al
 * centro del canvas.
 */
export default function ArenaScene({
  participants,
  params,
  arenaTextureUrl,
  running,
  resetKey,
  onFinish,
}: ArenaSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<BeybladeState[]>([]);
  const finishedRef = useRef(false);
  const arenaImgRef = useRef<HTMLImageElement | null>(null);
  const spritesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  // Carica arena
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = arenaTextureUrl || defaultArena;
    img.onload = () => {
      arenaImgRef.current = img;
    };
  }, [arenaTextureUrl]);

  // Pre-carica sprite partecipanti
  useEffect(() => {
    const map = new Map<string, HTMLImageElement>();
    for (const p of participants) {
      if (p.spriteUrl && !map.has(p.spriteUrl)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = p.spriteUrl;
        map.set(p.spriteUrl, img);
      }
    }
    spritesRef.current = map;
  }, [participants]);

  // Reset stato
  useEffect(() => {
    stateRef.current = createInitialState(participants, params, Date.now());
    finishedRef.current = false;
    elapsedRef.current = 0;
  }, [resetKey]); // eslint-disable-line

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tick = (t: number) => {
      const dtMs = lastTRef.current ? t - lastTRef.current : 16;
      lastTRef.current = t;
      const dt = Math.min(dtMs / 1000, 1 / 30);

      if (running && !finishedRef.current) {
        elapsedRef.current += dt;
        const r = stepSimulation(stateRef.current, params, dt, elapsedRef.current);
        if (r.finished) {
          finishedRef.current = true;
          onFinish(r.winner ? r.winner.participant : null);
        }
      }

      // Render
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Misurato dall'asset di default: linea rosa = ellisse interna
      // image 1264x842, centro ellisse non a metà altezza ma in (632, 393.5)
      // raggi interni: rx=582, ry=326.5
      // Ratios: rx/W=0.4604, ry/H=0.3878, cy/H=0.4673
      const arena = arenaImgRef.current;
      const imgAspect =
        arena && arena.naturalWidth > 0
          ? arena.naturalWidth / arena.naturalHeight
          : 1264 / 842;
      const PINK_RX_RATIO = 0.4604;
      const PINK_RY_RATIO = 0.3878;
      const PINK_CY_RATIO = 0.4673; // y del centro ellisse / H immagine

      // Fit "contain"
      let drawW = w;
      let drawH = w / imgAspect;
      if (drawH > h) {
        drawH = h;
        drawW = h * imgAspect;
      }
      drawW *= 0.98;
      drawH *= 0.98;

      const imgX = w / 2 - drawW / 2;
      const imgY = h / 2 - drawH / 2;
      // Centro reale dell'ellisse rosa nel canvas
      const ecx = imgX + drawW / 2;
      const ecy = imgY + drawH * PINK_CY_RATIO;
      const erx = drawW * PINK_RX_RATIO;
      const ery = drawH * PINK_RY_RATIO;

      if (arena && arena.complete) {
        ctx.drawImage(arena, imgX, imgY, drawW, drawH);
      } else {
        ctx.fillStyle = "#1a0b2e";
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, erx, ery, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Mappatura simulazione (cerchio raggio = arenaRadius) -> ellisse rosa
      const pxPerUnitX = erx / params.arenaRadius;
      const pxPerUnitY = ery / params.arenaRadius;
      const pxPerUnit = (pxPerUnitX + pxPerUnitY) / 2;

      // Disegna beyblade
      const beys = stateRef.current;
      for (const b of beys) {
        if (!b.alive) continue;
        const sx = ecx + b.position.x * pxPerUnitX;
        const sy = ecy - b.position.y * pxPerUnitY;
        const r = params.beybladeRadius * pxPerUnit;

        // Ombra
        ctx.beginPath();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.ellipse(sx + 2, sy + 4, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        const sprite = b.participant.spriteUrl
          ? spritesRef.current.get(b.participant.spriteUrl)
          : null;

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(b.spinAngle);
          ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
          ctx.restore();
        } else {
          // Fallback: pallino colorato per tipo + ring spin
          const color = TYPE_COLORS[b.type];
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 2;
          ctx.stroke();
          // tacca rotante
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(b.spinAngle);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(-1.5, -r * 0.9, 3, r * 0.5);
          ctx.restore();
        }

        // HP bar
        const barW = r * 2.2;
        const barH = 4;
        const barY = sy - r - 10;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(sx - barW / 2, barY, barW, barH);
        const dRatio = Math.max(0, b.durability / params.initialDurability);
        ctx.fillStyle = dRatio > 0.5 ? "#22c55e" : dRatio > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(sx - barW / 2, barY, barW * dRatio, barH);
        // Stamina underneath
        const sRatio = Math.max(0, b.stamina / params.initialStamina);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(sx - barW / 2, barY + barH + 1, barW, 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(sx - barW / 2, barY + barH + 1, barW * sRatio, 2);

        // Nome
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = `bold ${Math.max(10, r * 0.55)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(b.participant.name, sx, barY - 4);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      lastTRef.current = 0;
    };
  }, [running, params, onFinish]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ touchAction: "none" }}
    />
  );
}
