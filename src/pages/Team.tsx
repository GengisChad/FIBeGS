import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTeam } from "@/hooks/useTeam";
import { useTeamStats } from "@/hooks/useTeamStats";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CityCombobox } from "@/components/CityCombobox";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Plus, Search, Crown, Trophy, Swords, LogOut,
  MapPin, Calendar, TrendingUp, Award, Trash2, AlertTriangle, Camera, UserX, Pencil,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ReplaceInviteControl } from "@/components/teams/ReplaceInviteControl";
import { InviteSearchCard } from "@/components/teams/InviteSearchCard";
import { DeckCard } from "@/components/decks/DeckCard";


const StatCard = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) => (
  <Card className="p-3 flex items-center gap-3">
    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="min-w-0">
      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">{label}</div>
      <div className="text-lg font-bold leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  </Card>
);

// Compact member card with fade transition between Stats / Deck
const MemberCard = ({
  profile, stats, isLeader, isPreConfirm, acceptedInvite, canKick, onKick, deck,
  canPromote, onPromote,
}: {
  profile: any; stats: any; isLeader: boolean; isPreConfirm: boolean;
  acceptedInvite: boolean; canKick: boolean; onKick: () => void; deck: any;
  canPromote?: boolean; onPromote?: () => void;
}) => {
  const [view, setView] = useState<"stats" | "deck">("stats");
  const name = profile?.display_name || profile?.username || "?";
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback>{name[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {profile?.username ? (
              <Link to={`/profilo/${profile.username}`} className="font-semibold truncate hover:underline">{name}</Link>
            ) : <span className="font-semibold truncate">{name}</span>}
            {isLeader && <Crown size={12} className="text-amber-500" />}
            {isPreConfirm && acceptedInvite && <Badge variant="outline" className="text-[9px] border-emerald-500 text-emerald-600">Accettato</Badge>}
          </div>
          {profile?.username && <div className="text-[11px] text-muted-foreground truncate">@{profile.username}</div>}
        </div>
        {canPromote && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="outline" className="h-8 w-8 border-amber-500 text-amber-600 hover:bg-amber-500/10"
                title="Trasferisci leadership">
                <Crown size={16} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Trasferire la leadership?</AlertDialogTitle>
                <AlertDialogDescription>
                  {name} diventerà il nuovo Team Leader. Tu perderai i permessi di gestione. L'azione non può essere annullata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => onPromote?.()} className="bg-amber-600 hover:bg-amber-700">
                  Conferma trasferimento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {canKick && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="outline" className="h-8 w-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                title="Rimuovi dalla squadra">
                <UserX size={16} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rimuovere {name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Verrà rimosso dalla squadra. Potrai invitarlo di nuovo in futuro.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => onKick()} className="bg-destructive hover:bg-destructive/90">
                  Rimuovi
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>


      <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-wide text-muted-foreground">
        <span className={view === "stats" ? "text-primary" : ""}>Stats</span>
        <Switch checked={view === "deck"} onCheckedChange={(v) => setView(v ? "deck" : "stats")} />
        <span className={view === "deck" ? "text-primary" : ""}>Deck</span>
      </div>

      <div>
        {view === "stats" ? (
          <div key="stats" className="grid grid-cols-2 gap-2 text-center animate-in fade-in duration-200">
            <div className="bg-muted/50 rounded p-2">
              <div className="text-[10px] text-muted-foreground">Tornei</div>
              <div className="text-sm font-bold">{stats?.tournaments ?? 0}</div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-[10px] text-muted-foreground">Win rate</div>
              <div className="text-sm font-bold">{stats?.winRate ?? 0}%</div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-[10px] text-muted-foreground">V-S-P</div>
              <div className="text-sm font-bold">{stats?.wins ?? 0}-{stats?.losses ?? 0}-{stats?.draws ?? 0}</div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-[10px] text-muted-foreground">Best</div>
              <div className="text-sm font-bold">{stats?.bestPlacement ? `#${stats.bestPlacement}` : "—"}</div>
            </div>
          </div>
        ) : (
          <div key="deck" className="animate-in fade-in duration-200">
            {deck ? (
              <DeckCard deck={deck} compact hideDetail />
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nessun deck preferito impostato
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

type TournamentListItem = {
  tournament_id: string;
  name: string;
  date: string | null;
  best_placement?: number | null;
  placement?: number | null;
  perUser?: Record<string, { wins: number; losses: number; draws: number; placement: number | null; points: number }>;
};

const TournamentList = ({
  items, emptyText, profiles, focusUserId, showMembers,
}: {
  items: TournamentListItem[];
  emptyText: string;
  profiles: Record<string, any>;
  focusUserId?: string;       // when present, show only that user's stats
  showMembers?: string[];     // when present, show stats per listed members (team mode)
}) => (
  items.length === 0 ? (
    <Card className="p-6 text-center text-sm text-muted-foreground">{emptyText}</Card>
  ) : (
    <Card className="divide-y">
      {items.map(t => {
        const place = t.best_placement ?? t.placement ?? null;
        const userIds = focusUserId
          ? [focusUserId]
          : (showMembers || Object.keys(t.perUser || {}));
        return (
          <Link key={t.tournament_id} to={`/tournaments/${t.tournament_id}`}
            className="flex items-start gap-3 p-3 hover:bg-muted transition-colors">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold truncate">{t.name}</div>
                {t.date && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar size={10} />{new Date(t.date).toLocaleDateString("it-IT")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {userIds.map(uid => {
                  const s = t.perUser?.[uid];
                  if (!s) return null;
                  const p = profiles[uid];
                  const label = focusUserId ? null : (p?.display_name || p?.username || "?");
                  return (
                    <div key={uid} className="inline-flex items-center gap-1.5 rounded bg-muted/60 px-2 py-0.5 text-[10px]">
                      {label && <span className="font-semibold">{label}:</span>}
                      <span>{s.wins}-{s.losses}-{s.draws}</span>
                      {s.placement != null && <span className="text-muted-foreground">#{s.placement}</span>}
                      {s.points > 0 && <span className="text-primary font-medium">+{s.points}pt</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            {place != null && (
              <Badge variant={place <= 3 ? "default" : "outline"} className="shrink-0">#{place}</Badge>
            )}
          </Link>
        );
      })}
    </Card>
  )
);

const TeamPage = () => {
  const { user, loading: authLoading } = useAuth();
  const {
    team, members, profiles, isOwner, loading, leaveTeam, disbandTeam, kickMember, updateTeamLogo,
    updateTeamInfo, transferLeadership, inviteUser,
    incomingInvites, incomingProfiles, incomingTeams, respondToInvite,
    pendingOutgoing, acceptedOutgoing, cancelInvite, replaceInvite,
  } = useTeam();

  const memberIds = useMemo(() => members.map(m => m.user_id), [members]);
  const { memberStats, tournaments, aggregate, teamModeTournaments, teamModeAggregate, loading: statsLoading } = useTeamStats(memberIds);
  const pendingCount = pendingOutgoing.length;
  const isPreConfirm = pendingCount > 0;
  const creationTotal = members.length + pendingCount;
  const acceptedInviteUserIds = useMemo(() => new Set(acceptedOutgoing.map(i => i.invited_user_id)), [acceptedOutgoing]);
  const excludeReplacementIds = useMemo(() => [
    ...members.map(m => m.user_id),
    ...pendingOutgoing.map(i => i.invited_user_id),
    ...acceptedOutgoing.map(i => i.invited_user_id),
  ], [members, pendingOutgoing, acceptedOutgoing]);

  // Fetch favorite deck for each member
  const [favoriteDecks, setFavoriteDecks] = useState<Record<string, any>>({});
  useEffect(() => {
    (async () => {
      if (!memberIds.length) { setFavoriteDecks({}); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, favorite_deck_id")
        .in("user_id", memberIds);
      const deckIds = (profs || [])
        .map((p: any) => p.favorite_deck_id)
        .filter(Boolean) as string[];
      if (!deckIds.length) { setFavoriteDecks({}); return; }
      const { data: decks } = await (supabase as any)
        .from("decks")
        .select("id, user_id, name, description, created_at")
        .in("id", deckIds);
      const byUser: Record<string, any> = {};
      (profs || []).forEach((p: any) => {
        const d = (decks || []).find((dk: any) => dk.id === p.favorite_deck_id);
        if (d) byUser[p.user_id] = d;
      });
      setFavoriteDecks(byUser);
    })();
  }, [memberIds.join(",")]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editCity, setEditCity] = useState("");
  useEffect(() => {
    if (editOpen && team) { setEditDesc(team.description || ""); setEditCity(team.city || ""); }
  }, [editOpen, team]);


  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-5xl">

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !team ? (
          <div className="max-w-xl mx-auto space-y-6 text-center">
            <div className="inline-flex h-20 w-20 rounded-full bg-primary/10 items-center justify-center">
              <Users className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Non sei in una squadra</h1>
              <p className="text-muted-foreground mt-2">Crea la tua squadra (max 3 giocatori) o cercane una a cui unirti.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Button asChild size="lg" className="gap-2"><Link to="/squadra/crea"><Plus size={18} /> Crea una Team</Link></Button>
              <Button asChild size="lg" variant="outline" className="gap-2"><Link to="/squadra/cerca"><Search size={18} /> Trova una Team</Link></Button>
            </div>
            {incomingInvites.length > 0 && (
              <Card className="p-4 text-left space-y-3">
                <div className="text-sm font-semibold">Inviti in arrivo</div>
                {incomingInvites.map(inv => {
                  const t = incomingTeams[inv.team_id];
                  const inviter = incomingProfiles[inv.invited_by];
                  return (
                    <div key={inv.id} className="flex items-center gap-3">
                      <Avatar><AvatarImage src={t?.logo_url || undefined} /><AvatarFallback><Users size={14} /></AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{t?.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">da {inviter?.display_name || inviter?.username}</div>
                      </div>
                      <Button size="sm" onClick={() => respondToInvite(inv.id, true)}>Accetta</Button>
                      <Button size="sm" variant="ghost" onClick={() => respondToInvite(inv.id, false)}>Rifiuta</Button>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {isPreConfirm && (
              <Card className="p-4 border-dashed bg-muted/40 flex items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Squadra in attesa di conferma</div>
                  <div className="text-xs text-muted-foreground">
                    {members.length} accettato{members.length > 1 ? "i" : ""} su {creationTotal} · {pendingCount} invito{pendingCount > 1 ? "i" : ""} in sospeso
                  </div>
                </div>
                <Badge variant="outline" className="border-amber-500 text-amber-600">In attesa</Badge>
              </Card>
            )}

            {team.disband_at && (
              <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Squadra a rischio di scioglimento</div>
                  <div className="text-xs text-muted-foreground">
                    Squadra incompleta. Verrà sciolta automaticamente il {new Date(team.disband_at).toLocaleDateString("it-IT")} ({Math.max(0, Math.ceil((new Date(team.disband_at).getTime() - Date.now()) / 86400000))} giorni rimasti) se non viene reintegrata.
                  </div>
                </div>
              </Card>
            )}

            {/* HEADER */}
            <Card className={`p-5 transition ${isPreConfirm ? "opacity-70 grayscale" : ""}`}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={team.logo_url || undefined} />
                    <AvatarFallback><Users className="h-8 w-8" /></AvatarFallback>
                  </Avatar>
                  {isOwner && (
                    <>
                      <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:scale-105 transition"
                        title="Cambia logo">
                        <Camera size={14} />
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) updateTeamLogo(f); e.target.value = ""; }} />
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{team.name}</h1>
                    {isOwner && <Badge variant="default" className="gap-1"><Crown size={11} /> Team Leader</Badge>}
                    <Badge variant="outline">{members.length}/{Math.max(1, creationTotal)}</Badge>
                    {isPreConfirm && <Badge variant="outline" className="border-amber-500 text-amber-600">Creazione pending</Badge>}
                  </div>
                  {team.city && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin size={12} /> {team.city}</div>
                  )}
                  {team.description && <p className="text-sm text-muted-foreground mt-2">{team.description}</p>}
                </div>
                <div className="flex gap-2">
                  {!isOwner && (
                    <Button variant="outline" size="sm" className="gap-1"
                      onClick={() => { if (confirm("Lasciare la squadra?")) leaveTeam(); }}>
                      <LogOut size={14} /> Lascia
                    </Button>
                  )}
                  {isOwner && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditOpen(true)}>
                        <Pencil size={14} /> Modifica
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1"
                        onClick={() => { if (confirm("Sei sicuro? Il ruolo di leader passerà al membro più anziano.")) leaveTeam(); }}>
                        <LogOut size={14} /> Lascia
                      </Button>
                      <Button variant="destructive" size="sm" className="gap-1"
                        onClick={() => { if (confirm("Sciogliere definitivamente la squadra? L'azione è irreversibile.")) disbandTeam(); }}>
                        <Trash2 size={14} /> Sciogli
                      </Button>
                    </>
                  )}

                </div>
              </div>
            </Card>

            {/* MEMBRI */}
            <section>
              <h2 className="text-sm font-bold tracking-wide text-muted-foreground mb-2 uppercase">Membri ({members.length}/{Math.max(3, members.length + pendingCount)})</h2>
              <div className="grid md:grid-cols-3 gap-3">
                {members.map(m => (
                  <MemberCard key={m.user_id}
                    profile={profiles[m.user_id]}
                    stats={memberStats[m.user_id]}
                    isLeader={m.role === "owner"}
                    isPreConfirm={isPreConfirm}
                    acceptedInvite={acceptedInviteUserIds.has(m.user_id)}
                    canKick={isOwner && m.user_id !== user.id}
                    onKick={() => kickMember(m.user_id)}
                    canPromote={isOwner && m.user_id !== user.id && m.role !== "owner"}
                    onPromote={() => transferLeadership(m.user_id)}
                    deck={favoriteDecks[m.user_id]}
                  />
                ))}

                {pendingOutgoing.map(inv => {
                  const p = profiles[inv.invited_user_id];
                  const name = isOwner ? (p?.display_name || p?.username || "Invitato") : "•••••••";
                  return (
                    <Card key={inv.id} className="p-4 space-y-3 border-dashed bg-muted/30 relative">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 opacity-60 grayscale">
                          {isOwner && <AvatarImage src={p?.avatar_url || undefined} />}
                          <AvatarFallback>{isOwner ? name[0] : "?"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold truncate ${isOwner ? "" : "blur-sm select-none"}`}>{name}</div>
                          <Badge variant="outline" className="mt-1 text-[9px] border-amber-500 text-amber-600">In attesa</Badge>
                        </div>
                        {isOwner && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                            onClick={() => { if (confirm("Annullare l'invito?")) cancelInvite(inv.id); }}>
                            Annulla
                          </Button>
                        )}
                      </div>
                      {isOwner && <ReplaceInviteControl inviteId={inv.id} onReplace={replaceInvite} excludeUserIds={excludeReplacementIds} />}
                      <div className="text-[11px] text-muted-foreground italic text-center py-1">
                        Le statistiche saranno disponibili dopo la conferma.
                      </div>
                    </Card>
                  );
                })}
                {members.length + pendingOutgoing.length < 3 && isOwner && (
                  <InviteSearchCard
                    excludeUserIds={excludeReplacementIds}
                    onInvite={inviteUser}
                  />
                )}
              </div>
            </section>

            {/* TORNEI con 4 tab */}
            <section>
              <h2 className="text-sm font-bold tracking-wide text-muted-foreground mb-2 uppercase">Tornei</h2>
              {statsLoading ? (
                <div className="text-sm text-muted-foreground text-center py-6">Caricamento...</div>
              ) : (
                <Tabs defaultValue="team" className="w-full">
                  <TabsList className="w-full flex-wrap h-auto">
                    <TabsTrigger value="team" className="flex-1 min-w-[80px]">Squadra</TabsTrigger>
                    {members.map(m => {
                      const p = profiles[m.user_id];
                      const label = p?.display_name || p?.username || "?";
                      return <TabsTrigger key={m.user_id} value={m.user_id} className="flex-1 min-w-[80px] truncate">{label}</TabsTrigger>;
                    })}
                  </TabsList>
                  <TabsContent value="team" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard icon={Trophy} label="Tornei" value={teamModeAggregate.totalTournaments} />
                      <StatCard icon={Swords} label="V/S/P" value={`${teamModeAggregate.totalWins}/${teamModeAggregate.totalLosses}/${teamModeAggregate.totalDraws}`} />
                      <StatCard icon={TrendingUp} label="Win rate" value={`${teamModeAggregate.winRate}%`} />
                      <StatCard icon={Award} label="Best" value={teamModeAggregate.bestPlacement ? `#${teamModeAggregate.bestPlacement}` : "—"} />
                    </div>
                    <TournamentList items={teamModeTournaments} emptyText="Nessun torneo giocato come squadra." profiles={profiles} showMembers={memberIds} />
                  </TabsContent>
                  {members.map(m => {
                    const s = memberStats[m.user_id];
                    const memberTournaments = tournaments
                      .filter(t => t.members_played.includes(m.user_id));
                    return (
                      <TabsContent key={m.user_id} value={m.user_id} className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <StatCard icon={Trophy} label="Tornei" value={s?.tournaments ?? 0} />
                          <StatCard icon={Swords} label="V/S/P" value={`${s?.wins ?? 0}/${s?.losses ?? 0}/${s?.draws ?? 0}`} />
                          <StatCard icon={TrendingUp} label="Win rate" value={`${s?.winRate ?? 0}%`} />
                          <StatCard icon={Award} label="Best" value={s?.bestPlacement ? `#${s.bestPlacement}` : "—"} />
                        </div>
                        <TournamentList items={memberTournaments} emptyText="Nessun torneo." profiles={profiles} focusUserId={m.user_id} />
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </section>
          </div>
        )}
      </main>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica squadra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Città</Label>
              <CityCombobox value={editCity} onChange={(v) => setEditCity(v)} allowAllRegions placeholder="Cerca comune..." />
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} maxLength={500} placeholder="Racconta qualcosa sulla tua squadra..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Annulla</Button>
            <Button onClick={async () => {
              const ok = await updateTeamInfo({ description: editDesc.trim() || null, city: editCity.trim() || null });
              if (ok) setEditOpen(false);
            }}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default TeamPage;
