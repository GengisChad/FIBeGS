import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SharePreviewButton } from "@/components/SharePreviewButton";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Trophy, Crown, ScrollText, Plus, ArrowLeft, Settings, Users, Search, X, Shield, Clock } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CreateTournamentDialog } from "@/components/tournaments/CreateTournamentDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/forum/RichTextEditor";
import { RichContentRenderer } from "@/components/forum/RichContentRenderer";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { EventFeedbackButton } from "@/components/feedback/EventFeedbackButton";

interface Championship {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rules_text: string | null;
  banner_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  club_required: boolean;
}

interface Sponsor {
  id: string;
  name: string;
  logo_url: string;
  link_url: string | null;
}

interface Tournament {
  id: string;
  title: string;
  location: string;
  city: string;
  event_date: string;
  registration_deadline: string | null;
  status: string;
  max_participants: number;
  is_ranked: boolean;
  event_type?: string | null;
  image_url?: string | null;
  flyer_url?: string | null;
  prize_description?: string | null;
  team_mode?: string | null;
  format?: string | null;
  top_cut_size?: number | null;
  swiss_rounds?: number | null;
  banlist?: string | null;
  clubs: { id: string; name: string; logo_url: string | null; banner_url: string | null } | null;
}

interface RankingEntry {
  user_id: string;
  total_points: number;
  wins: number;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

interface TopPlayer {
  user_id: string;
  placement: number;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

const ChampionshipDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { isAdmin, isSponsor } = useUserRoles();
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<Championship>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [topPodiums, setTopPodiums] = useState<Record<string, TopPlayer[]>>({});
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [managersDialogOpen, setManagersDialogOpen] = useState(false);
  const [managersList, setManagersList] = useState<any[]>([]);
  const [managerSearch, setManagerSearch] = useState("");
  const [managerSearchResults, setManagerSearchResults] = useState<any[]>([]);
  const [managerSearching, setManagerSearching] = useState(false);

  const [refereesDialogOpen, setRefereesDialogOpen] = useState(false);
  const [refereesList, setRefereesList] = useState<any[]>([]);
  const [refereeSearch, setRefereeSearch] = useState("");
  const [refereeSearchResults, setRefereeSearchResults] = useState<any[]>([]);
  const [refereeSearching, setRefereeSearching] = useState(false);

  const championshipActive = championship?.is_active ?? false;
  const canEditManagers = isAdmin && championshipActive;
  const canEditReferees = (isAdmin || isManager) && championshipActive;

  const loadManagers = async (championshipId: string) => {
    const { data } = await supabase
      .from("championship_managers")
      .select("id, user_id")
      .eq("championship_id", championshipId);
    const rows = (data as any) ?? [];
    if (rows.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", rows.map((r: any) => r.user_id));
      const map: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { map[p.user_id] = p; });
      rows.forEach((r: any) => { r.profile = map[r.user_id] || null; });
    }
    setManagersList(rows);
  };

  const openManagersDialog = async () => {
    if (!championship) return;
    setManagerSearch("");
    setManagerSearchResults([]);
    await loadManagers(championship.id);
    setManagersDialogOpen(true);
  };

  const searchManagerUsers = async (q: string) => {
    setManagerSearch(q);
    if (q.length < 2) { setManagerSearchResults([]); return; }
    setManagerSearching(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20);
    const existingIds = managersList.map(m => m.user_id);
    setManagerSearchResults((profiles ?? []).filter((p: any) => !existingIds.includes(p.user_id)));
    setManagerSearching(false);
  };

