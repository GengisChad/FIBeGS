import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Globe, MapPin, Store, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FriendsTab } from "./FriendsTab";
import { PrivateChatView } from "./PrivateChatView";
import { ClubChatView } from "./ClubChatView";
import { GlobalChatView } from "./GlobalChatView";
import { RegionalStaffChatView } from "./RegionalStaffChatView";
import { ensureKeyPair } from "@/lib/cryptoChat";
import { useUnreadPrivateMessages } from "@/hooks/useUnreadMessages";
import type { FriendProfile } from "@/hooks/useFriends";

const LegacyChatHubDialog = lazy(() => import("./LegacyChatHubDialog"));

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: Tab;
}

type Club = { id: string; name: string };
type Tab = "friends" | "clubs" | "regional" | "global" | "legacy";

type ActivePrivate = { chatId: string; peer: FriendProfile } | null;
type QueryError = { message: string } | null;
type UntypedQueryResult<T> = { data: T | null; error: QueryError };
type UntypedQuery<T> = PromiseLike<UntypedQueryResult<T>> & {
  select: (columns: string) => UntypedQuery<T>;
  eq: (column: string, value: unknown) => UntypedQuery<T>;
  in: (column: string, values: unknown[]) => UntypedQuery<T>;
  limit: (count: number) => UntypedQuery<T>;
  maybeSingle: () => PromiseLike<UntypedQueryResult<T>>;
};
const fromUntyped = <T,>(table: string) =>
  (supabase as unknown as { from: (table: string) => UntypedQuery<T> }).from(table);

