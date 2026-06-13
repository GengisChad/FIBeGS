import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Dices, RotateCcw, Shield, Sparkles, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Bey, getBey } from "../data/beys";
import { LEVELS } from "../data/levels";
import { getLevelBackground } from "../data/levelAssets";
import { initialMods, pickRandomUpgrades, RunMods } from "../data/upgrades";
import { assembleBey, assembledToBey, loadGameComponents } from "../data/componentsCatalog";
import { generateEnemyDeck } from "../data/enemyDecks";
import { siteDeckToBeys } from "../data/siteDeckLoader";
import { useRpg } from "../state/rpgStore";
import { Arena, ArenaAction, KoState, MoveKind } from "./Arena";

interface Props {
  levelId: number;
  onExit: () => void;
}

interface BeyState {
  def: Bey;
  hp: number;
  maxHp: number;
  stamina: number;
  staminaMax: number;
  shield: number;
  defenseBoost: number;
  stunned: number;
}

type SkillKind = Exclude<MoveKind, null>;
type BattlePhase = "loading" | "rolling" | "planning" | "resolving" | "interlude" | "ended" | "upgrade";

interface SkillDefinition {
  kind: SkillKind;
  label: string;
  short: string;
  cost: number;
  color: string;
  hint: string;
}

interface SkillCard {
  uid: string;
  kind: SkillKind;
}

interface MoveResult {
  damage: number;
  shield: number;
  defenseBoost: number;
  stun: number;
  staminaCost: number;
}

const STAMINA_DRAIN_PER_TURN = 6;
const HAND_SIZE = 5;
const MAX_REROLLS = 2;
const PAIR_DELAY = 980;

const SKILLS: Record<SkillKind, SkillDefinition> = {
  attack: {
    kind: "attack",
    label: "Attacco",
    short: "ATK",
    cost: 2,
    color: "rose",
    hint: "Impatto diretto",
  },
  dodge: {
    kind: "dodge",
    label: "Schivata",
    short: "EVA",
    cost: 2,
    color: "cyan",
    hint: "Evita attacchi",
  },
  boost: {
    kind: "boost",
    label: "Guard",
    short: "DEF",
    cost: 3,
    color: "emerald",
    hint: "Scudo + difesa",
  },
  xtreme: {
    kind: "xtreme",
    label: "Xtreme Dash",
    short: "X",
    cost: 5,
    color: "amber",
    hint: "Rail dash",
  },
};

const SKILL_POOL: SkillKind[] = ["attack", "attack", "dodge", "dodge", "boost", "boost", "xtreme"];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const rollDice = (n: number) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
const skillCost = (kind: SkillKind) => SKILLS[kind].cost;
const skillLabel = (kind: SkillKind) => SKILLS[kind].label;
const queueCost = (queue: SkillCard[]) => queue.reduce((sum, c) => sum + skillCost(c.kind), 0);

const drawSkillHand = (seed = Date.now()): SkillCard[] =>
  Array.from({ length: HAND_SIZE }, (_, i) => {
    const kind = SKILL_POOL[Math.floor(Math.random() * SKILL_POOL.length)];
    return { uid: `${seed}-${i}-${kind}-${Math.random().toString(36).slice(2)}`, kind };
  });

const mkBeyState = (def: Bey, mods: RunMods): BeyState => {
  const maxHp = Math.round(def.hp * (1 + mods.bonusHpPercent / 100));
  const staminaMax = def.stamina ?? 80;
  return {
    def,
    hp: maxHp,
    maxHp,
    stamina: staminaMax,
    staminaMax,
    shield: mods.bonusShield,
    defenseBoost: 0,
    stunned: 0,
  };
};

const computeMove = (b: Bey | undefined, kind: SkillKind): MoveResult => {
  const atk = b?.attackStat ?? 0;
  const def = b?.defenseStat ?? 0;
  switch (kind) {
    case "attack":
      return { damage: 8 + Math.round(atk / 4), shield: 0, defenseBoost: 0, stun: 0, staminaCost: 4 };
    case "dodge":
      return { damage: 0, shield: 0, defenseBoost: 0, stun: 0, staminaCost: 2 };
    case "boost":
      return {
        damage: 0,
        shield: 12 + Math.round(def / 4),
        defenseBoost: 8 + Math.round(def / 5),
        stun: 0,
        staminaCost: 3,
      };
    case "xtreme":
      return { damage: 22 + Math.round(atk / 3), shield: 0, defenseBoost: 0, stun: 1, staminaCost: 10 };
  }
};

