import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useFriends } from "@/hooks/useFriends";
import { useTeam } from "@/hooks/useTeam";
import { useChatDock } from "@/stores/chatDockStore";
import { useSidebarState } from "@/contexts/SidebarStateContext";
import { openOrCreateChat } from "@/hooks/usePrivateChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReplaceInviteControl } from "@/components/teams/ReplaceInviteControl";
import {
  Users, Globe, MessageCircle, Check, X, Crown, Shield, MapPin,
  Plus, Search, LogOut, EyeOff, ChevronRight, ChevronLeft,
  MessageSquare, Coffee, ExternalLink,
} from "lucide-react";

const ChatHubDialog = lazy(() => import("@/components/chat/ChatHubDialog"));
const CreateTeamDialog = lazy(() => import("@/components/teams/CreateTeamDialog"));
const FindTeamDialog = lazy(() => import("@/components/teams/FindTeamDialog"));


type Club = { id: string; name: string; logo_url: string | null };
type QueryError = { message: string } | null;
type UntypedQueryResult<T> = { data: T | null; error: QueryError };
type UntypedQuery<T> = PromiseLike<UntypedQueryResult<T>> & {
  select: (columns: string) => UntypedQuery<T>;
  eq: (column: string, value: unknown) => UntypedQuery<T>;
  in: (column: string, values: unknown[]) => UntypedQuery<T>;
  limit: (count: number) => UntypedQuery<T>;
};
const fromUntyped = <T,>(table: string) =>
  (supabase as unknown as { from: (table: string) => UntypedQuery<T> }).from(table);

