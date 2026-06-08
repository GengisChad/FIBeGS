import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Dices, Sword, Heart, Shield as ShieldIcon, Sparkles, Trophy, Zap, Wind } from "lucide-react";
import { Bey, MoveCard, getBey, BEY_CATALOG } from "../data/beys";
import { LEVELS } from "../data/levels";
import { useRpg } from "../state/rpgStore";
import { RunMods, pickRandomUpgrades, initialMods } from "../data/upgrades";
import { siteDeckToBeys } from "../data/siteDeckLoader";
import { loadGameComponents, assembleBey, assembledToBey } from "../data/componentsCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getLevelBackground } from "../data/levelAssets";
import { toast } from "@/hooks/use-toast";
import { Arena, ArenaAction, MoveKind, KoState } from "./Arena";
import { generateEnemyDeck } from "../data/enemyDecks";

// ---------------------------------------------------------------------------
// HeroBey: vista desktop/tablet del bey attivo del giocatore — sostituisce
// l'arena e mostra un solo bey grande, animato in base alle mosse.
// ---------------------------------------------------------------------------
const HeroBey = ({
  bey,
  ko,
  action,
  enemyAction,
  shakeKey,
}: {
  bey: Bey;
  ko: KoState | null;
  action: ArenaAction;
  enemyAction: ArenaAction;
  shakeKey: number;
}) => {
  const spinRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef(action);
  const enemyActionRef = useRef(enemyAction);
  const koRef = useRef(ko);
  useEffect(() => { actionRef.current = action; }, [action]);
  useEffect(() => { enemyActionRef.current = enemyAction; }, [enemyAction]);
  useEffect(() => { koRef.current = ko; }, [ko]);

  useEffect(() => {
    if (!shakeKey || !shakeRef.current) return;
    shakeRef.current.style.animation = "none";
    void shakeRef.current.offsetWidth;
    shakeRef.current.style.animation = "hero-shake 0.4s";
  }, [shakeKey]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let a = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000; last = t;
      const k = koRef.current;
      let speed = 6;
      if (k) {
        const elapsed = (t - k.t0) / 1000;
        speed = k.reason === "burst"
          ? (elapsed < 0.15 ? 6 * (1 - elapsed / 0.15) : 0)
          : Math.max(0, 6 * (1 - elapsed / 1.4));
      }
      a += dt * speed;

      // Action overlay (lunge / boost pulse)
      const act = actionRef.current;
      const enemy = enemyActionRef.current;
      let tx = 0, ty = 0, sc = 1, glow = 0.4;
      if (act?.kind) {
        const dur = { attack: 900, dodge: 550, boost: 750, xtreme: 1300 }[act.kind];
        const p = Math.max(0, Math.min(1, (t - act.t0) / dur));
        if (p > 0 && p < 1) {
          if (act.kind === "attack") {
            const arc = Math.sin(p * Math.PI);
            ty = -arc * 24; sc = 1 + arc * 0.12; glow = 0.4 + arc * 0.5;
          } else if (act.kind === "xtreme") {
            const arc = Math.sin(p * Math.PI);
            ty = -arc * 38; sc = 1 + arc * 0.22; glow = 0.4 + arc * 0.8;
          } else if (act.kind === "dodge") {
            tx = Math.sin(p * Math.PI * 2) * 22; glow = 0.5;
          } else if (act.kind === "boost") {
            sc = 1 + Math.sin(p * Math.PI) * 0.18; glow = 0.4 + Math.sin(p * Math.PI) * 0.5;
          }
        }
      }
      if (enemy?.kind && (enemy.kind === "attack" || enemy.kind === "xtreme")) {
        const dur = enemy.kind === "attack" ? 900 : 1300;
        const p = (t - enemy.t0) / dur;
        if (p > 0.45 && p < 0.85) {
          const q = (p - 0.45) / 0.4;
          ty += Math.sin(q * Math.PI) * 14;
        }
      }

      if (spinRef.current) {
        spinRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${sc})`;
        spinRef.current.style.filter = `drop-shadow(0 0 ${10 + glow * 30}px hsl(var(--primary) / ${glow}))`;
      }
      // Rotate inner spinner
      const inner = spinRef.current?.firstElementChild as HTMLDivElement | null;
      if (inner) inner.style.transform = `rotate(${a}rad)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const size = 260;
  const layers = bey.partsImages ?? [];
  return (
    <div ref={shakeRef} className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 via-transparent to-fuchsia-500/10 blur-2xl" />
      <div ref={spinRef} className="absolute inset-0 will-change-transform" style={{ transition: "filter 120ms linear" }}>
        <div className="relative w-full h-full will-change-transform">
          {layers.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: size * 0.7 }}>{bey.emoji}</div>
          ) : (
            layers.slice().sort((a, b) => a.z - b.z).map((l, i) => {
              const isTop = i === layers.length - 1 && layers.length > 1;
              const s = isTop ? size * 0.55 : size;
              return (
                <img key={i} src={l.url} alt=""
                  className="absolute left-1/2 top-1/2 object-contain"
                  style={{ width: s, height: s, transform: "translate(-50%,-50%)", zIndex: l.z, pointerEvents: "none" }}
                  draggable={false} />
              );
            })
          )}
        </div>
      </div>
      <style>{`@keyframes hero-shake { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-6px,3px)} 50%{transform:translate(5px,-4px)} 75%{transform:translate(-3px,4px)} }`}</style>
    </div>
  );
};


