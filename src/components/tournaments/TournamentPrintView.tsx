import { forwardRef } from "react";
import { TopCutBracket } from "./TopCutBracket";

interface Match {
  id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  status: string;
  group_number?: number | null;
  phase?: string;
}

interface Props {
  tournament: {
    title: string;
    event_date: string;
    city: string;
    location: string;
    format: string | null;
    groups_count: number | null;
    status: string;
  };
  swissMatches: Match[];
  u12SwissMatches: Match[];
  topCutMatches: Match[];
  u12TopCutMatches: Match[];
  preTopCutMatches: Match[];
  tiebreakerMatches: Match[];
  playerMap: Map<string, string>;
  avatarMap: Map<string, string | null>;
}

const groupLabel = (n: number) => String.fromCharCode(64 + n);

const PrintMatchCard = ({
  match,
  playerMap,
}: {
  match: Match;
  playerMap: Map<string, string>;
}) => {
  const p1Name = match.player1_id ? playerMap.get(match.player1_id) || "?" : "BYE";
  const p2Name = match.player2_id ? playerMap.get(match.player2_id) || "?" : "BYE";
  const isCompleted = match.status === "completed";
  const p1Winner = isCompleted && match.winner_id === match.player1_id;
  const p2Winner = isCompleted && match.winner_id === match.player2_id;

  return (
    <div style={{
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      overflow: "hidden",
      fontSize: "12px",
      background: "#f9fafb",
    }}>
      <div style={{
        background: "#1a1a2e",
        padding: "3px 8px",
        fontSize: "10px",
        fontWeight: 700,
        color: "#a5b4fc",
        borderBottom: "1px solid #d1d5db",
        letterSpacing: "0.05em",
      }}>
        M{match.match_number}
      </div>
      <div style={{ padding: "6px 8px" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "3px 6px",
          borderRadius: "4px",
          background: p1Winner ? "#d1fae5" : "transparent",
          fontWeight: p1Winner ? 700 : 400,
        }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111" }}>
            {p1Name}
          </span>
          <span style={{ fontWeight: 600, minWidth: "16px", textAlign: "right", fontFamily: "monospace", color: "#111" }}>
            {isCompleted ? match.player1_score : "–"}
          </span>
        </div>
        <div style={{ textAlign: "center", fontSize: "9px", fontWeight: 700, color: "#9ca3af", padding: "1px 0" }}>VS</div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "3px 6px",
          borderRadius: "4px",
          background: p2Winner ? "#d1fae5" : "transparent",
          fontWeight: p2Winner ? 700 : 400,
        }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111" }}>
            {p2Name}
          </span>
          <span style={{ fontWeight: 600, minWidth: "16px", textAlign: "right", fontFamily: "monospace", color: "#111" }}>
            {isCompleted ? match.player2_score : "–"}
          </span>
        </div>
      </div>
    </div>
  );
};

