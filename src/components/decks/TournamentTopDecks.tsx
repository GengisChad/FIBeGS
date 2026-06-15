import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DeckCard } from "./DeckCard";
import { Trophy } from "lucide-react";
import { RankMedal } from "@/components/RankMedal";

interface TournamentTopDecksProps {
  tournamentId: string;
  standings: any[];
  playerMap: Map<string, string>;
  avatarMap: Map<string, string | null>;
}

export const TournamentTopDecks = ({ tournamentId, standings, playerMap, avatarMap }: TournamentTopDecksProps) => {
  const [deckSelections, setDeckSelections] = useState<any[]>([]);
  const [decks, setDecks] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopDecks();
  }, [tournamentId]);

  const fetchTopDecks = async () => {
    // Try to get top 3 from tournament_results (accurate bracket-based placement)
    const { data: results } = await (supabase as any)
      .from("tournament_results")
      .select("user_id, placement")
      .eq("tournament_id", tournamentId)
      .order("placement", { ascending: true })
      .limit(3);

    let top3UserIds: string[];
    if (results && results.length > 0) {
      top3UserIds = results.map((r: any) => r.user_id);
    } else {
      // Fallback to standings sorting
      const sortedStandings = [...standings]
        .sort((a, b) => b.points - a.points || b.resistance - a.resistance)
        .filter(s => !s.dropped);
      top3UserIds = sortedStandings.slice(0, 3).map(s => s.user_id);
    }

    if (top3UserIds.length === 0) { setLoading(false); return; }

    // Get their deck selections
    const { data: selections } = await (supabase as any)
      .from("tournament_deck_selections")
      .select("user_id, deck_id")
      .eq("tournament_id", tournamentId)
      .in("user_id", top3UserIds);

    if (!selections || selections.length === 0) { setLoading(false); return; }

    setDeckSelections(selections);

    const deckIds = selections.map((s: any) => s.deck_id);
    const { data: decksData } = await (supabase as any)
      .from("decks")
      .select("id, user_id, name, description, created_at")
      .in("id", deckIds);

    setDecks(decksData || []);

    // Build profiles from playerMap/avatarMap
    const pMap = new Map<string, any>();
    top3UserIds.forEach(uid => {
      pMap.set(uid, {
        display_name: playerMap.get(uid) || "Utente",
        username: null,
        avatar_url: avatarMap.get(uid) || null,
      });
    });
    setProfilesMap(pMap);
    setLoading(false);
  };

  if (loading) return null;
  if (deckSelections.length === 0) return null;

  // Build ordered top 3 user IDs from deck selections (preserves fetch order = placement order)
  const orderedTop3 = deckSelections
    .map((s: any) => s.user_id)
    .filter((uid: string, idx: number, arr: string[]) => arr.indexOf(uid) === idx)
    .slice(0, 3);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 space-y-4">
      <h3 className="font-display text-lg flex items-center gap-2">
        <Trophy size={18} className="text-primary" />
        Deck della Top 3
      </h3>

      <div className="space-y-3">
        {orderedTop3.map((userId: string, idx: number) => {
          const selection = deckSelections.find((s: any) => s.user_id === userId);
          if (!selection) return null;
          const deck = decks.find((d: any) => d.id === selection.deck_id);
          if (!deck) return null;

          return (
            <div key={userId}>
              <div className="flex items-center gap-2 mb-1.5">
                <RankMedal rank={(idx + 1) as 1 | 2 | 3} size={22} />
                <span className="font-semibold text-sm">{playerMap.get(userId) || "Utente"}</span>
              </div>
              <DeckCard
                deck={deck}
                profile={profilesMap.get(userId)}
                compact
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
