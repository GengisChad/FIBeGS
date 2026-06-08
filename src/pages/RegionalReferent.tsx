import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Compass, MessageSquare, Users, ClipboardList, Mail, Phone, Check, X, MessageCircle } from "lucide-react";
import { RegionalChatDialog } from "@/components/regional/RegionalChatDialog";
import { Navigate, Link } from "react-router-dom";
import { useStartPrivateChat } from "@/hooks/useStartPrivateChat";

interface ReferentRow {
  id: string;
  region_id: string;
  region_name: string;
  public_email: string | null;
  public_phone: string | null;
  bio: string | null;
}

interface ClubReq {
  id: string;
  club_name: string;
  city: string | null;
  status: string;
  user_id: string;
  description: string | null;
  created_at: string;
  channel_id?: string | null;
  requester?: { display_name: string | null; username: string | null } | null;
}

const RegionalReferentPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<ReferentRow[]>([]);
  const [requests, setRequests] = useState<ClubReq[]>([]);
  const [regionChannels, setRegionChannels] = useState<Record<string, string>>({}); // region_id -> channel_id
  const [chatOpen, setChatOpen] = useState(false);
  const [chatChannel, setChatChannel] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("");
  const startPrivate = useStartPrivateChat();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: myRefs } = await (supabase as any)
      .from("regional_referents")
      .select("id, region_id, public_email, public_phone, bio, regions(name)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const refsList: ReferentRow[] = (myRefs ?? []).map((r: any) => ({
      id: r.id,
      region_id: r.region_id,
      region_name: r.regions?.name ?? "—",
      public_email: r.public_email,
      public_phone: r.public_phone,
      bio: r.bio,
    }));
    setRefs(refsList);

    if (refsList.length === 0) {
      setLoading(false);
      return;
    }

    const regionIds = refsList.map((r) => r.region_id);

    // Pending club requests in my regions + their channels
    const { data: reqs } = await supabase
      .from("club_requests")
      .select("id, club_name, city, status, user_id, description, created_at")
      .in("region_id", regionIds)
      .order("created_at", { ascending: false });

    const reqIds = (reqs ?? []).map((r: any) => r.id);
    const userIds = (reqs ?? []).map((r: any) => r.user_id);
    const [{ data: chans }, { data: profs }] = await Promise.all([
      reqIds.length
        ? (supabase as any).from("regional_channels").select("id, club_request_id").in("club_request_id", reqIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabase.from("profiles").select("user_id, display_name, username").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    ]);
    const chMap = new Map((chans as any[] ?? []).map((c) => [c.club_request_id, c.id]));
    const profMap = new Map((profs as any[] ?? []).map((p) => [p.user_id, p]));
    setRequests(
      (reqs ?? []).map((r: any) => ({
        ...r,
        channel_id: chMap.get(r.id) ?? null,
        requester: profMap.get(r.user_id) ?? null,
      })),
    );

    // Region channels
    const { data: regChans } = await (supabase as any)
      .from("regional_channels")
      .select("id, region_id")
      .in("region_id", regionIds)
      .eq("channel_type", "region");
    const rcMap: Record<string, string> = {};
    (regChans ?? []).forEach((c: any) => {
      rcMap[c.region_id] = c.id;
    });
    setRegionChannels(rcMap);

    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) load();
  }, [user, authLoading]);

  const saveContacts = async (r: ReferentRow) => {
    const { error } = await (supabase as any)
      .from("regional_referents")
      .update({
        public_email: r.public_email,
        public_phone: r.public_phone,
        bio: r.bio,
      })
      .eq("id", r.id);
    if (error) {
      toast.error("Errore salvataggio: " + error.message);
      return;
    }
    toast.success("Contatti aggiornati");
  };

  const updateRequest = async (id: string, status: "approved" | "rejected") => {
    if (status === "approved") {
      // Use the RPC that actually creates the club, transfers members and notifies users.
      const { error } = await (supabase as any).rpc("approve_club_request_and_transfer", { _request_id: id });
      if (error) {
        toast.error("Errore approvazione: " + error.message);
        return;
      }
      toast.success("Club creato e richiesta approvata");
      load();
      return;
    }
    const { error } = await supabase.from("club_requests").update({ status }).eq("id", id);
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    toast.success("Richiesta rifiutata");
    load();
  };

  const openChat = (channelId: string | null, title: string) => {
    if (!channelId) {
      toast.error("Canale chat non disponibile.");
      return;
    }
    setChatChannel(channelId);
    setChatTitle(title);
    setChatOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6">Caricamento…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (refs.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="container mx-auto p-6 flex-1">
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <Compass size={36} className="mx-auto text-muted-foreground" />
              <h1 className="text-xl font-bold">Pannello Referente Regionale</h1>
              <p className="text-sm text-muted-foreground">
                Non risulti referente regionale di alcuna regione. Contatta lo staff per essere assegnato.
              </p>
              <Link to="/" className="text-primary text-sm underline">
                Torna alla home
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const handled = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6 flex-1">
        <div className="flex items-center gap-2">
          <Compass size={22} className="text-primary" />
          <h1 className="text-2xl font-bold">Pannello Referente Regionale</h1>
        </div>

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">
              <ClipboardList size={14} className="mr-1" /> Richieste club
              {pending.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chats">
              <MessageSquare size={14} className="mr-1" /> Chat regionali
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <Mail size={14} className="mr-1" /> Miei contatti
            </TabsTrigger>
          </TabsList>

          {/* REQUESTS */}
          <TabsContent value="requests" className="space-y-4">
            {pending.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nessuna richiesta in attesa nelle tue regioni.
                </CardContent>
              </Card>
            )}
            {pending.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>"{r.club_name}"</span>
                    <Badge variant="secondary">In attesa</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Richiesto da{" "}
                    <strong>{r.requester?.display_name || r.requester?.username || "Utente"}</strong>
                    {r.city && ` · ${r.city}`}
                  </p>
                  {r.description && <p className="whitespace-pre-wrap text-muted-foreground">{r.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openChat(r.channel_id ?? null, `Richiesta: ${r.club_name}`)}>
                      <MessageSquare size={14} className="mr-1" /> Chat canale
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startPrivate(r.user_id)}>
                      <MessageCircle size={14} className="mr-1" /> Chat privata
                    </Button>
                    <Button size="sm" onClick={() => updateRequest(r.id, "approved")}>
                      <Check size={14} className="mr-1" /> Approva
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateRequest(r.id, "rejected")}>
                      <X size={14} className="mr-1" /> Rifiuta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {handled.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Già gestite</h3>
                <div className="space-y-2">
                  {handled.slice(0, 20).map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                      <span>
                        {r.club_name}{" "}
                        <span className="text-xs text-muted-foreground">
                          {r.requester?.display_name || r.requester?.username}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge>
                        {r.channel_id && (
                          <Button size="sm" variant="ghost" onClick={() => openChat(r.channel_id!, `Richiesta: ${r.club_name}`)}>
                            <MessageSquare size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* CHATS */}
          <TabsContent value="chats" className="space-y-3">
            {refs.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      <Users size={16} /> Chat regione {r.region_name}
                    </p>
                    <p className="text-xs text-muted-foreground">Tutti i club leader della regione</p>
                  </div>
                  <Button onClick={() => openChat(regionChannels[r.region_id] ?? null, `Chat ${r.region_name}`)}>
                    <MessageSquare size={14} className="mr-1" /> Apri chat
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* CONTACTS */}
          <TabsContent value="contacts" className="space-y-3">
            {refs.map((r, idx) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="text-base">Regione {r.region_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>
                      <Mail size={12} className="inline mr-1" /> Email pubblica
                    </Label>
                    <Input
                      value={r.public_email || ""}
                      onChange={(e) => {
                        const c = [...refs];
                        c[idx] = { ...r, public_email: e.target.value };
                        setRefs(c);
                      }}
                    />
                  </div>
                  <div>
                    <Label>
                      <Phone size={12} className="inline mr-1" /> Telefono pubblico
                    </Label>
                    <Input
                      value={r.public_phone || ""}
                      onChange={(e) => {
                        const c = [...refs];
                        c[idx] = { ...r, public_phone: e.target.value };
                        setRefs(c);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Bio / Note pubbliche</Label>
                    <Textarea
                      rows={3}
                      value={r.bio || ""}
                      onChange={(e) => {
                        const c = [...refs];
                        c[idx] = { ...r, bio: e.target.value };
                        setRefs(c);
                      }}
                    />
                  </div>
                  <Button onClick={() => saveContacts(refs[idx])}>Salva contatti</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <RegionalChatDialog open={chatOpen} onOpenChange={setChatOpen} channelId={chatChannel} title={chatTitle} />
      <Footer />
    </div>
  );
};

export default RegionalReferentPage;
