import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ALL_BEY_IDS } from "../data/levels";
import { RunMods, initialMods } from "../data/upgrades";
import { BASE_OWNED, Gender } from "../data/cosmetics";

export interface RpgProfile {
  avatar_key: string;
  currency: number;
  gacha_points: number;
  unlocked_level: number;
  selected_deck: string[];
  gender: Gender;
  hair: string;
  eyes: string;
  skin: string;
  outfit: string;
  site_deck_id: string | null;
  owned_cosmetics: string[];
}

export interface RpgRunState {
  currentLevel: number;
  inBattle: boolean;
}

const DEFAULT_PROFILE: RpgProfile = {
  avatar_key: "hero_default",
  currency: 0,
  gacha_points: 0,
  unlocked_level: 1,
  selected_deck: ALL_BEY_IDS.slice(0, 3),
  gender: "male",
  hair: "short_dark",
  eyes: "brown",
  skin: "fair",
  outfit: "tunic_blue",
  site_deck_id: null,
  owned_cosmetics: [],
};

const DEFAULT_RUN_STATE: RpgRunState = {
  currentLevel: 1,
  inBattle: false,
};

interface RpgContextValue {
  profile: RpgProfile;
  run: RpgRunState;
  loading: boolean;
  setDeck: (deck: string[]) => Promise<void>;
  setSiteDeck: (id: string | null) => Promise<void>;
  setAppearance: (a: Partial<Pick<RpgProfile, "gender" | "hair" | "eyes" | "skin" | "outfit">>) => Promise<void>;
  buyCosmetic: (id: string, price: number) => Promise<boolean>;
  grantRewards: (currency: number, gachaPoints: number, unlockNext?: number) => Promise<void>;
  startRunLevel: (levelId?: number) => void;
  completeRunWin: () => void;
  completeRunLoss: () => void;
  mods: RunMods;
  setMods: (m: RunMods) => void;
  resetMods: () => void;
  // Debug
  freeMode: boolean;
  setFreeMode: (v: boolean) => void;
  addCurrency: (amount: number) => Promise<void>;
  addGachaPoints: (amount: number) => Promise<void>;
}

const RpgContext = createContext<RpgContextValue | null>(null);

const FREE_MODE_KEY = "rpg.debug.freeMode";
const runKeyFor = (userId?: string | null) => `rpg.run.${userId ?? "guest"}`;

const readRunState = (userId?: string | null): RpgRunState => {
  try {
    const raw = localStorage.getItem(runKeyFor(userId));
    if (!raw) return DEFAULT_RUN_STATE;
    const parsed = JSON.parse(raw);
    const currentLevel = Math.max(1, Math.floor(Number(parsed.currentLevel)) || 1);
    return { currentLevel, inBattle: Boolean(parsed.inBattle) };
  } catch {
    return DEFAULT_RUN_STATE;
  }
};

const writeRunState = (userId: string | null | undefined, next: RpgRunState) => {
  try { localStorage.setItem(runKeyFor(userId), JSON.stringify(next)); } catch {}
};

