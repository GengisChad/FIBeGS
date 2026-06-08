import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Calendar, Trophy, Gamepad2, Sparkles, Users, Check, Trash2, Clock, Hourglass, Star, Swords } from "lucide-react";
import { format, differenceInDays, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Tournament {
  id: string;
  title: string;
  event_date: string;
  event_end_date?: string | null;
  city: string;
  location?: string | null;
  registration_deadline?: string | null;
  is_active: boolean;
  event_type?: string | null;
  max_participants?: number | null;
  virtual?: boolean;
  is_ranked?: boolean | null;
}

interface Props {
  tournaments: Tournament[];
  mode?: "upcoming" | "past";
  canManage?: boolean;
  onDeleted?: () => void;
}

const ClubTournamentsCalendar = ({ tournaments, mode = "upcoming", canManage = false, onDeleted }: Props) => {
  const today = new Date();
  const { user } = useAuth();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [stickyMonth, setStickyMonth] = useState<string>("");
  const [tournamentCounts, setTournamentCounts] = useState<Record<string, number>>({});
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [myParticipations, setMyParticipations] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return tournaments.filter((t) => {
      const d = new Date(t.event_date);
      const isPast = d < startOfToday && !isSameDay(d, today);
      return mode === "past" ? isPast : !isPast;
    });
  }, [tournaments, mode]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const ta = new Date(a.event_date).getTime();
        const tb = new Date(b.event_date).getTime();
        return mode === "past" ? tb - ta : ta - tb;
      }),
    [filtered, mode],
  );

  const getEventType = (t: Tournament): "tournament" | "event" | "free_play" => {
    const et = t.event_type || "tournament";
    if (et === "event") return "event";
    if (et === "free_play") return "free_play";
    return "tournament";
  };

  // Fetch registration counts for tournaments and event participations for free_play/event
  useEffect(() => {
    if (sorted.length === 0) return;
    const tournamentIds = sorted.filter((t) => getEventType(t) === "tournament" && !t.virtual).map((t) => t.id);
    const eventIds = sorted.filter((t) => getEventType(t) !== "tournament" && !t.virtual).map((t) => t.id);

    if (tournamentIds.length > 0) {
      supabase
        .rpc("get_tournament_registration_counts", { _tournament_ids: tournamentIds } as any)
        .then(({ data }) => {
          const counts: Record<string, number> = {};
          ((data as any[]) ?? []).forEach((r: any) => { counts[r.tournament_id] = Number(r.reg_count); });
          setTournamentCounts(counts);
        });
    }

    if (eventIds.length > 0) {
      (supabase as any)
        .from("event_participants")
        .select("tournament_id, user_id")
        .in("tournament_id", eventIds)
        .then(({ data }: any) => {
          const counts: Record<string, number> = {};
          const mine = new Set<string>();
          ((data as any[]) ?? []).forEach((r: any) => {
            counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1;
            if (user && r.user_id === user.id) mine.add(r.tournament_id);
          });
          setEventCounts(counts);
          setMyParticipations(mine);
        });
    }
  }, [sorted, user]);

  // Set initial sticky month
  useEffect(() => {
    if (sorted.length > 0) {
      setStickyMonth(format(new Date(sorted[0].event_date), "MMMM yyyy", { locale: it }));
    }
  }, [sorted]);

  // Update sticky month based on scroll position
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const handler = () => {
      const cards = el.querySelectorAll<HTMLElement>("[data-tournament-card]");
      const scrollerRect = el.getBoundingClientRect();
      const threshold = scrollerRect.left + 24;
      let currentMonth = "";
      for (const c of Array.from(cards)) {
        const r = c.getBoundingClientRect();
        if (r.right >= threshold) {
          currentMonth = c.dataset.month || "";
          break;
        }
      }
      if (currentMonth) setStickyMonth(currentMonth);
    };
    el.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => el.removeEventListener("scroll", handler);
  }, [sorted]);

  const getUrgency = (eventDate: Date) => {
    const diff = Math.abs(differenceInDays(eventDate, today));
    if (mode === "past") {
      if (diff <= 7) return "past-near";
      if (diff <= 30) return "past-mid";
      if (diff <= 90) return "past-far";
      return "past-distant";
    }
    if (diff <= 3) return "imminent";
    if (diff <= 7) return "soon";
    if (diff <= 14) return "near";
    if (diff <= 30) return "far";
    return "distant";
  };

  const cardStyles: Record<string, string> = {
    imminent: "border-primary/60 bg-gradient-to-br from-primary/15 to-primary/5 shadow-md shadow-primary/10",
    soon: "border-primary/40 bg-primary/5",
    near: "border-primary/20 bg-card opacity-90",
    far: "border-border bg-card opacity-70",
    distant: "border-border bg-card opacity-45",
    "past-near": "border-border bg-card opacity-90",
    "past-mid": "border-border bg-card opacity-70",
    "past-far": "border-border bg-card opacity-55",
    "past-distant": "border-border bg-card opacity-40",
  };

  const dateBadge: Record<string, string> = {
    imminent: "bg-primary text-primary-foreground",
    soon: "bg-primary/80 text-primary-foreground",
    near: "bg-primary/15 text-primary",
    far: "bg-secondary text-foreground",
    distant: "bg-muted text-muted-foreground",
    "past-near": "bg-secondary text-foreground",
    "past-mid": "bg-secondary text-foreground",
    "past-far": "bg-muted text-muted-foreground",
    "past-distant": "bg-muted text-muted-foreground",
  };

  const toggleParticipation = async (tournamentId: string) => {
    if (!user) {
      toast.error("Devi accedere per partecipare");
      return;
    }
    if (togglingIds.has(tournamentId)) return;
    setTogglingIds((prev) => new Set(prev).add(tournamentId));
    const isParticipating = myParticipations.has(tournamentId);
    try {
      if (isParticipating) {
        const { error } = await (supabase as any)
          .from("event_participants")
          .delete()
          .eq("tournament_id", tournamentId)
          .eq("user_id", user.id);
        if (error) throw error;
        setMyParticipations((prev) => {
          const next = new Set(prev);
          next.delete(tournamentId);
          return next;
        });
        setEventCounts((prev) => ({ ...prev, [tournamentId]: Math.max(0, (prev[tournamentId] || 1) - 1) }));
      } else {
        const { error } = await (supabase as any)
          .from("event_participants")
          .insert({ tournament_id: tournamentId, user_id: user.id });
        if (error) throw error;
        setMyParticipations((prev) => new Set(prev).add(tournamentId));
        setEventCounts((prev) => ({ ...prev, [tournamentId]: (prev[tournamentId] || 0) + 1 }));
      }
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? "operazione fallita"));
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(tournamentId);
        return next;
      });
    }
  };

  const handleDeleteTraining = async (tournamentId: string) => {
    const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId);
    if (error) {
      toast.error("Errore nell'eliminazione: " + error.message);
      return;
    }
    toast.success("Allenamento eliminato");
    onDeleted?.();
  };

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {mode === "upcoming" ? "Nessun evento in programma." : "Nessun evento passato."}
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Sticky month label */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Calendar size={14} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground capitalize">
          {stickyMonth}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Horizontal scroller */}
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {sorted.map((t) => {
          const d = new Date(t.event_date);
          const urgency = getUrgency(d);
          const isToday = isSameDay(d, today);
          const monthLabel = format(d, "MMMM yyyy", { locale: it });
          const eventType = getEventType(t);
          const isRanked = eventType === "tournament" && !!t.is_ranked;

          // Sub-type metadata for visual distinction
          const subType: "ranked" | "normal" | "event" | "training" =
            eventType === "tournament" ? (isRanked ? "ranked" : "normal")
            : eventType === "event" ? "event" : "training";

          const TypeIcon =
            subType === "ranked" ? Star :
            subType === "normal" ? Swords :
            subType === "event" ? Sparkles : Gamepad2;
          const typeLabel =
            subType === "ranked" ? "RANKED" :
            subType === "normal" ? "Torneo" :
            subType === "event" ? "Evento" : "Allenamento";

          const badgeStyle =
            subType === "ranked"
              ? "bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-200 ring-1 ring-amber-400/40"
              : subType === "normal"
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : subType === "event"
                  ? "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30"
                  : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30";

          // Build card content (button or link)
          const cardClass = cn(
            "group relative flex flex-col rounded-xl border p-3 transition-all hover:shadow-lg shrink-0 snap-start overflow-hidden",
            "w-[200px] sm:w-[220px]",
            cardStyles[urgency],
            subType === "ranked" && "ring-1 ring-amber-400/30",
            eventType !== "free_play" && "hover:scale-[1.02]",
          );

          const endDate = t.event_end_date ? new Date(t.event_end_date) : null;
          const isMultiDay = endDate && !isSameDay(endDate, d);
          const regDeadline = t.registration_deadline ? new Date(t.registration_deadline) : null;
          const regClosed = regDeadline ? regDeadline.getTime() < Date.now() : false;
          const showRegDeadline = eventType === "tournament" && regDeadline && mode === "upcoming";

          const headerSection = (
            <>
              {/* Top accent strip per sub-type */}
              <div
                className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  subType === "ranked" && "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500",
                  subType === "normal" && "bg-primary/70",
                  subType === "event" && "bg-fuchsia-500/70",
                  subType === "training" && "bg-emerald-500/70",
                )}
              />
              <div className="flex items-start justify-between gap-1 mb-2">
                <div
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-center",
                    isToday ? "bg-primary text-primary-foreground" : dateBadge[urgency],
                  )}
                >
                  <span className="text-xl font-bold leading-none block">{format(d, "d")}</span>
                  <span className="text-[9px] uppercase leading-none mt-0.5 block capitalize">
                    {format(d, "EEE", { locale: it })}
                  </span>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 inline-flex items-center gap-1 uppercase tracking-wide",
                    badgeStyle,
                  )}
                  title={typeLabel}
                >
                  <TypeIcon size={10} />
                  {typeLabel}
                </span>
              </div>

              <h4
                className={cn(
                  "text-sm font-semibold leading-snug line-clamp-2 flex-1",
                  !t.is_active && mode === "past" && "line-through",
                )}
              >
                {t.title}
              </h4>

              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-border/50">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title={t.location || t.city}>
                  <MapPin size={10} className="shrink-0" />
                  <span className="truncate">{t.location || t.city}</span>
                </span>
                {t.location && (
                  <span className="text-[10px] text-muted-foreground/70 truncate pl-3.5">{t.city}</span>
                )}
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock size={10} className="shrink-0" />
                  <span className="truncate">
                    {isMultiDay
                      ? `${format(d, "d MMM", { locale: it })} → ${format(endDate!, "d MMM", { locale: it })}`
                      : `${format(d, "HH:mm")}${endDate ? ` – ${format(endDate, "HH:mm")}` : ""}`}
                  </span>
                </span>
                {showRegDeadline && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[10px]",
                      regClosed ? "text-destructive/80" : "text-muted-foreground/80",
                    )}
                    title={regClosed ? "Iscrizioni chiuse" : "Chiusura iscrizioni"}
                  >
                    <Hourglass size={9} className="shrink-0" />
                    <span className="truncate">
                      {regClosed ? "Iscrizioni chiuse" : `Iscriz. entro ${format(regDeadline!, "d MMM HH:mm", { locale: it })}`}
                    </span>
                  </span>
                )}
              </div>
            </>
          );

          // Tournament: show registration count, link to /tournaments/:id
          if (eventType === "tournament") {
            const count = tournamentCounts[t.id] || 0;
            return (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                data-tournament-card
                data-month={monthLabel}
                className={cardClass}
              >
                {headerSection}
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users size={10} />
                    {count}{t.max_participants ? `/${t.max_participants}` : ""} iscritti
                  </span>
                </div>
              </Link>
            );
          }

          // Event: link to dedicated event page
          if (eventType === "event") {
            const count = eventCounts[t.id] || 0;
            return (
              <Link
                key={t.id}
                to={`/events/${t.id}`}
                data-tournament-card
                data-month={monthLabel}
                className={cardClass}
              >
                {headerSection}
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users size={10} />
                    {count} partecipanti
                  </span>
                </div>
              </Link>
            );
          }

          // free_play: no link, show PARTECIPO button + count
          const isVirtual = !!t.virtual;
          const count = isVirtual ? 0 : (eventCounts[t.id] || 0);
          const isMine = !isVirtual && myParticipations.has(t.id);
          const toggling = togglingIds.has(t.id);
          const isPastEvent = mode === "past";
          return (
            <div
              key={t.id}
              data-tournament-card
              data-month={monthLabel}
              className={cardClass}
            >
              {headerSection}
              <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users size={10} />
                    {count} {count === 1 ? "partecipante" : "partecipanti"}
                  </span>
                  {canManage && !isVirtual && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="p-1 -m-1 rounded-md text-muted-foreground/70 hover:text-destructive transition-colors"
                          title="Elimina allenamento"
                          aria-label="Elimina allenamento"
                        >
                          <Trash2 size={12} />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare l'allenamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Stai per eliminare definitivamente l'allenamento{" "}
                            <span className="font-semibold text-foreground">"{t.title}"</span>.
                            Questa azione non può essere annullata e tutte le partecipazioni verranno rimosse.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTraining(t.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {!isPastEvent && !isVirtual && (
                  <button
                    type="button"
                    onClick={() => toggleParticipation(t.id)}
                    disabled={toggling}
                    className={cn(
                      "w-full text-[10px] font-bold uppercase tracking-wide rounded-md py-1.5 transition-colors inline-flex items-center justify-center gap-1",
                      isMine
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-secondary text-foreground hover:bg-secondary/80",
                      toggling && "opacity-60 cursor-wait",
                    )}
                  >
                    {isMine ? <><Check size={11} /> Partecipo</> : "Partecipo"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClubTournamentsCalendar;