export const RightSidebar = () => {
  const { user } = useAuth();
  const { collapsed, toggle } = useSidebarState();
  const { friends, incoming, profiles, respond } = useFriends();
  const {
    team, members, profiles: teamProfiles, pendingOutgoing, acceptedOutgoing,
    incomingInvites, incomingProfiles, incomingTeams,
    respondToInvite, cancelInvite, leaveTeam, replaceInvite, isOwner,
  } = useTeam();
  const { openChat } = useChatDock();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [chatHubOpen, setChatHubOpen] = useState(false);
  const [chatHubInitialTab, setChatHubInitialTab] = useState<"friends" | "clubs" | "regional" | "global" | "legacy">("friends");
  const [hasRegionalStaff, setHasRegionalStaff] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [findTeamOpen, setFindTeamOpen] = useState(false);

  useEffect(() => {
    if (!user) { setClubs([]); return; }
    (async () => {
      const { data: mems } = await supabase.from("club_members").select("club_id").eq("user_id", user.id);
      const ids = (mems || []).map((m: { club_id: string }) => m.club_id);
      if (ids.length === 0) { setClubs([]); return; }
      const { data: cs } = await supabase.from("clubs").select("id, name, logo_url").in("id", ids).eq("is_active", true);
      setClubs((cs || []) as Club[]);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) { setHasRegionalStaff(false); return; }
    (async () => {
      const [{ data: members }, { data: roles }, { data: refs }, { data: leaders }] = await Promise.all([
        fromUntyped<Array<{ channel_id: string }>>("regional_channel_members").select("channel_id").eq("user_id", user.id).limit(1),
        fromUntyped<Array<{ role: string }>>("user_roles").select("role").eq("user_id", user.id),
        fromUntyped<Array<{ id: string }>>("regional_referents").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
        fromUntyped<Array<{ role: string }>>("club_members").select("role").eq("user_id", user.id).in("role", ["owner", "leader", "admin", "co_leader"]).limit(1),
      ]);
      const roleNames = new Set((roles ?? []).map((r) => r.role));
      setHasRegionalStaff(
        (members?.length ?? 0) > 0 ||
        roleNames.has("admin") ||
        roleNames.has("regional_referent") ||
        (refs?.length ?? 0) > 0 ||
        (leaders?.length ?? 0) > 0
      );
    })();
  }, [user]);

  // Collapsed: tiny re-open tab (for both guest and logged in)
  if (collapsed) {
    return (
      <button
        onClick={toggle}
        title="Mostra barra laterale"
        className="hidden lg:flex fixed top-1/2 right-0 -translate-y-1/2 z-40 items-center justify-center w-6 h-16 rounded-l-md bg-card border border-r-0 border-border hover:bg-muted transition-colors"
      >
        <ChevronLeft size={14} className="text-muted-foreground" />
      </button>
    );
  }

  // Guest variant: placeholders + donate
  if (!user) {
    const LockedSection = ({ title, icon: Icon, desc }: { title: string; icon: typeof Users; desc: string }) => (
      <section className="px-3 pt-4 pb-2 border-t border-border/60 shrink-0 first:border-t-0 first:pt-3">
        <div className="ibnf-hud-eyebrow ibnf-hud-eyebrow--mute mb-2 px-1">{title}</div>
        <div className="ibnf-hud-tile p-3 flex flex-col items-center text-center gap-2">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
            <Icon size={16} style={{ color: "var(--ibnf-violet)" }} />
          </div>
          <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
          <Button asChild size="sm" variant="outline" className="w-full mt-1">
            <Link to="/auth">Accedi</Link>
          </Button>
        </div>
      </section>
    );
    return (
      <aside
        className="ibnf-hud-scope hidden lg:flex fixed top-[9px] right-3 bottom-3 w-[236px] 2xl:w-[268px] glass-card !rounded-2xl z-40 flex-col overflow-hidden p-0"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="relative flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
          <span className="ibnf-hud-edge ibnf-hud-edge--r" />
          <div className="ibnf-hud-eyebrow">Hub Sociale</div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggle} title="Nascondi">
            <ChevronRight size={14} />
          </Button>
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <LockedSection title="CHAT" icon={Globe} desc="Accedi per usare la chat globale, di club e privata." />
          <LockedSection title="AMICI" icon={Users} desc="Accedi per aggiungere amici e chattare con loro." />
          <LockedSection title="SQUADRA" icon={Shield} desc="Accedi per creare o unirti a una squadra." />
          <section className="px-3 py-3 border-t border-border/60 shrink-0 mt-auto space-y-1.5">
            <Button size="sm" variant="outline" className="ibnf-hud-btn ibnf-hud-btn--ghost"
              onClick={() => window.dispatchEvent(new CustomEvent("open-feedback"))}>
              <MessageSquare size={14} /> Feedback
            </Button>
            <Button size="sm" variant="default" className="ibnf-hud-btn ibnf-hud-btn--accent"
              onClick={() => window.dispatchEvent(new CustomEvent("open-donate"))}>
              <Coffee size={14} /> Supportaci
            </Button>
          </section>
        </div>
      </aside>
    );
  }

  const startChat = async (peerId: string, peer: { display_name: string | null; username: string | null; avatar_url: string | null }) => {
    const chatId = await openOrCreateChat(user.id, peerId);
    if (!chatId) return;
    openChat({
      kind: "private",
      peerId, chatId,
      displayName: peer.display_name || peer.username || "Amico",
      avatarUrl: peer.avatar_url,
      username: peer.username,
    });
  };

  const openGlobal = () => {
    openChat({
      kind: "global",
      displayName: "Chat Globale",
      avatarUrl: null,
      username: null,
    });
  };

  const openRegional = () => {
    setChatHubInitialTab("regional");
    setChatHubOpen(true);
  };

  const openClub = (c: Club) => {
    openChat({
      kind: "club",
      clubId: c.id,
      displayName: c.name,
      avatarUrl: c.logo_url,
      username: null,
    });
  };

  const SectionTitle = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-2 px-1">
      <div className="ibnf-hud-eyebrow ibnf-hud-eyebrow--mute">{children}</div>
      {action}
    </div>
  );
  const teamPending = pendingOutgoing.length > 0;
  const replacementExclusions = [
    ...members.map(m => m.user_id),
    ...pendingOutgoing.map(i => i.invited_user_id),
    ...acceptedOutgoing.map(i => i.invited_user_id),
  ];

  return (
    <>
      <aside
        className="ibnf-hud-scope hidden lg:flex fixed top-[9px] right-3 bottom-3 w-[236px] 2xl:w-[268px] glass-card !rounded-2xl z-40 flex-col overflow-hidden p-0"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
          <span className="ibnf-hud-edge ibnf-hud-edge--r" />
          <div className="ibnf-hud-eyebrow">Hub Sociale</div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggle} title="Nascondi">
            <ChevronRight size={14} />
          </Button>
        </div>



        <div className="flex-1 flex flex-col min-h-0">
          {/* CHAT RAPIDE */}
          <section className="p-3 pb-1 shrink-0">
            <SectionTitle>CHAT</SectionTitle>
            <div className="space-y-1.5">
              <button onClick={openGlobal} className="ibnf-hud-tile ibnf-hud-row">
                <span className="ibnf-hud-iconbadge">
                  <Globe size={16} />
                </span>
                <span className="text-sm font-medium flex-1 text-left">Chat Globale</span>
                <MessageCircle size={14} style={{ color: "color-mix(in srgb, var(--ibnf-ink) 45%, transparent)" }} />
              </button>

              {hasRegionalStaff && (
                <button onClick={openRegional} className="ibnf-hud-tile ibnf-hud-row">
                  <span className="ibnf-hud-iconbadge">
                    <MapPin size={16} />
                  </span>
                  <span className="text-sm font-medium flex-1 text-left">Staff Regionale</span>
                  <MessageCircle size={14} style={{ color: "color-mix(in srgb, var(--ibnf-ink) 45%, transparent)" }} />
                </button>
              )}

              {clubs.map(c => (
                <button key={c.id} onClick={() => openClub(c)} className="ibnf-hud-tile ibnf-hud-row">
                  <span className="ibnf-hud-iconbadge">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.logo_url || undefined} />
                      <AvatarFallback className="text-[10px]"><Shield size={12} /></AvatarFallback>
                    </Avatar>
                  </span>
                  <span className="text-sm font-medium flex-1 text-left truncate">{c.name}</span>
                  <MessageCircle size={14} style={{ color: "color-mix(in srgb, var(--ibnf-ink) 45%, transparent)" }} />
                </button>
              ))}
            </div>
          </section>

          {/* AMICI — l'unica area che scorre */}
          <section className="px-3 pt-4 pb-1 flex-1 min-h-0 flex flex-col">
            <SectionTitle action={
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setChatHubInitialTab("friends"); setChatHubOpen(true); }} title="Aggiungi amici">
                <Plus size={12} />
              </Button>
            }>AMICI ({friends.length})</SectionTitle>

            {incoming.length > 0 && (
              <div className="mb-2 space-y-1 rounded-md border border-primary/30 bg-primary/5 p-2 shrink-0">
                <div className="text-[10px] font-bold text-primary mb-1">
                  {incoming.length} RICHIEST{incoming.length > 1 ? "E" : "A"} D'AMICIZIA
                </div>
                {incoming.map(r => {
                  const other = r.user_a === user.id ? r.user_b : r.user_a;
                  const p = profiles[other];
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6"><AvatarImage src={p?.avatar_url || undefined} /><AvatarFallback>{(p?.display_name || p?.username || "?")[0]}</AvatarFallback></Avatar>
                      <span className="text-xs truncate flex-1">{p?.display_name || p?.username || "Utente"}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => respond(r.id, true)}><Check size={12} className="text-emerald-500" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => respond(r.id, false)}><X size={12} className="text-destructive" /></Button>
                    </div>
                  );
                })}
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0 -mx-1">
              <div className="px-1">
                {friends.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground px-1 py-2">Nessun amico ancora. Premi + per cercare giocatori.</div>
                ) : (
                  <div className="space-y-0.5">
                    {friends.map(r => {
                      const other = r.user_a === user.id ? r.user_b : r.user_a;
                      const p = profiles[other];
                      if (!p) return null;
                      const name = p.display_name || p.username || "?";
                      return (
                        <button key={r.id} onClick={() => startChat(p.user_id, p)}
                          className="ibnf-hud-row group">
                          <Avatar className="h-7 w-7"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar>
                          <span className="text-sm truncate flex-1 text-left">{name}</span>
                          <MessageCircle size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>

          {/* SQUADRA */}
          <section className="px-3 pt-4 pb-2 border-t border-border/60 shrink-0">
            <SectionTitle action={
              team ? (
                <Link to="/squadra" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  Apri <ExternalLink size={9} />
                </Link>
              ) : null
            }>SQUADRA</SectionTitle>

            {incomingInvites.length > 0 && (
              <div className="mb-2 space-y-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                <div className="text-[10px] font-bold text-primary">
                  {incomingInvites.length} INVITO IN SQUADRA
                </div>
                {incomingInvites.map(inv => {
                  const inviter = incomingProfiles[inv.invited_by];
                  const t = incomingTeams[inv.team_id];
                  return (
                    <div key={inv.id} className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={t?.logo_url || undefined} />
                        <AvatarFallback><Users size={12} /></AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{t?.name || "Squadra"}</div>
                        <div className="text-[10px] text-muted-foreground truncate">da {inviter?.display_name || inviter?.username || "qualcuno"}</div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => respondToInvite(inv.id, true)} disabled={!!team}>
                        <Check size={12} className="text-emerald-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => respondToInvite(inv.id, false)}>
                        <X size={12} className="text-destructive" />
                      </Button>
                    </div>
                  );
                })}
                {team && <div className="text-[10px] text-muted-foreground">Lascia la squadra attuale per poter accettare.</div>}
              </div>
            )}

            {!team ? (
              <div className="space-y-1.5">
                <Button size="sm" variant="default" className="ibnf-hud-btn ibnf-hud-btn--primary" onClick={() => setCreateTeamOpen(true)}>
                  <Plus size={14} /> Crea una squadra
                </Button>
                <Button size="sm" variant="outline" className="ibnf-hud-btn ibnf-hud-btn--glass" onClick={() => setFindTeamOpen(true)}>
                  <Search size={14} /> Trova una squadra
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 p-2 ibnf-hud-tile ${teamPending ? "ibnf-hud-tile--pending opacity-70 grayscale" : ""}`}>
                  <Link to="/squadra" className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80">
                    <Avatar className={`h-9 w-9 ${teamPending ? "opacity-70" : ""}`}>
                      <AvatarImage src={team.logo_url || undefined} />
                      <AvatarFallback><Users size={14} /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{team.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {teamPending ? "In attesa accettazione membri" : team.city}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{members.length}/{Math.max(3, members.length + pendingOutgoing.length)}</Badge>
                  </Link>
                  {!teamPending && (
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => openChat({ kind: "team", teamId: team.id, displayName: team.name, avatarUrl: team.logo_url, username: null })}
                      title="Chat di squadra">
                      <MessageCircle size={14} />
                    </Button>
                  )}
                </div>
                {team.disband_at && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-[10px] text-destructive">
                    Scioglimento previsto il {new Date(team.disband_at).toLocaleDateString("it-IT")}
                  </div>
                )}
                {teamPending && (
                  <div className="rounded-md border border-dashed border-border bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
                    Squadra in creazione · {pendingOutgoing.length} pending
                  </div>
                )}

                <div className="space-y-0.5">
                  {members.map(m => {
                    const p = teamProfiles[m.user_id];
                    if (!p || m.user_id === user.id) return null;
                    const name = p.display_name || p.username || "?";
                    return (
                      <button key={m.user_id} onClick={() => startChat(m.user_id, p)}
                        className="ibnf-hud-row group">
                        <Avatar className="h-7 w-7"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar>
                        <span className="text-sm truncate flex-1 text-left">{name}</span>
                        {m.role === "owner" && <Crown size={11} className="text-amber-500" />}
                        <MessageCircle size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>

                {pendingOutgoing.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-[10px] font-bold text-muted-foreground mb-1 px-1 flex items-center gap-1">
                      IN ATTESA <Badge variant="outline" className="text-[9px] px-1 py-0">{pendingOutgoing.length}</Badge>
                    </div>
                    <div className="space-y-0.5">
                      {pendingOutgoing.map(inv => {
                        const p = teamProfiles[inv.invited_user_id];
                        const showName = isOwner;
                        const name = showName ? (p?.display_name || p?.username || "?") : "•••••••";
                        return (
                          <div key={inv.id} className="space-y-1 rounded-md bg-muted/40 p-1.5">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 opacity-50">
                                {showName ? <AvatarImage src={p?.avatar_url || undefined} /> : null}
                                <AvatarFallback>{showName ? name[0] : <EyeOff size={10} />}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs truncate flex-1 text-muted-foreground italic">{name}</span>
                              {isOwner && (
                                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => cancelInvite(inv.id)}>
                                  <X size={10} />
                                </Button>
                              )}
                            </div>
                            {isOwner && (
                              <ReplaceInviteControl
                                inviteId={inv.id}
                                onReplace={replaceInvite}
                                excludeUserIds={replacementExclusions}
                                compact
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isOwner && (
                  <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm("Lasciare la squadra?")) leaveTeam(); }}>
                    <LogOut size={12} /> Lascia squadra
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* FOOTER — Feedback & Donate */}
          <section className="px-3 py-3 border-t border-border/60 shrink-0 space-y-1.5">
            <Button size="sm" variant="outline" className="ibnf-hud-btn ibnf-hud-btn--ghost"
              onClick={() => window.dispatchEvent(new CustomEvent("open-feedback"))}>
              <MessageSquare size={14} /> Feedback
            </Button>
            <Button size="sm" variant="default" className="ibnf-hud-btn ibnf-hud-btn--accent"
              onClick={() => window.dispatchEvent(new CustomEvent("open-donate"))}>
              <Coffee size={14} /> Supportaci
            </Button>
          </section>
        </div>
      </aside>

      <Suspense fallback={null}>
        {chatHubOpen && <ChatHubDialog open={chatHubOpen} onOpenChange={setChatHubOpen} initialTab={chatHubInitialTab} />}
        {createTeamOpen && <CreateTeamDialog open={createTeamOpen} onOpenChange={setCreateTeamOpen} />}
        {findTeamOpen && <FindTeamDialog open={findTeamOpen} onOpenChange={setFindTeamOpen} />}
        
      </Suspense>
    </>
  );
};

export default RightSidebar;
