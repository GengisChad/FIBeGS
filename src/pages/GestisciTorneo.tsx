import { useState, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  ArrowLeft,
  Check,
  X,
  Euro,
  UserCheck,
  Gavel,
  Crown,
  ShieldCheck,
  Edit3,
  Megaphone,
  Wrench,
} from "lucide-react";

// ============================================================================
// Tipi (solo mock locali — nessuna interazione con il DB)
// ============================================================================
type Status = "pending" | "confirmed";

interface Participant {
  id: string;
  nick: string;
  club: string;
  city: string;
  seed: number;
  status: Status;
  paid: boolean;
  present: boolean;
  referee: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  refBy?: string;
  refAt?: string;
}

interface LogEntry {
  at: string;
  actor: string;
  role: "Creatore" | "Arbitro";
  text: string;
  ref?: boolean;
}

const ME = { nick: "AdminRoma", role: "Creatore" as const };

const INITIAL: Participant[] = [
  { id: "p1", nick: "GHOST__23", club: "Roma Burst",  city: "Roma",    seed: 1, status: "confirmed", paid: true,  present: true,  referee: false, confirmedBy: "AdminRoma", confirmedAt: "10:02" },
  { id: "p2", nick: "Drago_X",   club: "Milano Spin", city: "Milano",  seed: 2, status: "confirmed", paid: true,  present: false, referee: false, confirmedBy: "AdminRoma", confirmedAt: "10:03" },
  { id: "p3", nick: "NovaBlade", club: "Torino TK",   city: "Torino",  seed: 3, status: "pending",   paid: false, present: false, referee: false },
  { id: "p4", nick: "PhantomZ",  club: "Napoli Storm",city: "Napoli",  seed: 4, status: "confirmed", paid: false, present: true,  referee: false, confirmedBy: "AdminRoma", confirmedAt: "10:05" },
  { id: "p5", nick: "Kaisen",    club: "Bologna BB",  city: "Bologna", seed: 5, status: "pending",   paid: false, present: false, referee: false },
];

const now = () =>
  new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

