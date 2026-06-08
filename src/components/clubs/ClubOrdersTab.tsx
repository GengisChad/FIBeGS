import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClubRole } from "@/hooks/useClubRole";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Package, Trash2, Edit2, Save, ShoppingCart, Check, X, Truck, CreditCard, Ban, Calendar, Lock, Unlock, Eye } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface OrderSession {
  id: string;
  club_id: string;
  title: string;
  deadline: string | null;
  is_open: boolean;
  created_by: string;
  created_at: string;
}

interface OrderProduct {
  id: string;
  session_id: string;
  component_id: string;
  price: number;
  quantity_available: number;
  is_shipped: boolean;
  added_by: string;
  created_at: string;
  component?: { name: string; image_url: string | null; recommended_price: number | null };
  added_by_profile?: { display_name: string | null; username: string | null };
  reserved_count?: number;
}

interface OrderReservation {
  id: string;
  order_product_id: string;
  user_id: string;
  quantity: number;
  is_paid: boolean;
  is_picked_up: boolean;
  is_cancelled: boolean;
  created_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

interface ProductCatalogItem {
  id: string;
  name: string;
  image_url: string | null;
  recommended_price: number | null;
  category_id: string;
}

const ClubOrdersTab = ({ clubId, paypalLink }: { clubId: string; paypalLink: string | null }) => {
  const { user } = useAuth();
  const { isStaff } = useClubRole(clubId);
  const { isAdmin } = useAdmin();
  const canManage = isStaff || isAdmin;

  const [sessions, setSessions] = useState<OrderSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<OrderSession | null>(null);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [reservations, setReservations] = useState<OrderReservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Create session dialog
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDeadline, setSessionDeadline] = useState("");

