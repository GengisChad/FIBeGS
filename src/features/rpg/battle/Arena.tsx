import { useEffect, useMemo, useRef, useState } from "react";
import { Bey, BeyType } from "../data/beys";

export type MoveKind = "attack" | "dodge" | "boost" | "xtreme" | null;

export interface ArenaAction {
  kind: MoveKind;
  t0: number;
}

export type KoReason = "burst" | "spin";
export interface KoState {
  reason: KoReason;
  t0: number;
}

interface Props {
  player: Bey;
  enemy: Bey;
  playerAction: ArenaAction;
  enemyAction: ArenaAction;
  shakeKey?: number;
  playerKo?: KoState | null;
  enemyKo?: KoState | null;
  onXtremeDash?: (side: "p" | "e") => void;
}

const ORBIT_RADIUS: Record<BeyType, number> = {
  attack: 0.88,
  balance: 0.72,
  stamina: 0.58,
  defense: 0.42,
};
const ORBIT_SPEED: Record<BeyType, number> = {
  attack: 3.6,
  balance: 2.8,
  stamina: 2.1,
  defense: 1.6,
};
const TYPE_RING_COLOR: Record<BeyType, string> = {
  attack: "rgba(239,68,68,0.35)",
  defense: "rgba(59,130,246,0.35)",
  stamina: "rgba(34,197,94,0.35)",
  balance: "rgba(234,179,8,0.35)",
};

// Rail trigger: knockback pushes the defender outward; once they brush the rail
// (radial position close to 1.0 of the inner play area), random chance to latch.
const RAIL_TRIGGER_RADIUS = 0.95;
const RAIL_LATCH_CHANCE = 0.28;
// Top notch angle in screen-space (0 rad = +X, -π/2 = top)
const NOTCH_ANGLE = -Math.PI / 2;


interface ActionOffset {
  dr: number;
  scale: number;
  glow: number;
  impact: number;
}

const ACTION_DUR: Record<Exclude<MoveKind, null>, number> = {
  attack: 900, dodge: 550, boost: 750, xtreme: 1300,
};

const computeActionOffset = (
  action: ArenaAction,
  now: number,
  gap: number,
): ActionOffset => {
  if (!action.kind) return { dr: 0, scale: 1, glow: 0, impact: 0 };
  const t = now - action.t0;
  const dur = ACTION_DUR[action.kind];
  if (t < 0 || t > dur) return { dr: 0, scale: 1, glow: 0, impact: 0 };
  const p = t / dur;
  switch (action.kind) {
    case "attack": {
      if (p < 0.45) {
        const q = p / 0.45;
        const ease = q * q * (3 - 2 * q);
        return { dr: -gap * 0.92 * ease, scale: 1 + 0.06 * ease, glow: 0.35 * ease, impact: 0 };
      }
      const q = (p - 0.45) / 0.55;
      const ease = 1 - Math.pow(1 - q, 2);
      return {
        dr: -gap * 0.92 * (1 - ease),
        scale: 1 + 0.06 * (1 - ease),
        glow: 0.6 * (1 - q),
        impact: q < 0.18 ? 1 - q * 5.5 : 0,
      };
    }
    case "dodge": {
      const dr = Math.sin(p * Math.PI) * 0.22 * Math.max(0.4, gap * 0.25);
      return { dr, scale: 1 - 0.08 * Math.sin(p * Math.PI), glow: 0.2, impact: 0 };
    }
    case "boost": {
      const s = 1 + 0.18 * Math.sin(p * Math.PI);
      return { dr: 0, scale: s, glow: Math.sin(p * Math.PI), impact: 0 };
    }
    case "xtreme": {
      if (p < 0.32) {
        const q = p / 0.32;
        return { dr: gap * 0.15 * q, scale: 1 + 0.25 * q, glow: q, impact: 0 };
      }
      if (p < 0.6) {
        const q = (p - 0.32) / 0.28;
        const ease = q * q;
        return { dr: gap * 0.15 - gap * 1.05 * ease, scale: 1.3, glow: 1, impact: 0 };
      }
      const q = (p - 0.6) / 0.4;
      const ease = 1 - Math.pow(1 - q, 2);
      return {
        dr: -gap * 0.9 * (1 - ease),
        scale: 1.25 - 0.25 * q,
        glow: 1 - q * 0.8,
        impact: q < 0.18 ? 1 - q * 5.5 : 0,
      };
    }
  }
};

