import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  AssembledBey,
  BeyParts,
  BeySeries,
  CatalogComponent,
  RatchetMode,
  SlotKind,
  STARTER_COMPONENT_IDS,
  assembleBey,
  loadGameComponents,
} from "../data/componentsCatalog";

export interface GameDeckRow {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
}

export interface GameDeckBeyRow {
  id: string;
  deck_id: string;
  position: number;
  series: BeySeries;
  ratchet_mode: RatchetMode;
  blade_id: string | null;
  ratchet_id: string | null;
  ribs_id: string | null;
  bit_id: string | null;
  lock_chip_id: string | null;
  ux_infinity_id: string | null;
  cx_infinity_id: string | null;
  cx_assist_id: string | null;
}

export interface AssembledDeck {
  deck: GameDeckRow;
  beys: AssembledBey[];
}

const SELECT_COLS =
  "id, deck_id, position, series, ratchet_mode, blade_id, ratchet_id, ribs_id, bit_id, lock_chip_id, ux_infinity_id, cx_infinity_id, cx_assist_id";

const rowToParts = (
  r: Partial<GameDeckBeyRow> | undefined,
  byId: Map<string, CatalogComponent>,
): BeyParts => {
  const parts: BeyParts = {};
  if (!r) return parts;
  const ids: Array<keyof GameDeckBeyRow> = [
    "blade_id", "ratchet_id", "ribs_id", "bit_id",
    "lock_chip_id", "ux_infinity_id", "cx_infinity_id", "cx_assist_id",
  ];
  for (const col of ids) {
    const id = r[col] as string | null | undefined;
    if (!id) continue;
    const comp = byId.get(id);
    if (!comp) continue;
    // For storage columns that double-up (e.g. cx_infinity_id used for cx_metal),
    // trust the component's resolved slot.
    parts[comp.slot] = comp;
  }
  return parts;
};

export const useActiveGameDeck = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AssembledDeck | null>(null);
  const [catalog, setCatalog] = useState<CatalogComponent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const cat = await loadGameComponents();
    setCatalog(cat);
    const byId = new Map(cat.map((c) => [c.id, c]));
    const { data: decks } = await (supabase as any)
      .from("rpg_game_decks")
      .select("id, user_id, name, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    const deck: GameDeckRow | undefined = decks?.[0];
    if (!deck) { setData(null); setLoading(false); return; }
    const { data: beysRows } = await (supabase as any)
      .from("rpg_game_deck_beys")
      .select(SELECT_COLS)
      .eq("deck_id", deck.id)
      .order("position");
    const beys: AssembledBey[] = [1, 2, 3].map((pos) => {
      const r = (beysRows ?? []).find((b: GameDeckBeyRow) => b.position === pos);
      const series: BeySeries = (r?.series as BeySeries) ?? "BX";
      const mode: RatchetMode = (r?.ratchet_mode as RatchetMode) ?? "ratchet";
      return assembleBey(pos, series, mode, rowToParts(r, byId));
    });
    setData({ deck, beys });
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  return { data, catalog, loading, reload };
};

export async function ensureStarterComponents(userId: string): Promise<void> {
  const rows = STARTER_COMPONENT_IDS.map((id) => ({ user_id: userId, component_id: id, qty: 1 }));
  await (supabase as any)
    .from("rpg_owned_components")
    .upsert(rows, { onConflict: "user_id,component_id", ignoreDuplicates: true });
}

export const useOwnedComponents = () => {
  const { user } = useAuth();
  const [owned, setOwned] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    await ensureStarterComponents(user.id);
    const { data } = await (supabase as any)
      .from("rpg_owned_components")
      .select("component_id, qty")
      .eq("user_id", user.id);
    const m = new Map<string, number>();
    (data ?? []).forEach((r: any) => m.set(r.component_id, r.qty));
    setOwned(m);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  return { owned, loading, reload };
};

export async function grantComponent(userId: string, componentId: string): Promise<{ duplicate: boolean }> {
  const { data: existing } = await (supabase as any)
    .from("rpg_owned_components")
    .select("qty")
    .eq("user_id", userId)
    .eq("component_id", componentId)
    .maybeSingle();
  if (existing) {
    await (supabase as any)
      .from("rpg_owned_components")
      .update({ qty: existing.qty + 1 })
      .eq("user_id", userId)
      .eq("component_id", componentId);
    return { duplicate: true };
  }
  await (supabase as any)
    .from("rpg_owned_components")
    .insert({ user_id: userId, component_id: componentId, qty: 1 });
  return { duplicate: false };
}

export type DeckSlotSelection = {
  position: number;
  series: BeySeries;
  ratchetMode: RatchetMode;
} & Partial<Record<SlotKind, string | null>>;

export async function saveGameDeck(
  userId: string,
  deckId: string | null,
  beys: DeckSlotSelection[],
): Promise<string> {
  let id = deckId;
  if (!id) {
    const { data } = await (supabase as any)
      .from("rpg_game_decks")
      .insert({ user_id: userId, name: "Deck principale", is_active: true })
      .select("id")
      .single();
    id = data.id;
  }
  await (supabase as any).from("rpg_game_deck_beys").delete().eq("deck_id", id);
  const rows = beys.map((b) => {
    // Pick single blade_id from whichever blade-family slot the series fills.
    // CX_INF uses cx_over for blade_id and cx_metal for cx_infinity_id.
    const bladeId =
      b.cx_over ?? b.cx_main ?? b.blade_ux ?? b.blade_bx_inf ?? b.blade_bx ?? null;
    return {
      deck_id: id,
      position: b.position,
      series: b.series,
      ratchet_mode: b.ratchetMode,
      blade_id: bladeId,
      ratchet_id: b.ratchet ?? null,
      ribs_id: b.ribs ?? null,
      bit_id: b.bit ?? null,
      lock_chip_id: b.cx_lock_chip ?? null,
      ux_infinity_id: b.blade_ux_inf ?? null,
      cx_infinity_id: b.cx_metal ?? null,
      cx_assist_id: b.cx_assist ?? null,
    };
  });
  await (supabase as any).from("rpg_game_deck_beys").insert(rows);
  return id!;
}
