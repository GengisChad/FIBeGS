import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Medal, Paintbrush, User, Film } from "lucide-react";
import { Top3BannerEditor } from "./Top3BannerEditor";
import { TournamentAnimationStudio } from "./TournamentAnimationStudio";
import { getCompleteStandingsOrder } from "./StandingsTable";

interface Props {
  tournamentId: string;
  tournamentTitle: string;
  tournamentDate: string;
  club: { id: string; name: string; banner_url: string | null; logo_url?: string | null } | null;
  standings: any[];
  matches?: any[];
  enabledTiebreakers?: any;
  playerMap: Map<string, string>;
  avatarMap: Map<string, string | null>;
  canCreateBanner: boolean;
  isRanked?: boolean;
}

type PodiumPlayer = {
  user_id: string;
  name: string;
  avatar: string | null;
  placement: 1 | 2 | 3;
};

export const TournamentPodium = ({
  tournamentId, tournamentTitle, tournamentDate, club,
  standings, matches = [], enabledTiebreakers, playerMap, avatarMap, canCreateBanner, isRanked = true,
}: Props) => {
  const [top3, setTop3] = useState<PodiumPlayer[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [animOpen, setAnimOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ids: string[] = [];

      // Priority 1: use the same complete standings order shown in the final
      // standings tab (placements from top-cut bracket + tiebreakers).
      if (standings && standings.length > 0 && matches && matches.length > 0) {
        try {
          const order = getCompleteStandingsOrder(
            standings as any[],
            matches as any[],
            enabledTiebreakers ?? undefined,
          );
          ids = order
            .filter((uid) => {
              const s = standings.find((x: any) => x.user_id === uid);
              return s && !s.dropped;
            })
            .slice(0, 3);
        } catch {
          ids = [];
        }
      }

      // Fallback to stored tournament_results
      if (ids.length === 0) {
        const { data: results } = await (supabase as any)
          .from("tournament_results")
          .select("user_id, placement")
          .eq("tournament_id", tournamentId)
          .order("placement", { ascending: true })
          .limit(3);
        if (results && results.length > 0) {
          ids = results.map((r: any) => r.user_id);
        }
      }

      // Final fallback: sort standings by points
      if (ids.length === 0) {
        ids = [...standings]
          .filter((s: any) => !s.dropped)
          .sort((a: any, b: any) => b.points - a.points || (b.resistance ?? 0) - (a.resistance ?? 0))
          .slice(0, 3)
          .map((s: any) => s.user_id);
      }

      if (cancelled) return;
      const built: PodiumPlayer[] = ids.slice(0, 3).map((uid, i) => ({
        user_id: uid,
        name: playerMap.get(uid) || "Utente",
        avatar: avatarMap.get(uid) || null,
        placement: (i + 1) as 1 | 2 | 3,
      }));
      setTop3(built);
    })();
    return () => { cancelled = true; };
  }, [tournamentId, standings, matches, enabledTiebreakers, playerMap, avatarMap]);

  const ordered = useMemo(() => {
    // Render order: 2°, 1°, 3°
    const p1 = top3.find(p => p.placement === 1);
    const p2 = top3.find(p => p.placement === 2);
    const p3 = top3.find(p => p.placement === 3);
    return { p1, p2, p3 };
  }, [top3]);

  if (top3.length === 0) return null;

  const Card = ({ player, size }: { player: PodiumPlayer | undefined; size: "lg" | "md" }) => {
    if (!player) return <div className={size === "lg" ? "w-32 sm:w-44" : "w-24 sm:w-32"} />;
    const isChamp = player.placement === 1;
    const icon = isChamp ? <Crown size={size === "lg" ? 28 : 20} className="text-yellow-400" />
      : player.placement === 2 ? <Medal size={20} className="text-zinc-300" />
      : <Medal size={20} className="text-amber-700" />;
    const ringClass = isChamp
      ? "ring-4 ring-yellow-400/60 shadow-[0_0_30px_-2px_rgba(250,204,21,0.55)]"
      : player.placement === 2
      ? "ring-2 ring-zinc-300/60"
      : "ring-2 ring-amber-700/60";
    return (
      <div className={`flex flex-col items-center text-center ${size === "lg" ? "w-32 sm:w-44" : "w-24 sm:w-32"}`}>
        <div className="mb-1">{icon}</div>
        <Avatar className={`${size === "lg" ? "h-20 w-20 sm:h-28 sm:w-28" : "h-14 w-14 sm:h-20 sm:w-20"} ${ringClass}`}>
          <AvatarImage src={player.avatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary"><User size={20} /></AvatarFallback>
        </Avatar>
        <div className={`mt-2 font-display ${size === "lg" ? "text-sm sm:text-base" : "text-xs sm:text-sm"} truncate w-full`}>
          {player.name}
        </div>
        <div className={`text-[10px] uppercase tracking-wider ${isChamp ? "text-yellow-400" : "text-muted-foreground"}`}>
          {player.placement === 1 ? "Campione" : player.placement === 2 ? "2° posto" : "3° posto"}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 rounded-2xl p-4 sm:p-6 space-y-4">
      <h3 className="font-display text-lg flex items-center gap-2">
        <Trophy size={18} className="text-primary" /> Podio del Torneo
      </h3>
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        <Card player={ordered.p2} size="md" />
        <Card player={ordered.p1} size="lg" />
        <Card player={ordered.p3} size="md" />
      </div>
      {canCreateBanner && (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button onClick={() => setEditorOpen(true)} className="gap-2">
            <Paintbrush size={16} /> Crea Banner Top 3
          </Button>
          <Button onClick={() => setAnimOpen(true)} variant="secondary" className="gap-2">
            <Film size={16} /> Crea Animazione
          </Button>
        </div>
      )}
      {editorOpen && (
        <Top3BannerEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          top3={top3}
          tournamentId={tournamentId}
          tournamentTitle={tournamentTitle}
          tournamentDate={tournamentDate}
          club={club}
          isRanked={isRanked}
        />
      )}
      {animOpen && (
        <TournamentAnimationStudio
          open={animOpen}
          onOpenChange={setAnimOpen}
          top3={top3}
          standings={standings}
          playerMap={playerMap}
          avatarMap={avatarMap}
          tournamentId={tournamentId}
          tournamentTitle={tournamentTitle}
          tournamentDate={tournamentDate}
          club={club}
          isRanked={isRanked}
          participantCount={standings.length}
        />
      )}
    </div>
  );
};
