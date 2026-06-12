import { useEffect, useMemo, useRef, useState } from "react";
import { Bey, BeyType } from "../data/beys";
import arenaImage from "../assets/arena-bx-green-rail.png";

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
// Top notch angle in screen-space (0 rad = +X, -PI/2 = top).
const NOTCH_ANGLE = -Math.PI / 2;

// Centerline sampled from the green rail pixels of arena-bx-green-rail.png.
const RAIL_TRACE: ReadonlyArray<readonly [number, number, number]> = [
  [-3.098, -0.3893, -0.0185], [-3.0107, -0.3933, -0.0552], [-2.9234, -0.3915, -0.0912],
  [-2.8362, -0.3863, -0.1301], [-2.7489, -0.3752, -0.165], [-2.6616, -0.3585, -0.1983],
  [-2.5744, -0.3392, -0.2296], [-2.4871, -0.3189, -0.2596], [-2.3998, -0.2957, -0.2887],
  [-2.3126, -0.2734, -0.317], [-2.2253, -0.2482, -0.3439], [-2.138, -0.2217, -0.3682],
  [-2.0508, -0.1917, -0.3938], [-1.9635, -0.1609, -0.4131], [-1.8762, -0.1237, -0.4192],
  [-1.789, -0.084, -0.4113], [-1.7017, -0.0485, -0.3832], [-1.6144, -0.0154, -0.3499],
  [-1.5272, 0.0143, -0.3496], [-1.4399, 0.0489, -0.3805], [-1.3526, 0.0837, -0.4101],
  [-1.2654, 0.1236, -0.4191], [-1.1781, 0.1613, -0.4138], [-1.0908, 0.1927, -0.3951],
  [-1.0036, 0.2226, -0.3695], [-0.9163, 0.249, -0.3453], [-0.829, 0.2748, -0.3184],
  [-0.7418, 0.2972, -0.2904], [-0.6545, 0.3205, -0.2606], [-0.5672, 0.3409, -0.2308],
  [-0.48, 0.3604, -0.1993], [-0.3927, 0.377, -0.1659], [-0.3054, 0.3885, -0.1309],
  [-0.2182, 0.3939, -0.0918], [-0.1309, 0.3958, -0.0556], [-0.0436, 0.3919, -0.0186],
  [0.0436, 0.3832, 0.0176], [0.1309, 0.372, 0.0521], [0.2182, 0.3576, 0.0831],
  [0.3054, 0.3396, 0.1145], [0.3927, 0.3221, 0.1415], [0.48, 0.3018, 0.167],
  [0.5672, 0.2807, 0.1902], [0.6545, 0.2585, 0.2101], [0.7418, 0.234, 0.2284],
  [0.829, 0.2113, 0.2453], [0.9163, 0.1878, 0.2596], [1.0036, 0.1629, 0.2715],
  [1.0908, 0.1381, 0.2819], [1.1781, 0.1134, 0.2915], [1.2654, 0.0882, 0.2963],
  [1.3526, 0.0631, 0.3027], [1.4399, 0.0378, 0.306], [1.5272, 0.0129, 0.3083],
  [1.6144, -0.0121, 0.3081], [1.7017, -0.0379, 0.3058], [1.789, -0.0627, 0.3019],
  [1.8762, -0.0882, 0.2958], [1.9635, -0.1132, 0.2907], [2.0508, -0.1378, 0.2816],
  [2.138, -0.1629, 0.2712], [2.2253, -0.1872, 0.2592], [2.3126, -0.2109, 0.2445],
  [2.3998, -0.233, 0.2274], [2.4871, -0.2573, 0.2091], [2.5744, -0.2795, 0.1891],
  [2.6616, -0.3003, 0.1661], [2.7489, -0.3203, 0.141], [2.8362, -0.3375, 0.1139],
  [2.9234, -0.3555, 0.0825], [3.0107, -0.3694, 0.0518], [3.098, -0.3808, 0.0176],
];

const normalizeAngle = (angle: number) => {
  let a = angle;
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
};

