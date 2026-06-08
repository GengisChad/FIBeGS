import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Swords, AlertTriangle, Users, Shield, Gamepad2, CalendarDays,
  ChevronLeft, ChevronRight, Info, MapPin, Layers, Wallet, ClipboardList, Crown,
  ListOrdered, Scale, Hash, FileText, Eye,
} from "lucide-react";
import { CityCombobox } from "@/components/CityCombobox";
import { OptionToggleGroup } from "@/components/tournaments/OptionToggleGroup";
import { TournamentRulesInfo } from "@/components/tournaments/TournamentRulesInfo";
import { useAdmin } from "@/hooks/useAdmin";
import { LocationMapPreview } from "@/components/tournaments/LocationMapPreview";
import {
  FormatDiagram, TopCutDiagram, TiebreakerDiagram, GroupsDiagram, SwissDiagram, ExampleCard,
} from "@/components/tournaments/StructureDiagrams";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string | null;
  onCreated?: () => void;
  championshipId?: string | null;
  parentEventId?: string | null;
}

interface Venue { id: string; name: string; address: string; city: string; }

export let MAX_RANKED_PER_MONTH = 3;

export const CreateTournamentDialog = ({ open, onOpenChange, clubId, onCreated, championshipId, parentEventId }: Props) => {
  const navigate = useNavigate();
  const [clubRegion, setClubRegion] = useState<{ id: string; name: string } | null>(null);
  const [clubBannerUrl, setClubBannerUrl] = useState<string | null>(null);
  const [clubDefaultPaypal, setClubDefaultPaypal] = useState<string | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [rankedThisWeek, setRankedThisWeek] = useState(0);
  const [rankedLimit, setRankedLimit] = useState(MAX_RANKED_PER_MONTH);
  const [rankedPeriod, setRankedPeriod] = useState<"monthly" | "weekly">("weekly");
  const [clubMemberCount, setClubMemberCount] = useState<number>(0);

  const [cityValid, setCityValid] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const { isAdmin } = useAdmin();
  const [eventType, setEventType] = useState<"ranked" | "normal" | "free_play" | "event" | "national">("ranked");
  const isSimpleEvent = eventType === "free_play" || eventType === "event";
  const isNational = eventType === "national";

  const [form, setForm] = useState({
    title: "", description: "", location: "", city: "",
    event_date: "", registration_deadline: "", registration_opens_at: "",
    max_participants: "32", entry_fee: "0", prize_description: "",
    format: "swiss_top_cut", top_cut_size: "8", swiss_rounds: "",
    is_ranked: true,
    payment_methods: [] as string[], payment_link: "",
    tiebreaker_depth: "0", tiebreaker_mode: "advanced",
    groups_count: "0",
    under12_enabled: false, under12_separate_topcut: false, u12_swiss_rounds: "",
    team_mode: "solo", scoring_policy: "staff_only",
    custom_rules: "", banlist: "all", custom_swiss_win_points: "", custom_top_win_points: "",
    has_waitlist: true, is_hidden: false, auto_publish_at: "",
  });

  const [step, setStep] = useState(0);

  useEffect(() => { if (!open) setStep(0); }, [open]);

  useEffect(() => {
    if (!clubId) return;
    const fetchClubInfo = async () => {
      const { data } = await supabase.from("clubs")
        .select("region_id, banner_url, default_paypal_link, regions(id, name)")
        .eq("id", clubId).single();
      if (data?.regions) setClubRegion(data.regions as any);
      if (data?.banner_url) setClubBannerUrl(data.banner_url);
      if ((data as any)?.default_paypal_link) setClubDefaultPaypal((data as any).default_paypal_link);
    };
    const fetchMemberCount = async () => {
      const { count } = await supabase.from("club_members").select("id", { count: "exact", head: true }).eq("club_id", clubId);
      const c = count ?? 0;
      setClubMemberCount(c);
      if (c < 8) setForm(prev => ({ ...prev, is_ranked: false }));
    };
    const fetchVenues = async () => {
      const { data } = await supabase.from("club_venues").select("id, name, address, city").eq("club_id", clubId).order("created_at");
      if (data) setVenues(data as Venue[]);
    };
    const fetchRankedCount = async () => {
      const { data: settingsData } = await supabase.from("site_settings").select("key, value")
        .in("key", ["competitive_ranked_limit", "competitive_ranked_limit_period"]);
      const settingsMap: Record<string, string> = {};
      (settingsData ?? []).forEach((r: any) => { settingsMap[r.key] = r.value; });
      setRankedLimit(parseInt(settingsMap["competitive_ranked_limit"]) || 3);
      setRankedPeriod((settingsMap["competitive_ranked_limit_period"] || "weekly") as "monthly" | "weekly");
      setRankedThisWeek(0);
    };
    fetchClubInfo(); fetchMemberCount(); fetchVenues(); fetchRankedCount();
  }, [clubId]);

  useEffect(() => {
    if (!clubId) { setRankedThisWeek(0); return; }
    const checkWeek = async () => {
      const eventDate = form.event_date ? new Date(form.event_date) : new Date();
      const dayOfWeek = eventDate.getDay();
      const monday = new Date(eventDate);
      monday.setDate(eventDate.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);
      const { count } = await supabase.from("tournaments").select("id", { count: "exact", head: true })
        .eq("club_id", clubId).eq("is_ranked", true)
        .gte("event_date", monday.toISOString()).lt("event_date", sunday.toISOString());
      setRankedThisWeek(count ?? 0);
    };
    checkWeek();
  }, [clubId, form.event_date]);

  const canRanked = !clubId ? (isAdmin || !!championshipId) : clubMemberCount >= 8;

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "is_ranked" && value === true && !canRanked) return prev;
      if (field === "is_ranked" && value === true) next.format = "swiss_top_cut";
      if (field === "max_participants") {
        const maxP = parseInt(value as string) || 32;
        const currentTopCut = parseInt(next.top_cut_size);
        const validSizes = [4, 8, 16, 32].filter(s => s === 4 ? maxP >= 6 : s <= Math.floor(maxP / 2));
        if (!validSizes.includes(currentTopCut)) {
          next.top_cut_size = validSizes.length > 0 ? String(validSizes[validSizes.length - 1]) : "4";
        }
      }
      return next;
    });
  };

  const maxParticipants = parseInt(form.max_participants) || 32;
  const availableTopCuts = [4, 8, 16, 32].filter(s => s === 4 ? maxParticipants >= 6 : s <= Math.floor(maxParticipants / 2));

  const showModality = (!form.is_ranked && !isSimpleEvent) || isNational;
  const showFormat = !isSimpleEvent && !form.is_ranked && !isNational;
  const hasSwiss = form.format === "swiss_top_cut" || form.format === "swiss";
  const hasTopCut = form.format === "swiss_top_cut" || form.format === "round_robin_top_cut" || form.format === "single_elimination";
  const showRules = !isSimpleEvent && !form.is_ranked;

  const handleSubmit = async () => {
    const requiredOk = isSimpleEvent
      ? form.title.trim() && form.location.trim() && form.city.trim() && form.event_date
      : form.title.trim() && form.location.trim() && form.city.trim() && form.event_date && form.registration_deadline;
    if (!requiredOk) { toast.error("Compila tutti i campi obbligatori"); return; }
    const profanityError = validateNoProfanity(form.title, form.description, form.location, form.city);
    if (profanityError) { toast.error(profanityError); return; }
    if (!cityValid) { toast.error("Seleziona un comune valido dalla lista"); return; }
    if (form.payment_methods.includes("paypal") && form.payment_link.trim() && !disclaimerAccepted) {
      toast.error("Devi accettare il disclaimer sul metodo di pagamento"); return;
    }
    if (clubId && !isSimpleEvent && !isNational && form.is_ranked && form.event_date && rankedThisWeek >= rankedLimit) {
      toast.error(`Limite raggiunto: massimo ${rankedLimit} tornei Ranked a settimana per club nella settimana selezionata`); return;
    }
    if (isNational && !isAdmin) { toast.error("Solo gli admin possono creare un Torneo Nazionale"); return; }

    setSubmitting(true);
    const insertPayload: any = isSimpleEvent ? {
      title: form.title.trim(), description: form.description.trim() || null,
      location: form.location.trim(), city: form.city.trim(),
      event_date: new Date(form.event_date).toISOString(),
      registration_deadline: new Date(form.event_date).toISOString(),
      max_participants: maxParticipants, entry_fee: parseFloat(form.entry_fee) || 0,
      prize_description: form.prize_description.trim() || null,
      club_id: clubId || null, region_id: clubRegion?.id || null,
      is_ranked: false,
      payment_method: form.payment_methods.length > 0 ? form.payment_methods.join(",") : null,
      payment_link: form.payment_methods.includes("paypal") ? (form.payment_link.trim() || null) : null,
      image_url: clubBannerUrl, championship_id: championshipId || null,
      has_waitlist: form.has_waitlist, is_hidden: form.is_hidden,
      auto_publish_at: form.is_hidden && form.auto_publish_at ? new Date(form.auto_publish_at).toISOString() : null,
      event_type: eventType,
    } : {
      title: form.title.trim(), description: form.description.trim() || null,
      location: form.location.trim(), city: form.city.trim(),
      event_date: new Date(form.event_date).toISOString(),
      registration_deadline: new Date(form.registration_deadline).toISOString(),
      max_participants: maxParticipants, entry_fee: parseFloat(form.entry_fee) || 0,
      prize_description: form.prize_description.trim() || null,
      club_id: clubId || null, region_id: clubRegion?.id || null,
      format: form.format, top_cut_size: parseInt(form.top_cut_size) || 8,
      swiss_rounds: form.swiss_rounds ? parseInt(form.swiss_rounds) : null,
      is_ranked: form.is_ranked,
      payment_method: form.payment_methods.length > 0 ? form.payment_methods.join(",") : null,
      payment_link: form.payment_methods.includes("paypal") ? (form.payment_link.trim() || null) : null,
      tiebreaker_depth: parseInt(form.tiebreaker_depth) || 0,
      tiebreaker_mode: (parseInt(form.tiebreaker_depth) || 0) > 0 ? form.tiebreaker_mode : "advanced",
      groups_count: parseInt(form.groups_count) || 0,
      under12_enabled: form.under12_enabled, under12_separate_topcut: form.under12_separate_topcut,
      u12_swiss_rounds: form.u12_swiss_rounds ? parseInt(form.u12_swiss_rounds) : null,
      image_url: clubBannerUrl,
      team_mode: (isNational || !form.is_ranked) ? form.team_mode : "solo",
      championship_id: championshipId || null,
      scoring_policy: form.scoring_policy,
      custom_rules: !form.is_ranked && form.custom_rules.trim() ? form.custom_rules.trim() : null,
      banlist: !form.is_ranked ? form.banlist : "all",
      custom_swiss_win_points: !form.is_ranked && form.custom_swiss_win_points ? parseInt(form.custom_swiss_win_points) : null,
      custom_top_win_points: !form.is_ranked && form.custom_top_win_points ? parseInt(form.custom_top_win_points) : null,
      has_waitlist: form.has_waitlist,
      registration_opens_at: form.registration_opens_at ? new Date(form.registration_opens_at).toISOString() : null,
      is_hidden: form.is_hidden,
      auto_publish_at: form.is_hidden && form.auto_publish_at ? new Date(form.auto_publish_at).toISOString() : null,
      event_type: isNational ? "national" : "tournament",
      parent_event_id: parentEventId || null,
    };
    if (isSimpleEvent && parentEventId) insertPayload.parent_event_id = parentEventId;

    const { data, error } = await supabase.from("tournaments").insert(insertPayload).select("id").single();
    if (error) {
      toast.error(isSimpleEvent ? "Errore nella creazione dell'evento" : "Errore nella creazione del torneo");
      console.error(error);
    } else {
      toast.success(isSimpleEvent ? "Evento creato con successo!" : "Torneo creato con successo!");
      onOpenChange(false); onCreated?.();
      if (data) {
        if (eventType === "event") navigate(`/events/${data.id}`);
        else if (eventType === "free_play") { /* stay */ }
        else navigate(`/tournaments/${data.id}`);
      }
    }
    setSubmitting(false);
  };

  // ── Wizard step configuration ──
  type StepDef = { id: string; label: string; short: string; icon: any };
  const allStepsDef: Array<StepDef & { show: boolean }> = [
    { id: "type",       label: "Tipo Evento",      short: "Tipo",     icon: Trophy,       show: true },
    { id: "modality",   label: "Modalità",         short: "Modalità", icon: Users,        show: showModality },
    { id: "info",       label: "Informazioni",     short: "Info",     icon: Info,         show: true },
    { id: "place",      label: "Luogo",            short: "Luogo",    icon: MapPin,       show: true },
    { id: "dates",      label: "Date",             short: "Date",     icon: CalendarDays, show: true },
    { id: "format",     label: "Formato",          short: "Formato",  icon: Layers,       show: showFormat },
    { id: "capacity",   label: "Capienza",         short: "Posti",    icon: Hash,         show: !isSimpleEvent },
    { id: "swiss",      label: "Turni Swiss",      short: "Swiss",    icon: Swords,       show: !isSimpleEvent && hasSwiss },
    { id: "topcut",     label: "Top Cut",          short: "Top Cut",  icon: Trophy,       show: !isSimpleEvent && hasTopCut },
    { id: "tiebreaker", label: "Spareggi",         short: "Spareggi", icon: ListOrdered,  show: !isSimpleEvent && hasTopCut },
    { id: "groups",     label: "Gruppi & Kids",    short: "Gruppi",   icon: Shield,       show: !isSimpleEvent },
    { id: "scoring",    label: "Punteggi",         short: "Score",    icon: Scale,        show: !isSimpleEvent },
    { id: "rules",      label: "Regole",           short: "Regole",   icon: FileText,     show: showRules },
    { id: "payment",    label: "Pagamento & Premi",short: "Premi",    icon: Wallet,       show: true },
    { id: "recap",      label: "Riepilogo",        short: "Recap",    icon: ClipboardList,show: true },
  ];
  const steps = allStepsDef.filter(s => s.show);
  const currentStep = steps[Math.min(step, steps.length - 1)];

  const validateStep = (sId: string): string | null => {
    if (sId === "type") {
      if (!eventType) return "Seleziona un tipo di evento";
      if (eventType === "ranked" && !canRanked) return "Il club non ha abbastanza membri per i tornei Ranked";
      return null;
    }
    if (sId === "info") {
      if (!form.title.trim()) return "Inserisci il titolo";
      const profanityError = validateNoProfanity(form.title, form.description);
      if (profanityError) return profanityError;
      return null;
    }
    if (sId === "place") {
      if (!form.location.trim()) return "Inserisci il luogo";
      if (!form.city.trim()) return "Inserisci la città";
      if (!cityValid) return "Seleziona un comune valido dalla lista";
      return null;
    }
    if (sId === "dates") {
      if (!form.event_date) return "Inserisci la data evento";
      if (!isSimpleEvent && !form.registration_deadline) return "Inserisci la scadenza iscrizioni";
      if (!isSimpleEvent && form.is_ranked && form.event_date && rankedThisWeek >= rankedLimit) {
        return `Limite raggiunto: massimo ${rankedLimit} tornei Ranked nella settimana selezionata`;
      }
      return null;
    }
    if (sId === "payment") {
      if (form.payment_methods.includes("paypal") && form.payment_link.trim() && !disclaimerAccepted) {
        return "Devi accettare il disclaimer sul metodo di pagamento";
      }
      return null;
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(currentStep.id);
    if (err) { toast.error(err); return; }
    setStep(s => Math.min(s + 1, steps.length - 1));
  };
  const handlePrev = () => setStep(s => Math.max(s - 1, 0));
  const goToStep = (idx: number) => {
    if (idx <= step) { setStep(idx); return; }
    for (let i = step; i < idx; i++) {
      const err = validateStep(steps[i].id);
      if (err) { toast.error(err); setStep(i); return; }
    }
    setStep(idx);
  };

  const eventTypeLabel: Record<string, string> = {
    ranked: "Torneo Ranked", normal: "Torneo Normal",
    free_play: "Gioco Libero", event: "Evento", national: "Torneo Nazionale",
  };
  const formatLabel: Record<string, string> = {
    swiss_top_cut: "Swiss + Top Cut", swiss: "Solo Swiss",
    round_robin: "Round Robin", round_robin_top_cut: "Round Robin + Top Cut",
    single_elimination: "Eliminazione Diretta",
  };

  // Derived swiss rounds (default by max participants)
  const defaultSwissRounds = (() => {
    const mp = maxParticipants;
    if (mp < 8) return 3;
    if (mp <= 16) return 4;
    if (mp <= 32) return 5;
    if (mp <= 64) return 6;
    if (mp <= 128) return 7;
    return 8;
  })();
  const swissCount = form.swiss_rounds ? parseInt(form.swiss_rounds) : defaultSwissRounds;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cte-shell w-[94vw] sm:w-[97vw] max-w-6xl max-h-[92vh] overflow-y-auto rounded-none px-3 sm:px-6 lg:px-8">
        <DialogHeader>
          <div className="ibnf-eyebrow ibnf-eyebrow--violet text-[10px]">// Event Forge</div>
          <DialogTitle className="font-display text-xl sm:text-3xl tracking-tight mt-1">
            Crea <span className="cte-title-accent">Nuovo Evento</span>
          </DialogTitle>
          <div className="cte-header-line" />
        </DialogHeader>

        {/* ── Stepper ── */}
        <div className="mt-3 mb-3">
          {/* MOBILE: centered current + faded siblings */}
          <div className="md:hidden">
            <div className="relative h-12 overflow-hidden">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent z-10" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent z-10" />
              <div
                className="flex items-center h-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(calc(50% - ${step * 56 + 28}px))` }}
              >
                {steps.map((s, idx) => {
                  const isActive = idx === step;
                  const isDone = idx < step;
                  const Ico = s.icon;
                  const distance = Math.abs(idx - step);
                  const opacity = distance === 0 ? 1 : distance === 1 ? 0.55 : distance === 2 ? 0.28 : 0.12;
                  const scale = isActive ? 1.15 : 0.85;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goToStep(idx)}
                      aria-label={`Step ${idx + 1}: ${s.label}`}
                      className="shrink-0 flex items-center justify-center"
                      style={{ width: 56, opacity, transition: "opacity 300ms ease, transform 300ms ease", transform: `scale(${scale})` }}
                    >
                      <span className="cte-dot" data-active={isActive ? 1 : 0} data-done={isDone ? 1 : 0}>
                        <Ico size={16} strokeWidth={2.2} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-center mt-1">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Step {step + 1} / {steps.length}</span>
              <div className="text-sm font-display font-bold cte-title-accent">{currentStep.label}</div>
            </div>
          </div>

          {/* DESKTOP: wrapping pills */}
          <div className="hidden md:flex flex-wrap gap-1.5 pb-2">
            {steps.map((s, idx) => {
              const isActive = idx === step;
              const isDone = idx < step;
              const Ico = s.icon;
              return (
                <button key={s.id} type="button" onClick={() => goToStep(idx)}
                  className="cte-pill"
                  data-active={isActive ? 1 : 0}
                  data-done={isDone ? 1 : 0}
                >
                  <span className="cte-pill-num">{isDone ? "✓" : idx + 1}</span>
                  <Ico size={13} strokeWidth={2.4} />
                  <span className="whitespace-nowrap">{s.short}</span>
                </button>
              );
            })}
          </div>

          <div className="cte-progress mt-1">
            <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <div className="cte-panel space-y-4 mt-4 min-h-[320px]">

          {/* ════ TYPE ════ */}
          {currentStep.id === "type" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Scegli il tipo di evento che vuoi creare. Determina le opzioni disponibili nei passi successivi.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <button type="button"
                  onClick={() => { if (!canRanked) return; setEventType("ranked"); updateField("is_ranked", true); }}
                  disabled={!canRanked}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    !canRanked ? "border-border opacity-50 cursor-not-allowed"
                    : eventType === "ranked" ? "border-primary bg-primary/10"
                    : "border-border hover:border-border/80"
                  }`}>
                  <Trophy size={20} className={`shrink-0 ${eventType === "ranked" && canRanked ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <span className={`font-semibold block ${eventType === "ranked" && canRanked ? "text-primary" : ""}`}>Torneo Ranked</span>
                    <span className="text-xs text-muted-foreground">
                      {canRanked ? "Incide sulla classifica ufficiale" : `Min. 8 membri (${clubMemberCount})`}
                    </span>
                  </div>
                  {canRanked && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      rankedThisWeek >= rankedLimit ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                    }`}>{rankedThisWeek}/{rankedLimit} sett.</span>
                  )}
                </button>

                <button type="button" onClick={() => { setEventType("normal"); updateField("is_ranked", false); }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    eventType === "normal" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"
                  }`}>
                  <Swords size={20} className={`shrink-0 ${eventType === "normal" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <span className={`font-semibold block ${eventType === "normal" ? "text-primary" : ""}`}>Torneo Normal</span>
                    <span className="text-xs text-muted-foreground">Competitivo, senza ranking</span>
                  </div>
                </button>

                <button type="button" onClick={() => { setEventType("free_play"); updateField("is_ranked", false); }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    eventType === "free_play" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"
                  }`}>
                  <Gamepad2 size={20} className={`shrink-0 ${eventType === "free_play" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <span className={`font-semibold block ${eventType === "free_play" ? "text-primary" : ""}`}>Gioco Libero</span>
                    <span className="text-xs text-muted-foreground">Giornata di gioco aperto</span>
                  </div>
                </button>

                <button type="button" onClick={() => { setEventType("event"); updateField("is_ranked", false); }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    eventType === "event" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"
                  }`}>
                  <CalendarDays size={20} className={`shrink-0 ${eventType === "event" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <span className={`font-semibold block ${eventType === "event" ? "text-primary" : ""}`}>Evento</span>
                    <span className="text-xs text-muted-foreground">Evento generico del club</span>
                  </div>
                </button>

                {isAdmin && (
                  <button type="button" onClick={() => { setEventType("national"); updateField("is_ranked", true); }}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all sm:col-span-2 text-left ${
                      eventType === "national" ? "border-amber-400 bg-gradient-to-r from-amber-500/15 to-yellow-500/10"
                      : "border-amber-400/40 hover:border-amber-400/70 bg-amber-500/5"
                    }`}>
                    <Crown size={20} className={`shrink-0 ${eventType === "national" ? "text-amber-400" : "text-amber-500/70"}`} />
                    <div className="min-w-0 flex-1">
                      <span className={`font-semibold block ${eventType === "national" ? "text-amber-400" : ""}`}>Torneo Nazionale 🏆</span>
                      <span className="text-xs text-muted-foreground">Solo admin · Conferisce il titolo di Campione Nazionale</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ════ MODALITY ════ */}
          {currentStep.id === "modality" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Come si iscrivono i partecipanti?</p>
              <div className={`grid gap-3 ${isNational ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
                <button type="button" onClick={() => updateField("team_mode", "solo")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.team_mode === "solo" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                  <Users size={22} className={form.team_mode === "solo" ? "text-primary" : "text-muted-foreground"} />
                  <span className={`font-semibold ${form.team_mode === "solo" ? "text-primary" : ""}`}>Solo</span>
                  <span className="text-[11px] text-muted-foreground text-center">Ogni giocatore si iscrive individualmente</span>
                </button>
                <button type="button" onClick={() => updateField("team_mode", "teams")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.team_mode === "teams" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                  <Swords size={22} className={form.team_mode === "teams" ? "text-primary" : "text-muted-foreground"} />
                  <span className={`font-semibold ${form.team_mode === "teams" ? "text-primary" : ""}`}>Squadre</span>
                  <span className="text-[11px] text-muted-foreground text-center">Squadre libere fino a 4 giocatori</span>
                </button>
                {!isNational && (
                  <button type="button" onClick={() => updateField("team_mode", "clubs")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.team_mode === "clubs" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                    <Shield size={22} className={form.team_mode === "clubs" ? "text-primary" : "text-muted-foreground"} />
                    <span className={`font-semibold ${form.team_mode === "clubs" ? "text-primary" : ""}`}>Club</span>
                    <span className="text-[11px] text-muted-foreground text-center">Solo leader club, squadra con membri del club</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ════ INFO ════ */}
          {currentStep.id === "info" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">{isSimpleEvent ? "Nome Evento *" : "Titolo *"}</label>
                <Input value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder={isSimpleEvent ? "Nome evento" : "Nome del torneo"} maxLength={200} />
                <p className="text-xs text-muted-foreground mt-2">Sarà visibile a tutti i giocatori nelle liste e nei dettagli del torneo.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">{isSimpleEvent ? "Descrizione Evento" : "Descrizione"}</label>
                <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder={isSimpleEvent ? "Descrivi l'evento, cosa porteranno, programma..." : "Descrizione del torneo"} rows={8} maxLength={1000} />
                <p className="text-xs text-muted-foreground mt-1 text-right">{form.description.length}/1000</p>
              </div>
            </div>
          )}

          {/* ════ PLACE ════ */}
          {currentStep.id === "place" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                {venues.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Sede Salvata</label>
                    <Select onValueChange={(venueId) => {
                      const venue = venues.find(v => v.id === venueId);
                      if (venue) {
                        updateField("location", `${venue.name} — ${venue.address}`);
                        updateField("city", venue.city);
                        setCityValid(true);
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Scegli una sede salvata..." /></SelectTrigger>
                      <SelectContent>
                        {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name} — {v.address}, {v.city}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Oppure compila manualmente i campi sotto</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Luogo *</label>
                  <Input value={form.location} onChange={(e) => updateField("location", e.target.value)} placeholder="Es. Palazzetto dello Sport, Via Roma 1" maxLength={200} />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Città *</label>
                  <CityCombobox value={form.city}
                    onChange={(city, isValid) => { updateField("city", city); setCityValid(isValid); }}
                    regionId={clubRegion?.id} allowAllRegions
                    placeholder="Cerca un qualsiasi comune italiano..." />
                  {form.city && !cityValid && <p className="text-xs text-destructive mt-1">Seleziona un comune valido dalla lista</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Anteprima Mappa</label>
                <LocationMapPreview location={form.location} city={form.city} />
                <p className="text-[11px] text-muted-foreground mt-1.5">L'anteprima si aggiorna automaticamente in base ai campi sopra.</p>
              </div>
            </div>
          )}

          {/* ════ DATES ════ */}
          {currentStep.id === "dates" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Data Evento *</label>
                <Input type="datetime-local" value={form.event_date} onChange={(e) => updateField("event_date", e.target.value)} />
              </div>
              {!isSimpleEvent && (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Apertura Iscrizioni</label>
                    <Input type="datetime-local" value={form.registration_opens_at} onChange={(e) => updateField("registration_opens_at", e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">Opzionale. Prima di questa data solo staff/admin possono iscriversi.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Chiusura Iscrizioni *</label>
                    <Input type="datetime-local" value={form.registration_deadline} onChange={(e) => updateField("registration_deadline", e.target.value)} />
                  </div>
                </>
              )}
              {form.is_ranked && form.event_date && rankedThisWeek >= rankedLimit && (
                <div className="md:col-span-2 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
                  <AlertTriangle size={16} className="text-destructive shrink-0" />
                  <span>Limite raggiunto per la settimana selezionata.</span>
                </div>
              )}
            </div>
          )}

          {/* ════ FORMAT ════ */}
          {currentStep.id === "format" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Scegli il formato. Ogni opzione mostra come si svilupperà il torneo.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {(["swiss_top_cut", "swiss", "round_robin", "round_robin_top_cut", "single_elimination"] as const).map(f => (
                  <ExampleCard key={f} active={form.format === f}
                    onClick={() => updateField("format", f)}
                    title={formatLabel[f]}
                    subtitle={
                      f === "swiss_top_cut" ? "Standard competitivo: Swiss + eliminazione finale"
                      : f === "swiss" ? "Solo fase Swiss, classifica finale per punti"
                      : f === "round_robin" ? "Tutti contro tutti, classifica finale"
                      : f === "round_robin_top_cut" ? "Gironi + fase finale ad eliminazione"
                      : "Tabellone secco senza fase Swiss"
                    }
                    diagram={<FormatDiagram format={f} />}
                    badge={f === "swiss_top_cut" ? "Consigliato" : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ════ CAPACITY ════ */}
          {currentStep.id === "capacity" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Max Partecipanti</label>
                <Input type="number" value={form.max_participants} onChange={(e) => updateField("max_participants", e.target.value)} min={4} max={256} />
                <p className="text-xs text-muted-foreground mt-1">Determina turni Swiss e dimensioni Top Cut disponibili.</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/40">
                <Checkbox id="has_waitlist" checked={form.has_waitlist} onCheckedChange={(v) => updateField("has_waitlist", v === true)} className="mt-0.5" />
                <div className="flex-1">
                  <label htmlFor="has_waitlist" className="text-sm font-medium cursor-pointer block">Lista d'attesa</label>
                  <p className="text-xs text-muted-foreground">
                    {form.has_waitlist ? "I giocatori in eccesso entrano in lista d'attesa automatica." : "Iscrizioni chiuse al raggiungimento del limite."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ════ SWISS ════ */}
          {currentStep.id === "swiss" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Numero di turni della fase a punti. Più turni = classifica più affidabile, ma evento più lungo.</p>
              <OptionToggleGroup label="Turni" options={[3, 4, 5, 6, 7, 8]}
                value={swissCount}
                onChange={(v) => updateField("swiss_rounds", String(v))}
                getDisabledReason={form.is_ranked ? (opt) => {
                  const maxR = maxParticipants < 8 ? 3 : maxParticipants <= 16 ? 4 : maxParticipants <= 32 ? 5 : maxParticipants <= 64 ? 6 : maxParticipants <= 128 ? 7 : 8;
                  if (opt > maxR) return `Servono almeno ${opt === 4 ? 8 : opt === 5 ? 17 : opt === 6 ? 33 : opt === 7 ? 65 : 129} partecipanti per ${opt} turni Ranked`;
                  return null;
                } : undefined}
              />
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Anteprima</div>
                <SwissDiagram rounds={swissCount} />
              </div>
            </div>
          )}

          {/* ════ TOP CUT ════ */}
          {currentStep.id === "topcut" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Quanti giocatori accedono alla fase eliminatoria finale.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[4, 8, 16, 32].map(s => {
                  const disabled = s === 4 ? maxParticipants < 6 : s > Math.floor(maxParticipants / 2);
                  return (
                    <ExampleCard key={s} active={parseInt(form.top_cut_size) === s}
                      onClick={() => !disabled && updateField("top_cut_size", String(s))}
                      disabled={disabled}
                      title={`Top ${s}`}
                      subtitle={disabled ? `Servono almeno ${s === 4 ? 6 : s * 2} iscritti` : `${Math.log2(s)} turni ad eliminazione`}
                      diagram={<TopCutDiagram size={s} />}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ════ TIEBREAKER ════ */}
          {currentStep.id === "tiebreaker" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Spareggi per assegnare le posizioni dei giocatori eliminati dalla Top Cut.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 4, 8, 16].map(d => {
                  const topCut = parseInt(form.top_cut_size) || 8;
                  const disabled = d > 0 && d > topCut;
                  return (
                    <ExampleCard key={d} active={parseInt(form.tiebreaker_depth) === d}
                      onClick={() => !disabled && updateField("tiebreaker_depth", String(d))}
                      disabled={disabled}
                      title={d === 0 ? "Nessuno" : d === 4 ? "Fino al 4°" : d === 8 ? "Fino all'8°" : "Fino al 16°"}
                      subtitle={
                        disabled ? "Top Cut troppo piccola"
                        : d === 0 ? "Solo posizioni Top Cut"
                        : `Determina posizioni ${d === 4 ? "3-4" : d === 8 ? "5-8" : "9-16"}`
                      }
                      diagram={<TiebreakerDiagram depth={d} mode={form.tiebreaker_mode as any} />}
                    />
                  );
                })}
              </div>
              {(parseInt(form.tiebreaker_depth) || 0) > 0 && (
                <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                  <label className="text-sm font-medium block">Tipo di spareggio</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button type="button" onClick={() => updateField("tiebreaker_mode", "rapid")}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${form.tiebreaker_mode === "rapid" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                      <div className="font-semibold text-sm">⚡ Rapidi</div>
                      <p className="text-xs text-muted-foreground mt-1">Match secchi: un solo match per due posizioni.</p>
                    </button>
                    <button type="button" onClick={() => updateField("tiebreaker_mode", "advanced")}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${form.tiebreaker_mode === "advanced" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                      <div className="font-semibold text-sm">🏆 Avanzati</div>
                      <p className="text-xs text-muted-foreground mt-1">Mini-bracket completo W/L per ogni fascia.</p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ GROUPS ════ */}
          {currentStep.id === "groups" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Dividi i giocatori in gironi separati per la fase Swiss.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 2, 4, 8].map(c => (
                  <ExampleCard key={c} active={Number(form.groups_count) === c}
                    onClick={() => updateField("groups_count", String(c))}
                    title={c === 0 ? "Pool unica" : `${c} gironi`}
                    subtitle={c === 0 ? "Tutti insieme" : `Swiss separati per girone`}
                    diagram={<GroupsDiagram count={c} />}
                  />
                ))}
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox id="under12_enabled" checked={form.under12_enabled} onCheckedChange={(v) => updateField("under12_enabled", v === true)} className="mt-0.5" />
                  <div className="flex-1">
                    <label htmlFor="under12_enabled" className="text-sm font-medium cursor-pointer block">Attiva gruppo Kids (under 12)</label>
                    <p className="text-xs text-muted-foreground">Swiss separato per giocatori under 12.</p>
                  </div>
                </div>
                {form.under12_enabled && (
                  <div className="ml-6 space-y-3 pt-2 border-t border-border">
                    <OptionToggleGroup label="Turni Swiss Kids" options={[3, 4, 5, 6, 7, 8, 9]}
                      value={form.u12_swiss_rounds ? Number(form.u12_swiss_rounds) : 3}
                      onChange={(v) => updateField("u12_swiss_rounds", String(v))}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox id="under12_separate_topcut" checked={form.under12_separate_topcut} onCheckedChange={(v) => updateField("under12_separate_topcut", v === true)} />
                      <label htmlFor="under12_separate_topcut" className="text-xs font-medium cursor-pointer">Top Cut separata per Kids</label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ SCORING ════ */}
          {currentStep.id === "scoring" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Chi può inserire i risultati dei match.</p>
              <div className="space-y-2">
                {([
                  { v: "staff_only", title: "Solo Staff del club", desc: "Solo lo staff del club può inserire i risultati." },
                  { v: "staff_and_referees", title: "Staff + Arbitri certificati", desc: "Staff + utenti con badge Judge/Head Judge." },
                  { v: "staff_referees_players", title: "Staff + Arbitri + Giocatori", desc: "I giocatori del match possono inviare il risultato (validato dallo staff)." },
                ] as const).map(o => (
                  <button key={o.v} type="button" onClick={() => updateField("scoring_policy", o.v)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${form.scoring_policy === o.v ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                    <div className="font-semibold text-sm">{o.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ════ RULES ════ */}
          {currentStep.id === "rules" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Personalizza le regole (disponibile solo per tornei non Ranked).</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Banlist</label>
                  <Select value={form.banlist} onValueChange={(v) => updateField("banlist", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ALL</SelectItem>
                      <SelectItem value="hasbro">Hasbro Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Punti vittoria Swiss</label>
                  <Input type="number" value={form.custom_swiss_win_points} onChange={(e) => updateField("custom_swiss_win_points", e.target.value)} placeholder="Default (4)" min={0} max={20} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Punti vittoria Top</label>
                  <Input type="number" value={form.custom_top_win_points} onChange={(e) => updateField("custom_top_win_points", e.target.value)} placeholder="Default (4)" min={0} max={20} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Regole custom (opzionale)</label>
                <Textarea value={form.custom_rules} onChange={(e) => updateField("custom_rules", e.target.value)}
                  placeholder="Es. Vietati i Bey della serie X, formato 1on1, ecc." rows={3} maxLength={1000} />
              </div>
              <TournamentRulesInfo />
            </div>
          )}

          {/* ════ PAYMENT ════ */}
          {currentStep.id === "payment" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Iscrizione *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button"
                    onClick={() => { setIsPaid(false); updateField("entry_fee", "0"); setForm(p => ({ ...p, payment_methods: [], payment_link: "" })); setDisclaimerAccepted(false); }}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${!isPaid ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                    <span>🆓</span><span className={!isPaid ? "text-primary font-medium" : ""}>Gratuito</span>
                  </button>
                  <button type="button" onClick={() => setIsPaid(true)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${isPaid ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                    <span>💰</span><span className={isPaid ? "text-primary font-medium" : ""}>A Pagamento</span>
                  </button>
                </div>
              </div>
              {isPaid && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Quota Iscrizione (€)</label>
                    <Input type="number" value={form.entry_fee} onChange={(e) => updateField("entry_fee", e.target.value)} min={0} step={0.5} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Metodo di Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, payment_methods: p.payment_methods.includes("in_loco") ? p.payment_methods.filter(m => m !== "in_loco") : [...p.payment_methods, "in_loco"] }))}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${form.payment_methods.includes("in_loco") ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                        <span>💵</span><span className={form.payment_methods.includes("in_loco") ? "text-primary font-medium" : ""}>In Loco</span>
                      </button>
                      <button type="button"
                        onClick={() => {
                          setForm(p => {
                            const has = p.payment_methods.includes("paypal");
                            return {
                              ...p,
                              payment_methods: has ? p.payment_methods.filter(m => m !== "paypal") : [...p.payment_methods, "paypal"],
                              payment_link: !has && clubDefaultPaypal && !p.payment_link ? clubDefaultPaypal : p.payment_link,
                            };
                          });
                          setDisclaimerAccepted(false);
                        }}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${form.payment_methods.includes("paypal") ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
                        <span>💳</span><span className={form.payment_methods.includes("paypal") ? "text-primary font-medium" : ""}>PayPal</span>
                      </button>
                    </div>
                  </div>
                  {form.payment_methods.includes("paypal") && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Link di Pagamento PayPal</label>
                        <Input value={form.payment_link} onChange={(e) => updateField("payment_link", e.target.value)} placeholder="https://paypal.me/..." maxLength={500} />
                      </div>
                      {form.payment_link.trim() && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                FIB non è responsabile di qualsiasi entrata o uscita di denaro derivante dai link di pagamento per l'iscrizione al torneo. Il link è di proprietà dell'organizzatore.
                              </p>
                              <div className="flex items-center gap-2">
                                <Checkbox id="payment-disclaimer" checked={disclaimerAccepted} onCheckedChange={(v) => setDisclaimerAccepted(v === true)} />
                                <label htmlFor="payment-disclaimer" className="text-xs font-medium cursor-pointer">Accetto e confermo di aver letto il disclaimer</label>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="pt-3 border-t border-border">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">🏆 Premi</label>
                <Input value={form.prize_description} onChange={(e) => updateField("prize_description", e.target.value)} placeholder="Es. Trofeo + Bey esclusivo" maxLength={300} />
              </div>
            </div>
          )}

          {/* ════ RECAP ════ */}
          {currentStep.id === "recap" && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="text-primary" size={20} />
                  <h3 className="font-semibold text-base">Riepilogo {isSimpleEvent ? "evento" : "torneo"}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</div><div className="font-medium">{eventTypeLabel[eventType] || eventType}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Titolo</div><div className="font-medium truncate">{form.title || "—"}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Luogo</div><div className="font-medium truncate">{form.location} — {form.city}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Data Evento</div><div className="font-medium">{form.event_date ? new Date(form.event_date).toLocaleString("it-IT") : "—"}</div></div>
                  {!isSimpleEvent && (
                    <>
                      <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Chiusura iscrizioni</div><div className="font-medium">{form.registration_deadline ? new Date(form.registration_deadline).toLocaleString("it-IT") : "—"}</div></div>
                      <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Formato</div><div className="font-medium">{formatLabel[form.format] || form.format}</div></div>
                      <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Max Partecipanti</div><div className="font-medium">{form.max_participants}{form.has_waitlist && <span className="text-xs text-muted-foreground"> (+ lista d'attesa)</span>}</div></div>
                      {hasSwiss && <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Turni Swiss</div><div className="font-medium">{swissCount}</div></div>}
                      {hasTopCut && <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Top Cut</div><div className="font-medium">Top {form.top_cut_size}</div></div>}
                      <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Spareggi</div><div className="font-medium">{form.tiebreaker_depth === "0" ? "OFF" : `Fino al ${form.tiebreaker_depth}° (${form.tiebreaker_mode === "rapid" ? "rapidi" : "avanzati"})`}</div></div>
                      {Number(form.groups_count) > 0 && <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Gruppi</div><div className="font-medium">{form.groups_count}</div></div>}
                      {showModality && <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Modalità</div><div className="font-medium capitalize">{form.team_mode}</div></div>}
                    </>
                  )}
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Iscrizione</div><div className="font-medium">{isPaid ? `${form.entry_fee} €` : "Gratuita"}</div></div>
                  {isPaid && form.payment_methods.length > 0 && (
                    <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Metodi pagamento</div><div className="font-medium">{form.payment_methods.join(", ")}</div></div>
                  )}
                  {form.prize_description && (
                    <div className="sm:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">Premi</div><div className="font-medium">{form.prize_description}</div></div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3 sm:p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2"><Eye size={14} /> Visibilità</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {form.is_hidden ? "🔒 Nascosto — visibile solo a staff e admin" : "👁 Pubblico — visibile a tutti i giocatori"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${!form.is_hidden ? "font-semibold" : "text-muted-foreground"}`}>Pubblico</span>
                    <Switch checked={form.is_hidden} onCheckedChange={(v) => { updateField("is_hidden", v); if (!v) updateField("auto_publish_at", ""); }} />
                    <span className={`text-xs ${form.is_hidden ? "font-semibold" : "text-muted-foreground"}`}>Nascosto</span>
                  </div>
                </div>
                {form.is_hidden && (
                  <div className="pl-3 border-l-2 border-primary/30 ml-1 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox id="schedule_publish" checked={!!form.auto_publish_at}
                        onCheckedChange={(v) => {
                          if (v === true) {
                            const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
                            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                            updateField("auto_publish_at", local);
                          } else updateField("auto_publish_at", "");
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <label htmlFor="schedule_publish" className="text-sm font-medium cursor-pointer block">📅 Programma pubblicazione</label>
                        <p className="text-xs text-muted-foreground mt-0.5">Il torneo diventerà automaticamente pubblico alla data indicata.</p>
                      </div>
                    </div>
                    {!!form.auto_publish_at && (
                      <div className="pl-6">
                        <label htmlFor="auto_publish_at" className="text-xs font-medium block mb-1">Data e ora di pubblicazione</label>
                        <Input id="auto_publish_at" type="datetime-local" value={form.auto_publish_at} onChange={(e) => updateField("auto_publish_at", e.target.value)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 pt-4 mt-3 border-t border-[color:var(--ibnf-acid-line)]">
          <button type="button" onClick={handlePrev} disabled={step === 0} className="cte-btn-ghost">
            <ChevronLeft size={14} /> Indietro
          </button>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Step {step + 1} / {steps.length} · <span className="cte-title-accent">{currentStep.label}</span>
          </span>
          {step < steps.length - 1 ? (
            <button type="button" onClick={handleNext} className="cte-btn-primary">
              Avanti <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting} className="cte-btn-submit">
              {submitting ? "Creazione…" : isSimpleEvent ? "Crea Evento" : "Forge Tournament"}
            </button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
};
