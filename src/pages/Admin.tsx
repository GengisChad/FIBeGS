import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useStartPrivateChat } from "@/hooks/useStartPrivateChat";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Shield, Users, Trophy, ClipboardList, Trash2, Check, X, Flag, Package, Crown, ArrowUpDown, ArrowUp, ArrowDown, MapPin, Pencil, Award, MessageSquare, Megaphone, Send, Eye, CheckCircle, RotateCcw, ShoppingBag, MessageCircle, Swords, ExternalLink, Smile, Upload, Film, ChevronsUpDown, Mail, Target, Box, ScrollText, Download, Bug, GraduationCap } from "lucide-react";
import ibnaLogo from "@/assets/ibna-logo-square.png";
import { Input } from "@/components/ui/input";
import CollectionAdminTab from "@/components/admin/CollectionAdminTab";
import { DeckCard } from "@/components/decks/DeckCard";
import BadgesAdminTab from "@/components/admin/BadgesAdminTab";
import StickersAdminTab from "@/components/admin/StickersAdminTab";
import FeedbackAdminTab from "@/components/admin/FeedbackAdminTab";
import { FeedbackTemplateEditor } from "@/components/admin/FeedbackTemplateEditor";
import { FeedbackResponsesPanel } from "@/components/admin/FeedbackResponsesPanel";
import CredentialRequestsSection from "@/components/admin/CredentialRequestsSection";
import ChampionshipsAdminTab from "@/components/admin/ChampionshipsAdminTab";
import ExternalImportsAdminTab from "@/components/admin/ExternalImportsAdminTab";
import ImportedTournamentsStagingTab from "@/components/admin/ImportedTournamentsStagingTab";
import MediaAdminTab from "@/components/admin/MediaAdminTab";
import FaqAdminTab from "@/components/admin/FaqAdminTab";
import ContactRequestsAdminTab from "@/components/admin/ContactRequestsAdminTab";
import AchievementsAdminTab from "@/components/admin/AchievementsAdminTab";
import Ranked3DModelsAdminTab from "@/components/admin/Ranked3DModelsAdminTab";
import CompetitiveSettingsTab from "@/components/admin/CompetitiveSettingsTab";
import ChangelogAdminTab from "@/components/admin/ChangelogAdminTab";
import UserManagementTab from "@/components/admin/UserManagementTab";
import TournamentPlayerManagement from "@/components/admin/TournamentPlayerManagement";
import TournamentImportTab from "@/components/admin/TournamentImportTab";
import RandomPickerTab from "@/components/admin/random-picker/RandomPickerTab";
import DebugTestsTab from "@/components/admin/DebugTestsTab";
import LegacyMigrationAdminTab from "@/components/admin/LegacyMigrationAdminTab";
import JudgeCoursesAdminTab from "@/components/admin/JudgeCoursesAdminTab";
import RulesSectionsAdminTab from "@/components/admin/RulesSectionsAdminTab";
import ModerationAdminTab from "@/components/admin/ModerationAdminTab";
import { CityCombobox } from "@/components/CityCombobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import AdminPagination, { useAdminPagination } from "@/components/admin/AdminPagination";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "requests";

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user || !isAdmin) navigate("/");
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="section-title text-3xl">Pannello Admin</h1>
        </div>

        <button
          onClick={() => navigate("/beta/rpg")}
          className="w-full mb-8 flex items-center justify-between gap-4 p-4 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent hover:border-primary transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎮</span>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold">RPG Roguelike Beyblade</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/20 text-primary border border-primary/40">● Beta</span>
              </div>
              <div className="text-xs text-muted-foreground">Nuova feature in beta — accessibile solo agli admin</div>
            </div>
          </div>
          <span className="text-primary text-sm font-semibold group-hover:translate-x-1 transition-transform">Apri →</span>
        </button>

        {(() => {
          const adminSections: { value: string; label: string; icon: any; content: JSX.Element }[] = [
            { value: "clubs", label: "Club", icon: Shield, content: <ClubsWrapper /> },
            { value: "tournaments", label: "Tornei", icon: Trophy, content: <TournamentsWrapper /> },
            { value: "users", label: "Utenti", icon: Users, content: <UsersWrapper /> },
            { value: "badges", label: "Badge", icon: Award, content: <BadgesWrapper /> },
            { value: "collection", label: "Collezione", icon: Package, content: <CollectionAdminTab /> },
            { value: "support", label: "Supporto", icon: MessageSquare, content: <SupportWrapper /> },
            { value: "communications", label: "Comunicazioni", icon: Megaphone, content: <CommunicationsWrapper /> },
            { value: "reports", label: "Segnalazioni", icon: Flag, content: <MarketReportsTab /> },
            { value: "moderation", label: "Moderazione", icon: Shield, content: <ModerationAdminTab /> },
            { value: "media", label: "Media", icon: Film, content: <MediaWrapper /> },
            { value: "3d-models", label: "Modelli 3D", icon: Box, content: <Ranked3DModelsAdminTab /> },
            { value: "random-picker", label: "Random Picker", icon: Target, content: <RandomPickerTab /> },
            { value: "migration", label: "Migrazione", icon: Download, content: <LegacyMigrationAdminTab /> },
            { value: "judge-courses", label: "Corsi Judges", icon: GraduationCap, content: <JudgeCoursesAdminTab /> },
            { value: "rules-page", label: "Pagina Regole", icon: ScrollText, content: <RulesSectionsAdminTab /> },
            { value: "debug", label: "Debug", icon: Bug, content: <DebugTestsTab /> },
          ];
          return (
            <Tabs defaultValue={defaultTab} className="space-y-6 lg:space-y-0 lg:flex lg:gap-6 lg:items-start">
              {/* Mobile: scrollable top bar */}
              <div className="lg:hidden overflow-x-auto scrollbar-hide -mx-4 px-4 sticky top-16 z-30 bg-background/95 backdrop-blur-sm py-2 border-b border-border">
                <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1.5 w-max">
                  {adminSections.map((s) => {
                    const Icon = s.icon;
                    return (
                      <TabsTrigger key={s.value} value={s.value} className="gap-1.5 text-xs px-2.5 py-1.5 whitespace-nowrap">
                        <Icon size={13} /> {s.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Desktop: vertical sidebar */}
              <aside className="hidden lg:block lg:w-56 lg:shrink-0 lg:sticky lg:top-20 lg:self-start">
                <TabsList className="bg-card border border-border flex flex-col gap-1 h-auto p-2 w-full">
                  {adminSections.map((s) => {
                    const Icon = s.icon;
                    return (
                      <TabsTrigger
                        key={s.value}
                        value={s.value}
                        className="w-full justify-start gap-2 text-sm px-3 py-2"
                      >
                        <Icon size={14} /> {s.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </aside>

              <div className="lg:flex-1 lg:min-w-0">
                {adminSections.map((s) => (
                  <TabsContent key={s.value} value={s.value} className="lg:mt-0">
                    {s.content}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          );
        })()}
      </div>
      <Footer />
    </div>
  );
};

/* ─── Club Requests ─── */
const ClubRequestsTab = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const fetchRequests = async () => {
    const { data } = await supabase
      .from("club_requests")
      .select("*, regions(name)")
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    let profMap = new Map<string, any>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", userIds);
      profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    }
    setRequests(rows.map((r: any) => ({ ...r, requester: profMap.get(r.user_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const startChat = useStartPrivateChat();
  const openPrivateChat = (otherId: string) => startChat(otherId);


  const handleAction = async (id: string, status: "approved" | "rejected", request: any) => {
    if (status === "approved") {
      // Use the DB function that handles club creation + member transfer
      const { error: rpcErr } = await supabase.rpc("approve_club_request_and_transfer", {
        _request_id: id,
      });

      if (rpcErr) {
        toast({ title: "Errore nell'approvazione: " + rpcErr.message, variant: "destructive" });
        return;
      }

      toast({ title: "Club creato e membri trasferiti con successo!" });
    } else {
      await supabase.from("club_requests").update({ status }).eq("id", id);
      toast({ title: "Richiesta rifiutata" });
    }

    fetchRequests();
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  const { getPageItems } = useAdminPagination(requests);
  const pagedRequests = getPageItems(page);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-xl">Richieste di Creazione Club</CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-muted-foreground">Nessuna richiesta.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {pagedRequests.map((r) => (
                <div key={r.id} className={`p-3 rounded-lg border space-y-2 ${r.special_reason ? 'bg-amber-500/5 border-amber-500/30' : 'bg-secondary/30 border-border'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{r.club_name}</p>
                      {r.special_reason && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400 px-1.5 py-0">
                          Speciale
                        </Badge>
                      )}
                    </div>
                    <Badge variant={r.status === "pending" ? "outline" : r.status === "approved" ? "default" : "destructive"}>
                      {r.status === "pending" ? "In attesa" : r.status === "approved" ? "Approvato" : "Rifiutato"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>📍 {r.city || "-"}</span>
                    <span>🗺️ {r.regions?.name || "-"}</span>
                    <span>📅 {new Date(r.created_at).toLocaleDateString("it-IT")}</span>
                  </div>
                  {r.requester && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Richiesto da:</span>
                      <a href={`/profilo/${r.requester.username || ''}`} className="font-medium hover:underline">
                        {r.requester.display_name || r.requester.username || "Utente"}
                        {r.requester.username && <span className="text-muted-foreground"> @{r.requester.username}</span>}
                      </a>
                      <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => openPrivateChat(r.user_id)}>
                        <MessageCircle size={12} className="mr-1" /> Chat
                      </Button>
                    </div>
                  )}
                  {r.special_reason && (
                    <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs">
                      <p className="font-medium text-amber-400 mb-1">⚠️ Motivazione richiesta speciale:</p>
                      <p className="text-muted-foreground whitespace-pre-wrap">{r.special_reason}</p>
                    </div>
                  )}
                  {r.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1" onClick={() => handleAction(r.id, "approved", r)}>
                        <Check size={14} className="mr-1" /> Approva
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleAction(r.id, "rejected", r)}>
                        <X size={14} className="mr-1" /> Rifiuta
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Club</TableHead>
                    <TableHead>Richiedente</TableHead>
                    <TableHead>Città</TableHead>
                    <TableHead>Regione</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRequests.map((r) => (
                    <TableRow key={r.id} className={r.special_reason ? 'bg-amber-500/5' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.club_name}</span>
                          {r.special_reason && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400 px-1.5 py-0">
                              Speciale
                            </Badge>
                          )}
                        </div>
                        {r.special_reason && (
                          <div className="mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs max-w-md">
                            <p className="font-medium text-amber-400 mb-1">⚠️ Motivazione:</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{r.special_reason}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.requester ? (
                          <div className="flex flex-col gap-1">
                            <a href={`/profilo/${r.requester.username || ''}`} className="text-sm font-medium hover:underline">
                              {r.requester.display_name || r.requester.username || "Utente"}
                            </a>
                            {r.requester.username && <span className="text-xs text-muted-foreground">@{r.requester.username}</span>}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">-</span>}
                      </TableCell>
                      <TableCell>{r.city || "-"}</TableCell>
                      <TableCell>{r.regions?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "pending" ? "outline" : r.status === "approved" ? "default" : "destructive"}>
                          {r.status === "pending" ? "In attesa" : r.status === "approved" ? "Approvato" : "Rifiutato"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString("it-IT")}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {r.user_id && (
                            <Button size="sm" variant="outline" onClick={() => openPrivateChat(r.user_id)}>
                              <MessageCircle size={14} className="mr-1" /> Chat
                            </Button>
                          )}
                          {r.status === "pending" && (
                            <>
                              <Button size="sm" onClick={() => handleAction(r.id, "approved", r)}>
                                <Check size={14} className="mr-1" /> Approva
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleAction(r.id, "rejected", r)}>
                                <X size={14} className="mr-1" /> Rifiuta
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <AdminPagination page={page} totalItems={requests.length} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── Tournaments ─── */
const TournamentsTab = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tPage, setTPage] = useState(0);
  const [editingTournament, setEditingTournament] = useState<any | null>(null);
  const [managingTournament, setManagingTournament] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", city: "", location: "", event_date: "", registration_deadline: "", registration_opens_at: "",
    max_participants: 32, top_cut_size: 8, swiss_rounds: 0, status: "pending",
    is_ranked: true, entry_fee: 0, description: "",
    groups_count: 0, under12_enabled: false, under12_separate_topcut: false,
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"all" | "imported">("all");
  const [importSourceFilter, setImportSourceFilter] = useState<"all" | "challonge" | "challengermode">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTournaments = async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("*, clubs(name), regions(name)")
      .order("event_date", { ascending: false });
    setTournaments(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTournaments(); }, []);

  const openEdit = (t: any) => {
    setEditingTournament(t);
    setEditForm({
      title: t.title || "",
      city: t.city || "",
      location: t.location || "",
      event_date: t.event_date ? new Date(t.event_date).toISOString().slice(0, 16) : "",
      registration_deadline: t.registration_deadline ? new Date(t.registration_deadline).toISOString().slice(0, 16) : "",
      registration_opens_at: t.registration_opens_at ? new Date(t.registration_opens_at).toISOString().slice(0, 16) : "",
      max_participants: t.max_participants ?? 32,
      top_cut_size: t.top_cut_size ?? 8,
      swiss_rounds: t.swiss_rounds ?? 0,
      status: t.status || "pending",
      is_ranked: t.is_ranked ?? true,
      entry_fee: t.entry_fee ?? 0,
      description: t.description || "",
      groups_count: t.groups_count ?? 0,
      under12_enabled: t.under12_enabled ?? false,
      under12_separate_topcut: t.under12_separate_topcut ?? false,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTournament) return;
    const rankedChanged = editingTournament.is_ranked !== editForm.is_ranked;
    
    // Validate ranked weekly limit when changing date on a ranked tournament
    const newEventDate = editForm.event_date ? new Date(editForm.event_date).toISOString() : editingTournament.event_date;
    const isTargetRanked = editForm.is_ranked;
    if (isTargetRanked && newEventDate !== editingTournament.event_date && (editingTournament as any).club_id) {
      const eventDate = new Date(newEventDate);
      const dayOfWeek = eventDate.getDay();
      const monday = new Date(eventDate);
      monday.setDate(eventDate.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);
      const { count } = await supabase
        .from("tournaments")
        .select("id", { count: "exact", head: true })
        .eq("club_id", (editingTournament as any).club_id)
        .eq("is_ranked", true)
        .neq("id", editingTournament.id)
        .gte("event_date", monday.toISOString())
        .lt("event_date", sunday.toISOString());
      const { data: settingsData } = await supabase
        .from("site_settings")
        .select("key, value")
        .eq("key", "competitive_ranked_limit");
      const limit = parseInt(settingsData?.[0]?.value ?? "3") || 3;
      if ((count ?? 0) >= limit) {
        toast({ title: `Non puoi spostare il torneo in questa settimana: il club ha già ${count}/${limit} tornei Ranked.`, variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase.from("tournaments").update({
      title: editForm.title,
      city: editForm.city,
      location: editForm.location,
      event_date: editForm.event_date ? new Date(editForm.event_date).toISOString() : editingTournament.event_date,
      registration_deadline: editForm.registration_deadline ? new Date(editForm.registration_deadline).toISOString() : editingTournament.registration_deadline,
      registration_opens_at: editForm.registration_opens_at ? new Date(editForm.registration_opens_at).toISOString() : null,
      max_participants: editForm.max_participants,
      top_cut_size: editForm.top_cut_size,
      swiss_rounds: editForm.swiss_rounds || null,
      status: editForm.status,
      is_ranked: editForm.is_ranked,
      entry_fee: editForm.entry_fee,
      description: editForm.description,
      groups_count: editForm.groups_count,
      under12_enabled: editForm.under12_enabled,
      under12_separate_topcut: editForm.under12_separate_topcut,
    }).eq("id", editingTournament.id);

    if (error) {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } else {
      toast({ title: "Torneo aggiornato" });
      
      // If ranked status changed, recalculate all rankings
      if (rankedChanged) {
        const { data: activeSeason } = await supabase
          .from("ranking_seasons")
          .select("bfl")
          .eq("is_active", true)
          .maybeSingle();
        await supabase.rpc("recalculate_all_rankings", { _bfl: activeSeason?.bfl ?? 10 });
        toast({ title: "Classifica ricalcolata dopo cambio stato ranked" });
      }
    }
    setEditingTournament(null);
    fetchTournaments();
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }

    await Promise.all([
      supabase.from("tournament_matches").delete().eq("tournament_id", id),
      supabase.from("tournament_standings").delete().eq("tournament_id", id),
      supabase.from("tournament_registrations").delete().eq("tournament_id", id),
      supabase.from("tournament_results").delete().eq("tournament_id", id),
    ]);

    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) {
      toast({ title: "Errore nella cancellazione", variant: "destructive" });
      setConfirmDeleteId(null);
      return;
    }

    const { data: activeSeason } = await supabase
      .from("ranking_seasons")
      .select("bfl")
      .eq("is_active", true)
      .maybeSingle();

    await supabase.rpc("recalculate_all_rankings", { _bfl: activeSeason?.bfl ?? 10 });

    toast({ title: "Torneo cancellato e classifica aggiornata" });
    setConfirmDeleteId(null);
    fetchTournaments();
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "outline" | "destructive" | "secondary" }> = {
      pending: { label: "In attesa", variant: "outline" },
      swiss: { label: "Swiss", variant: "default" },
      top_cut: { label: "Top Cut", variant: "default" },
      completed: { label: "Completato", variant: "secondary" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const handleExport = async (t: any) => {
    try {
      toast({ title: "Preparazione export..." });
      const [
        { data: matches },
        { data: standings },
        { data: results },
        { data: registrations },
        { data: tournament },
      ] = await Promise.all([
        supabase.from("tournament_matches").select("*").eq("tournament_id", t.id),
        supabase.from("tournament_standings").select("*").eq("tournament_id", t.id),
        supabase.from("tournament_results").select("*").eq("tournament_id", t.id),
        supabase.from("tournament_registrations").select("*").eq("tournament_id", t.id),
        supabase.from("tournaments").select("*").eq("id", t.id).single(),
      ]);

      const allUserIds = new Set<string>();
      matches?.forEach((m: any) => { if (m.player1_id) allUserIds.add(m.player1_id); if (m.player2_id) allUserIds.add(m.player2_id); });
      standings?.forEach((s: any) => allUserIds.add(s.user_id));
      registrations?.forEach((r: any) => allUserIds.add(r.user_id));

      const userIdsArr = [...allUserIds];
      const profilesMap: Record<string, string> = {};
      for (let i = 0; i < userIdsArr.length; i += 50) {
        const chunk = userIdsArr.slice(i, i + 50);
        const { data: profs } = await supabase.from("profiles").select("user_id, username, display_name").in("user_id", chunk);
        profs?.forEach((p: any) => { profilesMap[p.user_id] = p.username || p.display_name || p.user_id; });
      }

      const backup = {
        _meta: { version: 1, exported_at: new Date().toISOString(), tournament_id: t.id, tournament_title: t.title },
        tournament,
        matches: matches ?? [],
        standings: standings ?? [],
        results: results ?? [],
        registrations: registrations ?? [],
        profiles_map: profilesMap,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${(t.title || "torneo").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup esportato" });
    } catch (err: any) {
      toast({ title: "Errore export", description: err.message, variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    let list = tournaments;
    if (viewMode === "imported") {
      list = list.filter(t => t.is_external);
      if (importSourceFilter !== "all") {
        list = list.filter(t => t.external_source === importSourceFilter);
      }
    } else {
      if (statusFilter !== "all") {
        list = list.filter(t => t.status === statusFilter);
      }
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.clubs?.name ?? "").toLowerCase().includes(q) ||
        (t.regions?.name ?? "").toLowerCase().includes(q) ||
        (t.city ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tournaments, viewMode, importSourceFilter, statusFilter, searchQuery]);
  const { getPageItems: getTPageItems } = useAdminPagination(filtered);
  const pagedTournaments = getTPageItems(tPage);

  useEffect(() => { setTPage(0); }, [statusFilter, viewMode, importSourceFilter, searchQuery]);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  if (managingTournament) {
    return <TournamentPlayerManagement tournamentId={managingTournament.id} tournamentTitle={managingTournament.title} onClose={() => setManagingTournament(null)} />;
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-xl">Gestione Tornei ({filtered.length})</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select value={viewMode} onValueChange={(v: "all" | "imported") => setViewMode(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="imported">Importati</SelectItem>
                </SelectContent>
              </Select>
              {viewMode === "imported" ? (
                <Select value={importSourceFilter} onValueChange={(v: "all" | "challonge" | "challengermode") => setImportSourceFilter(v)}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le fonti</SelectItem>
                    <SelectItem value="challonge">Challonge</SelectItem>
                    <SelectItem value="challengermode">Challengermode</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filtra stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="pending">In attesa</SelectItem>
                    <SelectItem value="swiss">Swiss</SelectItem>
                    <SelectItem value="top_cut">Top Cut</SelectItem>
                    <SelectItem value="completed">Completati</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Input
              placeholder="Cerca per nome torneo, club, regione o città..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground">Nessun torneo.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {pagedTournaments.map((t) => (
                  <div key={t.id} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate flex-1">{t.title}</p>
                      {getStatusBadge(t.status)}
                    </div>
                     <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                       {t.clubs?.name && <span>🏟️ {t.clubs.name}</span>}
                       <span>📍 {t.city}</span>
                       <span>📅 {new Date(t.event_date).toLocaleDateString("it-IT")}</span>
                       <span>👥 {t.max_participants ?? "-"}</span>
                       {t.is_ranked && <span className="text-primary font-medium">Ranked</span>}
                       {t.is_external && <Badge variant="outline" className="text-[10px]">{t.external_source || "Esterno"}</Badge>}
                     </div>
                     <div className="flex gap-2 pt-1 flex-wrap">
                       <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(t)}>
                         <Pencil size={14} className="mr-1" /> Modifica
                       </Button>
                       <Button size="sm" variant="outline" className="flex-1" onClick={() => setManagingTournament(t)}>
                         <Users size={14} className="mr-1" /> Giocatori
                       </Button>
                       <Button size="sm" variant="outline" className="flex-1" onClick={() => handleExport(t)}>
                         <Download size={14} className="mr-1" /> Esporta
                       </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        variant={confirmDeleteId === t.id ? "destructive" : "outline"}
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 size={14} className="mr-1" /> {confirmDeleteId === t.id ? "Conferma" : "Elimina"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titolo</TableHead>
                      <TableHead>Club</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Città</TableHead>
                      <TableHead>Partecipanti</TableHead>
                      <TableHead>Ranked</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedTournaments.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{t.title}</TableCell>
                        <TableCell>{t.clubs?.name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(t.status)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{new Date(t.event_date).toLocaleDateString("it-IT")}</TableCell>
                        <TableCell>{t.city}</TableCell>
                        <TableCell className="text-center">{t.max_participants ?? "-"}</TableCell>
                        <TableCell>{t.is_ranked ? <Check size={14} className="text-primary" /> : <X size={14} className="text-muted-foreground" />}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                              <Pencil size={14} className="mr-1" /> Modifica
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setManagingTournament(t)}>
                              <Users size={14} className="mr-1" /> Giocatori
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleExport(t)}>
                              <Download size={14} className="mr-1" /> Esporta
                            </Button>
                            <Button
                              size="sm"
                              variant={confirmDeleteId === t.id ? "destructive" : "outline"}
                              onClick={() => handleDelete(t.id)}
                            >
                              <Trash2 size={14} className="mr-1" /> {confirmDeleteId === t.id ? "Conferma" : "Elimina"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination page={tPage} totalItems={filtered.length} onPageChange={setTPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTournament} onOpenChange={(o) => { if (!o) setEditingTournament(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Torneo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Titolo</Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Città</Label>
                <Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Luogo</Label>
                <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data evento</Label>
                <Input type="datetime-local" value={editForm.event_date} onChange={e => setEditForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div>
                <Label>Scadenza iscrizioni</Label>
                <Input type="datetime-local" value={editForm.registration_deadline} onChange={e => setEditForm(f => ({ ...f, registration_deadline: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Apertura iscrizioni (opzionale)</Label>
                <Input type="datetime-local" value={editForm.registration_opens_at} onChange={e => setEditForm(f => ({ ...f, registration_opens_at: e.target.value }))} />
                <p className="text-xs text-muted-foreground mt-1">Se impostata, gli utenti potranno iscriversi solo dopo questa data. Staff club e admin possono iscriversi sempre.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Max partecipanti</Label>
                <Input type="number" value={editForm.max_participants} onChange={e => setEditForm(f => ({ ...f, max_participants: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Top Cut</Label>
                <Input type="number" value={editForm.top_cut_size} onChange={e => setEditForm(f => ({ ...f, top_cut_size: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Turni Swiss</Label>
                <Input type="number" value={editForm.swiss_rounds} onChange={e => setEditForm(f => ({ ...f, swiss_rounds: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stato</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">In attesa</SelectItem>
                    <SelectItem value="swiss">Swiss</SelectItem>
                    <SelectItem value="top_cut">Top Cut</SelectItem>
                    <SelectItem value="completed">Completato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quota (€)</Label>
                <Input type="number" step="0.01" value={editForm.entry_fee} onChange={e => setEditForm(f => ({ ...f, entry_fee: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_ranked" checked={editForm.is_ranked} onChange={e => setEditForm(f => ({ ...f, is_ranked: e.target.checked }))} className="accent-primary" />
              <Label htmlFor="is_ranked">Torneo classificato (ranked)</Label>
            </div>
            <div>
              <Label>Descrizione</Label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              />
            </div>
            {/* Groups configuration */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <Label className="text-foreground font-medium">⚔️ Configurazione Gironi</Label>
              <div>
                <Label>Numero Gruppi</Label>
                <Select value={String(editForm.groups_count)} onValueChange={v => setEditForm(f => ({ ...f, groups_count: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nessun gruppo</SelectItem>
                    {[2, 3, 4, 5, 6, 7, 8].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} Gruppi</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit_under12" checked={editForm.under12_enabled} onChange={e => setEditForm(f => ({ ...f, under12_enabled: e.target.checked }))} className="accent-primary" />
                <Label htmlFor="edit_under12">Attiva gruppo Kids</Label>
              </div>
              {editForm.under12_enabled && (
                <div className="flex items-center gap-2 ml-6">
                  <input type="checkbox" id="edit_u12_topcut" checked={editForm.under12_separate_topcut} onChange={e => setEditForm(f => ({ ...f, under12_separate_topcut: e.target.checked }))} className="accent-primary" />
                  <Label htmlFor="edit_u12_topcut">Top Cut separata per Kids</Label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTournament(null)}>Annulla</Button>
            <Button onClick={handleSaveEdit}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ─── Users ─── */
const UsersTab = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [regionsMap, setRegionsMap] = useState<Record<string, string>>({});
  const [regionsList, setRegionsList] = useState<{ id: string; name: string }[]>([]);
  const [clubMemberships, setClubMemberships] = useState<Record<string, { clubName: string; role: string }>>({});
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uPage, setUPage] = useState(0);
  const [ghostPage, setGhostPage] = useState(0);
  const [syncedUserIds, setSyncedUserIds] = useState<Set<string>>(new Set());
  const [ghostUserIds, setGhostUserIds] = useState<Set<string>>(new Set());
  const [ghostSearch, setGhostSearch] = useState("");
  const [botSearch, setBotSearch] = useState("");
  const [botPage, setBotPage] = useState(0);
  const [userSubTab, setUserSubTab] = useState("registered");
  const [bulkResetLoading, setBulkResetLoading] = useState(false);
  const [confirmBulkReset, setConfirmBulkReset] = useState(false);
  // Filters
  const [roleFilter, setRoleFilter] = useState("all");
  const [nameSearch, setNameSearch] = useState("");

  // Sorting
  type SortKey = "display_name" | "username" | "city" | "region" | "role" | "points" | "created_at" | "updated_at";
  const [sortKey, setSortKey] = useState<SortKey>("display_name");
  const [sortAsc, setSortAsc] = useState(true);

  // Inline edit dialog
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [editCity, setEditCity] = useState("");
  const [editRegionId, setEditRegionId] = useState("");

  const fetchAllRows = async (table: any, select: string, order?: { column: string; ascending?: boolean }) => {
    const pageSize = 1000;
    let allData: any[] = [];
    let from = 0;
    while (true) {
      let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
      const { data } = await q;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return allData;
  };

  const fetchData = async () => {
    const [profilesData, rolesData, { data: regionsData }, membersData, mappingsData, { data: ghostData }] = await Promise.all([
      fetchAllRows("profiles", "id, user_id, username, display_name, avatar_url, city, points, wins, region_id, created_at", { column: "created_at", ascending: false }),
      fetchAllRows("user_roles", "id, user_id, role"),
      supabase.from("regions").select("id, name").order("name"),
      fetchAllRows("club_members", "user_id, role, clubs(name)"),
      fetchAllRows("external_player_mappings", "external_username, internal_user_id"),
      supabase.rpc("get_all_ghost_user_ids"),
    ]);

    setProfiles(profilesData);
    setRegionsList(regionsData ?? []);

    const rolesM: Record<string, string> = {};
    (rolesData ?? []).forEach((r: any) => { rolesM[r.user_id] = r.role; });
    setRoles(rolesM);

    const regM: Record<string, string> = {};
    (regionsData ?? []).forEach((r: any) => { regM[r.id] = r.name; });
    setRegionsMap(regM);

    const clubM: Record<string, { clubName: string; role: string }> = {};
    (membersData ?? []).forEach((m: any) => {
      clubM[m.user_id] = { clubName: m.clubs?.name || "-", role: m.role };
    });
    setClubMemberships(clubM);

    // Build set of user_ids that have synced external profiles
    const syncedSet = new Set<string>();
    (mappingsData ?? []).forEach((m: any) => {
      if (m.internal_user_id) syncedSet.add(m.internal_user_id);
    });
    setSyncedUserIds(syncedSet);

    // Build set of ghost user_ids (no auth.users entry)
    const ghostSet = new Set<string>();
    (ghostData ?? []).forEach((g: any) => { ghostSet.add(g.user_id); });
    setGhostUserIds(ghostSet);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const currentRole = roles[userId];
    if (newRole === "user") {
      if (currentRole) await supabase.from("user_roles").delete().eq("user_id", userId);
    } else {
      if (currentRole) {
        await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      }
    }
    toast({ title: `Ruolo aggiornato a ${getRoleLabel(newRole)}` });
    fetchData();
  };

  const handleDeleteUser = async (profile: any) => {
    if (confirmDeleteId !== profile.id) { setConfirmDeleteId(profile.id); return; }
    await Promise.all([
      supabase.from("user_roles").delete().eq("user_id", profile.user_id),
      supabase.from("club_members").delete().eq("user_id", profile.user_id),
      supabase.from("tournament_registrations").delete().eq("user_id", profile.user_id),
      supabase.from("tournament_standings").delete().eq("user_id", profile.user_id),
      supabase.from("tournament_results").delete().eq("user_id", profile.user_id),
      supabase.from("forum_posts").delete().eq("user_id", profile.user_id),
      supabase.from("forum_replies").delete().eq("user_id", profile.user_id),
      supabase.from("market_listings").delete().eq("user_id", profile.user_id),
      supabase.from("push_subscriptions").delete().eq("user_id", profile.user_id),
      supabase.from("user_collection_data").delete().eq("user_id", profile.user_id),
      (supabase as any).from("child_profiles").delete().eq("parent_user_id", profile.user_id),
    ]);
    const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
    if (error) {
      toast({ title: "Errore nell'eliminazione", variant: "destructive" });
    } else {
      toast({ title: `Utente ${profile.display_name || profile.username || ""} eliminato` });
    }
    setConfirmDeleteId(null);
    fetchData();
  };

  const handleSaveLocation = async () => {
    if (!editingProfile) return;
    const { error } = await supabase.from("profiles").update({
      city: editCity || null,
      region_id: editRegionId || null,
    } as any).eq("id", editingProfile.id);
    if (error) {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } else {
      toast({ title: "Località aggiornata" });
    }
    setEditingProfile(null);
    fetchData();
  };

  const handleBulkPasswordReset = async () => {
    setBulkResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-password-reset", {
        body: { redirect_to: "https://ibna.it/reset-password" },
      });
      if (error) throw error;
      toast({
        title: "Email inviate!",
        description: `Inviate ${data.sent} email di recupero password. Errori: ${data.errors}`,
      });
    } catch (err: any) {
      toast({ title: "Errore nell'invio", description: err.message, variant: "destructive" });
    } finally {
      setBulkResetLoading(false);
      setConfirmBulkReset(false);
    }
  };

  const openEditLocation = (p: any) => {
    setEditingProfile(p);
    setEditCity(p.city || "");
    setEditRegionId(p.region_id || "");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) { setSortAsc(!sortAsc); }
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    return sortAsc ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />;
  };

  // Split: real registered users vs ghost profiles (no auth.users entry)
  // Also treat profiles with no username AND no display_name as empty/incomplete
  const isEmptyProfile = (p: any) => !p.username && !p.display_name;
  const realProfiles = profiles.filter(p => !ghostUserIds.has(p.user_id) && !isEmptyProfile(p));
  const emptyRealProfiles = profiles.filter(p => !ghostUserIds.has(p.user_id) && isEmptyProfile(p));
  const allGhostProfiles = profiles.filter(p => ghostUserIds.has(p.user_id));
  // Further split ghosts: [Guest]/[BOT] fictional vs challenger imports
  const isFictional = (p: any) => p.display_name?.startsWith("[Guest]") || p.display_name?.startsWith("[BOT]");
  const unsyncedProfiles = [...allGhostProfiles.filter(p => !isFictional(p)), ...emptyRealProfiles];
  const botProfiles = allGhostProfiles.filter(p => isFictional(p));

  const filtered = realProfiles.filter((p) => {
    if (roleFilter !== "all") {
      const r = roles[p.user_id] || "user";
      if (r !== roleFilter) return false;
    }
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      const dn = (p.display_name || "").toLowerCase();
      const un = (p.username || "").toLowerCase();
      if (!dn.includes(q) && !un.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = "", bv = "";
    switch (sortKey) {
      case "display_name": av = (a.display_name || "").toLowerCase(); bv = (b.display_name || "").toLowerCase(); break;
      case "username": av = (a.username || "").toLowerCase(); bv = (b.username || "").toLowerCase(); break;
      case "city": av = (a.city || "").toLowerCase(); bv = (b.city || "").toLowerCase(); break;
      case "region": av = (a.region_id ? regionsMap[a.region_id] || "" : "").toLowerCase(); bv = (b.region_id ? regionsMap[b.region_id] || "" : "").toLowerCase(); break;
      case "role": av = roles[a.user_id] || "user"; bv = roles[b.user_id] || "user"; break;
      case "points": return sortAsc ? (a.points ?? 0) - (b.points ?? 0) : (b.points ?? 0) - (a.points ?? 0);
      case "created_at": return sortAsc ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "updated_at": return sortAsc ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime() : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const { getPageItems: getUPageItems } = useAdminPagination(sorted);
  const pagedUsers = getUPageItems(uPage);

  const filteredGhosts = ghostSearch.trim()
    ? unsyncedProfiles.filter(p => (p.display_name || "").toLowerCase().includes(ghostSearch.trim().toLowerCase()))
    : unsyncedProfiles;
  const { getPageItems: getGhostPageItems } = useAdminPagination(filteredGhosts);
  const pagedGhosts = getGhostPageItems(ghostPage);

  const filteredBots = botSearch.trim()
    ? botProfiles.filter(p => (p.display_name || "").toLowerCase().includes(botSearch.trim().toLowerCase()))
    : botProfiles;
  const { getPageItems: getBotPageItems } = useAdminPagination(filteredBots);
  const pagedBots = getBotPageItems(botPage);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <>
      <Tabs value={userSubTab} onValueChange={setUserSubTab} className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="registered" className="gap-1.5 text-xs px-3 py-1.5">
            <Users size={13} /> Utenti ({realProfiles.length})
          </TabsTrigger>
          <TabsTrigger value="unsynced" className="gap-1.5 text-xs px-3 py-1.5">
            <ExternalLink size={13} /> Non-Sync ({unsyncedProfiles.length})
          </TabsTrigger>
          <TabsTrigger value="bots" className="gap-1.5 text-xs px-3 py-1.5">
            🤖 BOT ({botProfiles.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Registered Users ── */}
        <TabsContent value="registered">
          <Card className="bg-card border-border">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-xl">Gestione Utenti ({filtered.length})</CardTitle>
                <div className="flex gap-3 flex-wrap">
                  <Input placeholder="Cerca per nome..." value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} className="w-[200px]" />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Filtra ruolo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i ruoli</SelectItem>
                      <SelectItem value="user">Blader</SelectItem>
                      <SelectItem value="parent">Genitore</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="moderator">Mod</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {!confirmBulkReset ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setConfirmBulkReset(true)}
                    >
                      <RotateCcw size={14} />
                      Reset Password Tutti
                    </Button>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-destructive font-medium">Confermi? Invierà email a tutti gli utenti.</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={bulkResetLoading}
                        onClick={handleBulkPasswordReset}
                      >
                        {bulkResetLoading ? "Invio..." : "Conferma"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmBulkReset(false)}>
                        Annulla
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {pagedUsers.map((p) => {
                  const currentRole = roles[p.user_id] || "user";
                  const club = clubMemberships[p.user_id];
                  return (
                    <div key={p.id} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">
                          {p.display_name || "-"}
                          {syncedUserIds.has(p.user_id) && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] border-green-500/50 text-green-400 px-1 py-0">Challenger</Badge>
                          )}
                        </p>
                        <Badge variant={currentRole === "admin" ? "default" : "outline"}>{getRoleLabel(currentRole)}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {p.username && <span>@{p.username}</span>}
                        {p.city && <span>📍 {p.city}</span>}
                        {p.region_id && <span>🗺️ {regionsMap[p.region_id] || "-"}</span>}
                        {club && <span>🏟️ {club.clubName} <Badge variant="outline" className="ml-0.5 text-[9px]">{club.role}</Badge></span>}
                        <span>⭐ {p.points ?? 0} pt</span>
                        <span>📅 {new Date(p.created_at).toLocaleDateString("it-IT")}</span>
                      </div>
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <Select value={currentRole} onValueChange={(v) => handleRoleChange(p.user_id, v)}>
                          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Blader</SelectItem>
                            <SelectItem value="parent">Genitore</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="moderator">Mod</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openEditLocation(p)} title="Modifica località"><MapPin size={14} /></Button>
                        <Button size="sm" className="h-8 px-2" variant={confirmDeleteId === p.id ? "destructive" : "outline"} onClick={() => handleDeleteUser(p)} onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}>
                          <Trash2 size={14} />{confirmDeleteId === p.id && <span className="ml-1 text-xs">Conferma</span>}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("display_name")}><span className="flex items-center">Nome <SortIcon col="display_name" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("username")}><span className="flex items-center">Username <SortIcon col="username" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("city")}><span className="flex items-center">Città <SortIcon col="city" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("region")}><span className="flex items-center">Regione <SortIcon col="region" /></span></TableHead>
                      <TableHead>Club</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("role")}><span className="flex items-center">Ruolo <SortIcon col="role" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("points")}><span className="flex items-center">Punti <SortIcon col="points" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}><span className="flex items-center whitespace-nowrap">Registrato <SortIcon col="created_at" /></span></TableHead>
                      
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedUsers.map((p) => {
                      const currentRole = roles[p.user_id] || "user";
                      const club = clubMemberships[p.user_id];
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.display_name || "-"}
                            {syncedUserIds.has(p.user_id) && (
                              <Badge variant="outline" className="ml-1.5 text-[10px] border-green-500/50 text-green-400 px-1 py-0">Challenger</Badge>
                            )}
                          </TableCell>
                          <TableCell>{p.username || "-"}</TableCell>
                          <TableCell>{p.city || "-"}</TableCell>
                          <TableCell>{p.region_id ? regionsMap[p.region_id] || "-" : "-"}</TableCell>
                          <TableCell>
                            {club ? (<span className="text-sm">{club.clubName}<Badge variant="outline" className="ml-1 text-[10px]">{club.role}</Badge></span>) : "-"}
                          </TableCell>
                          <TableCell><Badge variant={currentRole === "admin" ? "default" : "outline"}>{getRoleLabel(currentRole)}</Badge></TableCell>
                          <TableCell className="font-mono text-sm">{p.points ?? 0}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleDateString("it-IT")}</TableCell>
                          <TableCell>
                            <div className="flex gap-1.5 flex-wrap">
                              <Select value={currentRole} onValueChange={(v) => handleRoleChange(p.user_id, v)}>
                                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">Blader</SelectItem>
                                  <SelectItem value="parent">Genitore</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="moderator">Mod</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openEditLocation(p)} title="Modifica località"><MapPin size={14} /></Button>
                              <Button size="sm" className="h-8 px-2" variant={confirmDeleteId === p.id ? "destructive" : "outline"} onClick={() => handleDeleteUser(p)} onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}>
                                <Trash2 size={14} />{confirmDeleteId === p.id && <span className="ml-1 text-xs">Conferma</span>}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination page={uPage} totalItems={sorted.length} onPageChange={setUPage} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Unsynced Imported Profiles ── */}
        <TabsContent value="unsynced">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ExternalLink size={18} className="text-muted-foreground" />
                  Profili Importati Non Sincronizzati ({filteredGhosts.length})
                </CardTitle>
                <Input placeholder="Cerca per nome..." value={ghostSearch} onChange={(e) => { setGhostSearch(e.target.value); setGhostPage(0); }} className="w-[200px]" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Profili creati da importazione tornei esterni che non sono ancora stati associati a un account registrato.
              </p>
            </CardHeader>
            <CardContent>
              {filteredGhosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nessun profilo importato non sincronizzato.</p>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {pagedGhosts.map((p) => (
                      <div key={p.id} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{p.display_name || p.username || "-"}</p>
                          <Badge variant="outline" className="text-[10px]">⭐ {p.points ?? 0} pt</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {p.city && <span>📍 {p.city}</span>}
                          {p.region_id && <span>🗺️ {regionsMap[p.region_id] || "-"}</span>}
                          <span>🏆 {p.wins ?? 0} vittorie</span>
                          <span>📅 {new Date(p.created_at).toLocaleDateString("it-IT")}</span>
                        </div>
                        <Button size="sm" className="h-8 px-2" variant={confirmDeleteId === p.id ? "destructive" : "outline"} onClick={() => handleDeleteUser(p)} onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}>
                          <Trash2 size={14} />{confirmDeleteId === p.id && <span className="ml-1 text-xs">Conferma</span>}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome Importato</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Punti</TableHead>
                          <TableHead>Vittorie</TableHead>
                          <TableHead>Città</TableHead>
                          <TableHead>Regione</TableHead>
                          <TableHead>Importato il</TableHead>
                          <TableHead>Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedGhosts.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.display_name || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{p.username || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{p.points ?? 0}</TableCell>
                            <TableCell className="font-mono text-sm">{p.wins ?? 0}</TableCell>
                            <TableCell>{p.city || "-"}</TableCell>
                            <TableCell>{p.region_id ? regionsMap[p.region_id] || "-" : "-"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("it-IT")}</TableCell>
                            <TableCell>
                              <Button size="sm" className="h-8 px-2" variant={confirmDeleteId === p.id ? "destructive" : "outline"} onClick={() => handleDeleteUser(p)} onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}>
                                <Trash2 size={14} />{confirmDeleteId === p.id && <span className="ml-1 text-xs">Conferma</span>}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <AdminPagination page={ghostPage} totalItems={filteredGhosts.length} onPageChange={setGhostPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BOT / Guest Profiles ── */}
        <TabsContent value="bots">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-lg">🤖 Profili BOT / Guest ({filteredBots.length})</CardTitle>
                <Input placeholder="Cerca per nome..." value={botSearch} onChange={(e) => { setBotSearch(e.target.value); setBotPage(0); }} className="w-[200px]" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Profili fittizi creati per completare i tornei (Guest, BOT).
              </p>
            </CardHeader>
            <CardContent>
              {filteredBots.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nessun profilo BOT.</p>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {pagedBots.map((p) => (
                      <div key={p.id} className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{p.display_name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("it-IT")}</p>
                        </div>
                        <Button size="sm" className="h-8 px-2" variant={confirmDeleteId === p.id ? "destructive" : "outline"} onClick={() => handleDeleteUser(p)} onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}>
                          <Trash2 size={14} />{confirmDeleteId === p.id && <span className="ml-1 text-xs">Conferma</span>}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Creato il</TableHead>
                          <TableHead>Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedBots.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.display_name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("it-IT")}</TableCell>
                            <TableCell>
                              <Button size="sm" className="h-8 px-2" variant={confirmDeleteId === p.id ? "destructive" : "outline"} onClick={() => handleDeleteUser(p)} onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}>
                                <Trash2 size={14} />{confirmDeleteId === p.id && <span className="ml-1 text-xs">Conferma</span>}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <AdminPagination page={botPage} totalItems={filteredBots.length} onPageChange={setBotPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Location Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(o) => !o && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={18} /> Modifica Località — {editingProfile?.display_name || editingProfile?.username || "Utente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Regione</Label>
              <Select value={editRegionId || "none"} onValueChange={(v) => setEditRegionId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleziona regione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {regionsList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Città</Label>
              <CityCombobox
                value={editCity}
                onChange={setEditCity}
                regionId={editRegionId || undefined}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Annulla</Button>
            <Button onClick={handleSaveLocation}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ─── Tournaments Wrapper (sub-tabs) ─── */
const TournamentsWrapper = () => (
  <Tabs defaultValue="list" className="space-y-4">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1 w-max">
        <TabsTrigger value="list" className="gap-1.5 text-xs whitespace-nowrap"><Trophy size={14} /> Tornei sito</TabsTrigger>
        <TabsTrigger value="import-json" className="gap-1.5 text-xs whitespace-nowrap"><Upload size={14} /> Import JSON</TabsTrigger>
        <TabsTrigger value="import-external" className="gap-1.5 text-xs whitespace-nowrap"><Download size={14} /> Import Esterni</TabsTrigger>
        <TabsTrigger value="import-staging" className="gap-1.5 text-xs whitespace-nowrap"><Upload size={14} /> Stand-by Import</TabsTrigger>
        <TabsTrigger value="championships" className="gap-1.5 text-xs whitespace-nowrap"><Trophy size={14} /> Campionati</TabsTrigger>
        <TabsTrigger value="competitive" className="gap-1.5 text-xs whitespace-nowrap"><Swords size={14} /> Competitivo</TabsTrigger>
        <TabsTrigger value="feedback-template" className="gap-1.5 text-xs whitespace-nowrap"><MessageSquare size={14} /> Config feedback</TabsTrigger>
        <TabsTrigger value="feedback-responses" className="gap-1.5 text-xs whitespace-nowrap"><MessageSquare size={14} /> Risposte feedback</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="list"><TournamentsTab /></TabsContent>
    <TabsContent value="import-json"><TournamentImportTab /></TabsContent>
    <TabsContent value="import-external"><ExternalImportsAdminTab /></TabsContent>
    <TabsContent value="import-staging"><ImportedTournamentsStagingTab /></TabsContent>
    <TabsContent value="championships"><ChampionshipsAdminTab /></TabsContent>
    <TabsContent value="competitive"><CompetitiveSettingsTab /></TabsContent>
    <TabsContent value="feedback-template"><FeedbackTemplateEditor /></TabsContent>
    <TabsContent value="feedback-responses"><FeedbackResponsesPanel /></TabsContent>
  </Tabs>
);

/* ─── Users Wrapper (sub-tabs) ─── */
const UsersWrapper = () => (
  <Tabs defaultValue="list" className="space-y-4">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1 w-max">
        <TabsTrigger value="list" className="gap-1.5 text-xs whitespace-nowrap"><Users size={14} /> Lista utenti</TabsTrigger>
        <TabsTrigger value="management" className="gap-1.5 text-xs whitespace-nowrap"><Pencil size={14} /> Strumenti avanzati</TabsTrigger>
        <TabsTrigger value="parent-requests" className="gap-1.5 text-xs whitespace-nowrap"><Crown size={14} /> Richieste Genitori</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="list"><UsersTab /></TabsContent>
    <TabsContent value="management"><UserManagementTab /></TabsContent>
    <TabsContent value="parent-requests"><ParentRequestsTab /></TabsContent>
  </Tabs>
);

/* ─── Clubs Wrapper (sub-tabs) ─── */
const ClubsWrapper = () => (
  <Tabs defaultValue="list" className="space-y-4">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1 w-max">
        <TabsTrigger value="list" className="gap-1.5 text-xs whitespace-nowrap"><Shield size={14} /> Lista Club</TabsTrigger>
        <TabsTrigger value="requests" className="gap-1.5 text-xs whitespace-nowrap"><ClipboardList size={14} /> Richieste</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="list"><ClubsAdminTab /></TabsContent>
    <TabsContent value="requests"><ClubRequestsTab /></TabsContent>
  </Tabs>
);

/* ─── Badges Wrapper (sub-tabs) ─── */
const BadgesWrapper = () => (
  <Tabs defaultValue="badges" className="space-y-4">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1 w-max">
        <TabsTrigger value="badges" className="gap-1.5 text-xs whitespace-nowrap"><Award size={14} /> Badge</TabsTrigger>
        <TabsTrigger value="achievements" className="gap-1.5 text-xs whitespace-nowrap"><Target size={14} /> Achievement</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="badges"><BadgesAdminTab /></TabsContent>
    <TabsContent value="achievements"><AchievementsAdminTab /></TabsContent>
  </Tabs>
);

/* ─── Support Wrapper (sub-tabs) ─── */
const SupportWrapper = () => (
  <Tabs defaultValue="feedback" className="space-y-4">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1 w-max">
        <TabsTrigger value="feedback" className="gap-1.5 text-xs whitespace-nowrap"><MessageSquare size={14} /> Feedback</TabsTrigger>
        <TabsTrigger value="contacts" className="gap-1.5 text-xs whitespace-nowrap"><Mail size={14} /> Contatti</TabsTrigger>
        <TabsTrigger value="faq" className="gap-1.5 text-xs whitespace-nowrap"><MessageSquare size={14} /> FAQ</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="feedback"><FeedbackAdminTab /></TabsContent>
    <TabsContent value="contacts"><ContactRequestsAdminTab /></TabsContent>
    <TabsContent value="faq"><FaqAdminTab /></TabsContent>
  </Tabs>
);

/* ─── Communications Wrapper (sub-tabs) ─── */
const CommunicationsWrapper = () => (
  <Tabs defaultValue="announcements" className="space-y-4">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1 w-max">
        <TabsTrigger value="announcements" className="gap-1.5 text-xs whitespace-nowrap"><Megaphone size={14} /> Annunci</TabsTrigger>
        <TabsTrigger value="changelog" className="gap-1.5 text-xs whitespace-nowrap"><ScrollText size={14} /> Changelog</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
    <TabsContent value="changelog"><ChangelogAdminTab /></TabsContent>
  </Tabs>
);

/* ─── Media Wrapper (sub-tabs) ─── */
const MediaWrapper = () => (
  <Tabs defaultValue="media" className="space-y-4">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <TabsList className="bg-card border border-border inline-flex flex-nowrap gap-1 h-auto p-1 w-max">
        <TabsTrigger value="media" className="gap-1.5 text-xs whitespace-nowrap"><Film size={14} /> Media</TabsTrigger>
        <TabsTrigger value="stickers" className="gap-1.5 text-xs whitespace-nowrap"><Smile size={14} /> Stickers</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="media"><MediaAdminTab /></TabsContent>
    <TabsContent value="stickers"><StickersAdminTab /></TabsContent>
  </Tabs>
);

const REPORT_SOURCES = [
  { key: "all", label: "Tutte" },
  { key: "market", label: "Market" },
  { key: "forum", label: "Forum" },
  { key: "deck", label: "Deck" },
] as const;

type ReportSource = typeof REPORT_SOURCES[number]["key"];

const MarketReportsTab = () => {
  const { user } = useAuth();
  const [allReports, setAllReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportSource>("all");
  const [rPage, setRPage] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyMsg, setReplyMsg] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchReports = async () => {
    setLoading(true);
    const [marketRes, forumRes, deckRes] = await Promise.all([
      supabase.from("market_reports").select("*, market_listings(product_name, user_id, image_url, price, condition)").order("created_at", { ascending: false }),
      supabase.from("forum_reports").select("*, forum_posts(title, content, image_url, user_id, category), forum_replies(content, user_id)").order("created_at", { ascending: false }),
      supabase.from("deck_reports").select("*, decks(name, description, user_id)").order("created_at", { ascending: false }),
    ]);

    const reporterIds = new Set<string>();
    const contentUserIds = new Set<string>();
    const addIds = (items: any[]) => items.forEach(r => reporterIds.add(r.reporter_id));
    addIds(marketRes.data ?? []);
    addIds(forumRes.data ?? []);
    addIds(deckRes.data ?? []);

    // Collect content author IDs
    for (const r of (marketRes.data ?? [])) if (r.market_listings?.user_id) contentUserIds.add(r.market_listings.user_id);
    for (const r of (forumRes.data ?? [])) {
      if (r.forum_posts?.user_id) contentUserIds.add(r.forum_posts.user_id);
      if (r.forum_replies?.user_id) contentUserIds.add(r.forum_replies.user_id);
    }
    for (const r of (deckRes.data ?? [])) if (r.decks?.user_id) contentUserIds.add(r.decks.user_id);

    // Merge all user IDs
    const allUserIds = new Set([...reporterIds, ...contentUserIds]);

    let profilesMap: Record<string, string> = {};
    if (allUserIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", [...allUserIds]);
      (profiles ?? []).forEach((p: any) => {
        profilesMap[p.user_id] = p.display_name || p.username || "Utente";
      });
    }

    const combined: any[] = [
      ...(marketRes.data ?? []).map(r => ({
        ...r,
        source: "market" as const,
        target_name: r.market_listings?.product_name || "Eliminato",
        reporter_name: profilesMap[r.reporter_id] || "Utente",
        _content: r.market_listings ? { ...r.market_listings, _authorName: profilesMap[r.market_listings.user_id] || "Utente" } : null,
      })),
      ...(forumRes.data ?? []).map(r => {
        const isReply = !!r.reply_id;
        return {
          ...r,
          source: "forum" as const,
          target_name: isReply ? (r.forum_replies?.content?.substring(0, 60) || "Commento") : (r.forum_posts?.title || "Post eliminato"),
          reporter_name: profilesMap[r.reporter_id] || "Utente",
          _content: isReply
            ? (r.forum_replies ? { type: "reply" as const, ...r.forum_replies, _authorName: profilesMap[r.forum_replies.user_id] || "Utente" } : null)
            : (r.forum_posts ? { type: "post" as const, ...r.forum_posts, _authorName: profilesMap[r.forum_posts.user_id] || "Utente" } : null),
        };
      }),
      ...(deckRes.data ?? []).map(r => ({
        ...r,
        source: "deck" as const,
        target_name: r.decks?.name || "Deck eliminato",
        reporter_name: profilesMap[r.reporter_id] || "Utente",
        _content: r.decks ? { ...r.decks, _authorName: profilesMap[r.decks.user_id] || "Utente" } : null,
      })),
    ];

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setAllReports(combined);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const handleDismiss = async (report: any) => {
    const table = report.source === "market" ? "market_reports" : report.source === "forum" ? "forum_reports" : "deck_reports";
    await supabase.from(table).update({ status: "dismissed" }).eq("id", report.id);
    toast({ title: "Segnalazione archiviata" });
    fetchReports();
  };

  const handleResolve = async (report: any) => {
    const table = report.source === "market" ? "market_reports" : report.source === "forum" ? "forum_reports" : "deck_reports";
    await supabase.from(table).update({ status: "resolved" }).eq("id", report.id);
    toast({ title: "Ticket segnato come risolto ✅" });
    setSelected((prev: any) => prev ? { ...prev, status: "resolved" } : null);
    fetchReports();
  };

  const handleReopen = async (report: any) => {
    const table = report.source === "market" ? "market_reports" : report.source === "forum" ? "forum_reports" : "deck_reports";
    await supabase.from(table).update({ status: "pending" }).eq("id", report.id);
    toast({ title: "Ticket riaperto 🔄" });
    setSelected((prev: any) => prev ? { ...prev, status: "pending" } : null);
    fetchReports();
  };

  const handleDeleteContent = async (report: any) => {
    if (report.source === "market") {
      await supabase.from("market_listings").delete().eq("id", report.listing_id);
      toast({ title: "Annuncio eliminato" });
    } else if (report.source === "forum") {
      if (report.reply_id) {
        await supabase.from("forum_replies").delete().eq("id", report.reply_id);
        toast({ title: "Commento eliminato" });
      } else if (report.post_id) {
        await supabase.from("forum_posts").delete().eq("id", report.post_id);
        toast({ title: "Post eliminato" });
      }
    } else if (report.source === "deck") {
      await supabase.from("decks").delete().eq("id", report.deck_id);
      toast({ title: "Deck eliminato" });
    }
    setSelected(null);
    fetchReports();
  };

  const handleDeleteReport = async (report: any) => {
    const table = report.source === "market" ? "market_reports" : report.source === "forum" ? "forum_reports" : "deck_reports";
    await supabase.from(table).delete().eq("id", report.id);
    toast({ title: "Segnalazione eliminata" });
    setSelected(null);
    fetchReports();
  };

  const openDetail = async (report: any) => {
    setSelected(report);
    fetchReplies(report.id, report.source);
  };

  const fetchReplies = async (reportId: string, source: string) => {
    const { data } = await supabase
      .from("report_replies" as any)
      .select("*")
      .eq("report_id", reportId)
      .eq("report_source", source)
      .order("created_at", { ascending: true });
    setReplies((data as any[]) ?? []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendReply = async () => {
    if (!user || !selected || !replyMsg.trim()) return;
    setSendingReply(true);
    await supabase.from("report_replies" as any).insert({
      report_id: selected.id,
      report_source: selected.source,
      user_id: user.id,
      message: replyMsg.trim(),
      is_staff: true,
    } as any);
    setReplyMsg("");
    fetchReplies(selected.id, selected.source);
    setSendingReply(false);
  };

  const sourceLabel = (s: string) => s === "market" ? "🛒 Market" : s === "forum" ? "💬 Forum" : "🎯 Deck";
  const statusLabel = (s: string) => s === "pending" ? "In attesa" : s === "resolved" ? "✅ Risolto" : "Archiviata";

  const filtered = filter === "all" ? allReports : allReports.filter(r => r.source === filter);
  const { getPageItems: getRPageItems } = useAdminPagination(filtered);
  const pagedReports = getRPageItems(rPage);

  useEffect(() => { setRPage(0); }, [filter]);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <>
      <CredentialRequestsSection />
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">Segnalazioni ({allReports.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {REPORT_SOURCES.map(s => (
              <Button
                key={s.key}
                size="sm"
                variant={filter === s.key ? "default" : "outline"}
                onClick={() => setFilter(s.key)}
              >
                {s.label}
                {s.key !== "all" && (
                  <Badge variant="secondary" className="ml-1.5">
                    {allReports.filter(r => r.source === s.key).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground">Nessuna segnalazione.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {pagedReports.map((r) => (
                  <div key={`${r.source}-${r.id}`} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{sourceLabel(r.source)}</Badge>
                      <Badge variant={r.status === "pending" ? "outline" : "secondary"}>
                        {statusLabel(r.status)}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm truncate">{r.target_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Da: {r.reporter_name}</span>
                      <span>📅 {new Date(r.created_at).toLocaleDateString("it-IT")}</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => openDetail(r)}>
                      <Eye size={14} className="mr-1" /> Dettagli
                    </Button>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Contenuto</TableHead>
                      <TableHead>Segnalato da</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedReports.map((r) => (
                      <TableRow key={`${r.source}-${r.id}`}>
                        <TableCell>
                          <Badge variant="outline">{sourceLabel(r.source)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[150px] truncate">{r.target_name}</TableCell>
                        <TableCell>{r.reporter_name}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "pending" ? "outline" : "secondary"}>
                            {statusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleDateString("it-IT")}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                              <Eye size={14} className="mr-1" /> Vedi
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination page={rPage} totalItems={filtered.length} onPageChange={setRPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Dettaglio Segnalazione</span>
              {selected && selected.status !== "resolved" ? (
                <Button size="sm" variant="outline" onClick={() => handleResolve(selected)} className="text-green-500 border-green-500/30">
                  <CheckCircle size={14} className="mr-1" /> Segna risolto
                </Button>
              ) : selected && (
                <Button size="sm" variant="outline" onClick={() => handleReopen(selected)}>
                  <RotateCcw size={14} className="mr-1" /> Riapri ticket
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Badge variant="outline">{sourceLabel(selected.source)}</Badge>
                <span>•</span>
                <span>Da: <strong className="text-foreground">{selected.reporter_name}</strong></span>
                <span>•</span>
                <span>{new Date(selected.created_at).toLocaleString("it-IT")}</span>
                <span>•</span>
                <Badge variant={selected.status === "pending" ? "outline" : "secondary"}>
                  {statusLabel(selected.status)}
                </Badge>
              </div>

              {/* Reported Content Card */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Contenuto segnalato</h4>
                {selected._content ? (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {selected.source === "market" && <ShoppingBag size={13} />}
                        {selected.source === "forum" && <MessageCircle size={13} />}
                        {selected.source === "deck" && <Swords size={13} />}
                        <span className="font-medium">{selected._content._authorName}</span>
                      </div>

                      {selected.source === "market" && (
                        <div className="flex gap-3 items-start">
                          {selected._content.image_url && (
                            <img src={selected._content.image_url} alt="" className="w-14 h-14 rounded-md object-cover flex-shrink-0 border border-border" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{selected._content.product_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {selected._content.price != null && <span className="text-xs font-semibold text-primary">€{selected._content.price}</span>}
                              <Badge variant="outline" className="text-[10px] h-4">{selected._content.condition}</Badge>
                            </div>
                          </div>
                        </div>
                      )}

                      {selected.source === "forum" && selected._content.type === "post" && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium line-clamp-1">{selected._content.title}</p>
                          {selected._content.image_url && (
                            <img src={selected._content.image_url} alt="" className="w-full max-h-24 rounded-md object-cover border border-border" />
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2">{selected._content.content}</p>
                          <Badge variant="outline" className="text-[10px] h-4">{selected._content.category}</Badge>
                        </div>
                      )}

                      {selected.source === "forum" && selected._content.type === "reply" && (
                        <div className="space-y-1">
                          <p className="text-xs italic text-muted-foreground">Commento:</p>
                          <p className="text-sm line-clamp-3 bg-secondary/50 rounded p-2">{selected._content.content}</p>
                        </div>
                      )}

                      {selected.source === "deck" && selected._content && (
                        <DeckCard
                          deck={{
                            id: selected.deck_id,
                            user_id: selected._content.user_id,
                            name: selected._content.name,
                            description: selected._content.description || null,
                            created_at: selected.created_at,
                          }}
                          profile={{ display_name: selected._content._authorName, username: null, avatar_url: null }}
                          compact
                        />
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-sm bg-secondary/50 rounded-lg p-3 text-muted-foreground italic">
                    Contenuto eliminato o non disponibile
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Motivo segnalazione</h4>
                <p className="whitespace-pre-wrap text-sm bg-secondary/50 rounded-lg p-3">{selected.reason}</p>
              </div>

              {/* Chat */}
              <div className="border-t border-border pt-3">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Chat</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {replies.length === 0 && <p className="text-xs text-muted-foreground">Nessun messaggio ancora.</p>}
                  {replies.map((r: any) => (
                    <div key={r.id} className={`flex gap-2 ${r.is_staff ? "justify-start" : "justify-end"}`}>
                      {r.is_staff && (
                        <img src={ibnaLogo} alt="FIBeGS" className="w-6 h-6 rounded-full flex-shrink-0 mt-1" />
                      )}
                      <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${r.is_staff ? "bg-primary/10 text-foreground" : "bg-secondary text-foreground"}`}>
                        <p className="text-[10px] font-semibold mb-0.5 text-muted-foreground">
                          {r.is_staff ? "FIBeGS Staff" : selected.reporter_name}
                        </p>
                        <p className="whitespace-pre-wrap">{r.message}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2 mt-2">
                  <Textarea
                    placeholder="Rispondi..."
                    value={replyMsg}
                    onChange={(e: any) => setReplyMsg(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={sendReply} disabled={!replyMsg.trim() || sendingReply}>
                    <Send size={14} />
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap border-t border-border pt-3 justify-between">
                <div className="flex gap-2 flex-wrap">
                  {selected.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => handleDismiss(selected)}>
                      Archivia
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteReport(selected)}>
                    <Trash2 size={14} className="mr-1" /> Elimina segnalazione
                  </Button>
                </div>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDeleteContent(selected)}>
                  <Check size={14} className="mr-1" /> Approva ed elimina
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ─── Clubs Admin ─── */
const ClubsAdminTab = () => {
  const [clubs, setClubs] = useState<any[]>([]);
  const [membersMap, setMembersMap] = useState<Record<string, any[]>>({});
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cPage, setCPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAllRowsClub = async (table: any, select: string, order?: { column: string; ascending?: boolean }) => {
    const pageSize = 1000;
    let allData: any[] = [];
    let from = 0;
    while (true) {
      let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
      const { data } = await q;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return allData;
  };

  const fetchClubs = async () => {
    const [{ data: clubsData }, membersData, profilesData] = await Promise.all([
      supabase.from("clubs").select("*, regions(name)").order("name"),
      fetchAllRowsClub("club_members", "id, club_id, user_id, role, joined_at, city, last_tournament_at"),
      fetchAllRowsClub("profiles", "user_id, display_name, username"),
    ]);
    setClubs(clubsData ?? []);
    setAllProfiles(profilesData);
    const map: Record<string, any[]> = {};
    (membersData ?? []).forEach((m: any) => {
      if (!map[m.club_id]) map[m.club_id] = [];
      map[m.club_id].push(m);
    });
    setMembersMap(map);
    setLoading(false);
  };

  useEffect(() => { fetchClubs(); }, []);

  const getProfileName = (userId: string) => {
    const p = allProfiles.find((p) => p.user_id === userId);
    return p?.display_name || p?.username || "Utente";
  };

  // Filter bots, sort by name
  const leaderCandidates = useMemo(() =>
    allProfiles
      .filter((p) => {
        const name = (p.display_name || p.username || "").toLowerCase();
        return !name.startsWith("[bot]") && !name.startsWith("[guest]");
      })
      .sort((a, b) => {
        const nameA = (a.display_name || a.username || "").toLowerCase();
        const nameB = (b.display_name || b.username || "").toLowerCase();
        return nameA.localeCompare(nameB);
      }),
    [allProfiles]
  );

  const LeaderCombobox = ({ clubId }: { clubId: string }) => {
    const [open, setOpen] = useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
            Cambia Club Leader...
            <ChevronsUpDown size={12} className="ml-1 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Cerca utente..." />
            <CommandList>
              <CommandEmpty>Nessun utente trovato</CommandEmpty>
              <CommandGroup>
                {leaderCandidates.map((p) => {
                  const label = p.display_name || p.username || "Utente";
                  const searchValue = [p.display_name, p.username, p.user_id].filter(Boolean).join(" ");
                  return (
                    <CommandItem
                      key={p.user_id}
                      value={searchValue}
                      onSelect={() => { handleChangeLeader(clubId, p.user_id); setOpen(false); }}
                    >
                      {label}{p.username && p.display_name && p.username !== p.display_name ? ` (${p.username})` : ""}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const getLeader = (clubId: string) => (membersMap[clubId] || []).find((m) => m.role === "leader");

  const handleDeleteClub = async (clubId: string, clubName: string) => {
    if (!window.confirm(`Eliminare il club "${clubName}"?`)) return;
    await supabase.from("club_members").delete().eq("club_id", clubId);
    await supabase.from("tournaments").update({ club_id: null } as any).eq("club_id", clubId);
    const { error } = await supabase.from("clubs").delete().eq("id", clubId);
    if (error) {
      toast({ title: "Errore nell'eliminazione", variant: "destructive" });
    } else {
      toast({ title: "Club eliminato" });
      fetchClubs();
    }
  };

  const handleChangeLeader = async (clubId: string, newLeaderUserId: string) => {
    const currentLeader = getLeader(clubId);
    if (currentLeader) {
      await supabase.from("club_members").update({ role: "member" } as any).eq("id", currentLeader.id);
    }
    const clubMembers = membersMap[clubId] || [];
    const existing = clubMembers.find((m) => m.user_id === newLeaderUserId);
    if (existing) {
      await supabase.from("club_members").update({ role: "leader" } as any).eq("id", existing.id);
    } else {
      const { count } = await supabase.from("club_members").select("id", { count: "exact", head: true }).eq("user_id", newLeaderUserId);
      if (count && count > 0) {
        toast({ title: "Utente già membro di un altro club", variant: "destructive" });
        return;
      }
      await supabase.from("club_members").insert({ club_id: clubId, user_id: newLeaderUserId, role: "leader" });
    }
    toast({ title: "Club Leader aggiornato" });
    fetchClubs();
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  const q = searchQuery.trim().toLowerCase();
  const filteredClubs = q
    ? clubs.filter((club) => {
        if ((club.name ?? "").toLowerCase().includes(q)) return true;
        if ((club.city ?? "").toLowerCase().includes(q)) return true;
        if ((club.regions?.name ?? "").toLowerCase().includes(q)) return true;
        const members = membersMap[club.id] || [];
        return members.some((m) => {
          const name = getProfileName(m.user_id).toLowerCase();
          return name.includes(q);
        });
      })
    : clubs;

  const { getPageItems: getCPageItems } = useAdminPagination(filteredClubs);
  const pagedClubs = getCPageItems(cPage);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-xl">Gestione Club ({filteredClubs.length})</CardTitle>
        <Input
          placeholder="Cerca per nome, città, regione, founder o membri..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCPage(0); }}
          className="max-w-md mt-3"
        />
      </CardHeader>
      <CardContent>
        {filteredClubs.length === 0 ? (
          <p className="text-muted-foreground">Nessun club.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {pagedClubs.map((club) => {
                const leader = getLeader(club.id);
                return (
                  <div key={club.id} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{club.name}</p>
                      <Badge variant="outline">{(membersMap[club.id] || []).length} membri</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>🗺️ {club.regions?.name || "-"}</span>
                      <span className="flex items-center gap-1"><Crown size={12} className="text-primary" /> {leader ? getProfileName(leader.user_id) : "Nessuno"}</span>
                    </div>
                    <div className="space-y-2 pt-1">
                      <LeaderCombobox clubId={club.id} />
                      <Button size="sm" variant="destructive" className="w-full" onClick={() => handleDeleteClub(club.id, club.name)}>
                        <Trash2 size={14} className="mr-1" /> Elimina
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Club</TableHead>
                    <TableHead>Regione</TableHead>
                    <TableHead>Club Leader</TableHead>
                    <TableHead>Membri</TableHead>
                    <TableHead>Cambia Club Leader</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedClubs.map((club) => {
                    const leader = getLeader(club.id);
                    return (
                      <TableRow key={club.id}>
                        <TableCell className="font-medium">{club.name}</TableCell>
                        <TableCell>{club.regions?.name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Crown size={14} className="text-primary" />
                            {leader ? getProfileName(leader.user_id) : "Nessuno"}
                          </div>
                        </TableCell>
                        <TableCell>{(membersMap[club.id] || []).length}</TableCell>
                        <TableCell>
                          <LeaderCombobox clubId={club.id} />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteClub(club.id, club.name)}>
                            <Trash2 size={14} className="mr-1" /> Elimina
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <AdminPagination page={cPage} totalItems={clubs.length} onPageChange={setCPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case "admin": return "Admin";
    case "staff": return "Staff";
    case "moderator": return "Mod";
    case "parent": return "Genitore";
    default: return "Blader";
  }
};

/* ─── Announcements Tab ─── */
const ANNOUNCEMENTS_PER_PAGE = 10;

const AnnouncementsTab = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Edit state
  const [editingAnnouncement, setEditingAnnouncement] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchHistory = async (p = 0) => {
    const from = p * ANNOUNCEMENTS_PER_PAGE;
    const to = from + ANNOUNCEMENTS_PER_PAGE - 1;
    const { data, count } = await supabase
      .from("announcements" as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    setHistory((data as any[]) ?? []);
    setTotalCount(count ?? 0);
    setPage(p);
  };

  useEffect(() => { fetchHistory(); }, []);

  const totalPages = Math.ceil(totalCount / ANNOUNCEMENTS_PER_PAGE);

  const sendAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Compila titolo e messaggio", variant: "destructive" });
      return;
    }
    setSending(true);

    const { data: profiles } = await supabase.from("profiles").select("user_id");
    const userIds = (profiles ?? []).map((p: any) => p.user_id);

    if (userIds.length === 0) {
      toast({ title: "Nessun utente trovato", variant: "destructive" });
      setSending(false);
      return;
    }

    await supabase.from("announcements" as any).insert({
      title: title.trim(),
      message: message.trim(),
      link: link.trim() || null,
      sent_by: (await supabase.auth.getUser()).data.user?.id,
      recipients_count: userIds.length,
    } as any);

    const notifications = userIds.map((uid: string) => ({
      user_id: uid,
      type: "staff_announcement",
      title: title.trim(),
      message: message.trim(),
      link: link.trim() || null,
    }));

    for (let i = 0; i < notifications.length; i += 500) {
      const chunk = notifications.slice(i, i + 500);
      await supabase.from("notifications").insert(chunk);
    }

    toast({ title: `Annuncio inviato a ${userIds.length} utenti!` });
    setTitle("");
    setMessage("");
    setLink("");
    setSending(false);
    fetchHistory(0);
  };

  const handleEdit = (ann: any) => {
    setEditingAnnouncement(ann);
    setEditTitle(ann.title);
    setEditMessage(ann.message);
    setEditLink(ann.link || "");
  };

  const saveEdit = async () => {
    if (!editingAnnouncement || !editTitle.trim() || !editMessage.trim()) return;
    setEditSaving(true);

    // Update announcement record
    await supabase
      .from("announcements" as any)
      .update({
        title: editTitle.trim(),
        message: editMessage.trim(),
        link: editLink.trim() || null,
      } as any)
      .eq("id", editingAnnouncement.id);

    // Update all matching notifications so users see the updated content
    // Match by original title + type to find related notifications
    await supabase
      .from("notifications")
      .update({
        title: editTitle.trim(),
        message: editMessage.trim(),
        link: editLink.trim() || null,
      })
      .eq("type", "staff_announcement")
      .eq("title", editingAnnouncement.title);

    toast({ title: "Annuncio aggiornato per tutti gli utenti!" });
    setEditingAnnouncement(null);
    setEditSaving(false);
    fetchHistory(page);
  };

  const handleDelete = async (ann: any) => {
    if (!confirm("Eliminare questo annuncio e rimuoverlo dalle notifiche di tutti gli utenti?")) return;

    // Delete all related notifications
    await supabase
      .from("notifications")
      .delete()
      .eq("type", "staff_announcement")
      .eq("title", ann.title);

    // Delete announcement record
    await supabase
      .from("announcements" as any)
      .delete()
      .eq("id", ann.id);

    toast({ title: "Annuncio eliminato per tutti!" });
    fetchHistory(page);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Megaphone size={20} /> Invia Annuncio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Titolo *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="es. Aggiornamento regolamento" />
          </div>
          <div>
            <Label>Messaggio *</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Scrivi il messaggio dell'annuncio..." rows={3} />
          </div>
          <div>
            <Label>Link (opzionale)</Label>
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="/rules o https://..." />
          </div>
          <Button onClick={sendAnnouncement} disabled={sending} className="gap-2">
            <Send size={16} /> {sending ? "Invio in corso..." : "Invia a tutti gli utenti"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Cronologia annunci ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessun annuncio inviato.</p>
          ) : (
            <div className="space-y-3">
              {history.map((h: any) => (
                <div key={h.id} className="p-3 rounded-lg bg-secondary/30 border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{h.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{h.message}</p>
                      {h.link && (
                        <p className="text-xs text-primary mt-1 truncate">🔗 {h.link}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(h.created_at).toLocaleString("it-IT")} • {h.recipients_count} destinatari
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(h)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(h)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => fetchHistory(page - 1)}>
                ← Prec
              </Button>
              <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => fetchHistory(page + 1)}>
                Succ →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAnnouncement} onOpenChange={open => !open && setEditingAnnouncement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica annuncio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titolo *</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label>Messaggio *</Label>
              <Textarea value={editMessage} onChange={e => setEditMessage(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Link (opzionale)</Label>
              <Input value={editLink} onChange={e => setEditLink(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAnnouncement(null)}>Annulla</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Salvataggio..." : "Salva modifiche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Parent Role Requests ─── */
const ParentRequestsTab = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pPage, setPPage] = useState(0);

  const fetchRequests = async () => {
    const { data: reqData } = await supabase
      .from("parent_role_requests")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!reqData || reqData.length === 0) { setRequests([]); setLoading(false); return; }
    
    const userIds = reqData.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", userIds);
    
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
    const enriched = reqData.map(r => ({ ...r, profile: profileMap.get(r.user_id) || null }));
    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (id: string, status: "approved" | "rejected", userId: string) => {
    if (status === "approved") {
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "parent" });
      if (roleErr && !roleErr.message.includes("duplicate")) {
        toast({ title: "Errore nell'assegnazione del ruolo", variant: "destructive" });
        return;
      }
    }
    await supabase.from("parent_role_requests").update({ status }).eq("id", id);
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "parent_request",
      title: status === "approved" ? "Richiesta genitore approvata ✅" : "Richiesta genitore rifiutata",
      message: status === "approved"
        ? "La tua richiesta per il ruolo Genitore è stata approvata! Ora puoi gestire i profili dei tuoi figli."
        : "La tua richiesta per il ruolo Genitore è stata rifiutata. Puoi inviare una nuova richiesta dal tuo profilo.",
      link: "/profile",
    });
    toast({ title: status === "approved" ? "Richiesta approvata" : "Richiesta rifiutata" });
    fetchRequests();
  };

  const handleResetRequest = async (id: string) => {
    await supabase.from("parent_role_requests").delete().eq("id", id);
    toast({ title: "Richiesta resettata", description: "L'utente può inviarne una nuova." });
    fetchRequests();
  };

  const handleGrantManually = async (userId: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "parent" });
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("parent_role_requests").update({ status: "approved" }).eq("user_id", userId);
    await supabase.from("notifications").insert({
      user_id: userId, type: "parent_request",
      title: "Ruolo Genitore assegnato ✅",
      message: "Un admin ti ha assegnato manualmente il ruolo Genitore. Ora puoi gestire profili figli e iscriverli ai tornei.",
      link: "/profile",
    });
    toast({ title: "Ruolo Genitore assegnato manualmente" });
    fetchRequests();
  };

  const { getPageItems: getPPageItems } = useAdminPagination(requests);
  const pagedParentRequests = getPPageItems(pPage);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  const pending = requests.filter(r => r.status === "pending");

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Crown size={20} /> Richieste Ruolo Genitore
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-2">{pending.length} in attesa</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.length === 0 ? (
          <p className="text-muted-foreground">Nessuna richiesta.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {pagedParentRequests.map((r) => {
                const profile = r.profile;
                const name = profile?.display_name || profile?.username || "Utente";
                return (
                  <div key={r.id} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{name}</p>
                      <Badge variant={r.status === "pending" ? "outline" : r.status === "approved" ? "default" : "destructive"}>
                        {r.status === "pending" ? "In attesa" : r.status === "approved" ? "Approvato" : "Rifiutato"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      📅 {new Date(r.created_at).toLocaleDateString("it-IT")}
                    </p>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" className="flex-1" onClick={() => handleAction(r.id, "approved", r.user_id)}>
                            <Check size={14} className="mr-1" /> Approva
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleAction(r.id, "rejected", r.user_id)}>
                            <X size={14} className="mr-1" /> Rifiuta
                          </Button>
                        </>
                      )}
                      {r.status === "rejected" && (
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleResetRequest(r.id)}>
                          <RotateCcw size={14} className="mr-1" /> Reset
                        </Button>
                      )}
                      {r.status !== "approved" && (
                        <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleGrantManually(r.user_id)}>
                          <Crown size={14} className="mr-1" /> Forza
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead>Data richiesta</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedParentRequests.map((r) => {
                    const profile = r.profile;
                    const name = profile?.display_name || profile?.username || "Utente";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleDateString("it-IT")}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "pending" ? "outline" : r.status === "approved" ? "default" : "destructive"}>
                            {r.status === "pending" ? "In attesa" : r.status === "approved" ? "Approvato" : "Rifiutato"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {r.status === "pending" && (
                              <>
                                <Button size="sm" onClick={() => handleAction(r.id, "approved", r.user_id)}>
                                  <Check size={14} className="mr-1" /> Approva
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleAction(r.id, "rejected", r.user_id)}>
                                  <X size={14} className="mr-1" /> Rifiuta
                                </Button>
                              </>
                            )}
                            {r.status === "rejected" && (
                              <Button size="sm" variant="outline" onClick={() => handleResetRequest(r.id)}>
                                <RotateCcw size={14} className="mr-1" /> Reset
                              </Button>
                            )}
                            {r.status !== "approved" && (
                              <Button size="sm" variant="secondary" onClick={() => handleGrantManually(r.user_id)}>
                                <Crown size={14} className="mr-1" /> Forza ruolo
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <AdminPagination page={pPage} totalItems={requests.length} onPageChange={setPPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Admin;