export const ChatHubDialog = ({ open, onOpenChange, initialTab = "friends" }: Props) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [activePrivate, setActivePrivate] = useState<ActivePrivate>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [hasRegionalStaff, setHasRegionalStaff] = useState(initialTab === "regional");
  const deepLinkConsumed = useRef(false);
  const { count: unreadCount } = useUnreadPrivateMessages();

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (open && user) ensureKeyPair(user.id).catch(() => {});
    if (!open) {
      deepLinkConsumed.current = false;
      setActivePrivate(null);
    }
  }, [open, user]);

  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data: mems } = await supabase.from("club_members").select("club_id").eq("user_id", user.id);
      const ids = (mems || []).map((m: { club_id: string }) => m.club_id);
      if (ids.length === 0) { setClubs([]); } else {
        const { data: cs } = await supabase.from("clubs").select("id, name").in("id", ids).eq("is_active", true);
        const list = (cs || []) as Club[];
        setClubs(list);
        setActiveClubId((prev) => prev || list[0]?.id || null);
      }
      // Check if user has access to any regional staff channel.
      // Show the tab for: members, regional referents, admins, and club leaders.
      const [{ data: rcm }, { data: roles }, { data: refs }, { data: leaderRoles }] = await Promise.all([
        fromUntyped<Array<{ channel_id: string }>>("regional_channel_members").select("channel_id").eq("user_id", user.id).limit(1),
        fromUntyped<Array<{ role: string }>>("user_roles").select("role").eq("user_id", user.id),
        fromUntyped<Array<{ id: string }>>("regional_referents").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
        fromUntyped<Array<{ role: string }>>("club_members").select("role").eq("user_id", user.id).in("role", ["owner", "leader", "admin", "co_leader"]).limit(1),
      ]);
      const roleNames = new Set((roles ?? []).map((r) => r.role));
      const hasAccess =
        (rcm?.length ?? 0) > 0 ||
        roleNames.has("admin") ||
        roleNames.has("regional_referent") ||
        (refs?.length ?? 0) > 0 ||
        (leaderRoles?.length ?? 0) > 0;
      setHasRegionalStaff(hasAccess);
    })();
  }, [user, open]);

  // Deep link via ?chat=...&kind=... (only once per open)
  useEffect(() => {
    if (!open || !user || deepLinkConsumed.current) return;
    const params = new URLSearchParams(window.location.search);
    const chat = params.get("chat");
    const kind = params.get("kind");
    if (!chat) { deepLinkConsumed.current = true; return; }

    const consume = () => {
      deepLinkConsumed.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("chat");
      url.searchParams.delete("kind");
      window.history.replaceState({}, "", url.toString());
    };

    if (chat === "friends") { setTab("friends"); consume(); return; }
    if (kind === "private") {
      (async () => {
        const { data: c } = await fromUntyped<{ user_a: string; user_b: string }>("private_chats").select("user_a, user_b").eq("id", chat).maybeSingle();
        if (!c) { consume(); return; }
        const peerId = c.user_a === user.id ? c.user_b : c.user_a;
        const { data: p } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").eq("user_id", peerId).maybeSingle();
        if (p) { setTab("friends"); setActivePrivate({ chatId: chat, peer: p as FriendProfile }); }
        consume();
      })();
    } else if (kind === "club") {
      setTab("clubs");
      setActiveClubId(chat);
      consume();
    } else if (kind === "global") {
      setTab("global");
      consume();
    } else {
      consume();
    }
  }, [open, user]);

  const activeClub = clubs.find(c => c.id === activeClubId) || clubs[0];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 gap-0 flex flex-col w-[calc(100vw-2rem)] h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] max-w-none rounded-[var(--device-radius)] overflow-hidden border-border/60 shadow-2xl sm:w-full sm:max-w-3xl sm:h-[80vh] sm:rounded-lg">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base"><MessageCircle size={16} /> Chat</DialogTitle>
          </DialogHeader>

          {activePrivate ? (
            <PrivateChatView chatId={activePrivate.chatId} peer={activePrivate.peer} onBack={() => setActivePrivate(null)} />
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex-1 flex flex-col min-h-0">
              <TabsList className={`mx-3 mt-2 grid ${hasRegionalStaff ? "grid-cols-5" : "grid-cols-4"} shrink-0 h-auto`}>
                <TabsTrigger value="friends" className="text-xs gap-1 py-2 relative">
                  <Users size={12} /><span>Chat</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="clubs" className="text-xs gap-1 py-2"><Users size={12} />Club</TabsTrigger>
                {hasRegionalStaff && (
                  <TabsTrigger value="regional" className="text-xs gap-1 py-2"><MapPin size={12} />Regionale</TabsTrigger>
                )}
                <TabsTrigger value="global" className="text-xs gap-1 py-2"><Globe size={12} />Globale</TabsTrigger>
                <TabsTrigger value="legacy" className="text-xs gap-1 py-2"><Store size={12} />Altro</TabsTrigger>
              </TabsList>

              <TabsContent value="friends" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden">
                <FriendsTab onOpenChat={(chatId, peerId) => {
                  (async () => {
                    const { data: p } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").eq("user_id", peerId).maybeSingle();
                    if (p) setActivePrivate({ chatId, peer: p as FriendProfile });
                  })();
                }} />
              </TabsContent>

              <TabsContent value="clubs" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col">
                {clubs.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6 px-4">Non sei membro di nessun club.</div>
                ) : (
                  <>
                    {clubs.length > 1 && (
                      <div className="px-3 pb-2 shrink-0">
                        <Select value={activeClub?.id || ""} onValueChange={setActiveClubId}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona club" /></SelectTrigger>
                          <SelectContent>
                            {clubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {activeClub && (
                      <div className="flex-1 min-h-0">
                        <ClubChatView key={activeClub.id} clubId={activeClub.id} clubName={activeClub.name} />
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {hasRegionalStaff && (
                <TabsContent value="regional" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden">
                  <RegionalStaffChatView />
                </TabsContent>
              )}

              <TabsContent value="global" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden">
                <GlobalChatView />
              </TabsContent>

              <TabsContent value="legacy" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden">
                <div className="p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">Mercatino e altre chat.</div>
                  <Button onClick={() => setLegacyOpen(true)} className="w-full gap-2">
                    <Store size={14} /> Apri Mercatino
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        {legacyOpen && <LegacyChatHubDialog open={legacyOpen} onOpenChange={setLegacyOpen} />}
      </Suspense>
    </>
  );
};

export default ChatHubDialog;