// Knockback experienced by the DEFENDER when the opponent's attack/xtreme lands.
const computeKnockback = (
  opponentAction: ArenaAction,
  now: number,
  gap: number,
): { dr: number; scale: number; shake: number } => {
  if (!opponentAction.kind || (opponentAction.kind !== "attack" && opponentAction.kind !== "xtreme")) {
    return { dr: 0, scale: 1, shake: 0 };
  }
  const t = now - opponentAction.t0;
  const dur = ACTION_DUR[opponentAction.kind];
  if (t < 0 || t > dur) return { dr: 0, scale: 1, shake: 0 };
  const p = t / dur;
  const impactStart = opponentAction.kind === "attack" ? 0.42 : 0.58;
  const impactEnd = opponentAction.kind === "attack" ? 0.95 : 0.98;
  if (p < impactStart || p > impactEnd) return { dr: 0, scale: 1, shake: 0 };
  const q = (p - impactStart) / (impactEnd - impactStart);
  const strength = opponentAction.kind === "xtreme" ? 0.85 : 0.6;
  const dr = gap * strength * Math.sin(q * Math.PI) * (1 - q * 0.35);
  const shake = (1 - q) * (opponentAction.kind === "xtreme" ? 1 : 0.8);
  const scale = 1 + 0.08 * Math.sin(q * Math.PI);
  return { dr, scale, shake };
};

interface PartScatter {
  angle: number;
  distance: number;
  rot: number;
  delay: number;
}