  const addManagerToChampionship = async (userId: string) => {
    if (!championship) return;
    const { error } = await supabase.from("championship_managers").insert({ championship_id: championship.id, user_id: userId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Gestore aggiunto");
    setManagerSearch("");
    setManagerSearchResults([]);
    await loadManagers(championship.id);
  };

  const removeManagerFromChampionship = async (id: string) => {
    const { error } = await supabase.from("championship_managers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (championship) await loadManagers(championship.id);
  };

  const loadReferees = async (championshipId: string) => {
    const { data } = await supabase
      .from("championship_referees")
      .select("id, user_id")
      .eq("championship_id", championshipId);
    const rows = (data as any) ?? [];
    if (rows.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", rows.map((r: any) => r.user_id));
      const map: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { map[p.user_id] = p; });
      rows.forEach((r: any) => { r.profile = map[r.user_id] || null; });
    }
    setRefereesList(rows);
  };

  const openRefereesDialog = async () => {
    if (!championship) return;
    setRefereeSearch("");
    setRefereeSearchResults([]);
    await loadReferees(championship.id);
    setRefereesDialogOpen(true);
  };

  const searchRefereeUsers = async (q: string) => {
    setRefereeSearch(q);
    if (q.length < 2) { setRefereeSearchResults([]); return; }
    setRefereeSearching(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20);
    const existingIds = refereesList.map(m => m.user_id);
    setRefereeSearchResults((profiles ?? []).filter((p: any) => !existingIds.includes(p.user_id)));
    setRefereeSearching(false);
  };

  const addRefereeToChampionship = async (userId: string) => {
    if (!championship) return;
    const { error } = await supabase.from("championship_referees").insert({ championship_id: championship.id, user_id: userId, added_by: user?.id ?? null } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Arbitro aggiunto");
    setRefereeSearch("");
    setRefereeSearchResults([]);
    await loadReferees(championship.id);
  };

  const removeRefereeFromChampionship = async (id: string) => {
    const { error } = await supabase.from("championship_referees").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (championship) await loadReferees(championship.id);
  };

  useEffect(() => {
    if (!slug) return;
    fetchData();
  }, [slug, user]);

  const fetchData = async () => {
    const { data: champ } = await supabase
      .from("championships")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!champ) { setLoading(false); return; }
    setChampionship(champ as any);

    // Check if user is a manager of this championship
    if (user) {
      const { data: managerRow } = await supabase
        .from("championship_managers")
        .select("id")
        .eq("championship_id", champ.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setIsManager(!!managerRow);
    }

    const [sponsorsRes, tournamentsRes] = await Promise.all([
      supabase.from("championship_sponsors").select("*").eq("championship_id", champ.id).order("sort_order"),
      supabase.from("tournaments").select("*, clubs(id, name, logo_url, banner_url)").eq("championship_id", champ.id).or("event_type.eq.tournament,event_type.eq.national,event_type.is.null").order("event_date", { ascending: false }),
    ]);

    setSponsors((sponsorsRes.data as any) ?? []);
    const allTournaments = (tournamentsRes.data as any) ?? [];
    setTournaments(allTournaments);

    // Load registration counts (confirmed) for each tournament
    if (allTournaments.length > 0) {
      const tIds = allTournaments.map((t: any) => t.id);
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select("tournament_id")
        .in("tournament_id", tIds)
        .eq("status", "confirmed");
      const counts: Record<string, number> = {};
      (regs ?? []).forEach((r: any) => { counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1; });
      setRegistrationCounts(counts);
    }

    // Build internal ranking + per-tournament podiums
    if (allTournaments.length > 0) {
      const tIds = allTournaments.map((t: any) => t.id);
      const { data: results } = await supabase
        .from("tournament_results")
        .select("user_id, scaled_points, placement, tournament_id")
        .in("tournament_id", tIds);

      if (results && results.length > 0) {
        const userMap: Record<string, { total_points: number; wins: number }> = {};
        results.forEach((r: any) => {
          if (!userMap[r.user_id]) userMap[r.user_id] = { total_points: 0, wins: 0 };
          userMap[r.user_id].total_points += r.scaled_points;
          if (r.placement === 1) userMap[r.user_id].wins += 1;
        });

        const userIds = Object.keys(userMap);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, username")
          .in("user_id", userIds);

        const profileMap: Record<string, any> = {};
        (profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p; });

        const rankList: RankingEntry[] = userIds
          .map((uid) => ({
            user_id: uid,
            total_points: userMap[uid].total_points,
            wins: userMap[uid].wins,
            display_name: profileMap[uid]?.display_name || null,
            avatar_url: profileMap[uid]?.avatar_url || null,
            username: profileMap[uid]?.username || null,
          }))
          .filter(r => r.total_points > 0)
          .sort((a, b) => b.total_points - a.total_points);

        setRanking(rankList);

        // Build top3 podium per tournament
        const podiums: Record<string, TopPlayer[]> = {};
        results
          .filter((r: any) => r.placement && r.placement <= 3)
          .sort((a: any, b: any) => a.placement - b.placement)
          .forEach((r: any) => {
            if (!podiums[r.tournament_id]) podiums[r.tournament_id] = [];
            if (podiums[r.tournament_id].length < 3) {
              podiums[r.tournament_id].push({
                user_id: r.user_id,
                placement: r.placement,
                display_name: profileMap[r.user_id]?.display_name || null,
                avatar_url: profileMap[r.user_id]?.avatar_url || null,
                username: profileMap[r.user_id]?.username || null,
              });
            }
          });
        setTopPodiums(podiums);
      }
    }

    setLoading(false);
  };

  const canCreateTournament = (isAdmin || isManager) && championshipActive;
  const canEditChampionship = (isAdmin || isManager) && championshipActive;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 flex items-center justify-center">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!championship) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 text-center">
          <h1 className="text-2xl font-bold">Campionato non trovato</h1>
          <Link to="/tournaments" className="text-primary hover:underline mt-4 inline-block">Torna ai tornei</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const upcomingTournaments = tournaments.filter(t => t.status !== "completed");
  const completedTournaments = tournaments.filter(t => t.status === "completed");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-20 pb-16">
        {/* Back button */}
        <div className="container mx-auto px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tournaments" className="gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Torna ai tornei
            </Link>
          </Button>
        </div>
        {/* Hero Banner */}
        <div
          className="relative w-full h-[280px] md:h-[360px] overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${championship.secondary_color}, ${championship.primary_color}30)` }}
        >
          {championship.banner_url && (
            <img
              src={championship.banner_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover brightness-[0.3]"
            />
          )}
          <div className="relative z-10 container mx-auto px-4 h-full flex items-end pb-8">
            <div className="flex items-end gap-4">
              {championship.logo_url && (
                <img
                  src={championship.logo_url}
                  alt={championship.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-contain bg-white/10 backdrop-blur-sm border border-white/20 p-2"
                />
              )}
              <div>
                <Badge
                  className="mb-2 text-xs"
                  style={{ backgroundColor: `${championship.primary_color}30`, color: championship.primary_color, borderColor: `${championship.primary_color}50` }}
                >
                  CAMPIONATO SPECIALE
                </Badge>
                <h1 className="font-display text-3xl md:text-4xl text-white drop-shadow-lg">
                  {championship.name}
                </h1>
                {championship.description && (
                  <div className="text-white/70 mt-2 max-w-xl text-sm md:text-base rich-content">
                    <RichContentRenderer content={championship.description} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sponsors Carousel */}
        {sponsors.length > 0 && (
          <div className="border-b border-border" style={{ backgroundColor: `${championship.secondary_color}20` }}>
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
                <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">Sponsor</span>
                {sponsors.map((s) => (
                  <a
                    key={s.id}
                    href={s.link_url || "#"}
                    target={s.link_url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                    title={s.name}
                  >
                    <img src={s.logo_url} alt={s.name} className="h-8 md:h-10 object-contain" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 mt-8">
          {!championshipActive && (
            <div className="mb-6">
              <EventFeedbackButton scope="championship" targetId={championship.id} canSubmit={true} />
            </div>
          )}
          <Tabs defaultValue="tournaments" className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="tournaments" className="gap-1.5">
                  <Trophy size={14} /> Tornei
                </TabsTrigger>
                <TabsTrigger value="ranking" className="gap-1.5">
                  <Crown size={14} /> Classifica
                </TabsTrigger>
                {championship.rules_text && (
                  <TabsTrigger value="rules" className="gap-1.5">
                    <ScrollText size={14} /> Regolamento
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="flex gap-2 flex-wrap">
                <SharePreviewButton kind="championship" id={championship.slug} />
                {isAdmin && (
                  <Button variant="outline" onClick={openManagersDialog} className="gap-2" disabled={!championshipActive} title={!championshipActive ? "Campionato chiuso: gestori non modificabili" : undefined}>
                    <Users size={16} /> Gestori
                  </Button>
                )}
                {(isAdmin || isManager) && (
                  <Button variant="outline" onClick={openRefereesDialog} className="gap-2">
                    <ScrollText size={16} /> Arbitri
                  </Button>
                )}
                {canEditChampionship && (
                  <Button variant="outline" onClick={() => { if (championship) setSettingsForm(championship); setSettingsOpen(true); }} className="gap-2">
                    <Settings size={16} /> Impostazioni
                  </Button>
                )}
                {canCreateTournament && (
                  <Button onClick={() => setCreateTournamentOpen(true)} className="gap-2">
                    <Plus size={16} /> Crea Evento
                  </Button>
                )}
                {!championshipActive && (isAdmin || isManager) && (
                  <Badge variant="outline" className="self-center text-xs">Campionato chiuso</Badge>
                )}
              </div>
            </div>

            <TabsContent value="tournaments">
              <div className="space-y-8">
                {upcomingTournaments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                      In programma / In corso
                    </h3>
                    <div className="space-y-4">
                      {upcomingTournaments.map((t) => (
                        <TournamentCard
                          key={t.id}
                          tournament={t}
                          primaryColor={championship.primary_color}
                          championshipBanner={championship.banner_url}
                          registeredCount={registrationCounts[t.id] || 0}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {completedTournaments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                      Conclusi
                    </h3>
                    <div className="space-y-3">
                      {completedTournaments.map((t) => (
                        <TournamentCard
                          key={t.id}
                          tournament={t}
                          primaryColor={championship.primary_color}
                          championshipBanner={championship.banner_url}
                          registeredCount={registrationCounts[t.id] || 0}
                          completed
                          podium={topPodiums[t.id]}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {tournaments.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nessun torneo ancora programmato per questo campionato.</p>
                    {canCreateTournament && (
                      <Button onClick={() => setCreateTournamentOpen(true)} className="mt-4 gap-2" variant="outline">
                        <Plus size={16} /> Crea il primo torneo
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ranking">
              {ranking.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nessun risultato disponibile</p>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {ranking.map((r, i) => (
                        <Link
                          key={r.user_id}
                          to={r.username ? `/profilo/${r.username}` : "#"}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
                        >
                          <span
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{
                              backgroundColor: i < 3 ? `${championship.primary_color}30` : undefined,
                              color: i < 3 ? championship.primary_color : undefined,
                            }}
                          >
                            {i + 1}
                          </span>
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                              {(r.display_name || "?")[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{r.display_name || r.username || "Anonimo"}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm" style={{ color: championship.primary_color }}>
                              {r.total_points} pts
                            </p>
                            {r.wins > 0 && (
                              <p className="text-xs text-muted-foreground">{r.wins} {r.wins === 1 ? "vittoria" : "vittorie"}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {championship.rules_text && (
              <TabsContent value="rules">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="prose prose-invert max-w-none text-sm text-foreground/90">
                      <RichContentRenderer content={championship.rules_text} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Create Tournament Dialog */}
      {canCreateTournament && championship && (
        <CreateTournamentDialog
          open={createTournamentOpen}
          onOpenChange={setCreateTournamentOpen}
          clubId=""
          championshipId={championship.id}
          onCreated={fetchData}
        />
      )}

      {/* Championship Settings Dialog */}
      {canEditChampionship && championship && (
        <Dialog open={settingsOpen} onOpenChange={(o) => {
          setSettingsOpen(o);
          if (o) setSettingsForm(championship);
        }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Impostazioni Campionato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Nome</Label>
                <Input value={settingsForm.name ?? ""} onChange={(e) => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Descrizione</Label>
                <RichTextEditor
                  initialContent={settingsForm.description ?? ""}
                  onChange={(html) => setSettingsForm(f => ({ ...f, description: html }))}
                  placeholder="Descrizione del campionato..."
                />
              </div>
              <div>
                <Label>Regolamento</Label>
                <RichTextEditor
                  initialContent={settingsForm.rules_text ?? ""}
                  onChange={(html) => setSettingsForm(f => ({ ...f, rules_text: html }))}
                  placeholder="Regole specifiche del campionato..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>URL Logo</Label>
                  <Input value={settingsForm.logo_url ?? ""} onChange={(e) => setSettingsForm(f => ({ ...f, logo_url: e.target.value }))} />
                </div>
                <div>
                  <Label>URL Banner</Label>
                  <Input value={settingsForm.banner_url ?? ""} onChange={(e) => setSettingsForm(f => ({ ...f, banner_url: e.target.value }))} />
                </div>
                <div>
                  <Label>Colore primario</Label>
                  <Input type="color" value={settingsForm.primary_color ?? "#000000"} onChange={(e) => setSettingsForm(f => ({ ...f, primary_color: e.target.value }))} />
                </div>
                <div>
                  <Label>Colore secondario</Label>
                  <Input type="color" value={settingsForm.secondary_color ?? "#000000"} onChange={(e) => setSettingsForm(f => ({ ...f, secondary_color: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label className="text-sm">Club obbligatorio</Label>
                  <p className="text-xs text-muted-foreground">Richiedi l'appartenenza a un club per partecipare</p>
                </div>
                <Switch checked={!!settingsForm.club_required} onCheckedChange={(v) => setSettingsForm(f => ({ ...f, club_required: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label className="text-sm">Campionato attivo</Label>
                  <p className="text-xs text-muted-foreground">Visibile pubblicamente</p>
                </div>
                <Switch checked={!!settingsForm.is_active} onCheckedChange={(v) => setSettingsForm(f => ({ ...f, is_active: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Annulla</Button>
              <Button
                disabled={savingSettings}
                onClick={async () => {
                  setSavingSettings(true);
                  const payload = {
                    name: settingsForm.name,
                    description: settingsForm.description || null,
                    rules_text: settingsForm.rules_text || null,
                    logo_url: settingsForm.logo_url || null,
                    banner_url: settingsForm.banner_url || null,
                    primary_color: settingsForm.primary_color,
                    secondary_color: settingsForm.secondary_color,
                    club_required: !!settingsForm.club_required,
                    is_active: !!settingsForm.is_active,
                  };
                  const { error } = await supabase.from("championships").update(payload).eq("id", championship.id);
                  setSavingSettings(false);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Impostazioni salvate");
                  setSettingsOpen(false);
                  fetchData();
                }}
              >
                {savingSettings ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Managers Dialog (admin only) */}
      {isAdmin && championship && (
        <Dialog open={managersDialogOpen} onOpenChange={setManagersDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users size={18} /> Gestori - {championship.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Qualsiasi utente può essere assegnato come gestore: avrà un ruolo temporaneo legato al campionato (creazione/gestione tornei e impostazioni). Quando il campionato non è più attivo i gestori non potranno più essere modificati.
              </p>
              {managersList.length > 0 ? (
                <div className="space-y-2">
                  {managersList.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                      {m.profile?.avatar_url ? (
                        <img src={m.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {(m.profile?.display_name || m.profile?.username || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.profile?.display_name || m.profile?.username || "Utente"}</p>
                        {m.profile?.username && <p className="text-xs text-muted-foreground">@{m.profile.username}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">Gestore</Badge>
                      {canEditManagers && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeManagerFromChampionship(m.id)}>
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun gestore assegnato</p>
              )}

              {canEditManagers ? (
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-sm font-medium">Aggiungi Gestore</p>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={managerSearch}
                      onChange={(e) => searchManagerUsers(e.target.value)}
                      placeholder="Cerca utenti per nome o username..."
                      className="pl-9"
                    />
                  </div>
                  {managerSearching && <p className="text-xs text-muted-foreground">Ricerca...</p>}
                  {managerSearchResults.length > 0 && (
                    <div className="space-y-2">
                      {managerSearchResults.map((p) => (
                        <div key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {(p.display_name || p.username || "?")[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.display_name || p.username}</p>
                            {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                          </div>
                          <Button size="sm" onClick={() => addManagerToChampionship(p.user_id)} className="gap-1 shrink-0">
                            <Plus size={14} /> Aggiungi
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {managerSearch.length >= 2 && managerSearchResults.length === 0 && !managerSearching && (
                    <p className="text-xs text-muted-foreground text-center py-2">Nessun utente trovato.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
                  Il campionato è chiuso: i gestori non possono essere modificati.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Referees Dialog (admin or manager) */}
      {(isAdmin || isManager) && championship && (
        <Dialog open={refereesDialogOpen} onOpenChange={setRefereesDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScrollText size={18} /> Arbitri abilitati - {championship.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Gli utenti aggiunti potranno arbitrare questo campionato e tutti i tornei al suo interno. Quando il campionato non è più attivo, la lista non potrà essere modificata.
              </p>
              {refereesList.length > 0 ? (
                <div className="space-y-2">
                  {refereesList.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                      {m.profile?.avatar_url ? (
                        <img src={m.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {(m.profile?.display_name || m.profile?.username || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.profile?.display_name || m.profile?.username || "Utente"}</p>
                        {m.profile?.username && <p className="text-xs text-muted-foreground">@{m.profile.username}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">Arbitro</Badge>
                      {canEditReferees && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeRefereeFromChampionship(m.id)}>
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun arbitro abilitato</p>
              )}

              {canEditReferees ? (
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-sm font-medium">Aggiungi Arbitro</p>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={refereeSearch}
                      onChange={(e) => searchRefereeUsers(e.target.value)}
                      placeholder="Cerca per nickname o nome..."
                      className="pl-9"
                    />
                  </div>
                  {refereeSearching && <p className="text-xs text-muted-foreground">Ricerca...</p>}
                  {refereeSearchResults.length > 0 && (
                    <div className="space-y-2">
                      {refereeSearchResults.map((p) => (
                        <div key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {(p.display_name || p.username || "?")[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.display_name || p.username}</p>
                            {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                          </div>
                          <Button size="sm" onClick={() => addRefereeToChampionship(p.user_id)} className="gap-1 shrink-0">
                            <Plus size={14} /> Aggiungi
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {refereeSearch.length >= 2 && refereeSearchResults.length === 0 && !refereeSearching && (
                    <p className="text-xs text-muted-foreground text-center py-2">Nessun utente trovato.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
                  Il campionato è chiuso: la lista arbitri non può essere modificata.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const formatLabel = (t: { swiss_rounds?: number | null; top_cut_size?: number | null; format?: string | null }) => {
  const parts: string[] = [];
  if (t.swiss_rounds && t.swiss_rounds > 0) parts.push("Swiss");
  if (t.top_cut_size && t.top_cut_size > 0) parts.push(`Top ${t.top_cut_size}`);
  if (parts.length === 0) {
    if (t.format === "swiss") return "Swiss";
    if (t.format === "round_robin") return "Round Robin";
    return null;
  }
  return parts.join(" + ");
};

const TournamentCard = ({
  tournament,
  primaryColor,
  championshipBanner,
  registeredCount,
  completed,
  podium,
}: {
  tournament: Tournament;
  primaryColor: string;
  championshipBanner?: string | null;
  registeredCount?: number;
  completed?: boolean;
  podium?: TopPlayer[];
}) => {
  const isNational = tournament.event_type === "national";
  const year = new Date(tournament.event_date).getFullYear();
  const medalColor = (p: number) => p === 1 ? "text-amber-400" : p === 2 ? "text-slate-300" : "text-orange-400";
  const bannerSrc = tournament.flyer_url || tournament.image_url || tournament.clubs?.banner_url || championshipBanner || null;
  const deadlinePassed = tournament.registration_deadline ? new Date(tournament.registration_deadline) < new Date() : false;
  const fmtLabel = formatLabel(tournament);
  const teamLabel = tournament.team_mode === "teams" ? (
    <><Users size={11} aria-hidden="true" /> SQUADRE</>
  ) : tournament.team_mode === "clubs" ? (
    <><Shield size={11} aria-hidden="true" /> CLUB</>
  ) : (
    <><Users size={11} aria-hidden="true" /> SOLO</>
  );
  const count = registeredCount ?? 0;

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden card-glow relative ${
      isNational ? "border-amber-400/60" : "border-border"
    }`}>
      {bannerSrc ? (
        <div className="absolute inset-0 z-0">
          <img src={bannerSrc} alt="" className={`w-full h-full object-cover ${completed ? "blur-sm brightness-[0.2]" : "blur-sm brightness-[0.25]"}`} />
          <div className={`absolute inset-0 ${isNational ? "bg-gradient-to-br from-amber-500/15 via-background/55 to-background/75" : "bg-gradient-to-br from-background/50 via-background/60 to-background/75"}`} />
        </div>
      ) : (
        <div className={`absolute inset-0 z-0 ${
          isNational ? "bg-gradient-to-br from-amber-500/10 via-card to-card" : completed ? "bg-muted/30" : "bg-card"
        }`} />
      )}

      <div className="p-4 md:p-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 flex gap-3 min-w-0">
            {tournament.clubs?.logo_url && (
              <Link to={`/clubs/${tournament.clubs.id}`} className="shrink-0">
                <img src={tournament.clubs.logo_url} alt={tournament.clubs.name} className="w-12 h-12 rounded-full object-cover border-2 border-primary/30 bg-card" />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {isNational && (
                  <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-400/50 gap-1 px-2 py-0.5">
                    <Crown size={10} /> NAZIONALE
                  </Badge>
                )}
                <Badge
                  className="text-xs px-2 py-0.5"
                  style={{
                    backgroundColor: completed ? undefined : `${primaryColor}20`,
                    color: completed ? undefined : primaryColor,
                    borderColor: completed ? undefined : `${primaryColor}40`,
                  }}
                  variant={completed ? "secondary" : "default"}
                >
                  {completed ? "CONCLUSO" : tournament.status === "pending" ? "IN PROGRAMMA" : "IN CORSO"}
                </Badge>
                <Badge className={tournament.is_ranked ? "bg-green-500/20 text-green-400 border-green-500/30 text-xs px-2 py-0.5" : "bg-muted/50 text-muted-foreground border-border text-xs px-2 py-0.5"}>
                  {tournament.is_ranked ? "RANKED" : "NORMAL"}
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-2 py-0.5">{teamLabel}</Badge>
                {fmtLabel && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs px-2 py-0.5">{fmtLabel}</Badge>
                )}
                {!completed && deadlinePassed && (
                  <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium">Chiuso</span>
                )}
              </div>
              <h2 className="font-display text-xl md:text-2xl mb-1 leading-tight">
                <Link to={`/tournaments/${tournament.id}`} className="hover:text-primary transition-colors">{tournament.title}</Link>
              </h2>
              {tournament.clubs && (
                <Link to={`/clubs/${tournament.clubs.id}`} className="inline-flex items-center gap-1 text-primary text-xs hover:underline mb-2">
                  <Shield size={12} />{tournament.clubs.name}
                </Link>
              )}
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar size={14} className="text-primary shrink-0" /><span>{format(new Date(tournament.event_date), "d MMMM yyyy, HH:mm", { locale: it })}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={14} className="text-primary shrink-0" /><span className="truncate">{tournament.location}{tournament.city ? `, ${tournament.city}` : ""}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Users size={14} className="text-primary shrink-0" /><span>{count}/{tournament.max_participants} iscritti</span></div>
                {!completed && tournament.registration_deadline && (
                  <div className="flex items-center gap-2 text-muted-foreground"><Clock size={14} className="text-primary shrink-0" /><span>Entro: {format(new Date(tournament.registration_deadline), "d MMM", { locale: it })}</span></div>
                )}
              </div>
              {tournament.prize_description && (
                <div className="flex items-center gap-2 mt-2 text-sm"><Trophy size={14} className="text-primary shrink-0" /><span className="font-medium">{tournament.prize_description}</span></div>
              )}
            </div>
          </div>
          <div className="lg:text-right shrink-0">
            <Link to={`/tournaments/${tournament.id}`}>
              <Button variant={completed ? "outline" : "hero"} size="sm">
                {completed ? "Vedi risultati" : "Apri torneo"}
              </Button>
            </Link>
          </div>
        </div>

      {/* Top 3 podium for completed tournaments */}
      {completed && podium && podium.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-3 gap-2">
          {podium.map((p) => (
            <div key={p.user_id} className="flex flex-col items-center text-center gap-1 min-w-0">
              <div className="relative">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className={`w-10 h-10 rounded-full object-cover ring-2 ${p.placement === 1 ? "ring-amber-400" : p.placement === 2 ? "ring-slate-300" : "ring-orange-400"}`} />
                ) : (
                  <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs ring-2 ${p.placement === 1 ? "ring-amber-400" : p.placement === 2 ? "ring-slate-300" : "ring-orange-400"}`}>
                    {(p.display_name || "?")[0]}
                  </div>
                )}
                <span className={`absolute -bottom-1 -right-1 text-[10px] font-bold rounded-full bg-card border border-border w-5 h-5 flex items-center justify-center ${medalColor(p.placement)}`}>
                  {p.placement}
                </span>
              </div>
              <span className="text-[11px] font-medium truncate w-full">{p.display_name || p.username || "Anonimo"}</span>
              {p.placement === 1 && isNational && (
                <Badge className="text-[9px] bg-gradient-to-r from-amber-500 to-yellow-500 text-black border-0 gap-0.5 px-1.5">
                  <Crown size={8} /> Campione Nazionale {year}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default ChampionshipDetail;