const railTracePoint = (angle: number) => {
  const a = normalizeAngle(angle);
  for (let i = 0; i < RAIL_TRACE.length; i++) {
    const p0 = RAIL_TRACE[i];
    const p1 = RAIL_TRACE[(i + 1) % RAIL_TRACE.length];
    const a0 = p0[0];
    const a1 = i === RAIL_TRACE.length - 1 ? p1[0] + Math.PI * 2 : p1[0];
    const aa = i === RAIL_TRACE.length - 1 && a < p0[0] ? a + Math.PI * 2 : a;
    if (aa >= a0 && aa <= a1) {
      const t = (aa - a0) / (a1 - a0);
      return {
        x: p0[1] + (p1[1] - p0[1]) * t,
        y: p0[2] + (p1[2] - p0[2]) * t,
      };
    }
  }
  return { x: RAIL_TRACE[0][1], y: RAIL_TRACE[0][2] };
};

const railPoint = (angle: number, width: number, height: number, radial = 1) => {
  const p = railTracePoint(angle);
  return {
    x: p.x * width * radial,
    y: p.y * height * radial,
  };
};

const railAngleFromPoint = (x: number, y: number, width: number, height: number) => {
  const nx = x / width;
  const ny = y / height;
  let best = RAIL_TRACE[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of RAIL_TRACE) {
    const dx = point[1] - nx;
    const dy = point[2] - ny;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best[0];
};


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
  const [arenaDims, setArenaDims] = useState({ width: 360, height: 339 });

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
      const width = Math.round(r.width);
      const height = Math.round(r.height);
      setArenaDims((prev) => (
        Math.abs(prev.width - width) > 1 || Math.abs(prev.height - height) > 1
          ? { width, height }
          : prev
      ));
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
      const cssW = arenaDims.width;
      const cssH = arenaDims.height;
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
            const { x, y } = railPoint(a, arenaDims.width, arenaDims.height, 1);
            ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1.15)`;
            return { x, y, off: { dr: 0, scale: 1.15, glow: 1, impact: 0 }, onRail: true };
          } else if (elapsed < DASH_RAIL_DUR + DASH_LAUNCH_DUR) {
            const q = (elapsed - DASH_RAIL_DUR) / DASH_LAUNCH_DUR;
            const ease = 1 - Math.pow(1 - q, 2);
            const notch = railPoint(NOTCH_ANGLE, arenaDims.width, arenaDims.height, 1);
            const x0 = notch.x;
            const y0 = notch.y;
            const x1 = -x0 * 0.45;
            const y1 = -y0 * 0.45;
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
            const notch = railPoint(NOTCH_ANGLE, arenaDims.width, arenaDims.height, 1);
            const x1 = -notch.x * 0.45;
            const y1 = -notch.y * 0.45;
            const home = railPoint(baseAngle, arenaDims.width, arenaDims.height, baseR);
            const x2 = home.x;
            const y2 = home.y;
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
        const shakeMag = Math.max(kb.shake, bouncedOff * 6);
        const shakeX = shakeMag ? (Math.random() - 0.5) * shakeMag * 8 : 0;
        const shakeY = shakeMag ? (Math.random() - 0.5) * shakeMag * 8 : 0;
        const point = railPoint(baseAngle, arenaDims.width, arenaDims.height, radial);
        const x = point.x + shakeX;
        const y = point.y + shakeY;
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
            const ang = railAngleFromPoint(res.x, res.y, arenaDims.width, arenaDims.height);
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
  }, [arenaDims.height, arenaDims.width, arenaSize]);



  const beySize = Math.max(28, arenaSize * 0.095);

  return (
    <div
      ref={arenaRef}
      className="relative w-full aspect-[626/589] mx-auto animate-fade-in"
    >
      <div ref={shakeRef} className="absolute inset-0">
      <img
        src={arenaImage}
        alt=""
        className="absolute inset-0 h-full w-full object-contain select-none pointer-events-none"
        draggable={false}
      />

      {/* Neon trail canvas (lights up hexes where the beys pass) */}
      <canvas
        ref={trailCanvasRef}
        className="absolute top-1/2 left-1/2 pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ mixBlendMode: "screen" }}
      />

      {/* Orbit guide rings kept disabled: the green rail is the active boundary. */}
      {(["attack", "balance", "stamina", "defense"] as BeyType[]).map((t) => {
        const d = ORBIT_RADIUS[t] * 2 * 46;
        return (
          <div
            key={t}
            className="hidden absolute rounded-full border pointer-events-none"
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
