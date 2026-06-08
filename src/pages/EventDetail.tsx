import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClubRole } from "@/hooks/useClubRole";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextEditor } from "@/components/forum/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  Check,
  Sparkles,
  Building2,
  Pencil,
  Settings,
  Trash2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeUserHtml } from "@/lib/sanitizeUserHtml";
import { CreateTournamentDialog } from "@/components/tournaments/CreateTournamentDialog";
import { Trophy, Plus } from "lucide-react";
import { EventFeedbackButton } from "@/components/feedback/EventFeedbackButton";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  location: string;
  city: string;
  event_date: string;
  event_end_date: string | null;
  max_participants: number | null;
  image_url: string | null;
  event_type: string | null;
  club_id: string | null;
  is_active: boolean;
  clubs?: { id: string; name: string; logo_url: string | null } | null;
}

interface Participant {
  user_id: string;
  created_at: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

interface ClubVenue {
  id: string;
  name: string;
  address: string;
  city: string;
}

type EditMode = "date" | "location" | "participants" | "description" | "title" | "banner" | null;

const toLocalInputValue = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [subTournaments, setSubTournaments] = useState<any[]>([]);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Edit state
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editMax, setEditMax] = useState<string>("");
  const [editUnlimited, setEditUnlimited] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editBanner, setEditBanner] = useState("");
  const [venues, setVenues] = useState<ClubVenue[]>([]);

  // Advanced settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { isStaff: isClubStaff } = useClubRole(event?.club_id ?? undefined);
  const { isAdmin } = useAdmin();
  const isStaff = isClubStaff || isAdmin;

  useEffect(() => {
    if (!id) return;
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchEvent = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, title, description, location, city, event_date, event_end_date, max_participants, image_url, event_type, club_id, is_active, clubs(id, name, logo_url)")
      .eq("id", id!)
      .maybeSingle();

    if (error || !data) {
      setLoading(false);
      return;
    }

    if ((data as any).event_type !== "event") {
      if ((data as any).event_type === "free_play" && (data as any).club_id) {
        navigate(`/clubs/${(data as any).club_id}`, { replace: true });
      } else {
        navigate(`/tournaments/${id}`, { replace: true });
      }
      return;
    }

    setEvent(data as any);

    // Load club venues for staff selection
    if ((data as any).club_id) {
      const { data: venueData } = await supabase
        .from("club_venues")
        .select("id, name, address, city")
        .eq("club_id", (data as any).club_id)
        .order("is_primary", { ascending: false });
      if (venueData) setVenues(venueData as ClubVenue[]);
    }

    const { data: partsData } = await (supabase as any)
      .from("event_participants")
      .select("user_id, created_at")
      .eq("tournament_id", id!)
      .order("created_at", { ascending: true });

    const parts = (partsData ?? []) as Participant[];
    if (parts.length > 0) {
      const userIds = parts.map((p) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);
      const profileMap: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p; });
      parts.forEach((p) => {
        const prof = profileMap[p.user_id];
        if (prof) {
          p.display_name = prof.display_name;
          p.username = prof.username;
          p.avatar_url = prof.avatar_url;
        }
      });
    }
    setParticipants(parts);

    // Load sub-tournaments belonging to this event
    const { data: subs } = await (supabase as any)
      .from("tournaments")
      .select("id, title, event_date, format, status, is_ranked, max_participants")
      .eq("parent_event_id", id!)
      .order("event_date", { ascending: true });
    setSubTournaments(subs ?? []);

    setLoading(false);
  };

  const isParticipating = !!user && participants.some((p) => p.user_id === user.id);

  const toggleParticipation = async () => {
    if (!user) {
      toast.error("Devi accedere per partecipare");
      navigate("/auth");
      return;
    }
    setToggling(true);
    try {
      if (isParticipating) {
        const { error } = await (supabase as any)
          .from("event_participants")
          .delete()
          .eq("tournament_id", id!)
          .eq("user_id", user.id);
        if (error) throw error;
        toast.success("Partecipazione rimossa");
      } else {
        const { error } = await (supabase as any)
          .from("event_participants")
          .insert({ tournament_id: id!, user_id: user.id });
        if (error) throw error;
        toast.success("Partecipazione confermata!");
      }
      await fetchEvent();
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? "operazione fallita"));
    } finally {
      setToggling(false);
    }
  };

  const openEdit = (mode: EditMode) => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDate(toLocalInputValue(event.event_date));
    setEditEndDate(event.event_end_date ? toLocalInputValue(event.event_end_date) : "");
    setEditLocation(event.location);
    setEditCity(event.city);
    setEditMax(event.max_participants ? String(event.max_participants) : "");
    setEditUnlimited(!event.max_participants);
    setEditDescription(event.description ?? "");
    setEditBanner(event.image_url ?? "");
    setEditMode(mode);
  };

  const saveEdit = async () => {
    if (!event || !editMode) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (editMode === "title") {
        if (!editTitle.trim()) { toast.error("Titolo obbligatorio"); setSaving(false); return; }
        updates.title = editTitle.trim();
      } else if (editMode === "date") {
        if (!editDate) { toast.error("Data inizio obbligatoria"); setSaving(false); return; }
        const startIso = new Date(editDate).toISOString();
        let endIso: string | null = null;
        if (editEndDate) {
          endIso = new Date(editEndDate).toISOString();
          if (new Date(endIso) <= new Date(startIso)) {
            toast.error("La data di fine deve essere successiva all'inizio");
            setSaving(false); return;
          }
        }
        updates.event_date = startIso;
        updates.event_end_date = endIso;
      } else if (editMode === "location") {
        if (!editLocation.trim() || !editCity.trim()) {
          toast.error("Luogo e città obbligatori"); setSaving(false); return;
        }
        updates.location = editLocation.trim();
        updates.city = editCity.trim();
      } else if (editMode === "participants") {
        if (editUnlimited) {
          updates.max_participants = null;
        } else {
          const n = editMax.trim() === "" ? null : parseInt(editMax, 10);
          if (n === null || isNaN(n) || n < 1) {
            toast.error("Inserisci un numero valido o seleziona illimitato");
            setSaving(false); return;
          }
          updates.max_participants = n;
        }
      } else if (editMode === "description") {
        updates.description = editDescription;
      } else if (editMode === "banner") {
        const url = editBanner.trim();
        if (url && !/^https?:\/\//i.test(url)) {
          toast.error("Inserisci un URL valido (http:// o https://)");
          setSaving(false); return;
        }
        updates.image_url = url || null;
      }

      const { error } = await (supabase as any)
        .from("tournaments")
        .update(updates)
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Salvato");
      setEditMode(null);
      await fetchEvent();
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? "salvataggio fallito"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!event) return;
    setActionLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("tournaments")
        .update({ is_active: !event.is_active })
        .eq("id", event.id);
      if (error) throw error;
      toast.success(event.is_active ? "Evento annullato" : "Evento riattivato");
      setConfirmCancel(false);
      setSettingsOpen(false);
      await fetchEvent();
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? "operazione fallita"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDelete = async () => {
    if (!event) return;
    setActionLoading(true);
    try {
      await (supabase as any).from("event_participants").delete().eq("tournament_id", event.id);
      const { error } = await supabase.from("tournaments").delete().eq("id", event.id);
      if (error) throw error;
      toast.success("Evento eliminato");
      setConfirmDelete(false);
      setSettingsOpen(false);
      if (event.club_id) {
        navigate(`/clubs/${event.club_id}`, { replace: true });
      } else {
        navigate("/clubs", { replace: true });
      }
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? "eliminazione fallita"));
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-12 text-center text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground mb-4">Evento non trovato</p>
          <Button asChild variant="outline"><Link to="/clubs">Torna ai Club</Link></Button>
        </div>
      </div>
    );
  }

  const date = new Date(event.event_date);
  const endDate = event.event_end_date ? new Date(event.event_end_date) : null;
  const isMultiDay = endDate && (
    endDate.getFullYear() !== date.getFullYear() ||
    endDate.getMonth() !== date.getMonth() ||
    endDate.getDate() !== date.getDate()
  );

  const EditBtn = ({ mode, label }: { mode: EditMode; label: string }) => (
    <button
      type="button"
      onClick={() => openEdit(mode)}
      aria-label={label}
      className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md bg-background/70 hover:bg-background border border-border text-muted-foreground hover:text-foreground transition-colors"
    >
      <Pencil size={12} />
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl pt-20 md:pt-24 pb-6 md:pb-10">
        {event.image_url ? (
          <div className="relative rounded-xl overflow-hidden mb-6 aspect-[16/7] bg-muted">
            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            {event.club_id && (
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm hover:bg-background border border-border shadow-md"
              >
                <Link to={`/clubs/${event.club_id}`}>
                  <ArrowLeft size={14} className="mr-1" /> Torna al Club
                </Link>
              </Button>
            )}
            {isStaff && (
              <button
                type="button"
                onClick={() => openEdit("banner")}
                aria-label="Modifica banner"
                className="absolute top-3 right-3 h-8 inline-flex items-center gap-1 px-2 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background border border-border text-xs font-medium text-foreground shadow-md transition-colors"
              >
                <Pencil size={12} /> Banner
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {event.club_id && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/clubs/${event.club_id}`}>
                  <ArrowLeft size={14} className="mr-1" /> Torna al Club
                </Link>
              </Button>
            )}
            {isStaff && (
              <Button variant="outline" size="sm" onClick={() => openEdit("banner")}>
                <Pencil size={14} className="mr-1" /> Aggiungi banner
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground text-xs font-semibold uppercase tracking-wide">
            <Sparkles size={12} /> Evento
          </span>
        </div>

        <div className="flex items-start gap-2 mb-3">
          <h1 className="font-display text-3xl md:text-4xl flex-1">{event.title}</h1>
          {isStaff && (
            <>
              <button
                type="button"
                onClick={() => openEdit("title")}
                aria-label="Modifica titolo"
                className="mt-2 h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Impostazioni avanzate"
                className="mt-2 h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              >
                <Settings size={14} />
              </button>
            </>
          )}
        </div>

        {!event.is_active && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30 text-sm font-medium">
            <Ban size={14} /> Evento annullato
          </div>
        )}

        {(() => {
          const eventEnd = endDate ?? date;
          const isConcluded = eventEnd.getTime() < Date.now();
          if (!isConcluded) return null;
          return (
            <div className="mb-4">
              <EventFeedbackButton scope="event" targetId={event.id} canSubmit={isParticipating} />
            </div>
          );
        })()}


        {event.clubs && (
          <Link
            to={`/clubs/${event.clubs.id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <Building2 size={14} /> Organizzato da <span className="font-semibold text-foreground">{event.clubs.name}</span>
          </Link>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="relative rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
              <Calendar size={12} /> Data
            </div>
            {endDate ? (
              isMultiDay ? (
                <>
                  <div className="font-semibold capitalize text-sm leading-tight">
                    {format(date, "d MMM", { locale: it })} → {format(endDate, "d MMM yyyy", { locale: it })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(date, "HH:mm")} – {format(endDate, "HH:mm")}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold capitalize">{format(date, "EEEE d MMMM yyyy", { locale: it })}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(date, "HH:mm")} – {format(endDate, "HH:mm")}
                  </div>
                </>
              )
            ) : (
              <>
                <div className="font-semibold capitalize">{format(date, "EEEE d MMMM yyyy", { locale: it })}</div>
                <div className="text-sm text-muted-foreground">{format(date, "HH:mm")}</div>
              </>
            )}
            {isStaff && <EditBtn mode="date" label="Modifica data" />}
          </div>
          <div className="relative rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
              <MapPin size={12} /> Luogo
            </div>
            <div className="font-semibold">{event.location}</div>
            <div className="text-sm text-muted-foreground">{event.city}</div>
            {isStaff && <EditBtn mode="location" label="Modifica luogo" />}
          </div>
          <div className="relative rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
              <Users size={12} /> Partecipanti
            </div>
            <div className="font-semibold">
              {participants.length}{event.max_participants ? ` / ${event.max_participants}` : ""}
            </div>
            {isStaff && <EditBtn mode="participants" label="Modifica posti" />}
          </div>
        </div>

        <div className="relative mb-8">
          {isStaff && (
            <button
              type="button"
              onClick={() => openEdit("description")}
              aria-label="Modifica descrizione"
              className="absolute -top-1 right-0 h-7 inline-flex items-center gap-1 px-2 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Pencil size={12} /> {event.description ? "Modifica" : "Aggiungi descrizione"}
            </button>
          )}
          {event.description ? (
            <div className="prose prose-sm max-w-none text-foreground tiptap-content pt-6">
              <div dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(event.description) }} />
            </div>
          ) : (
            isStaff && (
              <p className="text-sm text-muted-foreground italic pt-6">
                Nessuna descrizione. Clicca "Aggiungi descrizione" per inserirla.
              </p>
            )
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-display text-lg mb-1">Partecipa all'evento</h3>
              <p className="text-sm text-muted-foreground">
                {isParticipating
                  ? "Hai confermato la tua partecipazione."
                  : "Conferma la tua presenza con un click."}
              </p>
            </div>
            <Button
              onClick={toggleParticipation}
              disabled={toggling || !event.is_active}
              variant={isParticipating ? "default" : "outline"}
              className={cn(isParticipating && "bg-primary text-primary-foreground")}
            >
              {isParticipating ? <><Check size={16} className="mr-1" /> Partecipo</> : "Partecipo"}
            </Button>
          </div>
        </div>

        {/* Sub-tournaments inside this event */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Trophy size={18} className="text-primary" /> Tornei dell'Evento ({subTournaments.length})
            </h3>
            {isStaff && (
              <Button size="sm" onClick={() => setShowCreateSub(true)}>
                <Plus size={14} className="mr-1" /> Crea torneo
              </Button>
            )}
          </div>
          {subTournaments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun torneo creato per questo evento.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {subTournaments.map((t) => (
                <Link
                  key={t.id}
                  to={`/tournaments/${t.id}`}
                  className="rounded-lg border border-border bg-card p-3 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{t.title}</span>
                    {t.is_ranked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">RANKED</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.event_date && format(new Date(t.event_date), "dd MMM HH:mm", { locale: it })}
                    {t.format && ` · ${t.format}`}
                    {t.status && ` · ${t.status}`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <div>
            <h3 className="font-display text-lg mb-3">Partecipanti ({participants.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {participants.map((p) => (
                <Link
                  key={p.user_id}
                  to={p.username ? `/profilo/${p.username}` : "#"}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 hover:bg-secondary/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden shrink-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-muted-foreground">
                        {(p.display_name || p.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-sm truncate">
                    {p.display_name || p.username || "Utente"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editMode !== null} onOpenChange={(o) => !o && setEditMode(null)}>
        <DialogContent className={cn(editMode === "description" && "max-w-3xl")}>
          <DialogHeader>
            <DialogTitle>
              {editMode === "title" && "Modifica titolo"}
              {editMode === "date" && "Modifica date evento"}
              {editMode === "location" && "Modifica luogo"}
              {editMode === "participants" && "Modifica posti disponibili"}
              {editMode === "description" && "Modifica descrizione"}
              {editMode === "banner" && "Modifica banner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editMode === "title" && (
              <div className="space-y-2">
                <Label>Titolo evento</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
            )}

            {editMode === "date" && (
              <>
                <div className="space-y-2">
                  <Label>Data e ora di inizio *</Label>
                  <Input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Data e ora di fine</Label>
                    {editEndDate && (
                      <button
                        type="button"
                        onClick={() => setEditEndDate("")}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                  <Input type="datetime-local" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Opzionale: usa la data di fine per eventi multi-giorno (es. dal venerdì alla domenica).
                  </p>
                </div>
              </>
            )}

            {editMode === "location" && (
              <>
                {venues.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sedi del club</Label>
                    <div className="flex flex-wrap gap-2">
                      {venues.map((v) => {
                        const selected = editLocation === `${v.name} - ${v.address}` && editCity === v.city;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setEditLocation(`${v.name} - ${v.address}`);
                              setEditCity(v.city);
                            }}
                            className={cn(
                              "text-left text-xs px-3 py-2 rounded-md border transition-colors",
                              selected
                                ? "bg-primary/10 border-primary text-foreground"
                                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                            )}
                          >
                            <div className="font-semibold">{v.name}</div>
                            <div className="opacity-70">{v.address}, {v.city}</div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Seleziona una sede esistente o compila i campi sotto manualmente.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Luogo / Sede</Label>
                  <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Es. Sala parrocchiale Don Bosco" />
                </div>
                <div className="space-y-2">
                  <Label>Città</Label>
                  <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="Es. Milano" />
                </div>
              </>
            )}

            {editMode === "participants" && (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label className="text-sm font-medium">Posti illimitati</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mostra solo il contatore degli iscritti, senza un limite.
                    </p>
                  </div>
                  <Switch checked={editUnlimited} onCheckedChange={setEditUnlimited} />
                </div>
                {!editUnlimited && (
                  <div className="space-y-2">
                    <Label>Numero massimo partecipanti</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editMax}
                      onChange={(e) => setEditMax(e.target.value)}
                      placeholder="Es. 32"
                    />
                  </div>
                )}
              </>
            )}

            {editMode === "description" && (
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <RichTextEditor
                  initialContent={editDescription}
                  onChange={setEditDescription}
                  placeholder="Descrivi il tuo evento, aggiungi gif, sticker, formattazione..."
                />
              </div>
            )}

            {editMode === "banner" && (
              <>
                <div className="space-y-2">
                  <Label>URL immagine banner</Label>
                  <Input
                    type="url"
                    value={editBanner}
                    onChange={(e) => setEditBanner(e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Incolla l'URL pubblico di un'immagine. Lascia vuoto per rimuovere il banner.
                  </p>
                </div>
                {editBanner && (
                  <div className="rounded-lg overflow-hidden border border-border aspect-[16/7] bg-muted">
                    <img
                      src={editBanner}
                      alt="Anteprima banner"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMode(null)} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings size={18} /> Impostazioni avanzate
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-semibold text-sm mb-1">
                    {event.is_active ? "Annulla evento" : "Riattiva evento"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {event.is_active
                      ? "L'evento resta visibile ma marcato come annullato. Le iscrizioni vengono bloccate."
                      : "Riapre le iscrizioni e rimuove lo stato di annullamento."}
                  </p>
                </div>
                <Button
                  variant={event.is_active ? "outline" : "default"}
                  size="sm"
                  onClick={() => (event.is_active ? setConfirmCancel(true) : handleToggleActive())}
                  disabled={actionLoading}
                >
                  {event.is_active ? (
                    <><Ban size={14} className="mr-1" /> Annulla</>
                  ) : (
                    <><RotateCcw size={14} className="mr-1" /> Riattiva</>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-semibold text-sm mb-1 text-destructive">Elimina evento</h4>
                  <p className="text-xs text-muted-foreground">
                    Elimina permanentemente l'evento e la lista dei partecipanti. Azione irreversibile.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={actionLoading}
                >
                  <Trash2 size={14} className="mr-1" /> Elimina
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare l'evento?</AlertDialogTitle>
            <AlertDialogDescription>
              L'evento resterà visibile come "annullato" ma le iscrizioni saranno bloccate.
              Potrai riattivarlo in qualsiasi momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={actionLoading}>
              {actionLoading ? "Attendere..." : "Conferma"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente l'evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno cancellati l'evento e tutti i {participants.length} partecipanti iscritti.
              Questa azione <strong>non può essere annullata</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? "Eliminazione..." : "Elimina definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />

      {/* Sub-tournaments dialog */}
      {showCreateSub && event && (
        <CreateTournamentDialog
          open={showCreateSub}
          onOpenChange={setShowCreateSub}
          clubId={event.club_id || undefined}
          parentEventId={event.id}
          onCreated={() => { setShowCreateSub(false); fetchEvent(); }}
        />
      )}
    </div>
  );
};

export default EventDetail;
