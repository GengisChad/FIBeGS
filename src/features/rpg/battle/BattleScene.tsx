import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Check, Dices, Heart, RotateCcw, Shield as ShieldIcon, Sparkles, Sword, Trophy, Zap, Wind } from "lucide-react";
import { Bey, getBey } from "../data/beys";
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
// HeroBey: vista desktop/tablet del bey attivo del giocatore â€” sostituisce
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
const HAND_SIZE = 5;
const MAX_REROLLS = 2;
type SkillKind = Exclude<MoveKind, null>;
type BattlePhase = "loading" | "rolling" | "planning" | "resolving" | "interlude" | "ended" | "upgrade";

interface SkillDefinition {
  kind: SkillKind;
  label: string;
  cost: number;
  accent: string;
}

interface SkillCard {
  uid: string;
  kind: SkillKind;
}

const SKILLS: Record<SkillKind, SkillDefinition> = {
  attack: { kind: "attack", label: "Attacco", cost: 2, accent: "border-rose-500/60 hover:bg-rose-500/10" },
  dodge: { kind: "dodge", label: "Schivata", cost: 2, accent: "border-sky-500/60 hover:bg-sky-500/10" },
  boost: { kind: "boost", label: "Boost", cost: 3, accent: "border-emerald-500/60 hover:bg-emerald-500/10" },
  xtreme: { kind: "xtreme", label: "Special Move Xtreme", cost: 5, accent: "border-amber-500/60 hover:bg-amber-500/10" },
};

const SKILL_POOL: SkillKind[] = ["attack", "attack", "dodge", "dodge", "boost", "boost", "xtreme"];
const skillCost = (kind: SkillKind) => SKILLS[kind].cost;
const skillLabel = (kind: SkillKind) => SKILLS[kind].label;
const skillIcon = (kind: SkillKind) => {
  switch (kind) {
    case "attack": return <Sword className="h-4 w-4" />;
    case "dodge": return <Wind className="h-4 w-4" />;
    case "boost": return <Heart className="h-4 w-4" />;
    case "xtreme": return <Zap className="h-4 w-4" />;
  }
};