const hasKo = (pActive: BeyState, eActive: BeyState) =>
  pActive.hp <= 0 || pActive.stamina <= 0 || eActive.hp <= 0 || eActive.stamina <= 0;

const SkillMark = ({ kind }: { kind: SkillKind }) => (
  <span className={cn("bt-skill-mark", `bt-skill-mark--${SKILLS[kind].color}`)} aria-hidden>
    <span />
  </span>
);

const ResourcePill = ({ label, value, tone }: { label: string; value: number | string; tone?: string }) => (
  <div className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">{label}</div>
    <div className={cn("text-base font-black leading-none", tone)}>{value}</div>
  </div>
);

const BeyStatus = ({ b, side, activeIndex, total }: { b: BeyState; side: "p" | "e"; activeIndex: number; total: number }) => (
  <div className={cn("bt-glass-panel p-2.5", side === "e" && "text-right")}>
    <div className={cn("flex items-center gap-2", side === "e" && "flex-row-reverse")}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/14 bg-black/30 text-2xl">
        {b.def.emoji}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate font-black uppercase tracking-[0.08em]">{b.def.name}</span>
          <div className="flex shrink-0 items-center gap-1 text-[10px] text-white/55">
            {b.shield > 0 && <span className="inline-flex items-center gap-0.5"><Shield className="h-3 w-3" />{b.shield}</span>}
            {b.defenseBoost > 0 && <span>DEF+{b.defenseBoost}</span>}
            {b.stunned > 0 && <span>STUN</span>}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
            <span>Burst</span><span>{b.hp}/{b.maxHp}</span>
          </div>
          <Progress value={(b.hp / b.maxHp) * 100} className="h-1.5 bg-white/10" />
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
            <span>Spin</span><span>{b.stamina}/{b.staminaMax}</span>
          </div>
          <Progress value={(b.stamina / b.staminaMax) * 100} className="h-1.5 bg-white/10 [&>div]:bg-cyan-300" />
        </div>
      </div>
    </div>
    <div className={cn("mt-2 flex gap-1", side === "e" && "justify-end")}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-6 rounded-full",
            i < activeIndex ? "bg-white/18" : i === activeIndex ? (side === "p" ? "bg-cyan-300" : "bg-fuchsia-400") : "bg-white/8",
          )}
        />
      ))}
    </div>
  </div>
);

const SkillCardButton = ({
  card,
  order,
  disabled,
  onClick,
  preview,
}: {
  card: SkillCard;
  order: number | null;
  disabled: boolean;
  onClick: () => void;
  preview: MoveResult;
}) => {
  const def = SKILLS[card.kind];
  const selected = order != null;
  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      className={cn(
        "bt-hand-card group relative min-h-[126px] w-[112px] shrink-0 overflow-hidden rounded-2xl border p-2.5 text-left transition-all duration-200",
        `bt-hand-card--${def.color}`,
        selected && "bt-hand-card--selected -translate-y-5 scale-[1.04]",
        disabled && !selected && "opacity-35 grayscale",
      )}
      style={{ transform: selected ? undefined : `rotate(${(Number(card.uid.slice(-1).charCodeAt(0)) % 7) - 3}deg)` }}
    >
      {selected && (
        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-black text-black shadow-[0_0_22px_rgba(255,255,255,0.65)]">
          {order}
        </span>
      )}
      <div className="mb-2 flex items-center justify-between pr-6">
        <SkillMark kind={card.kind} />
        <span className="rounded-full border border-white/16 bg-black/28 px-1.5 py-0.5 text-[10px] font-black">{def.cost}</span>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{def.short}</div>
        <div className="text-sm font-black leading-tight">{def.label}</div>
        <div className="text-[10px] font-semibold text-white/55">{def.hint}</div>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 text-[9px] font-bold text-white/70">
        {preview.damage > 0 && <span>DMG {preview.damage}</span>}
        {preview.shield > 0 && <span>SHD {preview.shield}</span>}
        {preview.defenseBoost > 0 && <span>DEF {preview.defenseBoost}</span>}
        {preview.stun > 0 && <span>STUN</span>}
      </div>
    </button>
  );
};