// ============================================================================
// Pagina
// ============================================================================
export default function GestisciTorneo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isStaff, roles } = useUserRoles();
  const [list, setList] = useState<Participant[]>(INITIAL);
  const [log, setLog] = useState<LogEntry[]>([
    { at: "10:00", actor: ME.nick, role: "Creatore", text: "Apertura check-in torneo" },
  ]);

  /* Route guard: solo admin, moderator o staff —
     il check “creator” non è applicabile in preview/mock senza dati DB */
  if (!user) return <Navigate to="/auth" replace />;
  const canAccess = isAdmin || isStaff || roles.includes("moderator");
  if (!canAccess) {
    return (
      <div className="ibnf-root min-h-screen flex items-center justify-center px-4" style={{ background: "#06080a" }}>
        <div className="text-center space-y-5 max-w-md">
          <div
            className="mx-auto w-14 h-14 flex items-center justify-center"
            style={{
              background: "rgba(239,68,68,.12)",
              border: "1px solid rgba(239,68,68,.4)",
              clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
            }}
          >
            <ShieldCheck size={28} style={{ color: "#fca5a5" }} />
          </div>
          <h2
            className="uppercase italic"
            style={{
              fontFamily: "var(--ibnf-font-display)",
              fontSize: "22px",
              letterSpacing: ".06em",
              color: "#e5e7eb",
            }}
          >
            Accesso negato
          </h2>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Questo pannello è riservato a <strong style={{ color: "#e5e7eb" }}>creator</strong>,{" "}
            <strong style={{ color: "#e5e7eb" }}>admin</strong> e <strong style={{ color: "#e5e7eb" }}>moderator</strong>.
          </p>
          <ActBtn tone="ghost" onClick={() => navigate("/tournaments")}>
            Torna ai tornei
          </ActBtn>
        </div>
      </div>
    );
  }

  const pushLog = (text: string, role: LogEntry["role"] = "Creatore", ref = false) =>
    setLog((l) => [{ at: now(), actor: ME.nick, role, text, ref }, ...l]);

  const update = (id: string, patch: Partial<Participant>) =>
    setList((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // Azioni ------------------------------------------------------------------
  const accept = (p: Participant) => {
    update(p.id, { status: "confirmed", confirmedBy: ME.nick, confirmedAt: now() });
    pushLog(`Iscrizione di @${p.nick} accettata`);
  };
  const reject = (p: Participant) => {
    setList((arr) => arr.filter((x) => x.id !== p.id));
    pushLog(`Iscrizione di @${p.nick} rifiutata`);
  };
  const togglePaid = (p: Participant) => {
    update(p.id, { paid: !p.paid });
    pushLog(`@${p.nick} ${!p.paid ? "ha pagato" : "segnato come non pagato"}`);
  };
  const togglePresent = (p: Participant) => {
    update(p.id, { present: !p.present });
    pushLog(`@${p.nick} ${!p.present ? "presente (check-in)" : "rimosso check-in"}`);
  };
  const makeReferee = (p: Participant) => {
    update(p.id, { referee: true, refBy: ME.nick, refAt: now() });
    pushLog(`@${p.nick} nominato Arbitro Volante`);
  };
  const revokeReferee = (p: Participant) => {
    update(p.id, { referee: false, refBy: undefined, refAt: undefined });
    pushLog(`Arbitro Volante revocato a @${p.nick}`);
  };

  // Azioni "Console arbitro" — registrate come firma dell'arbitro
  const refAction = (p: Participant, text: string) => {
    setLog((l) => [
      { at: now(), actor: p.nick, role: "Arbitro", text, ref: true },
      ...l,
    ]);
  };

  const refs = useMemo(() => list.filter((p) => p.referee), [list]);

  return (
    <div className="ibnf-root min-h-screen" style={{ background: "#06080a" }}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header ----------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm uppercase tracking-wider"
            style={{ color: "#9ca3af", fontFamily: "var(--ibnf-font-display)", fontStyle: "italic" }}
          >
            <ArrowLeft size={16} /> Indietro
          </button>
          <span
            className="px-3 py-1.5 text-xs uppercase tracking-wider"
            style={{
              background: "rgba(177,77,255,.12)",
              color: "#d8b3ff",
              border: "1px solid rgba(177,77,255,.4)",
              clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
              fontFamily: "var(--ibnf-font-display)",
              fontStyle: "italic",
              letterSpacing: ".1em",
            }}
          >
            @{ME.nick} · {ME.role}
          </span>
        </div>

        <div>
          <h1
            className="uppercase italic"
            style={{
              fontFamily: "var(--ibnf-font-display)",
              fontSize: "28px",
              letterSpacing: ".06em",
              color: "#e5e7eb",
            }}
          >
            Gestione torneo — Check-in & Arbitri
          </h1>
          <p className="text-xs mt-1" style={{ color: "#6b7280" }}>
            Modalità preview · dati mock locali · nessuna scrittura sul database
          </p>
        </div>

        {/* Lista partecipanti ----------------------------------------------- */}
        <Card title="Partecipanti">
          <div className="space-y-2">
            {list.map((p) => (
              <Row
                key={p.id}
                p={p}
                onAccept={() => accept(p)}
                onReject={() => reject(p)}
                onPaid={() => togglePaid(p)}
                onPresent={() => togglePresent(p)}
                onMakeRef={() => makeReferee(p)}
                onRevokeRef={() => revokeReferee(p)}
                onRefAction={(t) => refAction(p, t)}
              />
            ))}
          </div>
        </Card>

        {/* Arbitri attivi --------------------------------------------------- */}
        {refs.length > 0 && (
          <Card title="Arbitri volanti attivi" violet>
            <div className="flex flex-wrap gap-2">
              {refs.map((r) => (
                <span
                  key={r.id}
                  className="px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2"
                  style={{
                    background: "rgba(177,77,255,.15)",
                    color: "#e2c9ff",
                    border: "1px solid rgba(177,77,255,.5)",
                    clipPath:
                      "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
                    boxShadow: "0 0 14px -3px rgba(177,77,255,.7)",
                    fontFamily: "var(--ibnf-font-display)",
                    fontStyle: "italic",
                  }}
                >
                  <Gavel size={12} /> @{r.nick}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Log -------------------------------------------------------------- */}
        <Card title="Log attività">
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {log.map((e, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-sm py-1.5 px-2"
                style={{
                  borderLeft: `2px solid ${e.ref ? "#b14dff" : "#5bf23c"}`,
                  background: e.ref ? "rgba(177,77,255,.06)" : "rgba(91,242,60,.04)",
                  color: e.ref ? "#e2c9ff" : "#d8f5cf",
                }}
              >
                <span
                  className="text-xs tabular-nums pt-0.5"
                  style={{ color: "#6b7280", minWidth: 38 }}
                >
                  {e.at}
                </span>
                <span className="flex-1">
                  {e.ref && <span className="mr-1">⚖</span>}
                  <strong style={{ color: e.ref ? "#d8b3ff" : "#a8e89a" }}>
                    @{e.actor}
                  </strong>{" "}
                  {e.text}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================
function Card({
  title,
  children,
  violet = false,
}: {
  title: string;
  children: React.ReactNode;
  violet?: boolean;
}) {
  return (
    <section
      className="relative p-4 md:p-5"
      style={{
        background: "linear-gradient(135deg,#131d21 0%,#0f1619 100%)",
        border: `1px solid ${violet ? "rgba(177,77,255,.35)" : "rgba(91,242,60,.18)"}`,
        clipPath:
          "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)",
        boxShadow: violet
          ? "0 0 24px -8px rgba(177,77,255,.4)"
          : "0 0 18px -10px rgba(91,242,60,.25)",
      }}
    >
      <h2
        className="uppercase italic mb-3"
        style={{
          fontFamily: "var(--ibnf-font-display)",
          fontSize: "15px",
          letterSpacing: ".1em",
          color: violet ? "#d8b3ff" : "#a8e89a",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "cyan" | "green" | "violet";
}) {
  const styles = {
    cyan: {
      bg: "rgba(34,211,238,.12)",
      bd: "rgba(34,211,238,.45)",
      fg: "#a5f3fc",
      glow: "0 0 10px -3px rgba(34,211,238,.5)",
    },
    green: {
      bg: "rgba(91,242,60,.14)",
      bd: "rgba(91,242,60,.5)",
      fg: "#bff5a3",
      glow: "0 0 10px -3px rgba(91,242,60,.55)",
    },
    violet: {
      bg: "rgba(177,77,255,.15)",
      bd: "rgba(177,77,255,.5)",
      fg: "#e2c9ff",
      glow: "0 0 12px -3px rgba(177,77,255,.6)",
    },
  }[tone];
  return (
    <span
      className="px-2 py-0.5 text-[10px] uppercase tracking-wider inline-flex items-center gap-1"
      style={{
        background: styles.bg,
        color: styles.fg,
        border: `1px solid ${styles.bd}`,
        clipPath:
          "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
        boxShadow: styles.glow,
        fontFamily: "var(--ibnf-font-display)",
        fontStyle: "italic",
        letterSpacing: ".08em",
      }}
    >
      {children}
    </span>
  );
}

function ActBtn({
  children,
  onClick,
  tone,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone: "green" | "violet" | "red" | "ghost";
  disabled?: boolean;
  title?: string;
}) {
  const palette = {
    green:  { bg: "#5bf23c", fg: "#06140a", glow: "rgba(91,242,60,.55)" },
    violet: { bg: "#b14dff", fg: "#13041f", glow: "rgba(177,77,255,.65)" },
    red:    { bg: "rgba(239,68,68,.15)", fg: "#fca5a5", glow: "rgba(239,68,68,.4)" },
    ghost:  { bg: "rgba(255,255,255,.06)", fg: "#cbd5e1", glow: "rgba(148,163,184,.25)" },
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2.5 py-1 text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 transition-all"
      style={{
        background: palette.bg,
        color: palette.fg,
        border: tone === "red" || tone === "ghost" ? `1px solid ${palette.glow}` : "none",
        clipPath:
          "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
        boxShadow: disabled ? "none" : `0 0 12px -3px ${palette.glow}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--ibnf-font-display)",
        fontStyle: "italic",
        letterSpacing: ".08em",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 transition-all"
      style={{
        background: active ? "rgba(91,242,60,.18)" : "rgba(255,255,255,.04)",
        color: active ? "#bff5a3" : "#94a3b8",
        border: `1px solid ${active ? "rgba(91,242,60,.55)" : "rgba(148,163,184,.25)"}`,
        clipPath:
          "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
        boxShadow: active ? "0 0 10px -3px rgba(91,242,60,.5)" : "none",
        fontFamily: "var(--ibnf-font-display)",
        fontStyle: "italic",
        letterSpacing: ".08em",
      }}
    >
      {icon} {label}
    </button>
  );
}

function Row({
  p,
  onAccept,
  onReject,
  onPaid,
  onPresent,
  onMakeRef,
  onRevokeRef,
  onRefAction,
}: {
  p: Participant;
  onAccept: () => void;
  onReject: () => void;
  onPaid: () => void;
  onPresent: () => void;
  onMakeRef: () => void;
  onRevokeRef: () => void;
  onRefAction: (text: string) => void;
}) {
  const canRef = p.status === "confirmed" && p.present;
  return (
    <div
      className="p-3 md:p-4"
      style={{
        background: p.referee
          ? "linear-gradient(135deg,rgba(177,77,255,.10),rgba(15,22,25,.6))"
          : "linear-gradient(135deg,rgba(255,255,255,.02),rgba(15,22,25,.6))",
        border: `1px solid ${p.referee ? "rgba(177,77,255,.45)" : "rgba(255,255,255,.06)"}`,
        clipPath:
          "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
        boxShadow: p.referee ? "0 0 18px -6px rgba(177,77,255,.5)" : "none",
      }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        {/* Seed */}
        <span
          className="w-7 h-7 flex items-center justify-center text-xs tabular-nums"
          style={{
            background: "rgba(91,242,60,.10)",
            color: "#a8e89a",
            border: "1px solid rgba(91,242,60,.3)",
            fontFamily: "var(--ibnf-font-display)",
            fontStyle: "italic",
          }}
        >
          {p.seed}
        </span>
        {/* Avatar */}
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
          style={{
            background: p.referee ? "#b14dff" : "#1f2a30",
            color: p.referee ? "#13041f" : "#cbd5e1",
          }}
        >
          {p.nick[0]}
        </span>
        {/* Nick + club */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-sm truncate"
              style={{
                color: "#e5e7eb",
                fontFamily: "var(--ibnf-font-display)",
                fontStyle: "italic",
                letterSpacing: ".04em",
              }}
            >
              @{p.nick}
            </span>
            <ShieldCheck size={12} style={{ color: "#5bf23c" }} />
            {p.referee && (
              <span
                className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider inline-flex items-center gap-1"
                style={{
                  background: "#b14dff",
                  color: "#13041f",
                  clipPath:
                    "polygon(3px 0,100% 0,100% calc(100% - 3px),calc(100% - 3px) 100%,0 100%,0 3px)",
                  boxShadow: "0 0 12px -2px rgba(177,77,255,.8)",
                  fontFamily: "var(--ibnf-font-display)",
                  fontStyle: "italic",
                }}
              >
                <Crown size={9} /> Arbitro Volante
              </span>
            )}
          </div>
          <span className="text-[11px]" style={{ color: "#6b7280" }}>
            {p.club} · {p.city}
          </span>
        </div>

        {/* Stato */}
        {p.status === "pending" ? (
          <Chip tone="cyan">In attesa</Chip>
        ) : (
          <Chip tone="green">Confermato</Chip>
        )}
      </div>

      {/* Azioni */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {p.status === "pending" ? (
          <>
            <ActBtn tone="green" onClick={onAccept}>
              <Check size={12} /> Accetta
            </ActBtn>
            <ActBtn tone="red" onClick={onReject}>
              <X size={12} /> Rifiuta
            </ActBtn>
          </>
        ) : (
          <>
            <Toggle active={p.paid} onClick={onPaid} icon={<Euro size={11} />} label="Pagato" />
            <Toggle
              active={p.present}
              onClick={onPresent}
              icon={<UserCheck size={11} />}
              label="Presente"
            />
            {!p.referee ? (
              <ActBtn
                tone="violet"
                onClick={onMakeRef}
                disabled={!canRef}
                title={!canRef ? "Il giocatore deve essere confermato e presente" : undefined}
              >
                <Gavel size={12} /> Rendi arbitro
              </ActBtn>
            ) : (
              <ActBtn tone="ghost" onClick={onRevokeRef}>
                <X size={12} /> Revoca arbitro
              </ActBtn>
            )}
          </>
        )}
      </div>

      {/* Firme inline */}
      {(p.confirmedBy || p.refBy) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: "#6b7280" }}>
          {p.confirmedBy && (
            <span>
              Confermato da{" "}
              <strong style={{ color: "#a8e89a" }}>@{p.confirmedBy}</strong> · {p.confirmedAt}
            </span>
          )}
          {p.refBy && (
            <span>
              Arbitro nominato da{" "}
              <strong style={{ color: "#d8b3ff" }}>@{p.refBy}</strong> · {p.refAt}
            </span>
          )}
        </div>
      )}

      {/* Console arbitro */}
      {p.referee && (
        <div
          className="mt-3 p-3"
          style={{
            background: "rgba(177,77,255,.06)",
            border: "1px dashed rgba(177,77,255,.4)",
            clipPath:
              "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{
              color: "#d8b3ff",
              fontFamily: "var(--ibnf-font-display)",
              fontStyle: "italic",
              letterSpacing: ".12em",
            }}
          >
            Console arbitro · @{p.nick}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ActBtn
              tone="violet"
              onClick={() => onRefAction("ha modificato il risultato · Tavolo 3 → 3–1")}
            >
              <Edit3 size={11} /> Modifica risultato
            </ActBtn>
            <ActBtn tone="violet" onClick={() => onRefAction("ha chiamato il Tavolo 5")}>
              <Megaphone size={11} /> Chiama tavolo
            </ActBtn>
            <ActBtn
              tone="violet"
              onClick={() => onRefAction("ha corretto un errore di scoring · Tavolo 2")}
            >
              <Wrench size={11} /> Correggi errore
            </ActBtn>
          </div>
        </div>
      )}
    </div>
  );
}