interface Props { levelId: number; onExit: () => void; }

interface BeyState {
  def: Bey;
  hp: number;            // burst resistance current
  maxHp: number;
  stamina: number;       // current stamina
  staminaMax: number;
  shield: number;
  stunned: number;
}

const STAMINA_DRAIN_PER_TURN = 6;

const mkBeyState = (def: Bey, mods: RunMods): BeyState => {
  const maxHp = Math.round(def.hp * (1 + mods.bonusHpPercent / 100));
  const staminaMax = def.stamina ?? 80;
  return { def, hp: maxHp, maxHp, stamina: staminaMax, staminaMax, shield: mods.bonusShield, stunned: 0 };
};

const rollDice = (n: number) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));

export const BattleScene = ({ levelId, onExit }: Props) => {
  const { profile, grantRewards, mods, setMods, resetMods } = useRpg();
  const { user } = useAuth();
  const level = LEVELS.find((l) => l.id === levelId)!;

  const [playerBeys, setPlayerBeys] = useState<Bey[] | null>(null);
  const [player, setPlayer] = useState<BeyState[]>([]);
  const [enemy, setEnemy] = useState<BeyState[]>([]);
  const [pIdx, setPIdx] = useState(0);
  const [eIdx, setEIdx] = useState(0);
  const [pScore, setPScore] = useState(0);
  const [eScore, setEScore] = useState(0);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [dice, setDice] = useState<number[]>([]);
  const [energy, setEnergy] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [played, setPlayed] = useState<string[]>([]);
  const [phase, setPhase] = useState<"loading" | "rolling" | "playing" | "interlude" | "ended" | "upgrade">("loading");
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [upgrades, setUpgrades] = useState<ReturnType<typeof pickRandomUpgrades>>([]);

  const pBey = player[pIdx];
  const eBey = enemy[eIdx];

  const addLog = (s: string) => setLog((l) => [s, ...l].slice(0, 8));

  // Resolve player beys: game deck (priority) → site deck → catalog fallback.
  // Enemy is ALWAYS built from real catalog components, scaled by level.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const catalog = await loadGameComponents();
      let beys: Bey[] | null = null;
      if (user) {
        const { data: deckRows } = await (supabase as any)
          .from("rpg_game_decks")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);
        const deckId = deckRows?.[0]?.id;
        if (deckId) {
          const { data: beyRows } = await (supabase as any).from("rpg_game_deck_beys").select("position, series, ratchet_mode, blade_id, ratchet_id, ribs_id, bit_id, lock_chip_id, ux_infinity_id, cx_infinity_id, cx_assist_id").eq("deck_id", deckId).order("position");
          const byId = new Map(catalog.map((c) => [c.id, c]));
          const getC = (id: string | null | undefined) => id ? byId.get(id) ?? null : null;
          const assembled = [1, 2, 3].map((pos) => {
            const r = (beyRows ?? []).find((b: any) => b.position === pos);
            const series = (r?.series as any) ?? "BX";
            const mode = (r?.ratchet_mode as any) ?? "ratchet";
            const parts: any = {};
            const colIds = [
              r?.blade_id, r?.cx_assist_id, r?.lock_chip_id, r?.ux_infinity_id,
              r?.cx_infinity_id, r?.ratchet_id, r?.ribs_id, r?.bit_id,
            ];
            for (const id of colIds) {
              const c = getC(id);
              if (c) parts[c.slot] = c;
            }
            return assembleBey(pos, series, mode, parts);
          });
          if (assembled.every((a) => Object.values(a.parts).some(Boolean))) {
            beys = assembled.map((a, i) => assembledToBey(a, i));
          }
        }
      }
      if (!beys && profile.site_deck_id) {
        beys = await siteDeckToBeys(profile.site_deck_id);
      }
      if (!beys) {
        beys = profile.selected_deck.map((id) => getBey(id)).filter(Boolean) as Bey[];
      }
      const enemyBeys = generateEnemyDeck(level.id, catalog);
      if (cancelled) return;
      setPlayerBeys(beys);
      setPlayer(beys.map((b) => mkBeyState(b, mods)));
      setEnemy(enemyBeys.map((b) => mkBeyState(b, initialMods)));
      setPhase("rolling");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.site_deck_id, levelId, user?.id]);


  // Roll dice at start of each new player turn (after KO or after enemy turn)
  useEffect(() => {
    if (phase !== "rolling" || !pBey) return;
    const n = 2 + mods.extraDice;
    const r = rollDice(n);
    setDice(r);
    const sum = r.reduce((a, b) => a + b, 0);
    setEnergy(sum);
    setPlayed([]);
    addLog(`🎲 Tiri ${r.join(" + ")} = ${sum} energia`);
    setPhase("playing");
    if (pBey.stunned > 0) {
      addLog(`💫 ${pBey.def.name} è stordito!`);
      setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, stunned: b.stunned - 1 } : b));
      setTimeout(() => endTurn(), 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pIdx, pBey?.def.id]);

  const applyDamageToEnemy = (raw: number) => {
    setEnemy((arr) => arr.map((b, i) => {
      if (i !== eIdx) return b;
      const absorbed = Math.min(b.shield, raw);
      const dmg = raw - absorbed;
      return { ...b, shield: b.shield - absorbed, hp: Math.max(0, b.hp - dmg) };
    }));
  };
  const applyDamageToPlayer = (raw: number) => {
    setPlayer((arr) => arr.map((b, i) => {
      if (i !== pIdx) return b;
      const absorbed = Math.min(b.shield, raw);
      const dmg = raw - absorbed;
      return { ...b, shield: b.shield - absorbed, hp: Math.max(0, b.hp - dmg) };
    }));
  };

  // ---------- New 4-move system (Attacco / Schivata / Boost / Special Xtreme) ----------
  const [pAction, setPAction] = useState<ArenaAction>({ kind: null, t0: 0 });
  const [eAction, setEAction] = useState<ArenaAction>({ kind: null, t0: 0 });
  const [shakeKey, setShakeKey] = useState(0);
  const [pKo, setPKo] = useState<KoState | null>(null);
  const [eKo, setEKo] = useState<KoState | null>(null);

  const moveCost = (kind: Exclude<MoveKind, null>) => {
    const base = { attack: 2, dodge: 2, boost: 3, xtreme: 5 }[kind];
    return Math.max(1, base - mods.costReduction);
  };
  const moveLabel = (kind: Exclude<MoveKind, null>) =>
    ({ attack: "Attacco", dodge: "Schivata", boost: "Boost", xtreme: "Special Move Xtreme" }[kind]);

  const computeMove = (b: Bey | undefined, kind: Exclude<MoveKind, null>) => {
    const atk = b?.attackStat ?? 0;
    const def = b?.defenseStat ?? 0;
    const sta = b?.staminaStat ?? 0;
    switch (kind) {
      case "attack":  return { damage: 8 + Math.round(atk / 4), heal: 0, shield: 0, stun: 0, staminaCost: 4 };
      case "dodge":   return { damage: 0, heal: 0, shield: 12 + Math.round(def / 4), stun: 0, staminaCost: 2 };
      case "boost":   return { damage: 0, heal: 10 + Math.round(sta / 5), shield: 0, stun: 0, staminaCost: -8 };
      case "xtreme":  return { damage: 22 + Math.round(atk / 3), heal: 0, shield: 0, stun: 1, staminaCost: 10 };
    }
  };

  const playMove = (kind: Exclude<MoveKind, null>) => {
    if (phase !== "playing" || turn !== "player" || !pBey) return;
    const cost = moveCost(kind);
    if (energy < cost) return;
    setEnergy((e) => e - cost);
    setPAction({ kind, t0: performance.now() });
    const r = computeMove(pBey.def, kind);
    const dmg = r.damage > 0 ? r.damage + mods.bonusDamage : 0;
    if (dmg > 0) {
      applyDamageToEnemy(dmg);
      addLog(`⚔️ ${moveLabel(kind)} → ${dmg} danni`);
      if (kind === "attack" || kind === "xtreme") setShakeKey((k) => k + 1);
    }
    if (r.heal > 0) {
      setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, hp: Math.min(b.maxHp, b.hp + r.heal) } : b));
      addLog(`💚 ${moveLabel(kind)} +${r.heal} HP`);
    }
    if (r.shield > 0) {
      setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, shield: b.shield + r.shield } : b));
      addLog(`🛡️ ${moveLabel(kind)} +${r.shield} scudo`);
    }
    if (r.stun > 0) {
      setEnemy((arr) => arr.map((b, i) => i === eIdx ? { ...b, stunned: b.stunned + r.stun } : b));
      addLog(`💫 Avversario stordito`);
    }
    if (r.staminaCost !== 0) {
      setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, stamina: Math.max(0, Math.min(b.staminaMax, b.stamina - r.staminaCost)) } : b));
    }
  };

  // Legacy card prop kept for safety; not used by UI anymore.
  const playCard = (_c: MoveCard) => {};

  const drainStaminaActive = () => {
    // Stamina is consumed each turn; high-stamina beys last longer.
    setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, stamina: Math.max(0, b.stamina - STAMINA_DRAIN_PER_TURN) } : b));
    setEnemy((arr) => arr.map((b, i) => i === eIdx ? { ...b, stamina: Math.max(0, b.stamina - STAMINA_DRAIN_PER_TURN) } : b));
  };
  const endTurn = () => {
    drainStaminaActive();
    setTurn((t) => (t === "player" ? "enemy" : "player"));
  };

  // KO detection: when either bey reaches 0, BOTH sides advance to next bey,
  // and the surviving side gains a battle point. Best-of-3 wins the match.
  useEffect(() => {
    if (phase === "loading" || phase === "ended" || phase === "upgrade" || phase === "interlude") return;
    if (!pBey || !eBey) return;
    const enemyBurst = eBey.hp <= 0;
    const playerBurst = pBey.hp <= 0;
    const enemyOutOfSpin = eBey.stamina <= 0;
    const playerOutOfSpin = pBey.stamina <= 0;
    const enemyKO = enemyBurst || enemyOutOfSpin;
    const playerKO = playerBurst || playerOutOfSpin;
    if (!enemyKO && !playerKO) return;

    let nextPScore = pScore;
    let nextEScore = eScore;
    if (enemyKO && !playerKO) {
      nextPScore += 1;
      const reason = enemyBurst ? "Burst!" : "ha esaurito la stamina";
      addLog(`🏆 ${eBey.def.name} ${reason} +1 (${nextPScore}-${nextEScore})`);
    } else if (playerKO && !enemyKO) {
      nextEScore += 1;
      const reason = playerBurst ? "Burst!" : "stamina esaurita";
      addLog(`💀 ${pBey.def.name} ${reason} Avversario +1 (${nextPScore}-${nextEScore})`);
    } else {
      addLog(`💥 KO simultaneo! Nessun punto.`);
    }
    setPScore(nextPScore);
    setEScore(nextEScore);

    // Trigger KO visuals
    const now = performance.now();
    if (enemyKO) setEKo({ reason: enemyBurst ? "burst" : "spin", t0: now });
    if (playerKO) setPKo({ reason: playerBurst ? "burst" : "spin", t0: now });

    const anyBurst = (enemyKO && enemyBurst) || (playerKO && playerBurst);
    const koDelay = anyBurst ? 1800 : 1600;

    if (nextPScore >= 2) { setTimeout(() => finishBattle("win"), koDelay); return; }
    if (nextEScore >= 2) { setTimeout(() => finishBattle("lose"), koDelay); return; }

    const nextPIdx = pIdx + 1;
    const nextEIdx = eIdx + 1;
    if (nextPIdx >= player.length || nextEIdx >= enemy.length) {
      setTimeout(() => finishBattle(nextPScore > nextEScore ? "win" : "lose"), koDelay);
      return;
    }

    setPhase("interlude");
    setTimeout(() => {
      if (mods.healBetweenBeys > 0) {
        setPlayer((arr) => arr.map((b, i) => i === nextPIdx ? { ...b, hp: Math.min(b.maxHp, b.hp + Math.round(b.maxHp * mods.healBetweenBeys / 100)) } : b));
      }
      setPKo(null);
      setEKo(null);
      setPIdx(nextPIdx);
      setEIdx(nextEIdx);
      setTurn("player");
      setPhase("rolling");
    }, koDelay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, enemy]);

  // Enemy AI — picks among the same 4 moves based on situation.
  useEffect(() => {
    if (turn !== "enemy" || phase !== "playing" || !eBey) return;
    const t = setTimeout(() => {
      if (eBey.stunned > 0) {
        addLog(`💫 ${eBey.def.name} è stordito!`);
        setEnemy((arr) => arr.map((b, i) => i === eIdx ? { ...b, stunned: b.stunned - 1 } : b));
      } else {
        const eDice = rollDice(2);
        let eEnergy = eDice.reduce((a, b) => a + b, 0);
        addLog(`🎲 Avversario tira ${eEnergy}`);
        const pool: Exclude<MoveKind, null>[] = ["xtreme", "attack", "dodge", "boost"];
        for (const kind of pool) {
          const cost = { attack: 2, dodge: 2, boost: 3, xtreme: 5 }[kind];
          if (cost > eEnergy) continue;
          // Light heuristics
          if (kind === "boost" && eBey.hp > eBey.maxHp * 0.7) continue;
          if (kind === "dodge" && eBey.shield > 10) continue;
          eEnergy -= cost;
          setEAction({ kind, t0: performance.now() });
          const r = computeMove(eBey.def, kind);
          if (r.damage > 0) {
            applyDamageToPlayer(r.damage);
            addLog(`💥 Nemico usa ${moveLabel(kind)} (${r.damage})`);
            if (kind === "attack" || kind === "xtreme") setShakeKey((k) => k + 1);
          }
          if (r.heal > 0) setEnemy((arr) => arr.map((b, i) => i === eIdx ? { ...b, hp: Math.min(b.maxHp, b.hp + r.heal) } : b));
          if (r.shield > 0) setEnemy((arr) => arr.map((b, i) => i === eIdx ? { ...b, shield: b.shield + r.shield } : b));
          if (r.stun > 0) setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, stunned: b.stunned + r.stun } : b));
          break;
        }
      }
      drainStaminaActive();
      setTurn("player");
      setPhase("rolling");
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase]);

  const finishBattle = (r: "win" | "lose") => {
    setResult(r);
    if (r === "win") {
      addLog("🎉 Vittoria!");
      setUpgrades(pickRandomUpgrades(3));
      setPhase("upgrade");
    } else {
      addLog("💀 Sconfitta");
      setPhase("ended");
      resetMods();
    }
  };

  const claim = async (upgIdx?: number) => {
    if (result === "win") {
      if (upgIdx != null) setMods(upgrades[upgIdx].apply(mods));
      await grantRewards(level.reward.currency, level.reward.gachaPoints, level.id + 1);
      toast({ title: "Ricompense ricevute!", description: `+${level.reward.currency} 🪙 · +${level.reward.gachaPoints} 🎁` });
    }
    onExit();
  };

  const BeyPanel = ({ b, side }: { b: BeyState; side: "p" | "e" }) => (
    <div className={`flex ${side === "p" ? "flex-row" : "flex-row-reverse"} items-center gap-3`}>
      <div className="text-5xl">{b.def.emoji}</div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold truncate">{b.def.name}</span>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            {b.shield > 0 && <span className="flex items-center gap-0.5"><ShieldIcon className="h-3 w-3" />{b.shield}</span>}
            {b.stunned > 0 && <span>💫{b.stunned}</span>}
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
            <span>Burst Res</span><span>{b.hp}/{b.maxHp}</span>
          </div>
          <Progress value={(b.hp / b.maxHp) * 100} className="h-1.5" />
        </div>
        <div>
          <div className="flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
            <span>Stamina</span><span>{b.stamina}/{b.staminaMax}</span>
          </div>
          <Progress value={(b.stamina / b.staminaMax) * 100} className="h-1.5 [&>div]:bg-sky-400" />
        </div>
      </div>
    </div>
  );

  if (phase === "loading") {
    return <div className="text-center py-20 text-muted-foreground">Preparazione battaglia...</div>;
  }

  if (phase === "upgrade") {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-primary mx-auto mb-2" />
          <h2 className="text-2xl font-bold">Vittoria! {pScore}-{eScore}</h2>
          <p className="text-muted-foreground">Scegli un potenziamento per la prossima sfida</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {upgrades.map((u, i) => (
            <Card key={u.id} className="p-4 hover:border-primary cursor-pointer text-center space-y-2" onClick={() => claim(i)}>
              <Sparkles className="h-6 w-6 mx-auto text-primary" />
              <div className="font-bold">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.description}</div>
            </Card>
          ))}
        </div>
        <div className="text-center"><Button variant="ghost" onClick={() => claim()}>Salta e torna al menu</Button></div>
      </div>
    );
  }

  if (phase === "ended" && result === "lose") {
    return (
      <div className="text-center space-y-4 py-10">
        <div className="text-6xl">💀</div>
        <h2 className="text-2xl font-bold">Sconfitta {pScore}-{eScore}</h2>
        <p className="text-muted-foreground">I potenziamenti della run sono andati persi. Riprova!</p>
        <Button onClick={onExit}>Torna al menu</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft className="h-4 w-4 mr-2" />Abbandona</Button>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Livello {level.id} · {level.name}</div>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-card border border-border text-sm font-bold">
          <Trophy className="h-4 w-4 text-amber-400" />{pScore} - {eScore}
        </div>
      </div>

      {/* Arena with circular stadium and orbiting beyblades */}
      <Card
        className="relative p-4 overflow-hidden border-primary/30"
        style={{
          backgroundImage: `linear-gradient(to bottom, hsl(var(--background) / 0.55), hsl(var(--background) / 0.85)), url(${getLevelBackground(level.id)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          imageRendering: "pixelated",
        }}
      >
        <div className="relative z-10 grid md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Enemy panel (left on desktop, top on mobile) */}
          <div className="space-y-2 order-1 md:order-1">
            {eBey && <BeyPanel b={eBey} side="e" />}
            <div className="flex justify-end gap-1">
              {enemy.map((b, i) => <div key={i} className={`w-2 h-2 rounded-full ${i < eIdx ? "bg-muted" : i === eIdx ? "bg-destructive" : "bg-destructive/30"}`} />)}
            </div>
          </div>

          {/* Center stage */}
          <div className="order-3 md:order-2 w-full">
            {/* Mobile: full physics arena, ingrandita */}
            <div className="md:hidden">
              {pBey && eBey && (
                <Arena
                  player={pBey.def}
                  enemy={eBey.def}
                  playerAction={pAction}
                  enemyAction={eAction}
                  shakeKey={shakeKey}
                  playerKo={pKo}
                  enemyKo={eKo}
                  onXtremeDash={(side) => {
                    const dasher = side === "p" ? pBey : eBey;
                    const dmg = 18 + Math.round((dasher?.def.attackStat ?? 0) / 3);
                    if (side === "p") {
                      applyDamageToEnemy(dmg);
                      addLog(`⚡ Xtreme Dash! Contrattacco di ${pBey?.def.name} (${dmg})`);
                    } else {
                      applyDamageToPlayer(dmg);
                      addLog(`⚡ Xtreme Dash nemico! Contrattacco (${dmg})`);
                    }
                    setShakeKey((k) => k + 1);
                  }}
                />
              )}
            </div>

            {/* Desktop/tablet: solo bey al centro tra le barre */}
            <div className="hidden md:flex items-center justify-center" style={{ minHeight: 280, minWidth: 240 }}>
              {pBey && (
                <HeroBey
                  bey={pBey.def}
                  ko={pKo}
                  action={pAction}
                  enemyAction={eAction}
                  shakeKey={shakeKey}
                />
              )}
            </div>
          </div>

          {/* Player panel (right on desktop, bottom on mobile) */}
          <div className="space-y-2 order-2 md:order-3">
            {pBey && <BeyPanel b={pBey} side="p" />}
            <div className="flex gap-1">
              {player.map((b, i) => <div key={i} className={`w-2 h-2 rounded-full ${i < pIdx ? "bg-muted" : i === pIdx ? "bg-primary" : "bg-primary/30"}`} />)}
            </div>
          </div>
        </div>
      </Card>

      {/* Energy + dice */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Dices className="h-5 w-5 text-primary" />
          <div className="flex gap-1">
            {dice.map((d, i) => <div key={i} className="w-8 h-8 rounded bg-card border border-border flex items-center justify-center font-bold">{d}</div>)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Energia</span>
          <span className="text-2xl font-bold text-primary">{energy}</span>
        </div>
        <Button size="sm" variant="secondary" onClick={endTurn} disabled={turn !== "player" || phase !== "playing"}>Fine turno</Button>
      </div>

      {/* Moves: Attacco / Schivata / Boost / Special Move Xtreme */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { kind: "attack" as const, label: "Attacco", icon: <Sword className="h-4 w-4" />, accent: "border-rose-500/60 hover:bg-rose-500/10" },
          { kind: "dodge" as const, label: "Schivata", icon: <Wind className="h-4 w-4" />, accent: "border-sky-500/60 hover:bg-sky-500/10" },
          { kind: "boost" as const, label: "Boost", icon: <Heart className="h-4 w-4" />, accent: "border-emerald-500/60 hover:bg-emerald-500/10" },
          { kind: "xtreme" as const, label: "Special Move Xtreme", icon: <Zap className="h-4 w-4" />, accent: "border-amber-500/60 hover:bg-amber-500/10" },
        ]).map((m) => {
          const cost = moveCost(m.kind);
          const disabled = turn !== "player" || phase !== "playing" || energy < cost;
          const preview = pBey ? computeMove(pBey.def, m.kind) : null;
          return (
            <button
              key={m.kind}
              onClick={() => playMove(m.kind)}
              disabled={disabled}
              className={`p-3 rounded-lg border text-left transition-all bg-card ${disabled ? "opacity-40 border-border" : `${m.accent} hover:-translate-y-0.5`}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold uppercase truncate flex items-center gap-1">{m.icon}{m.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">⚡{cost}</span>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                {preview && preview.damage > 0 && <span className="flex items-center gap-0.5"><Sword className="h-3 w-3" />{preview.damage + mods.bonusDamage}</span>}
                {preview && preview.heal > 0 && <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{preview.heal}</span>}
                {preview && preview.shield > 0 && <span className="flex items-center gap-0.5"><ShieldIcon className="h-3 w-3" />{preview.shield}</span>}
                {preview && preview.stun > 0 && <span>💫{preview.stun}</span>}
              </div>
            </button>
          );
        })}
      </div>


      {/* Log */}
      <Card className="p-3 max-h-32 overflow-y-auto text-xs space-y-1">
        {log.map((l, i) => <div key={i} className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{l}</div>)}
      </Card>
    </div>
  );
};
