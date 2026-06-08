import { useState } from "react";
import { Settings, Sliders, Wrench, Euro, ScrollText, Shield, AlertTriangle, BookOpen, Baby, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TournamentBracketManager } from "@/components/tournaments/TournamentBracketManager";
import TournamentRulesEditor from "@/components/tournaments/TournamentRulesEditor";
import { TournamentRefereesManager } from "@/components/tournaments/TournamentRefereesManager";
import { TournamentActionLog } from "@/components/tournaments/TournamentActionLog";

type SectionId =
  | "general"
  | "format"
  | "kids"
  | "tiebreakers"
  | "payment"
  | "rules"
  | "referees"
  | "log"
  | "danger";


interface SectionItem {
  id: SectionId;
  label: string;
  icon: LucideIcon;
}

interface Props {
  tournament: any;
  bracketPlayers: any[];
  confirmedRegs: any[];
  publicMatches: any[];
  publicStandings: any[];
  canManage: boolean;
  fetchTournament: () => void;
  handleDeleteTournament: () => void;
  handleHardDeleteTournament: () => void;
  handleConvertToNewTournament: () => void;
}

export const TournamentAdminSections = ({
  tournament,
  bracketPlayers,
  confirmedRegs,
  publicMatches,
  publicStandings,
  canManage,
  fetchTournament,
  handleDeleteTournament,
  handleHardDeleteTournament,
  handleConvertToNewTournament,
}: Props) => {
  const showRules = tournament.is_ranked === false;

  const sections: SectionItem[] = [
    { id: "general", label: "Informazioni Generali", icon: Settings },
    { id: "format", label: "Formato e Struttura", icon: Sliders },
    { id: "kids", label: "Kids", icon: Baby },
    { id: "tiebreakers", label: "Tiebreakers", icon: Wrench },
    { id: "payment", label: "Iscrizione e Pagamento", icon: Euro },
    ...(showRules ? [{ id: "rules" as SectionId, label: "Regole Custom", icon: BookOpen }] : []),
    { id: "referees", label: "Arbitri e Scoring", icon: Shield },
    { id: "log", label: "Log Azioni", icon: ScrollText },
    { id: "danger", label: "Zona Pericolosa", icon: AlertTriangle },
  ];


  const [active, setActive] = useState<SectionId>("general");

  const bracketProps = {
    tournamentId: tournament.id,
    format: tournament.format,
    swissRounds: tournament.swiss_rounds,
    topCutSize: tournament.top_cut_size,
    status: tournament.status,
    players: bracketPlayers,
    maxParticipants: tournament.max_participants,
    isRanked: (tournament as any).is_ranked !== false,
    checkInEnabled: tournament.check_in_enabled,
    hasWaitlist: (tournament as any).has_waitlist !== false,
    registrations: confirmedRegs,
    tiebreakerDepth: (tournament as any).tiebreaker_depth ?? 0,
    tiebreakerMode: (tournament as any).tiebreaker_mode ?? "advanced",
    groupsCount: tournament.groups_count ?? 0,
    under12Enabled: (tournament as any).under12_enabled ?? false,
    under12SeparateTopcut: (tournament as any).under12_separate_topcut ?? false,
    u12SwissRounds: (tournament as any).u12_swiss_rounds ?? null,
    tableAssignmentEnabled: (tournament as any).table_assignment_enabled ?? false,
    matchesPerTable: (tournament as any).matches_per_table ?? 1,
    scoringPolicy: (tournament as any).scoring_policy ?? "staff_only",
    customSwissWinPoints: (tournament as any).custom_swiss_win_points ?? null,
    customTopWinPoints: (tournament as any).custom_top_win_points ?? null,
    enabledTiebreakers: (tournament as any).enabled_tiebreakers ?? null,
    initialMatches: publicMatches,
    initialStandings: publicStandings,
    tournamentDetails: {
      title: tournament.title,
      description: tournament.description,
      location: tournament.location,
      city: tournament.city,
      event_date: tournament.event_date,
      registration_deadline: tournament.registration_deadline,
      registration_opens_at: tournament.registration_opens_at,
      entry_fee: tournament.entry_fee,
      prize_description: tournament.prize_description,
      payment_method: (tournament as any).payment_method ?? null,
      payment_link: (tournament as any).payment_link ?? null,
      swiss_rounds: tournament.swiss_rounds,
    },
    onStatusChange: fetchTournament,
    onDeleteTournament: handleDeleteTournament,
    onHardDeleteTournament: handleHardDeleteTournament,
    onConvertToNewTournament: handleConvertToNewTournament,
    isCancelled: !tournament.is_active,
    renderMode: "settings" as const,
  };

  const isBracketSection = (id: SectionId) =>
    id === "general" || id === "format" || id === "kids" || id === "tiebreakers" || id === "payment" || id === "danger";

  const renderContent = () => {
    if (isBracketSection(active)) {
      return (
        <div className="bg-card rounded-2xl border border-border p-3 sm:p-6">
          <TournamentBracketManager {...bracketProps} settingsSection={active as any} />
        </div>
      );
    }
    if (active === "rules") {
      return (
        <TournamentRulesEditor
          tournamentId={tournament.id}
          initialCustomRules={(tournament as any).custom_rules ?? null}
          initialBanlist={(tournament as any).banlist ?? "all"}
          initialSwissWinPoints={(tournament as any).custom_swiss_win_points ?? null}
          initialTopWinPoints={(tournament as any).custom_top_win_points ?? null}
          onSaved={fetchTournament}
        />
      );
    }
    if (active === "referees") {
      return (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-3 sm:p-6">
            <TournamentBracketManager {...bracketProps} settingsSection={"scoring" as any} />
          </div>
          <div className="bg-card rounded-2xl border border-border p-3 sm:p-6">
            <TournamentRefereesManager
              tournamentId={tournament.id}
              clubId={tournament.club_id ?? null}
              canManage={canManage}
            />
          </div>
        </div>
      );
    }

    if (active === "log") {
      return <TournamentActionLog tournamentId={tournament.id} />;
    }
    return null;
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Mobile: horizontal scroll tabs */}
      <div className="md:hidden -mx-3 px-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1 min-w-max">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === active;
            const isDanger = s.id === "danger";
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap border transition-colors shrink-0",
                  isActive
                    ? isDanger
                      ? "bg-destructive text-destructive-foreground border-destructive"
                      : "bg-primary text-primary-foreground border-primary"
                    : isDanger
                      ? "bg-card text-destructive border-destructive/30 hover:bg-destructive/10"
                      : "bg-card text-foreground border-border hover:bg-muted",
                )}
              >
                <Icon size={14} className="shrink-0" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop: sidebar */}
      <aside className="hidden md:block md:w-60 lg:w-64 shrink-0">
        <nav className="bg-card rounded-2xl border border-border p-2 sticky top-24 space-y-1">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === active;
            const isDanger = s.id === "danger";
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors",
                  isActive
                    ? isDanger
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                    : isDanger
                      ? "text-destructive/80 hover:bg-destructive/5"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">{renderContent()}</div>
    </div>
  );
};

export default TournamentAdminSections;