export const RpgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<RpgProfile>(DEFAULT_PROFILE);
  const [run, setRun] = useState<RpgRunState>(() => readRunState(null));
  const [loading, setLoading] = useState(true);
  const [mods, setMods] = useState<RunMods>(initialMods);
  const [freeMode, setFreeModeState] = useState<boolean>(() => {
    try { return localStorage.getItem(FREE_MODE_KEY) === "1"; } catch { return false; }
  });

  const setFreeMode = useCallback((v: boolean) => {
    setFreeModeState(v);
    try { localStorage.setItem(FREE_MODE_KEY, v ? "1" : "0"); } catch {}
  }, []);


  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setRun(readRunState(user.id));
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("rpg_profiles")
        .select("avatar_key,currency,gacha_points,unlocked_level,selected_deck,gender,hair,eyes,skin,outfit,site_deck_id,owned_cosmetics")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setProfile({
          avatar_key: data.avatar_key,
          currency: data.currency,
          gacha_points: data.gacha_points,
          unlocked_level: data.unlocked_level,
          selected_deck: Array.isArray(data.selected_deck) && data.selected_deck.length === 3
            ? (data.selected_deck as string[])
            : DEFAULT_PROFILE.selected_deck,
          gender: (data.gender as Gender) ?? "male",
          hair: data.hair ?? "short_dark",
          eyes: data.eyes ?? "brown",
          skin: data.skin ?? "fair",
          outfit: data.outfit ?? "tunic_blue",
          site_deck_id: data.site_deck_id ?? null,
          owned_cosmetics: Array.isArray(data.owned_cosmetics) ? (data.owned_cosmetics as string[]) : [],
        });
      } else {
        await (supabase as any).from("rpg_profiles").insert({
          user_id: user.id,
          selected_deck: DEFAULT_PROFILE.selected_deck as any,
          owned_cosmetics: BASE_OWNED as any,
        });
        setProfile({ ...DEFAULT_PROFILE, owned_cosmetics: BASE_OWNED });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const persistRun = useCallback((next: RpgRunState) => {
    const safeNext = {
      currentLevel: Math.max(1, Math.floor(next.currentLevel) || 1),
      inBattle: next.inBattle,
    };
    setRun(safeNext);
    writeRunState(user?.id, safeNext);
  }, [user?.id]);

  const persist = useCallback(async (next: Partial<RpgProfile>) => {
    if (!user) return;
    setProfile((p) => ({ ...p, ...next }));
    await (supabase as any)
      .from("rpg_profiles")
      .update(next as any)
      .eq("user_id", user.id);
  }, [user]);

  const setDeck = useCallback(async (deck: string[]) => {
    await persist({ selected_deck: deck });
  }, [persist]);

  const setSiteDeck = useCallback(async (id: string | null) => {
    await persist({ site_deck_id: id });
  }, [persist]);

  const setAppearance = useCallback(async (a: Partial<Pick<RpgProfile, "gender" | "hair" | "eyes" | "skin" | "outfit">>) => {
    await persist(a);
  }, [persist]);

  const buyCosmetic = useCallback(async (id: string, price: number) => {
    const effectivePrice = freeMode ? 0 : price;
    if (profile.currency < effectivePrice) return false;
    if (profile.owned_cosmetics.includes(id)) return true;
    await persist({
      currency: profile.currency - effectivePrice,
      owned_cosmetics: [...profile.owned_cosmetics, id],
    });
    return true;
  }, [persist, profile, freeMode]);

  const grantRewards = useCallback(async (currency: number, gachaPoints: number, unlockNext?: number) => {
    const next: Partial<RpgProfile> = {
      currency: profile.currency + currency,
      gacha_points: profile.gacha_points + gachaPoints,
    };
    if (unlockNext && unlockNext > profile.unlocked_level) next.unlocked_level = unlockNext;
    await persist(next);
  }, [persist, profile]);

  const resetMods = useCallback(() => setMods(initialMods), []);

  const startRunLevel = useCallback((levelId?: number) => {
    const currentLevel = levelId ?? run.currentLevel;
    persistRun({ currentLevel, inBattle: true });
  }, [persistRun, run.currentLevel]);

  const completeRunWin = useCallback(() => {
    persistRun({ currentLevel: run.currentLevel + 1, inBattle: false });
  }, [persistRun, run.currentLevel]);

  const completeRunLoss = useCallback(() => {
    persistRun({ currentLevel: 1, inBattle: false });
    resetMods();
  }, [persistRun, resetMods]);

  const addCurrency = useCallback(async (amount: number) => {
    await persist({ currency: Math.max(0, profile.currency + amount) });
  }, [persist, profile]);

  const addGachaPoints = useCallback(async (amount: number) => {
    await persist({ gacha_points: Math.max(0, profile.gacha_points + amount) });
  }, [persist, profile]);

  return (
    <RpgContext.Provider value={{ profile, run, loading, setDeck, setSiteDeck, setAppearance, buyCosmetic, grantRewards, startRunLevel, completeRunWin, completeRunLoss, mods, setMods, resetMods, freeMode, setFreeMode, addCurrency, addGachaPoints }}>
      {children}
    </RpgContext.Provider>
  );
};


export const useRpg = () => {
  const ctx = useContext(RpgContext);
  if (!ctx) throw new Error("useRpg must be used within RpgProvider");
  return ctx;
};