export const BattleScene = ({ levelId, onExit }: Props) => {
  const { profile, grantRewards, mods, setMods, resetMods } = useRpg();
  const { user } = useAuth();
  const level = LEVELS.find((l) => l.id === levelId)!;

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
  const [activePair, setActivePair] = useState<number | null>(null);
  const [phase, setPhase] = useState<BattlePhase>("loading");
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [upgrades, setUpgrades] = useState<ReturnType<typeof pickRandomUpgrades>>([]);
  const [log, setLog] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [pAction, setPAction] = useState<ArenaAction>({ kind: null, t0: 0 });
  const [eAction, setEAction] = useState<ArenaAction>({ kind: null, t0: 0 });
  const [shakeKey, setShakeKey] = useState(0);
  const [pKo, setPKo] = useState<KoState | null>(null);
  const [eKo, setEKo] = useState<KoState | null>(null);

  const pBey = player[pIdx];
  const eBey = enemy[eIdx];
  const spent = queueCost(pQueue);
  const remainingEnergy = energy - spent;

  const addLog = (s: string) => setLog((l) => [s, ...l].slice(0, 7));
  const flashBanner = async (text: string, ms = 760) => {
    setBanner(text);
    await wait(ms);
    setBanner(null);
  };

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
          const { data: beyRows } = await (supabase as any)
            .from("rpg_game_deck_beys")
            .select("position, series, ratchet_mode, blade_id, ratchet_id, ribs_id, bit_id, lock_chip_id, ux_infinity_id, cx_infinity_id, cx_assist_id")
            .eq("deck_id", deckId)
            .order("position");
          const byId = new Map(catalog.map((c) => [c.id, c]));
          const assembled = [1, 2, 3].map((pos) => {
            const r = (beyRows ?? []).find((b: any) => b.position === pos);
            const parts: any = {};
            for (const id of [r?.blade_id, r?.cx_assist_id, r?.lock_chip_id, r?.ux_infinity_id, r?.cx_infinity_id, r?.ratchet_id, r?.ribs_id, r?.bit_id]) {
              const c = id ? byId.get(id) : null;
              if (c) parts[c.slot] = c;
            }
            return assembleBey(pos, (r?.series as any) ?? "BX", (r?.ratchet_mode as any) ?? "ratchet", parts);
          });
          if (assembled.every((a) => Object.values(a.parts).some(Boolean))) {
            beys = assembled.map((a, i) => assembledToBey(a, i));
          }
        }
      }
      if (!beys && profile.site_deck_id) beys = await siteDeckToBeys(profile.site_deck_id);
      if (!beys) beys = profile.selected_deck.map((id) => getBey(id)).filter(Boolean) as Bey[];
      if (cancelled) return;
      setPlayer(beys.map((b) => mkBeyState(b, mods)));
      setEnemy(generateEnemyDeck(level.id, catalog).map((b) => mkBeyState(b, initialMods)));
      setPhase("rolling");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.site_deck_id, levelId, user?.id]);

  useEffect(() => {
    if (phase !== "rolling" || !pBey || !eBey) return;
    const rolls = rollDice(2 + mods.extraDice);
    const enemyRolls = rollDice(2);
    const sum = rolls.reduce((a, b) => a + b, 0);
    const enemySum = enemyRolls.reduce((a, b) => a + b, 0);
    setDice(rolls);
    setEnergy(pBey.stunned > 0 ? 0 : sum);
    setEnemyEnergy(eBey.stunned > 0 ? 0 : enemySum);
    setRerolls(0);
    setHand(pBey.stunned > 0 ? [] : drawSkillHand());
    setEnemyHand(eBey.stunned > 0 ? [] : drawSkillHand(Date.now() + 1));
    setPQueue([]);
    setEQueue([]);
    setActivePair(null);
    setPAction({ kind: null, t0: 0 });
    setEAction({ kind: null, t0: 0 });
    if (pBey.stunned > 0) {
      addLog(`${pBey.def.name} salta il turno: stordito`);
      setPlayer((arr) => arr.map((b, i) => i === pIdx ? { ...b, stunned: b.stunned - 1 } : b));
    } else {
      addLog(`Dadi: ${rolls.join(" + ")} = ${sum}`);
    }
    if (eBey.stunned > 0) {
      addLog(`${eBey.def.name} nemico salta il turno: stordito`);
      setEnemy((arr) => arr.map((b, i) => i === eIdx ? { ...b, stunned: b.stunned - 1 } : b));
    }
    setPhase("planning");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pIdx, eIdx, pBey?.def.id, eBey?.def.id]);

  const previewFor = (card: SkillCard) => {
    const move = computeMove(pBey?.def, card.kind);
    return { ...move, damage: move.damage > 0 ? move.damage + mods.bonusDamage : 0 };
  };

  const toggleSkill = (card: SkillCard) => {
    if (phase !== "planning" || pBey?.stunned) return;
    const existing = pQueue.find((c) => c.uid === card.uid);
    if (existing) {
      setPQueue((cards) => cards.filter((c) => c.uid !== card.uid));
      return;
    }
    if (remainingEnergy < skillCost(card.kind)) return;
    setPQueue((cards) => [...cards, card]);
  };

  const rerollDice = () => {
    if (phase !== "planning" || pQueue.length > 0 || rerolls >= MAX_REROLLS || pBey?.stunned) return;
    const rolls = rollDice(2 + mods.extraDice);
    const sum = rolls.reduce((a, b) => a + b, 0);
    setDice(rolls);
    setEnergy(sum);
    setRerolls((v) => v + 1);
    setHand(drawSkillHand());
    addLog(`Reroll ${rerolls + 1}/${MAX_REROLLS}: ${rolls.join(" + ")} = ${sum}`);
  };

  const buildEnemyPlan = (cards: SkillCard[], points: number) => {
    const plan: SkillCard[] = [];
    let budget = points;
    const ranked = [...cards].sort((a, b) => {
      const score = (c: SkillCard) => {
        if (c.kind === "xtreme") return eBey && eBey.stamina > 16 ? 6 : 1;
        if (c.kind === "attack") return 5;
        if (c.kind === "dodge") return pBey && pBey.hp > 0 ? 3 : 0;
        if (c.kind === "boost") return eBey && (eBey.shield < 14 || eBey.hp < eBey.maxHp * 0.65) ? 4 : 1;
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

  const applyIncomingDamage = (target: BeyState, raw: number) => {
    const mitigated = Math.max(0, raw - target.defenseBoost);
    const absorbed = Math.min(target.shield, mitigated);
    target.shield -= absorbed;
    target.hp = Math.max(0, target.hp - (mitigated - absorbed));
    return mitigated - absorbed;
  };

  const applyPair = async (
    pCard: SkillCard | undefined,
    eCard: SkillCard | undefined,
    pLocal: BeyState[],
    eLocal: BeyState[],
    pairIndex: number,
  ) => {
    setActivePair(pairIndex);
    const now = performance.now();
    const pActive = pLocal[pIdx];
    const eActive = eLocal[eIdx];
    const pMove = pCard ? computeMove(pActive.def, pCard.kind) : null;
    const eMove = eCard ? computeMove(eActive.def, eCard.kind) : null;
    setPAction({ kind: pCard?.kind ?? null, t0: now });
    setEAction({ kind: eCard?.kind ?? null, t0: now });

    if (pCard?.kind === "xtreme" || eCard?.kind === "xtreme") void flashBanner("XTREME DASH!", 900);
    if (pCard?.kind === "dodge") addLog("Tu: Schivata");
    if (eCard?.kind === "dodge") addLog("Nemico: Schivata");

    if (pMove && pCard) {
      pActive.shield += pMove.shield;
      pActive.defenseBoost = Math.max(pActive.defenseBoost, pMove.defenseBoost);
      pActive.stamina = Math.max(0, pActive.stamina - pMove.staminaCost);
    }
    if (eMove && eCard) {
      eActive.shield += eMove.shield;
      eActive.defenseBoost = Math.max(eActive.defenseBoost, eMove.defenseBoost);
      eActive.stamina = Math.max(0, eActive.stamina - eMove.staminaCost);
    }
    if (pCard?.kind === "boost") addLog(`Tu: Guard +${pMove?.shield ?? 0} scudo`);
    if (eCard?.kind === "boost") addLog(`Nemico: Guard +${eMove?.shield ?? 0} scudo`);

    const pAttacks = pMove && pMove.damage > 0;
    const eAttacks = eMove && eMove.damage > 0;
    const pDodges = pCard?.kind === "dodge";
    const eDodges = eCard?.kind === "dodge";

    if (pAttacks && !eDodges) {
      const raw = pMove.damage + mods.bonusDamage;
      const dealt = applyIncomingDamage(eActive, raw);
      if (pMove.stun > 0) eActive.stunned += pMove.stun;
      addLog(`Tu: ${skillLabel(pCard!.kind)} -${dealt}`);
      setShakeKey((k) => k + 1);
    } else if (pAttacks && eDodges) {
      addLog(`Nemico evita ${skillLabel(pCard!.kind)}`);
    }

    if (eAttacks && !pDodges) {
      const dealt = applyIncomingDamage(pActive, eMove.damage);
      if (eMove.stun > 0) pActive.stunned += eMove.stun;
      addLog(`Nemico: ${skillLabel(eCard!.kind)} -${dealt}`);
      setShakeKey((k) => k + 1);
    } else if (eAttacks && pDodges) {
      addLog(`Schivi ${skillLabel(eCard!.kind)}`);
    }

    setPlayer([...pLocal]);
    setEnemy([...eLocal]);
    await wait((pCard?.kind === "xtreme" || eCard?.kind === "xtreme") ? PAIR_DELAY + 360 : PAIR_DELAY);
  };

  const finishBattle = (r: "win" | "lose") => {
    setResult(r);
    if (r === "win") {
      addLog("Vittoria!");
      setUpgrades(pickRandomUpgrades(3));
      setPhase("upgrade");
    } else {
      addLog("Sconfitta");
      setPhase("ended");
      resetMods();
    }
  };

  const resolvePlans = async (playerPlan: SkillCard[], enemyPlan: SkillCard[]) => {
    const pLocal = player.map((b) => ({ ...b }));
    const eLocal = enemy.map((b) => ({ ...b }));
    const max = Math.max(playerPlan.length, enemyPlan.length);
    for (let i = 0; i < max; i++) {
      await applyPair(playerPlan[i], enemyPlan[i], pLocal, eLocal, i);
      if (hasKo(pLocal[pIdx], eLocal[eIdx])) return;
    }
    pLocal[pIdx].stamina = Math.max(0, pLocal[pIdx].stamina - STAMINA_DRAIN_PER_TURN);
    eLocal[eIdx].stamina = Math.max(0, eLocal[eIdx].stamina - STAMINA_DRAIN_PER_TURN);
    pLocal[pIdx].defenseBoost = 0;
    eLocal[eIdx].defenseBoost = 0;
    setPlayer([...pLocal]);
    setEnemy([...eLocal]);
    setActivePair(null);
    await wait(350);
    if (!hasKo(pLocal[pIdx], eLocal[eIdx])) setPhase("rolling");
  };

  const confirmPlan = () => {
    if (phase !== "planning" || !pBey || !eBey) return;
    const enemyPlan = buildEnemyPlan(enemyHand, enemyEnergy);
    setEQueue(enemyPlan);
    setPhase("resolving");
    addLog(`Sequenza: ${pQueue.length} tue / ${enemyPlan.length} nemico`);
    void resolvePlans(pQueue, enemyPlan);
  };

  useEffect(() => {
    if (phase === "loading" || phase === "ended" || phase === "upgrade" || phase === "interlude") return;
    if (!pBey || !eBey) return;
    const enemyBurst = eBey.hp <= 0;
    const playerBurst = pBey.hp <= 0;
    const enemyOut = eBey.stamina <= 0;
    const playerOut = pBey.stamina <= 0;
    const enemyKO = enemyBurst || enemyOut;
    const playerKO = playerBurst || playerOut;
    if (!enemyKO && !playerKO) return;

    let nextPScore = pScore;
    let nextEScore = eScore;
    if (enemyKO && !playerKO) {
      nextPScore += 1;
      addLog(`${eBey.def.name} KO. +1`);
    } else if (playerKO && !enemyKO) {
      nextEScore += 1;
      addLog(`${pBey.def.name} KO. Punto nemico`);
    } else {
      addLog("KO simultaneo. Nessun punto");
    }
    setPScore(nextPScore);
    setEScore(nextEScore);

    const now = performance.now();
    if (enemyKO) setEKo({ reason: enemyBurst ? "burst" : "spin", t0: now });
    if (playerKO) setPKo({ reason: playerBurst ? "burst" : "spin", t0: now });

    const delay = enemyBurst || playerBurst ? 1700 : 1400;
    if (nextPScore >= 2) { setTimeout(() => finishBattle("win"), delay); return; }
    if (nextEScore >= 2) { setTimeout(() => finishBattle("lose"), delay); return; }

    const nextPIdx = pIdx + 1;
    const nextEIdx = eIdx + 1;
    if (nextPIdx >= player.length || nextEIdx >= enemy.length) {
      setTimeout(() => finishBattle(nextPScore > nextEScore ? "win" : "lose"), delay);
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
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, enemy]);

  const claim = async (upgIdx?: number) => {
    if (result === "win") {
      if (upgIdx != null) setMods(upgrades[upgIdx].apply(mods));
      await grantRewards(level.reward.currency, level.reward.gachaPoints, level.id + 1);
      toast({ title: "Ricompense ricevute!", description: `+${level.reward.currency} monete · +${level.reward.gachaPoints} gacha` });
    }
    onExit();
  };

  const turnLabel = phase === "planning" ? "Scegli la sequenza" : phase === "resolving" ? "Risoluzione" : "Preparazione";
  const opponentPlanText = phase === "resolving" ? `${eQueue.length} carte` : `${enemyEnergy} energia`;

  if (phase === "loading") {
    return <div className="py-20 text-center text-muted-foreground">Preparazione battaglia...</div>;
  }

  if (phase === "upgrade") {
    return (
      <div className="bt-battle-shell mx-auto max-w-2xl space-y-4 p-4">
        <div className="text-center">
          <Sparkles className="mx-auto mb-2 h-12 w-12 text-primary" />
          <h2 className="text-2xl font-black">Vittoria {pScore}-{eScore}</h2>
          <p className="text-sm text-muted-foreground">Scegli un potenziamento per la prossima sfida</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {upgrades.map((u, i) => (
            <button key={u.id} className="bt-glass-panel p-4 text-center transition hover:-translate-y-1 hover:border-primary/60" onClick={() => claim(i)}>
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
              <div className="font-black">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.description}</div>
            </button>
          ))}
        </div>
        <div className="text-center"><Button variant="ghost" onClick={() => claim()}>Salta e torna al menu</Button></div>
      </div>
    );
  }

  if (phase === "ended" && result === "lose") {
    return (
      <div className="bt-battle-shell mx-auto max-w-md space-y-4 p-8 text-center">
        <div className="text-5xl">×</div>
        <h2 className="text-2xl font-black">Sconfitta {pScore}-{eScore}</h2>
        <p className="text-sm text-muted-foreground">I potenziamenti della run sono andati persi. Riprova.</p>
        <Button onClick={onExit}>Torna al menu</Button>
      </div>
    );
  }

  return (
    <div className="bt-battle-shell relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#06080b] text-white shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(6,8,11,.4), rgba(6,8,11,.94)), url(${getLevelBackground(level.id)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          imageRendering: "pixelated",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(34,211,238,.18),transparent_34%),radial-gradient(circle_at_85%_22%,rgba(217,70,239,.14),transparent_28%)]" />

      <div className="relative z-10 flex min-h-[calc(100svh-116px)] flex-col gap-3 p-2.5 sm:min-h-0 sm:p-4">
        <header className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onExit} className="h-9 rounded-full text-white hover:bg-white/10 hover:text-white">
            <ArrowLeft className="mr-1.5 h-4 w-4" />Esci
          </Button>
          <div className="min-w-0 text-center">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.26em] text-white/45">Livello {level.id}</div>
            <div className="truncate text-sm font-black">{level.name}</div>
          </div>
          <div className="flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 text-sm font-black">
            <Trophy className="h-4 w-4 text-amber-300" />{pScore}-{eScore}
          </div>
        </header>

        <section className="grid flex-1 gap-2 lg:grid-cols-[250px_minmax(0,1fr)_250px] lg:items-stretch">
          <div className="order-1 space-y-2 lg:order-none">
            {eBey && <BeyStatus b={eBey} side="e" activeIndex={eIdx} total={enemy.length} />}
            <div className="bt-glass-panel hidden p-3 text-xs lg:block">
              <div className="mb-2 font-black uppercase tracking-[0.18em] text-white/45">Nemico</div>
              <div className="flex items-center justify-between"><span>Piano</span><span>{opponentPlanText}</span></div>
              <div className="mt-2 flex gap-1">
                {eQueue.map((c, i) => <span key={c.uid} className={cn("h-7 w-7 rounded-lg border border-white/12 bg-white/8 text-[10px] font-black grid place-items-center", activePair === i && "ring-2 ring-fuchsia-300")}>{SKILLS[c.kind].short}</span>)}
              </div>
            </div>
          </div>

          <div className="relative order-2 flex min-h-[300px] flex-col">
            {banner && (
              <div className="bt-xtreme-banner pointer-events-none absolute left-1/2 top-9 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-6 py-2 text-xl font-black uppercase tracking-[0.18em]">
                {banner}
              </div>
            )}
            <div className="bt-arena-wrap relative mx-auto flex w-full max-w-[560px] flex-1 items-center justify-center rounded-[28px] border border-white/10 bg-black/30 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {pBey && eBey && (
                <Arena
                  player={pBey.def}
                  enemy={eBey.def}
                  playerAction={pAction}
                  enemyAction={eAction}
                  shakeKey={shakeKey}
                  playerKo={pKo}
                  enemyKo={eKo}
                />
              )}
              <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/55 backdrop-blur">
                {turnLabel}
              </div>
            </div>
          </div>

          <div className="order-3 space-y-2">
            {pBey && <BeyStatus b={pBey} side="p" activeIndex={pIdx} total={player.length} />}
            <div className="bt-glass-panel hidden max-h-36 overflow-y-auto p-3 text-xs lg:block">
              <div className="mb-2 font-black uppercase tracking-[0.18em] text-white/45">Log</div>
              <div className="space-y-1">
                {log.map((l, i) => <div key={i} className={i === 0 ? "text-white" : "text-white/50"}>{l}</div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="bt-control-dock space-y-2 rounded-[24px] border border-white/10 bg-black/45 p-2.5 shadow-[0_-18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/8 sm:grid">
                <Dices className="h-4 w-4 text-cyan-200" />
              </div>
              <div className="flex gap-1">
                {dice.map((d, i) => (
                  <span key={i} className="grid h-8 w-8 place-items-center rounded-xl border border-white/12 bg-white/8 text-sm font-black">{d}</span>
                ))}
              </div>
              <button
                onClick={rerollDice}
                disabled={phase !== "planning" || pQueue.length > 0 || rerolls >= MAX_REROLLS || Boolean(pBey?.stunned)}
                className="bt-reroll-btn grid h-8 w-12 place-items-center rounded-xl border border-white/12 bg-white/8 text-xs font-black disabled:opacity-35"
              >
                <span className="inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" />{MAX_REROLLS - rerolls}</span>
              </button>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <ResourcePill label="EN" value={remainingEnergy} tone="text-cyan-200" />
              <ResourcePill label="Use" value={spent} />
              <Button size="sm" onClick={confirmPlan} disabled={phase !== "planning"} className="h-[46px] rounded-2xl px-3 font-black">
                <Check className="mr-1 h-4 w-4" />Go
              </Button>
            </div>
          </div>

          <div className="flex items-end gap-2 overflow-x-auto px-1 pb-1 pt-5">
            {hand.length === 0 ? (
              <div className="w-full py-6 text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Nessuna carta giocabile</div>
            ) : hand.map((card) => {
              const order = pQueue.findIndex((c) => c.uid === card.uid);
              const selected = order >= 0;
              const disabled = phase !== "planning" || (!selected && remainingEnergy < skillCost(card.kind)) || Boolean(pBey?.stunned);
              return (
                <SkillCardButton
                  key={card.uid}
                  card={card}
                  order={selected ? order + 1 : null}
                  disabled={disabled}
                  onClick={() => toggleSkill(card)}
                  preview={previewFor(card)}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 lg:hidden">
            {log.slice(0, 4).map((l, i) => <span key={i} className={cn("shrink-0 rounded-full border border-white/10 px-2 py-1", i === 0 ? "text-white/80" : "text-white/45")}>{l}</span>)}
          </div>
        </section>
      </div>

      <style>{`
        .bt-glass-panel {
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,.11);
          background:
            linear-gradient(145deg, rgba(255,255,255,.105), rgba(255,255,255,.035)),
            rgba(8,10,14,.48);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.10),
            0 16px 46px rgba(0,0,0,.28);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }
        .bt-hand-card {
          color: white;
          background:
            radial-gradient(circle at 35% 0%, rgba(255,255,255,.16), transparent 38%),
            linear-gradient(160deg, rgba(255,255,255,.11), rgba(255,255,255,.035) 48%, rgba(0,0,0,.28));
          border-color: rgba(255,255,255,.13);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.12),
            0 16px 38px rgba(0,0,0,.30);
          backdrop-filter: blur(16px) saturate(160%);
          -webkit-backdrop-filter: blur(16px) saturate(160%);
        }
        .bt-hand-card--rose { --skill: 244 63 94; }
        .bt-hand-card--cyan { --skill: 34 211 238; }
        .bt-hand-card--emerald { --skill: 52 211 153; }
        .bt-hand-card--amber { --skill: 251 191 36; }
        .bt-hand-card::before {
          content: "";
          position: absolute;
          inset: -45% -25% auto;
          height: 90px;
          background: radial-gradient(circle, rgb(var(--skill) / .30), transparent 62%);
          opacity: .8;
        }
        .bt-hand-card--selected {
          border-color: rgb(var(--skill) / .86);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.20),
            0 0 0 1px rgb(var(--skill) / .34),
            0 0 34px rgb(var(--skill) / .46),
            0 20px 44px rgba(0,0,0,.42);
        }
        .bt-skill-mark {
          position: relative;
          display: inline-grid;
          height: 34px;
          width: 34px;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgb(var(--skill-mark) / .45);
          background: radial-gradient(circle, rgb(var(--skill-mark) / .24), rgba(0,0,0,.28));
        }
        .bt-skill-mark span {
          display: block;
          height: 15px;
          width: 15px;
          border: 2px solid rgb(var(--skill-mark));
          transform: rotate(45deg);
        }
        .bt-skill-mark--rose { --skill-mark: 244 63 94; }
        .bt-skill-mark--cyan { --skill-mark: 34 211 238; }
        .bt-skill-mark--emerald { --skill-mark: 52 211 153; }
        .bt-skill-mark--amber { --skill-mark: 251 191 36; }
        .bt-skill-mark--rose span { border-left-color: transparent; border-bottom-color: transparent; }
        .bt-skill-mark--cyan span { border-radius: 50% 50% 50% 0; border-right-color: transparent; }
        .bt-skill-mark--emerald span { border-radius: 3px; box-shadow: inset 0 0 0 3px rgba(0,0,0,.38); }
        .bt-skill-mark--amber span { width: 11px; height: 20px; border-radius: 2px 8px 2px 8px; border-top-color: transparent; }
        .bt-xtreme-banner {
          color: #fff;
          background: linear-gradient(90deg, rgba(251,191,36,.15), rgba(34,211,238,.22), rgba(251,191,36,.15));
          border: 1px solid rgba(255,255,255,.20);
          text-shadow: 0 0 18px rgba(34,211,238,.95), 0 0 34px rgba(251,191,36,.85);
          box-shadow: 0 0 44px rgba(34,211,238,.36), inset 0 1px 0 rgba(255,255,255,.22);
          animation: bt-pop 900ms cubic-bezier(.2,.9,.2,1);
          backdrop-filter: blur(18px);
        }
        .bt-reroll-btn:not(:disabled):active { transform: rotate(-12deg) scale(.96); }
        @keyframes bt-pop {
          0% { transform: translate(-50%, 8px) scale(.78); opacity: 0; letter-spacing: .04em; }
          22% { transform: translate(-50%, 0) scale(1.08); opacity: 1; }
          100% { transform: translate(-50%, -4px) scale(1); opacity: 0; letter-spacing: .24em; }
        }
        @media (max-width: 640px) {
          .bt-battle-shell {
            margin-left: -0.5rem;
            margin-right: -0.5rem;
            padding-bottom: 18rem;
            border-radius: 0;
            border-left: 0;
            border-right: 0;
          }
          .bt-arena-wrap {
            max-height: min(58vw, 230px);
          }
          .bt-hand-card {
            min-height: 104px;
            width: 94px;
          }
          .bt-control-dock {
            position: fixed;
            left: max(0.5rem, env(safe-area-inset-left));
            right: max(0.5rem, env(safe-area-inset-right));
            bottom: calc(4.75rem + env(safe-area-inset-bottom));
            z-index: 70;
            max-height: min(17rem, calc(100svh - 8rem));
            overflow: hidden;
            border-radius: 22px;
            background: rgba(5, 8, 12, .72);
            box-shadow: 0 -18px 58px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12);
          }
        }
      `}</style>
    </div>
  );
};