  // Add product dialog
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productQty, setProductQty] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");

  // Staff management view
  const [showManagement, setShowManagement] = useState(false);

  const fetchSessions = useCallback(async () => {
    // Get linked club IDs
    const { data: linkedIds } = await supabase.rpc("get_linked_club_ids", { _club_id: clubId });
    const allClubIds = [clubId, ...((linkedIds as string[]) ?? [])];

    const { data } = await supabase
      .from("club_order_sessions")
      .select("*")
      .in("club_id", allClubIds)
      .order("created_at", { ascending: false });

    // Enrich with club name for linked sessions
    if (data && data.length > 0) {
      const uniqueClubIds = [...new Set((data as any[]).map(s => s.club_id))];
      if (uniqueClubIds.length > 1) {
        const { data: clubs } = await supabase.from("clubs").select("id, name").in("id", uniqueClubIds);
        const clubMap = new Map((clubs ?? []).map((c: any) => [c.id, c.name]));
        setSessions((data as any[]).map(s => ({ ...s, _club_name: clubMap.get(s.club_id) })));
      } else {
        setSessions((data as OrderSession[]) ?? []);
      }
    } else {
      setSessions([]);
    }
    setLoading(false);
  }, [clubId]);

  const fetchSessionDetails = useCallback(async (sessionId: string) => {
    // Fetch products
    const { data: prods } = await supabase
      .from("club_order_products")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");

    if (prods && prods.length > 0) {
      const componentIds = [...new Set((prods as any[]).map(p => p.component_id))];
      const addedByIds = [...new Set((prods as any[]).map(p => p.added_by))];

      const [{ data: comps }, { data: profiles }, { data: resData }] = await Promise.all([
        supabase.from("collection_components").select("id, name, image_url, recommended_price").in("id", componentIds),
        supabase.from("profiles").select("user_id, display_name, username").in("user_id", addedByIds),
        supabase.from("club_order_reservations").select("*").in("order_product_id", (prods as any[]).map(p => p.id)),
      ]);

      const compMap = new Map((comps ?? []).map((c: any) => [c.id, c]));
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      // Get reservation user profiles
      let resProfiles = new Map<string, any>();
      if (resData && resData.length > 0) {
        const resUserIds = [...new Set((resData as any[]).map(r => r.user_id))];
        const { data: rp } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", resUserIds);
        resProfiles = new Map((rp ?? []).map((p: any) => [p.user_id, p]));
      }

      const enrichedProducts = (prods as any[]).map(p => {
        const productReservations = (resData as any[] ?? []).filter(r => r.order_product_id === p.id && !r.is_cancelled);
        const reserved_count = productReservations.reduce((sum: number, r: any) => sum + r.quantity, 0);
        return {
          ...p,
          component: compMap.get(p.component_id),
          added_by_profile: profileMap.get(p.added_by),
          reserved_count,
        };
      });

      setProducts(enrichedProducts);
      setReservations((resData as OrderReservation[] ?? []).map(r => ({
        ...r,
        profile: resProfiles.get(r.user_id),
      })));
    } else {
      setProducts([]);
      setReservations([]);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { if (selectedSession) fetchSessionDetails(selectedSession.id); }, [selectedSession, fetchSessionDetails]);

  const fetchCatalogProducts = async () => {
    // Fetch products-only categories
    const { data: cats } = await supabase
      .from("collection_categories")
      .select("id")
      .eq("is_products_only", true);

    if (!cats || cats.length === 0) {
      toast.error("Nessuna categoria prodotti configurata dall'admin");
      return;
    }

    const catIds = cats.map(c => c.id);
    // Also get subcategories
    const { data: subCats } = await supabase
      .from("collection_categories")
      .select("id")
      .in("parent_id", catIds);

    const allCatIds = [...catIds, ...(subCats ?? []).map(c => c.id)];

    const { data: comps } = await supabase
      .from("collection_components")
      .select("id, name, image_url, recommended_price, category_id")
      .in("category_id", allCatIds)
      .order("name");

    setCatalogProducts((comps as ProductCatalogItem[]) ?? []);
  };

  const createSession = async () => {
    if (!sessionTitle.trim()) return;
    const { error } = await supabase.from("club_order_sessions").insert({
      club_id: clubId,
      title: sessionTitle.trim(),
      deadline: sessionDeadline || null,
      created_by: user!.id,
    } as any);
    if (error) { toast.error("Errore nella creazione"); return; }
    toast.success("Sessione ordine creata!");
    setShowCreateSession(false);
    setSessionTitle("");
    setSessionDeadline("");
    fetchSessions();
  };

  const toggleSessionOpen = async (session: OrderSession) => {
    const { error } = await supabase
      .from("club_order_sessions")
      .update({ is_open: !session.is_open } as any)
      .eq("id", session.id);
    if (error) { toast.error("Errore"); return; }
    toast.success(session.is_open ? "Ordine chiuso" : "Ordine riaperto");
    fetchSessions();
    if (selectedSession?.id === session.id) {
      setSelectedSession({ ...session, is_open: !session.is_open });
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm("Eliminare questa sessione ordine e tutte le prenotazioni?")) return;
    const { error } = await supabase.from("club_order_sessions").delete().eq("id", sessionId);
    if (error) { toast.error("Errore nell'eliminazione"); return; }
    toast.success("Sessione eliminata");
    if (selectedSession?.id === sessionId) setSelectedSession(null);
    fetchSessions();
  };

  const addProduct = async () => {
    if (!selectedProductId || !productPrice || !productQty || !selectedSession) return;
    const { error } = await supabase.from("club_order_products").insert({
      session_id: selectedSession.id,
      component_id: selectedProductId,
      price: parseFloat(productPrice),
      quantity_available: parseInt(productQty),
      added_by: user!.id,
    } as any);
    if (error) { toast.error("Errore nell'aggiunta del prodotto"); return; }
    toast.success("Prodotto aggiunto!");
    setShowAddProduct(false);
    setSelectedProductId("");
    setProductPrice("");
    setProductQty("");
    setCatalogSearch("");
    fetchSessionDetails(selectedSession.id);
  };

  const removeProduct = async (productId: string) => {
    if (!window.confirm("Rimuovere questo prodotto e tutte le prenotazioni associate?")) return;
    const { error } = await supabase.from("club_order_products").delete().eq("id", productId);
    if (error) { toast.error("Errore"); return; }
    toast.success("Prodotto rimosso");
    if (selectedSession) fetchSessionDetails(selectedSession.id);
  };

  const toggleShipped = async (product: OrderProduct) => {
    const { error } = await supabase
      .from("club_order_products")
      .update({ is_shipped: !product.is_shipped } as any)
      .eq("id", product.id);
    if (error) { toast.error("Errore"); return; }
    if (selectedSession) fetchSessionDetails(selectedSession.id);
  };

  const reserveProduct = async (product: OrderProduct) => {
    if (!user) return;
    const existing = reservations.find(r => r.order_product_id === product.id && r.user_id === user.id && !r.is_cancelled);
    if (existing) { toast.error("Hai già prenotato questo prodotto"); return; }
    const available = product.quantity_available - (product.reserved_count ?? 0);
    if (available <= 0) { toast.error("Prodotto esaurito"); return; }

    const { error } = await supabase.from("club_order_reservations").insert({
      order_product_id: product.id,
      user_id: user.id,
      quantity: 1,
    } as any);
    if (error) { toast.error("Errore nella prenotazione"); return; }
    toast.success("Prodotto prenotato!");
    if (selectedSession) fetchSessionDetails(selectedSession.id);
  };

  const cancelReservation = async (reservationId: string) => {
    if (!window.confirm("Annullare la prenotazione?")) return;
    const { error } = await supabase
      .from("club_order_reservations")
      .update({ is_cancelled: true } as any)
      .eq("id", reservationId);
    if (error) { toast.error("Errore"); return; }
    toast.success("Prenotazione annullata");
    if (selectedSession) fetchSessionDetails(selectedSession.id);
  };

  const updateReservationFlag = async (reservationId: string, field: "is_paid" | "is_picked_up" | "is_cancelled", value: boolean) => {
    const { error } = await supabase
      .from("club_order_reservations")
      .update({ [field]: value } as any)
      .eq("id", reservationId);
    if (error) { toast.error("Errore"); return; }
    if (selectedSession) fetchSessionDetails(selectedSession.id);
  };

  const updateProductQty = async (productId: string, newQty: number) => {
    const { error } = await supabase
      .from("club_order_products")
      .update({ quantity_available: newQty } as any)
      .eq("id", productId);
    if (error) { toast.error("Errore"); return; }
    if (selectedSession) fetchSessionDetails(selectedSession.id);
  };

  const updateProductPrice = async (productId: string, newPrice: number) => {
    const { error } = await supabase
      .from("club_order_products")
      .update({ price: newPrice } as any)
      .eq("id", productId);
    if (error) { toast.error("Errore"); return; }
    if (selectedSession) fetchSessionDetails(selectedSession.id);
  };

  // Calculate user's total
  const myReservations = reservations.filter(r => r.user_id === user?.id && !r.is_cancelled);
  const myTotal = myReservations.reduce((sum, r) => {
    const prod = products.find(p => p.id === r.order_product_id);
    return sum + (prod ? prod.price * r.quantity : 0);
  }, 0);

  const filteredCatalog = catalogProducts.filter(p =>
    p.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  if (loading) return <p className="text-muted-foreground text-sm">Caricamento ordini...</p>;

  // ─── Session List ───
  if (!selectedSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">ORDINI <span className="gradient-text">DEL CLUB</span></h3>
          {canManage && (
            <Button size="sm" variant="hero" onClick={() => setShowCreateSession(true)}>
              <Plus size={14} className="mr-1" /> Nuovo Ordine
            </Button>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nessun ordine attivo. {canManage && "Crea un nuovo ordine per iniziare."}</p>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedSession(s)}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{s.title}</h4>
                    <Badge variant={s.is_open ? "default" : "secondary"} className="text-[10px]">
                      {s.is_open ? "Aperto" : "Chiuso"}
                    </Badge>
                    {(s as any)._club_name && s.club_id !== clubId && (
                      <Badge variant="outline" className="text-[10px]">
                        {(s as any)._club_name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      Creato {format(new Date(s.created_at), "d MMM yyyy", { locale: it })}
                    </span>
                    {s.deadline && (
                      <span className="flex items-center gap-1">
                        <Lock size={12} />
                        Scade {format(new Date(s.deadline), "d MMM yyyy HH:mm", { locale: it })}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => toggleSessionOpen(s)} title={s.is_open ? "Chiudi ordine" : "Riapri ordine"}>
                      {s.is_open ? <Lock size={14} /> : <Unlock size={14} />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteSession(s.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Session Dialog */}
        <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nuovo Ordine</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Titolo *</Label>
                <Input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="Es. Ordine Gennaio 2026" className="mt-1" maxLength={100} />
              </div>
              <div>
                <Label>Scadenza (opzionale)</Label>
                <Input type="datetime-local" value={sessionDeadline} onChange={e => setSessionDeadline(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Se impostata, l'ordine si chiuderà automaticamente.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateSession(false)}>Annulla</Button>
              <Button onClick={createSession} disabled={!sessionTitle.trim()}>Crea Ordine</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Check if deadline passed
  const isExpired = selectedSession.deadline && new Date(selectedSession.deadline) < new Date();
  const isOrderOpen = selectedSession.is_open && !isExpired;

  // ─── Session Detail View ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedSession(null); setShowManagement(false); }}>
            ← Torna agli ordini
          </Button>
          <div>
            <h3 className="font-display text-xl">{selectedSession.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={isOrderOpen ? "default" : "secondary"} className="text-[10px]">
                {isOrderOpen ? "Aperto" : isExpired ? "Scaduto" : "Chiuso"}
              </Badge>
              {selectedSession.deadline && (
                <span>Scadenza: {format(new Date(selectedSession.deadline), "d MMM yyyy HH:mm", { locale: it })}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button size="sm" variant={showManagement ? "default" : "outline"} onClick={() => setShowManagement(!showManagement)}>
                <Eye size={14} className="mr-1" /> {showManagement ? "Vista Prodotti" : "Gestione Ordini"}
              </Button>
              {isOrderOpen && (
                <Button size="sm" variant="hero" onClick={() => { fetchCatalogProducts(); setShowAddProduct(true); }}>
                  <Plus size={14} className="mr-1" /> Aggiungi Prodotto
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Staff Management View */}
      {showManagement && canManage ? (
        <div className="space-y-4">
          <h4 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Gestione Prenotazioni</h4>
          {products.map(product => {
            const productReservations = reservations.filter(r => r.order_product_id === product.id);
            const activeReservations = productReservations.filter(r => !r.is_cancelled);
            const cancelledReservations = productReservations.filter(r => r.is_cancelled);

            return (
              <div key={product.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Product header */}
                <div className="flex items-center gap-3 p-4 bg-secondary/30 border-b border-border">
                  <div className="w-10 h-10 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {product.component?.image_url ? (
                      <img src={product.component.image_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Package size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.component?.name ?? "Prodotto"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>€{product.price.toFixed(2)}</span>
                      <span>Prenotati: {product.reserved_count ?? 0}/{product.quantity_available}</span>
                      <Badge variant={product.is_shipped ? "default" : "outline"} className="text-[10px]">
                        {product.is_shipped ? "✓ Partito" : "In attesa"}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => toggleShipped(product)} title={product.is_shipped ? "Segna come non partito" : "Segna come partito"}>
                    <Truck size={14} className={product.is_shipped ? "text-primary" : ""} />
                  </Button>
                </div>

                {/* Reservations */}
                {activeReservations.length === 0 && cancelledReservations.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nessuna prenotazione</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {activeReservations.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium overflow-hidden shrink-0">
                            {r.profile?.avatar_url ? (
                              <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (r.profile?.display_name || "?")[0].toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">{r.profile?.display_name || r.profile?.username || "Utente"}</span>
                            <span className="text-[10px] text-muted-foreground">Qtà: {r.quantity} · €{(products.find(p => p.id === r.order_product_id)?.price ?? 0) * r.quantity}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <Checkbox
                              checked={r.is_paid}
                              onCheckedChange={(v) => updateReservationFlag(r.id, "is_paid", !!v)}
                            />
                            <CreditCard size={12} /> Pagato
                          </label>
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <Checkbox
                              checked={r.is_picked_up}
                              onCheckedChange={(v) => updateReservationFlag(r.id, "is_picked_up", !!v)}
                            />
                            <Check size={12} /> Ritirato
                          </label>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => updateReservationFlag(r.id, "is_cancelled", true)} title="Annulla">
                            <Ban size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {cancelledReservations.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-3 opacity-50">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px]">
                            {(r.profile?.display_name || "?")[0].toUpperCase()}
                          </div>
                          <span className="text-sm line-through">{r.profile?.display_name || "Utente"}</span>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">Annullato</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── Product List (Member View) ─── */
        <div className="space-y-4">
          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessun prodotto ancora aggiunto a questo ordine.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map(product => {
                  const available = product.quantity_available - (product.reserved_count ?? 0);
                  const myRes = reservations.find(r => r.order_product_id === product.id && r.user_id === user?.id && !r.is_cancelled);

                  return (
                    <div key={product.id} className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="flex gap-3 p-4">
                        <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {product.component?.image_url ? (
                            <img src={product.component.image_url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Package size={24} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{product.component?.name ?? "Prodotto"}</p>
                          <p className="text-lg font-bold text-primary">€{product.price.toFixed(2)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>Disponibili: {available}/{product.quantity_available}</span>
                            {product.is_shipped && <Badge variant="default" className="text-[10px]">Partito</Badge>}
                          </div>
                          {canManage && product.added_by_profile && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Aggiunto da {product.added_by_profile.display_name || product.added_by_profile.username}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="px-4 pb-4">
                        {myRes ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                <ShoppingCart size={12} className="mr-1" /> Prenotato ({myRes.quantity})
                              </Badge>
                              {myRes.is_paid && <Badge className="text-[10px]">Pagato</Badge>}
                              {myRes.is_picked_up && <Badge className="text-[10px]">Ritirato</Badge>}
                            </div>
                            {!product.is_shipped && (
                              <Button size="sm" variant="ghost" className="text-destructive h-7 text-xs" onClick={() => cancelReservation(myRes.id)}>
                                <X size={12} className="mr-1" /> Annulla
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={available <= 0 || !isOrderOpen}
                            onClick={() => reserveProduct(product)}
                          >
                            {available <= 0 ? "Esaurito" : !isOrderOpen ? "Ordine chiuso" : "Prenota"}
                          </Button>
                        )}
                      </div>

                      {/* Staff inline controls */}
                      {canManage && (
                        <div className="flex items-center gap-1 px-4 pb-3 border-t border-border pt-3">
                          <EditableField
                            label="Qtà"
                            value={product.quantity_available}
                            onSave={(v) => updateProductQty(product.id, v)}
                          />
                          <EditableField
                            label="€"
                            value={product.price}
                            onSave={(v) => updateProductPrice(product.id, v)}
                            isDecimal
                          />
                          <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => removeProduct(product.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* User's order summary */}
              {myReservations.length > 0 && (
                <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">Il tuo riepilogo</h4>
                  {myReservations.map(r => {
                    const prod = products.find(p => p.id === r.order_product_id);
                    return (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span>{prod?.component?.name}</span>
                        <span className="font-medium">€{((prod?.price ?? 0) * r.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="font-bold">Totale</span>
                    <span className="font-bold text-primary text-lg">€{myTotal.toFixed(2)}</span>
                  </div>
                  {paypalLink && myTotal > 0 && (
                    <a
                      href={`${paypalLink.startsWith("http") ? paypalLink : `https://${paypalLink}`}/${myTotal.toFixed(2)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] text-white font-medium text-sm transition-colors"
                    >
                      <CreditCard size={16} /> Paga con PayPal — €{myTotal.toFixed(2)}
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Aggiungi Prodotto all'Ordine</DialogTitle></DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1">
            <Input
              placeholder="Cerca prodotto..."
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
              {filteredCatalog.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Nessun prodotto trovato</p>
              ) : (
                filteredCatalog.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0 ${selectedProductId === p.id ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      if (p.recommended_price) setProductPrice(p.recommended_price.toString());
                    }}
                  >
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain" /> : <Package size={14} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.recommended_price && <p className="text-xs text-muted-foreground">Prezzo consigliato: €{p.recommended_price}</p>}
                    </div>
                    {selectedProductId === p.id && <Check size={16} className="text-primary shrink-0" />}
                  </button>
                ))
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prezzo (€) *</Label>
                <Input type="number" step="0.01" min="0" value={productPrice} onChange={e => setProductPrice(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Quantità disponibile *</Label>
                <Input type="number" min="1" value={productQty} onChange={e => setProductQty(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddProduct(false)}>Annulla</Button>
            <Button onClick={addProduct} disabled={!selectedProductId || !productPrice || !productQty}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Small inline editable field
const EditableField = ({ label, value, onSave, isDecimal }: { label: string; value: number; onSave: (v: number) => void; isDecimal?: boolean }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value.toString());

  if (!editing) {
    return (
      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary" onClick={() => { setVal(value.toString()); setEditing(true); }}>
        {label}: {isDecimal ? `€${value.toFixed(2)}` : value} <Edit2 size={10} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step={isDecimal ? "0.01" : "1"}
        min="0"
        value={val}
        onChange={e => setVal(e.target.value)}
        className="h-7 w-20 text-xs"
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") { onSave(parseFloat(val)); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button size="sm" className="h-7 px-2" onClick={() => { onSave(parseFloat(val)); setEditing(false); }}>
        <Save size={10} />
      </Button>
    </div>
  );
};

export default ClubOrdersTab;
