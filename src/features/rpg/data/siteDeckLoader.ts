import { supabase } from "@/integrations/supabase/client";
import { Bey, BeyType, MoveCard } from "./beys";

// Heuristic mapping from blade name keywords to Bey type
const inferType = (name: string): BeyType => {
  const n = name.toLowerCase();
  if (/(phoenix|dran|wyvern|ashindra|leon|knight|sword|hells|tyrann|shark|cobalt)/.test(n)) return "attack";
  if (/(fortress|wall|golem|defender|aegis|tusk|wizard|impact)/.test(n)) return "defense";
  if (/(tempest|drift|stamina|aero|wind|owl|spinner|cyclone|saturn|orb)/.test(n)) return "stamina";
  return "balance";
};

const STATS: Record<BeyType, { hp: number }> = {
  attack: { hp: 90 },
  defense: { hp: 140 },
  stamina: { hp: 110 },
  balance: { hp: 115 },
};

const cardsFor = (type: BeyType, prefix: string): MoveCard[] => {
  switch (type) {
    case "attack":
      return [
        { id: `${prefix}-1`, name: "Affondo", cost: 1, damage: 6 },
        { id: `${prefix}-2`, name: "Carica", cost: 3, damage: 16 },
        { id: `${prefix}-3`, name: "Spirale Letale", cost: 5, damage: 28 },
        { id: `${prefix}-4`, name: "Onda d'Urto", cost: 4, damage: 18, effect: "stun", effectValue: 1 },
      ];
    case "defense":
      return [
        { id: `${prefix}-1`, name: "Colpo Solido", cost: 2, damage: 8 },
        { id: `${prefix}-2`, name: "Muraglia", cost: 3, damage: 4, effect: "shield", effectValue: 18 },
        { id: `${prefix}-3`, name: "Contraccolpo", cost: 4, damage: 20 },
        { id: `${prefix}-4`, name: "Riparazione", cost: 4, damage: 0, effect: "heal", effectValue: 22 },
      ];
    case "stamina":
      return [
        { id: `${prefix}-1`, name: "Vortice", cost: 1, damage: 5 },
        { id: `${prefix}-2`, name: "Spin Eterno", cost: 4, damage: 14, effect: "heal", effectValue: 12 },
        { id: `${prefix}-3`, name: "Tornado", cost: 5, damage: 22 },
        { id: `${prefix}-4`, name: "Drenaggio", cost: 3, damage: 10, effect: "heal", effectValue: 8 },
      ];
    case "balance":
    default:
      return [
        { id: `${prefix}-1`, name: "Jab", cost: 1, damage: 7 },
        { id: `${prefix}-2`, name: "Colpo Misurato", cost: 3, damage: 14 },
        { id: `${prefix}-3`, name: "Perno", cost: 4, damage: 18, effect: "shield", effectValue: 8 },
        { id: `${prefix}-4`, name: "Spin Surge", cost: 5, damage: 24 },
      ];
  }
};

const EMOJI: Record<BeyType, string> = { attack: "🔥", defense: "🛡️", stamina: "🌀", balance: "⚖️" };

export interface SiteDeckSummary {
  id: string;
  name: string;
  beyblades: { position: number; blade_name: string; blade_type: string }[];
}

export async function loadUserSiteDecks(userId: string): Promise<SiteDeckSummary[]> {
  const { data: decks } = await (supabase as any)
    .from("decks")
    .select("id, name, deck_beyblades(position, blade_type, deck_beyblade_components(component_type, collection_components(name)))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (decks ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    beyblades: (d.deck_beyblades ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((b: any) => {
        const bladeComp = (b.deck_beyblade_components ?? []).find((c: any) => c.component_type === "blade" || c.component_type === "main_blade");
        return {
          position: b.position,
          blade_type: b.blade_type,
          blade_name: bladeComp?.collection_components?.name ?? "Sconosciuto",
        };
      }),
  }));
}

export async function siteDeckToBeys(deckId: string): Promise<Bey[] | null> {
  const { data } = await (supabase as any)
    .from("decks")
    .select("id, deck_beyblades(position, blade_type, deck_beyblade_components(component_type, collection_components(name)))")
    .eq("id", deckId)
    .maybeSingle();
  if (!data) return null;
  const beys: Bey[] = (data.deck_beyblades ?? [])
    .sort((a: any, b: any) => a.position - b.position)
    .map((b: any, idx: number) => {
      const bladeComp = (b.deck_beyblade_components ?? []).find((c: any) => c.component_type === "blade" || c.component_type === "main_blade");
      const name: string = bladeComp?.collection_components?.name ?? `Bey ${idx + 1}`;
      const type = inferType(name);
      return {
        id: `${deckId}-${idx}`,
        name,
        type,
        hp: STATS[type].hp,
        emoji: EMOJI[type],
        cards: cardsFor(type, `${deckId}-${idx}`),
      };
    });
  if (beys.length < 3) return null;
  return beys.slice(0, 3);
}