const BeyVisual = ({
  bey,
  size,
  ko,
  arenaSize,
}: {
  bey: Bey;
  size: number;
  ko: KoState | null | undefined;
  arenaSize: number;
}) => {
  const spinRef = useRef<HTMLDivElement>(null);
  const layers = bey.partsImages ?? [];

  const scatter = useMemo<PartScatter[]>(() => {
    return layers.map((_, i) => ({
      angle: Math.random() * Math.PI * 2,
      distance: arenaSize * (0.18 + Math.random() * 0.28),
      rot: (Math.random() - 0.5) * Math.PI * 4,
      delay: i * 60 + Math.random() * 120,
    }));
  }, [layers.length, arenaSize, ko?.t0]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let a = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      let speed = 80;
      if (ko) {
        const elapsed = (t - ko.t0) / 1000;
        if (ko.reason === "burst") {
          speed = elapsed < 0.15 ? 80 * (1 - elapsed / 0.15) : 0;
        } else {
          speed = Math.max(0, 80 * Math.max(0, 1 - elapsed / 1.4));
        }
      }
      a += dt * speed;
      if (spinRef.current) spinRef.current.style.transform = `rotate(${a}rad)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ko?.t0, ko?.reason]);

  const isBurst = ko?.reason === "burst";

  return (
    <div ref={spinRef} className="relative" style={{ width: size, height: size, willChange: "transform" }}>
      {layers.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: size * 0.7 }}>
          {bey.emoji}
        </div>
      ) : (
        layers
          .slice()
          .sort((a, b) => a.z - b.z)
          .map((l, i) => {
            const isTop = i === layers.length - 1 && layers.length > 1;
            const s = isTop ? size * 0.55 : size;
            const sc = scatter[i];
            const burstStyle = isBurst && sc
              ? {
                  transform: `translate(-50%, -50%) translate(${Math.cos(sc.angle) * sc.distance}px, ${Math.sin(sc.angle) * sc.distance}px) rotate(${sc.rot}rad)`,
                  transition: `transform 850ms cubic-bezier(.22,.9,.3,1) ${sc.delay}ms, opacity 1200ms ease ${sc.delay + 400}ms`,
                  opacity: 0.85,
                }
              : { transform: "translate(-50%, -50%)" };
            return (
              <img
                key={i}
                src={l.url}
                alt=""
                className="absolute left-1/2 top-1/2 object-contain"
                style={{
                  width: s,
                  height: s,
                  zIndex: l.z,
                  pointerEvents: "none",
                  ...burstStyle,
                }}
                draggable={false}
              />
            );
          })
      )}
    </div>
  );
};

// Per-side dash state, kept as a mutable ref inside Arena.
interface DashState {
  t0: number;
  fromAngle: number;   // angle on rail where latch happened
  fired: boolean;      // damage callback fired
}

const DASH_RAIL_DUR = 650;   // ms to slide along rail to notch
const DASH_LAUNCH_DUR = 380; // ms launching from notch toward center
const DASH_TOTAL = DASH_RAIL_DUR + DASH_LAUNCH_DUR + 220;

// Shortest signed angular delta going counterclockwise (decreasing angle in screen space).
const ccwDelta = (from: number, to: number): number => {
  let d = to - from;
  while (d > 0) d -= Math.PI * 2;
  while (d < -Math.PI * 2) d += Math.PI * 2;
  return d; // negative
};

export const Arena = ({
  player, enemy, playerAction, enemyAction, shakeKey, playerKo, enemyKo, onXtremeDash,
}: Props) => {
  const angleRef = useRef(0);
  const pPosRef = useRef<HTMLDivElement>(null);
  const ePosRef = useRef<HTMLDivElement>(null);
  const vfxPRef = useRef<HTMLDivElement>(null);
  const vfxERef = useRef<HTMLDivElement>(null);
  const burstPRef = useRef<HTMLDivElement>(null);
  const burstERef = useRef<HTMLDivElement>(null);
  const railFxRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const [arenaSize, setArenaSize] = useState(360);

  // Stable refs so the RAF loop never tears down on prop change (prevents input lag).
  const onXtremeDashRef = useRef(onXtremeDash);
  const playerActionRef = useRef(playerAction);
  const enemyActionRef = useRef(enemyAction);
  const playerKoRef = useRef(playerKo);
  const enemyKoRef = useRef(enemyKo);
  const playerTypeRef = useRef(player.type);
  const enemyTypeRef = useRef(enemy.type);

  const pDashRef = useRef<DashState | null>(null);
  const eDashRef = useRef<DashState | null>(null);
  const pContactRef = useRef(false);
  const eContactRef = useRef(false);

  useEffect(() => { onXtremeDashRef.current = onXtremeDash; }, [onXtremeDash]);
  useEffect(() => { playerActionRef.current = playerAction; }, [playerAction]);
  useEffect(() => { enemyActionRef.current = enemyAction; }, [enemyAction]);
  useEffect(() => { playerKoRef.current = playerKo; }, [playerKo]);
  useEffect(() => { enemyKoRef.current = enemyKo; }, [enemyKo]);
  useEffect(() => { playerTypeRef.current = player.type; }, [player.type]);
  useEffect(() => { enemyTypeRef.current = enemy.type; }, [enemy.type]);

  useEffect(() => {
    if (!shakeKey || !shakeRef.current) return;
    shakeRef.current.style.animation = "none";
    void shakeRef.current.offsetWidth;
    shakeRef.current.style.animation = "shake 0.35s";
  }, [shakeKey]);

  useEffect(() => {
    if (!arenaRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = arenaRef.current!.getBoundingClientRect();
      const next = Math.round(Math.min(r.width, r.height));
      setArenaSize((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    });
    ro.observe(arenaRef.current);
    return () => ro.disconnect();
  }, []);


  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    // Canvas trail setup (DPR-aware).
    const canvas = trailCanvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas && ctx) {
      const cssW = arenaSize;
      const cssH = Math.round(arenaSize * 0.7);
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
    }

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const playerKo = playerKoRef.current;
      const enemyKo = enemyKoRef.current;
      const playerAction = playerActionRef.current;
      const enemyAction = enemyActionRef.current;
      const pType = playerTypeRef.current;
      const eType = enemyTypeRef.current;

      const orbitFactor = (ko: KoState | null | undefined) => {
        if (!ko) return 1;
        const elapsed = (now - ko.t0) / 1000;
        if (ko.reason === "burst") return elapsed < 0.12 ? 1 - elapsed / 0.12 : 0;
        return Math.max(0, 1 - elapsed / 1.4);
      };
      const pFactor = orbitFactor(playerKo);
      const eFactor = orbitFactor(enemyKo);
      const baseSpeed = (ORBIT_SPEED[pType] + ORBIT_SPEED[eType]) * 0.5;
      angleRef.current -= baseSpeed * dt * Math.min(pFactor, eFactor);

      const inner = arenaSize * 0.40;
      const rP = ORBIT_RADIUS[pType];
      const rE = ORBIT_RADIUS[eType];
      const gap = rP + rE;

      const apply = (
        ref: React.RefObject<HTMLDivElement>,
        baseR: number,
        baseAngle: number,
        action: ArenaAction,
        opponentAction: ArenaAction,
        ko: KoState | null | undefined,
        dashRef: React.MutableRefObject<DashState | null>,
        side: "p" | "e",
      ) => {
        if (!ref.current) return { x: 0, y: 0, off: { dr: 0, scale: 1, glow: 0, impact: 0 }, onRail: false };

        if (dashRef.current) {
          const ds = dashRef.current;
          const elapsed = now - ds.t0;
          if (elapsed >= DASH_TOTAL) {
            dashRef.current = null;
          } else if (elapsed < DASH_RAIL_DUR) {
            const q = elapsed / DASH_RAIL_DUR;
            const ease = q * q;
            const delta = ccwDelta(ds.fromAngle, NOTCH_ANGLE);
            const a = ds.fromAngle + delta * ease;
            const r = inner * 1.0;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1.15)`;
            return { x, y, off: { dr: 0, scale: 1.15, glow: 1, impact: 0 }, onRail: true };
          } else if (elapsed < DASH_RAIL_DUR + DASH_LAUNCH_DUR) {
            const q = (elapsed - DASH_RAIL_DUR) / DASH_LAUNCH_DUR;
            const ease = 1 - Math.pow(1 - q, 2);
            const x0 = Math.cos(NOTCH_ANGLE) * inner;
            const y0 = Math.sin(NOTCH_ANGLE) * inner;
            const x1 = -x0 * 0.6;
            const y1 = -y0 * 0.6;
            const x = x0 + (x1 - x0) * ease;
            const y = y0 + (y1 - y0) * ease;
            const sc = 1.25 - 0.2 * q;
            ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${sc})`;
            if (!ds.fired && q > 0.55) {
              ds.fired = true;
              onXtremeDashRef.current?.(side);
            }
            return { x, y, off: { dr: 0, scale: sc, glow: 1, impact: q < 0.7 ? 1 - q : 0 }, onRail: false };
          } else {
            const q = (elapsed - DASH_RAIL_DUR - DASH_LAUNCH_DUR) / 220;
            const x1 = -Math.cos(NOTCH_ANGLE) * inner * 0.6;
            const y1 = -Math.sin(NOTCH_ANGLE) * inner * 0.6;
            const r2 = inner * baseR;
            const x2 = Math.cos(baseAngle) * r2;
            const y2 = Math.sin(baseAngle) * r2;
            const ease = q;
            const x = x1 + (x2 - x1) * ease;
            const y = y1 + (y2 - y1) * ease;
            ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${1.05 - 0.05 * q})`;
            return { x, y, off: { dr: 0, scale: 1, glow: 0, impact: 0 }, onRail: false };
          }
        }

        const off = ko ? { dr: 0, scale: 1, glow: 0, impact: 0 } : computeActionOffset(action, now, gap);
        const kb = ko ? { dr: 0, scale: 1, shake: 0 } : computeKnockback(opponentAction, now, gap);
        let radial = baseR + off.dr + kb.dr;
        const MAX_RADIAL = 0.96;
        let bouncedOff = 0;
        if (radial > MAX_RADIAL) {
          const overshoot = radial - MAX_RADIAL;
          radial = MAX_RADIAL - overshoot * 0.6;
          bouncedOff = overshoot;
        }
        const r = inner * radial;
        const shakeMag = Math.max(kb.shake, bouncedOff * 6);
        const shakeX = shakeMag ? (Math.random() - 0.5) * shakeMag * 8 : 0;
        const shakeY = shakeMag ? (Math.random() - 0.5) * shakeMag * 8 : 0;
        const x = Math.cos(baseAngle) * r + shakeX;
        const y = Math.sin(baseAngle) * r + shakeY;
        ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${off.scale * kb.scale})`;

        const onRail = !ko && (bouncedOff > 0 || radial >= RAIL_TRIGGER_RADIUS);
        return { x, y, off, onRail };
      };

      const pRes = apply(pPosRef, rP, angleRef.current, playerAction, enemyAction, playerKo, pDashRef, "p");
      const eRes = apply(ePosRef, rE, angleRef.current + Math.PI, enemyAction, playerAction, enemyKo, eDashRef, "e");

      const tryLatch = (
        res: { x: number; y: number; onRail: boolean },
        dashRef: React.MutableRefObject<DashState | null>,
        contactRef: React.MutableRefObject<boolean>,
      ) => {
        if (dashRef.current) { contactRef.current = res.onRail; return; }
        if (res.onRail && !contactRef.current) {
          if (Math.random() < RAIL_LATCH_CHANCE) {
            const ang = Math.atan2(res.y, res.x);
            dashRef.current = { t0: now, fromAngle: ang, fired: false };
            if (railFxRef.current) {
              railFxRef.current.style.opacity = "1";
              railFxRef.current.style.transform = `translate(-50%, -50%) translate(${res.x}px, ${res.y}px)`;
              setTimeout(() => { if (railFxRef.current) railFxRef.current.style.opacity = "0"; }, 350);
            }
          }
        }
        contactRef.current = res.onRail;
      };
      tryLatch(pRes, pDashRef, pContactRef);
      tryLatch(eRes, eDashRef, eContactRef);

      // Neon hex trail: fade prior frame then stamp glowing dots at bey positions.
      if (canvas && ctx) {
        const cw = canvas.width / dpr;
        const ch = canvas.height / dpr;
        const cx = cw / 2;
        const cy = ch / 2;
        // Fade
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(0, 0, cw, ch);
        // Add glows
        ctx.globalCompositeOperation = "lighter";
        const stamp = (x: number, y: number, hue: number) => {
          const px = cx + x;
          const py = cy + y;
          const rad = arenaSize * 0.12;
          const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
          g.addColorStop(0, `hsla(${hue}, 100%, 65%, 0.85)`);
          g.addColorStop(0.45, `hsla(${hue}, 100%, 55%, 0.35)`);
          g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fill();
        };
        if (!playerKo || (now - playerKo.t0) < 200) stamp(pRes.x, pRes.y, 175); // cyan
        if (!enemyKo || (now - enemyKo.t0) < 200) stamp(eRes.x, eRes.y, 305);   // magenta
        ctx.globalCompositeOperation = "source-over";
      }

      const placeVfx = (
        vfxRef: React.RefObject<HTMLDivElement>,
        attackerRes: { x: number; y: number; off: ActionOffset },
        defenderRes: { x: number; y: number; off: ActionOffset },
      ) => {
        if (!vfxRef.current) return;
        const i = attackerRes.off.impact;
        if (i <= 0.02) {
          vfxRef.current.style.opacity = "0";
          return;
        }
        const mx = (attackerRes.x + defenderRes.x) / 2;
        const my = (attackerRes.y + defenderRes.y) / 2;
        vfxRef.current.style.transform = `translate(-50%, -50%) translate(${mx}px, ${my}px) scale(${0.2 + i * 1.05})`;
        vfxRef.current.style.opacity = `${i}`;
      };
      placeVfx(vfxPRef, pRes, eRes);
      placeVfx(vfxERef, eRes, pRes);

      const placeBurst = (ref: React.RefObject<HTMLDivElement>, res: { x: number; y: number }, ko: KoState | null | undefined) => {
        if (!ref.current) return;
        if (!ko || ko.reason !== "burst") { ref.current.style.opacity = "0"; return; }
        const elapsed = (now - ko.t0) / 1000;
        if (elapsed > 1) { ref.current.style.opacity = "0"; return; }
        const q = Math.min(1, elapsed / 0.7);
        const size = 40 + q * arenaSize * 0.9;
        ref.current.style.transform = `translate(-50%, -50%) translate(${res.x}px, ${res.y}px)`;
        ref.current.style.width = `${size}px`;
        ref.current.style.height = `${size}px`;
        ref.current.style.opacity = `${1 - q}`;
      };
      placeBurst(burstPRef, pRes, playerKo);
      placeBurst(burstERef, eRes, enemyKo);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [arenaSize]);



  const beySize = Math.max(28, arenaSize * 0.095);

  // Top-down round arena: green outer rail with a small notch at top, white inner floor.
  // viewBox 100x70. Center (50, 35).
  const railPath =
    "M 47.5 2.5 L 49 4.2 L 51 4.2 L 52.5 2.5 " +
    "A 33 33 0 1 1 47.5 2.5 Z";
  const floorPath =
    "M 47.9 6.2 L 49.2 7.7 L 50.8 7.7 L 52.1 6.2 " +
    "A 29 29 0 1 1 47.9 6.2 Z";
  const xtremeLinePath =
    "M 47.7 4.2 L 49.1 5.9 L 50.9 5.9 L 52.3 4.2 " +
    "A 31 31 0 1 1 47.7 4.2 Z";

  return (
    <div
      ref={arenaRef}
      className="relative w-full aspect-[4/3] mx-auto animate-fade-in"
    >
      <div ref={shakeRef} className="absolute inset-0">

      <svg
        viewBox="0 0 100 70"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="floorGrad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="hsl(0 0% 100%)" />
            <stop offset="70%" stopColor="hsl(190 30% 94%)" />
            <stop offset="100%" stopColor="hsl(200 25% 84%)" />
          </radialGradient>
          <radialGradient id="railGrad" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="hsl(140 70% 42%)" />
            <stop offset="60%" stopColor="hsl(145 78% 30%)" />
            <stop offset="100%" stopColor="hsl(150 85% 16%)" />
          </radialGradient>
          <pattern id="hexGrid" width="6" height="5.196" patternUnits="userSpaceOnUse">
            <path
              d="M 1.5 0 L 4.5 0 L 6 2.598 L 4.5 5.196 L 1.5 5.196 L 0 2.598 Z"
              fill="none"
              stroke="hsl(185 95% 55% / 0.55)"
              strokeWidth="0.18"
            />
          </pattern>
        </defs>

        <path d={railPath} fill="url(#railGrad)" stroke="hsl(150 80% 14%)" strokeWidth="0.5" />
        <path
          d={xtremeLinePath}
          fill="none"
          stroke="hsl(140 100% 80% / 0.55)"
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{ filter: "blur(0.6px)" }}
        />
        <path
          d={xtremeLinePath}
          fill="none"
          stroke="hsl(140 100% 65% / 0.95)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
        <path d={floorPath} fill="url(#floorGrad)" stroke="hsl(190 30% 70%)" strokeWidth="0.3" />
        <path d={floorPath} fill="url(#hexGrid)" />
        <circle cx="50" cy="35" r="0.6" fill="hsl(185 90% 45% / 0.9)" />
        <circle cx="50" cy="35" r="2.6" fill="none" stroke="hsl(185 90% 55% / 0.45)" strokeWidth="0.15" />
      </svg>

      {/* Neon trail canvas (lights up hexes where the beys pass) */}
      <canvas
        ref={trailCanvasRef}
        className="absolute top-1/2 left-1/2 pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ mixBlendMode: "screen" }}
      />

      {/* Orbit guide rings (kept subtle) */}
      {(["attack", "balance", "stamina", "defense"] as BeyType[]).map((t) => {
        const d = ORBIT_RADIUS[t] * 2 * 46;
        return (
          <div
            key={t}
            className="absolute rounded-full border pointer-events-none"
            style={{
              width: `${d}%`,
              height: `${d}%`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              borderColor: TYPE_RING_COLOR[t],
              borderStyle: "dashed",
              opacity: 0.35,
            }}
          />
        );
      })}
      <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-foreground/30 -translate-x-1/2 -translate-y-1/2" />

      {/* Rail latch spark */}
      <div
        ref={railFxRef}
        className="absolute top-1/2 left-1/2 pointer-events-none rounded-full vfx-rail"
        style={{ width: 80, height: 80, opacity: 0, transition: "opacity 220ms ease" }}
      />

      {/* Burst shockwaves */}
      <div ref={burstPRef} className="absolute top-1/2 left-1/2 pointer-events-none rounded-full vfx-shock" style={{ opacity: 0 }} />
      <div ref={burstERef} className="absolute top-1/2 left-1/2 pointer-events-none rounded-full vfx-shock" style={{ opacity: 0 }} />

      {/* Collision VFX */}
      <div ref={vfxPRef} className="absolute top-1/2 left-1/2 pointer-events-none rounded-full vfx-burst" style={{ width: 96, height: 96, opacity: 0, willChange: "transform, opacity" }} />
      <div ref={vfxERef} className="absolute top-1/2 left-1/2 pointer-events-none rounded-full vfx-burst" style={{ width: 96, height: 96, opacity: 0, willChange: "transform, opacity" }} />

      <div ref={pPosRef} className="absolute top-1/2 left-1/2" style={{ willChange: "transform" }}>
        <BeyVisual bey={player} size={beySize} ko={playerKo} arenaSize={arenaSize} />
      </div>
      <div ref={ePosRef} className="absolute top-1/2 left-1/2" style={{ willChange: "transform" }}>
        <BeyVisual bey={enemy} size={beySize} ko={enemyKo} arenaSize={arenaSize} />
      </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translate(0,0); }
          20% { transform: translate(-4px, 2px); }
          40% { transform: translate(3px, -3px); }
          60% { transform: translate(-2px, 3px); }
          80% { transform: translate(2px, -2px); }
        }
        .vfx-burst {
          background: radial-gradient(circle, hsl(var(--primary) / 0.95) 0%, hsl(var(--primary) / 0.55) 35%, transparent 70%);
          box-shadow:
            0 0 24px 6px hsl(var(--primary) / 0.7),
            0 0 60px 18px hsl(var(--primary) / 0.35);
          mix-blend-mode: screen;
        }
        .vfx-shock {
          background: radial-gradient(circle, transparent 55%, hsl(0 90% 60% / 0.8) 62%, hsl(40 100% 60% / 0.5) 70%, transparent 80%);
          box-shadow: 0 0 40px 10px hsl(0 90% 60% / 0.4);
          mix-blend-mode: screen;
        }
        .vfx-rail {
          background: radial-gradient(circle, hsl(285 90% 75% / 0.95) 0%, hsl(285 90% 60% / 0.55) 40%, transparent 75%);
          box-shadow: 0 0 36px 10px hsl(285 90% 60% / 0.6);
          mix-blend-mode: screen;
        }
      `}</style>
    </div>
  );
};