const drawSkillHand = (seed = Date.now()): SkillCard[] =>
  Array.from({ length: HAND_SIZE }, (_, i) => {
    const kind = SKILL_POOL[Math.floor(Math.random() * SKILL_POOL.length)];
    return { uid: `${seed}-${i}-${kind}-${Math.random().toString(36).slice(2)}`, kind };
  });

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
  const [dice, setDice] = useState<number[]>([]);
  const [energy, setEnergy] = useState(0);
  const [enemyEnergy, setEnemyEnergy] = useState(0);
  const [rerolls, setRerolls] = useState(0);
  const [hand, setHand] = useState<SkillCard[]>([]);
  const [enemyHand, setEnemyHand] = useState<SkillCard[]>([]);
  const [pQueue, setPQueue] = useState<SkillCard[]>([]);
  const [eQueue, setEQueue] = useState<SkillCard[]>([]);
  const [starter, setStarter] = useState<"p" | "e" | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [phase, setPhase] = useState<BattlePhase>("loading");
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [upgrades, setUpgrades] = useState<ReturnType<typeof pickRandomUpgrades>>([]);

  const pBey = player[pIdx];
  const eBey = enemy[eIdx];

  const addLog = (s: string) => setLog((l) => [s, ...l].slice(0, 8));

  // Resolve player beys: game deck (priority) â†’ site deck â†’ catalog fallback.
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


  // Roll dice and draw 5 skill cards at the start of every planning turn.
  useEffect(() => {
    if (phase !== "rolling" || !pBey) return;
    const n = 2 + mods.extraDice;
    const r = rollDice(n);
    const er = rollDice(2);
    setDice(r);
    const sum = r.reduce((a, b) => a + b, 0);
    const enemySum = er.reduce((a, b) => a + b, 0);
    setEnergy(sum);
    setEnemyEnergy(enemySum);
    setRerolls(0);
    setHand(drawSkillHand());
    setEnemyHand(drawSkillHand(Date.now() + 1));
    setPQueue([]);
    setEQueue([]);
    setStarter(null);
    addLog(`Dadi: ${r.join(" + ")} = ${sum} energia`);
    setPhase("planning");
    if (pBey.stunned > 0) {
      addLog(`${pBey.def.name} e' stordito: salta la scelta skill`);
      setEnergy(0);
      setHand([]);
      setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, stunned: b.stunned - 1 } : b));
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

  const [pAction, setPAction] = useState<ArenaAction>({ kind: null, t0: 0 });
  const [eAction, setEAction] = useState<ArenaAction>({ kind: null, t0: 0 });
  const [shakeKey, setShakeKey] = useState(0);
  const [pKo, setPKo] = useState<KoState | null>(null);
  const [eKo, setEKo] = useState<KoState | null>(null);

  const queueCost = (queue: SkillCard[]) => queue.reduce((sum, c) => sum + skillCost(c.kind), 0);
  const remainingEnergy = energy - queueCost(pQueue);

  const computeMove = (b: Bey | undefined, kind: SkillKind) => {
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

  const selectSkill = (card: SkillCard) => {
    if (phase !== "planning" || pBey?.stunned) return;
    if (remainingEnergy < skillCost(card.kind)) return;
    setHand((cards) => cards.filter((c) => c.uid !== card.uid));
    setPQueue((cards) => [...cards, card]);
  };

  const removeQueuedSkill = (card: SkillCard) => {
    if (phase !== "planning") return;
    setPQueue((cards) => cards.filter((c) => c.uid !== card.uid));
    setHand((cards) => [...cards, card]);
  };

  const rerollDice = () => {
    if (phase !== "planning" || pQueue.length > 0 || rerolls >= MAX_REROLLS) return;
    const r = rollDice(2 + mods.extraDice);
    const sum = r.reduce((a, b) => a + b, 0);
    setDice(r);
    setEnergy(sum);
    setRerolls((v) => v + 1);
    addLog(`Reroll ${rerolls + 1}/${MAX_REROLLS}: ${r.join(" + ")} = ${sum}`);
  };

  const buildEnemyPlan = (cards: SkillCard[], points: number) => {
    const plan: SkillCard[] = [];
    let budget = points;
    const ranked = [...cards].sort((a, b) => {
      const score = (c: SkillCard) => {
        if (c.kind === "xtreme") return eBey && eBey.stamina > 12 ? 5 : 1;
        if (c.kind === "attack") return 4;
        if (c.kind === "dodge") return eBey && eBey.shield < 12 ? 3 : 0;
        if (c.kind === "boost") return eBey && (eBey.hp < eBey.maxHp * 0.75 || eBey.stamina < eBey.staminaMax * 0.45) ? 4 : 1;
        return 0;
      };
      return score(b) - score(a);
    });
    for (const card of ranked) {
      const cost = skillCost(card.kind);
      if (cost <= budget) {
        plan.push(card);
        budget -= cost;
      }
    }
    return plan;
  };

  const hasKo = (pActive: BeyState, eActive: BeyState) =>
    pActive.hp <= 0 || pActive.stamina <= 0 || eActive.hp <= 0 || eActive.stamina <= 0;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const resolveSkill = async (side: "p" | "e", card: SkillCard, pLocal: BeyState[], eLocal: BeyState[]) => {
    const now = performance.now();
    const attacker = side === "p" ? pLocal[pIdx] : eLocal[eIdx];
    const defender = side === "p" ? eLocal[eIdx] : pLocal[pIdx];
    if (!attacker || !defender || attacker.stunned > 0) return;

    if (side === "p") setPAction({ kind: card.kind, t0: now });
    else setEAction({ kind: card.kind, t0: now });

    const r = computeMove(attacker.def, card.kind);
    const damage = r.damage > 0 ? r.damage + (side === "p" ? mods.bonusDamage : 0) : 0;
    if (damage > 0) {
      const absorbed = Math.min(defender.shield, damage);
      defender.shield -= absorbed;
      defender.hp = Math.max(0, defender.hp - (damage - absorbed));
      addLog(`${side === "p" ? "Tu" : "Nemico"}: ${skillLabel(card.kind)} -${damage - absorbed} Burst Res`);
      if (card.kind === "attack" || card.kind === "xtreme") setShakeKey((k) => k + 1);
    } else {
      addLog(`${side === "p" ? "Tu" : "Nemico"}: ${skillLabel(card.kind)}`);
    }
    if (r.heal > 0) attacker.hp = Math.min(attacker.maxHp, attacker.hp + r.heal);
    if (r.shield > 0) attacker.shield += r.shield;
    if (r.stun > 0) defender.stunned += r.stun;
    if (r.staminaCost !== 0) attacker.stamina = Math.max(0, Math.min(attacker.staminaMax, attacker.stamina - r.staminaCost));

    setPlayer([...pLocal]);
    setEnemy([...eLocal]);
    await wait(card.kind === "xtreme" ? 850 : 560);
  };

  const resolvePlans = async (playerPlan: SkillCard[], enemyPlan: SkillCard[], first: "p" | "e") => {
    const pLocal = player.map((b) => ({ ...b }));
    const eLocal = enemy.map((b) => ({ ...b }));
    const max = Math.max(playerPlan.length, enemyPlan.length);
    const order: Array<"p" | "e"> = first === "p" ? ["p", "e"] : ["e", "p"];
    for (let i = 0; i < max; i++) {
      for (const side of order) {
        const card = side === "p" ? playerPlan[i] : enemyPlan[i];
        if (!card) continue;
        await resolveSkill(side, card, pLocal, eLocal);
        if (hasKo(pLocal[pIdx], eLocal[eIdx])) return;
      }
    }
    pLocal[pIdx].stamina = Math.max(0, pLocal[pIdx].stamina - STAMINA_DRAIN_PER_TURN);
    eLocal[eIdx].stamina = Math.max(0, eLocal[eIdx].stamina - STAMINA_DRAIN_PER_TURN);
    setPlayer([...pLocal]);
    setEnemy([...eLocal]);
    await wait(350);
    if (!hasKo(pLocal[pIdx], eLocal[eIdx])) setPhase("rolling");
  };

  const confirmPlan = (forcedPlan?: SkillCard[]) => {
    if (phase !== "planning" || !pBey || !eBey) return;
    const playerPlan = forcedPlan ?? pQueue;
    const enemyPlan = eBey.stunned > 0 ? [] : buildEnemyPlan(enemyHand, enemyEnergy);
    if (eBey.stunned > 0) {
      addLog(`${eBey.def.name} e' stordito: salta la scelta skill`);
      setEnemy((arr) => arr.map((b, i) => i === eIdx ? { ...b, stunned: b.stunned - 1 } : b));
    }
    setEQueue(enemyPlan);
    const first = Math.random() < 0.5 ? "p" : "e";
    setStarter(first);
    setPhase("resolving");
    addLog(`${first === "p" ? "Inizi tu" : "Inizia il nemico"}. Risoluzione skill in corso.`);
    void resolvePlans(playerPlan, enemyPlan, first);
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
      addLog(`ðŸ† ${eBey.def.name} ${reason} +1 (${nextPScore}-${nextEScore})`);
    } else if (playerKO && !enemyKO) {
      nextEScore += 1;
      const reason = playerBurst ? "Burst!" : "stamina esaurita";
      addLog(`ðŸ’€ ${pBey.def.name} ${reason} Avversario +1 (${nextPScore}-${nextEScore})`);
    } else {
      addLog(`ðŸ’¥ KO simultaneo! Nessun punto.`);
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
      setPhase("rolling");
    }, koDelay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, enemy]);

  // Enemy AI â€” picks among the same 4 moves based on situation.
  const finishBattle = (r: "win" | "lose") => {
    setResult(r);
    if (r === "win") {
      addLog("ðŸŽ‰ Vittoria!");
      setUpgrades(pickRandomUpgrades(3));
      setPhase("upgrade");
    } else {
      addLog("ðŸ’€ Sconfitta");
      setPhase("ended");
      resetMods();
    }
  };

  const claim = async (upgIdx?: number) => {
    if (result === "win") {
      if (upgIdx != null) setMods(upgrades[upgIdx].apply(mods));
      await grantRewards(level.reward.currency, level.reward.gachaPoints, level.id + 1);
      toast({ title: "Ricompense ricevute!", description: `+${level.reward.currency} ðŸª™ Â· +${level.reward.gachaPoints} ðŸŽ` });
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
            {b.stunned > 0 && <span>ðŸ’«{b.stunned}</span>}
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
        <div className="text-6xl">ðŸ’€</div>
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
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Livello {level.id} Â· {level.name}</div>
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
          <div className="order-3 md:order-2 w-full md:w-[360px] lg:w-[420px] mx-auto">
            {/* Full physics arena, shared across mobile and desktop. */}
            <div>
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
                      addLog(`âš¡ Xtreme Dash! Contrattacco di ${pBey?.def.name} (${dmg})`);
                    } else {
                      applyDamageToPlayer(dmg);
                      addLog(`âš¡ Xtreme Dash nemico! Contrattacco (${dmg})`);
                    }
                    setShakeKey((k) => k + 1);
                  }}
                />
              )}
            </div>

            {/* Legacy desktop bey preview kept disabled while the full arena is active. */}
            <div className="hidden" style={{ minHeight: 280, minWidth: 240 }}>
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

      {/* Planning */}
      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-3">
        <Card className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Dices className="h-5 w-5 text-primary shrink-0" />
              <div className="flex gap-1">
                {dice.map((d, i) => <div key={i} className="w-8 h-8 rounded bg-card border border-border flex items-center justify-center font-bold">{d}</div>)}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={rerollDice} disabled={phase !== "planning" || pQueue.length > 0 || rerolls >= MAX_REROLLS}>
              <RotateCcw className="h-4 w-4 mr-1" />{MAX_REROLLS - rerolls}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-border bg-background/70 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Energia</div>
              <div className="text-xl font-bold text-primary">{remainingEnergy}</div>
            </div>
            <div className="rounded border border-border bg-background/70 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Spesa</div>
              <div className="text-xl font-bold">{queueCost(pQueue)}</div>
            </div>
            <div className="rounded border border-border bg-background/70 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nemico</div>
              <div className="text-xl font-bold text-destructive">{phase === "resolving" ? queueCost(eQueue) : enemyEnergy}</div>
            </div>
          </div>
          <Button className="w-full" onClick={() => confirmPlan()} disabled={phase !== "planning"}>
            <Check className="h-4 w-4 mr-2" />Conferma sequenza
          </Button>
          {starter && <div className="text-xs text-center text-muted-foreground">{starter === "p" ? "Inizi tu" : "Inizia il nemico"}</div>}
        </Card>

        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {hand.map((card) => {
              const def = SKILLS[card.kind];
              const preview = pBey ? computeMove(pBey.def, card.kind) : null;
              const disabled = phase !== "planning" || remainingEnergy < def.cost || Boolean(pBey?.stunned);
              return (
                <button
                  key={card.uid}
                  onClick={() => selectSkill(card)}
                  disabled={disabled}
                  className={`min-h-[94px] p-2 rounded-lg border text-left transition-all bg-card ${disabled ? "opacity-40 border-border" : `${def.accent} hover:-translate-y-0.5`}`}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className="text-[11px] font-bold uppercase leading-tight flex items-center gap-1">{skillIcon(card.kind)}{def.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">{def.cost}</span>
                  </div>
                  <div className="flex gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                    {preview && preview.damage > 0 && <span className="flex items-center gap-0.5"><Sword className="h-3 w-3" />{preview.damage + mods.bonusDamage}</span>}
                    {preview && preview.heal > 0 && <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{preview.heal}</span>}
                    {preview && preview.shield > 0 && <span className="flex items-center gap-0.5"><ShieldIcon className="h-3 w-3" />{preview.shield}</span>}
                    {preview && preview.stun > 0 && <span>Stun {preview.stun}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <Card className="p-3">
            <div className="flex items-center gap-2 min-h-12 overflow-x-auto">
              {pQueue.length === 0 ? (
                <div className="text-xs text-muted-foreground">Sequenza vuota</div>
              ) : pQueue.map((card, i) => (
                <button
                  key={card.uid}
                  onClick={() => removeQueuedSkill(card)}
                  disabled={phase !== "planning"}
                  className="shrink-0 rounded border border-primary/40 bg-primary/10 px-2.5 py-2 text-xs font-semibold"
                >
                  {i + 1}. {skillLabel(card.kind)} <span className="text-primary">{skillCost(card.kind)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>


      {/* Log */}
      <Card className="p-3 max-h-32 overflow-y-auto text-xs space-y-1">
        {log.map((l, i) => <div key={i} className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{l}</div>)}
      </Card>
    </div>
  );
};