export const TournamentPrintView = forwardRef<HTMLDivElement, Props>(
  ({ tournament, swissMatches, u12SwissMatches, topCutMatches, u12TopCutMatches, preTopCutMatches, tiebreakerMatches, playerMap, avatarMap }, ref) => {
    const hasSwiss = swissMatches.length > 0 || u12SwissMatches.length > 0;
    const hasTopCut = topCutMatches.length > 0 || u12TopCutMatches.length > 0;
    const hasElimination = tournament.format === "single_elimination";

    const groupNumbers = (tournament.groups_count ?? 0) > 0
      ? Array.from({ length: tournament.groups_count! }, (_, i) => i + 1)
      : [0];

    const swissRounds = [...new Set(swissMatches.map(m => m.round))].sort((a, b) => a - b);
    const u12Rounds = [...new Set(u12SwissMatches.map(m => m.round))].sort((a, b) => a - b);

    return (
      <div ref={ref} style={{ background: "#ffffff", color: "#111", fontFamily: "'Inter', sans-serif", padding: "24px" }}>
        {/* Header */}
        <div style={{
          textAlign: "center",
          borderBottom: "3px solid #1a1a2e",
          paddingBottom: "12px",
          marginBottom: "20px",
        }}>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "32px",
            letterSpacing: "0.06em",
            color: "#1a1a2e",
            margin: 0,
          }}>
            {tournament.title}
          </h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            📍 {tournament.city} • {tournament.location} • {new Date(tournament.event_date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Swiss rounds */}
        {hasSwiss && !hasElimination && (
          <>
            {groupNumbers.map(groupNum => {
              const groupMatches = groupNum === 0
                ? swissMatches
                : swissMatches.filter(m => m.group_number === groupNum);
              if (groupMatches.length === 0) return null;

              return (
                <div key={`group-${groupNum}`} style={{ marginBottom: "20px" }}>
                  <h2 style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "20px",
                    letterSpacing: "0.05em",
                    borderBottom: "2px solid #e5e7eb",
                    paddingBottom: "4px",
                    marginBottom: "12px",
                    color: "#1a1a2e",
                  }}>
                    {groupNum > 0 ? `Gruppo ${groupLabel(groupNum)}` : "Fase Swiss"}
                  </h2>
                  {swissRounds.map(round => {
                    const roundMatches = groupMatches.filter(m => m.round === round);
                    if (roundMatches.length === 0) return null;
                    return (
                      <div key={`r-${round}`} style={{ marginBottom: "14px" }}>
                        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>
                          Turno {round}
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                          {roundMatches.map(match => (
                            <PrintMatchCard key={match.id} match={match} playerMap={playerMap} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* U12 Swiss */}
            {u12SwissMatches.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px", marginBottom: "12px", color: "#1a1a2e" }}>
                  🧒 Gruppo Kids
                </h2>
                {u12Rounds.map(round => {
                  const roundMatches = u12SwissMatches.filter(m => m.round === round);
                  return (
                    <div key={`u12-r-${round}`} style={{ marginBottom: "14px" }}>
                      <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>Turno {round}</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                        {roundMatches.map(match => (
                          <PrintMatchCard key={match.id} match={match} playerMap={playerMap} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Pre-Top Cut */}
        {preTopCutMatches.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px", marginBottom: "12px", color: "#1a1a2e" }}>
              ⚔️ Spareggi di Qualificazione
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {preTopCutMatches.map(match => (
                <PrintMatchCard key={match.id} match={match} playerMap={playerMap} />
              ))}
            </div>
          </div>
        )}

        {/* Top Cut / Single Elimination */}
        {(hasTopCut || hasElimination) && topCutMatches.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px", marginBottom: "12px", color: "#1a1a2e" }}>
              🏆 {hasElimination ? "Tabellone" : "Top Cut"}
            </h2>
            <TopCutBracket
              matches={topCutMatches}
              playerMap={playerMap}
              avatarMap={avatarMap}
              onResult={() => {}}
              isStaff={false}
            />
          </div>
        )}

        {/* Tiebreakers */}
        {tiebreakerMatches.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px", marginBottom: "12px", color: "#1a1a2e" }}>
              Spareggi
            </h2>
            <TopCutBracket
              matches={tiebreakerMatches}
              playerMap={playerMap}
              avatarMap={avatarMap}
              onResult={() => {}}
              isStaff={false}
              isTiebreaker={true}
            />
          </div>
        )}

        {/* U12 Top Cut */}
        {u12TopCutMatches.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px", marginBottom: "12px", color: "#1a1a2e" }}>
              🧒 Top Cut Kids
            </h2>
            <TopCutBracket
              matches={u12TopCutMatches}
              playerMap={playerMap}
              avatarMap={avatarMap}
              onResult={() => {}}
              isStaff={false}
            />
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", borderTop: "2px solid #e5e7eb", paddingTop: "8px", marginTop: "16px" }}>
          <p style={{ fontSize: "10px", color: "#9ca3af" }}>
            Esportato da FIBeGS • {new Date().toLocaleDateString("it-IT")}
          </p>
        </div>
      </div>
    );
  }
);

TournamentPrintView.displayName = "TournamentPrintView";
