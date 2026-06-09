import { useState, useEffect, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useUserClubs } from "@/hooks/useClubRole";
import { useAdmin } from "@/hooks/useAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Flag, ExternalLink, ShoppingBag, Search, MapPin, Truck, Filter, Heart, Info, ChevronDown, ChevronUp, Shield, Tag, AlertTriangle, Scale, Ban, PackageX, ImageOff, Package } from "lucide-react";
import { BncIcon } from "@/components/icons/BncIcon";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { validateNoProfanity } from "@/lib/profanityFilter";
import MarketWantedSection from "@/components/market/MarketWantedSection";
import MarketChatDialog from "@/components/market/MarketChatDialog";
import MarketComponentPicker from "@/components/market/MarketComponentPicker";

const REPORT_CATEGORIES = [
  { value: "truffa", label: "Truffa / Scam", desc: "Il venditore sembra voler truffare gli acquirenti", icon: Ban, reasons: [
    "Prezzo troppo basso per essere reale",
    "Richiede pagamento fuori piattaforma sospetto",
    "Profilo appena creato con molti annunci",
    "Ha già truffato altri utenti",
  ]},
  { value: "prodotto", label: "Prodotto non conforme", desc: "Il prodotto non corrisponde a quanto dichiarato", icon: PackageX, reasons: [
    "Prodotto contraffatto / falso",
    "Condizione reale diversa da quella indicata",
    "Prodotto diverso da quello in foto",
    "Componenti mancanti non dichiarati",
  ]},
  { value: "immagine", label: "Immagine / Link esterno", desc: "Problemi con l'immagine o il link di vendita", icon: ImageOff, reasons: [
    "Immagine rubata da un altro utente",
    "Link esterno non funzionante o sospetto",
    "Immagine non corrispondente al prodotto",
  ]},
  { value: "altro", label: "Contenuto inappropriato", desc: "Spam, linguaggio offensivo o altro", icon: AlertTriangle, reasons: [
    "Contenuto offensivo o volgare",
    "Spam o pubblicità non autorizzata",
    "Annuncio duplicato intenzionale",
    "Prodotto non pertinente alla piattaforma",
  ]},
];

const CATEGORIES = [
  "Bey intero", "Lock Chip", "Blade", "Main Blade", "Assist Blade",
  "Ratchet", "Bit", "Ratchet Integrato", "Blade Extended",
  "Grip", "Launcher", "Arena", "Bundle", "Lotto", "Altro"
];

const CONDITIONS = [
  { value: "new", label: "Nuovo" },
  { value: "opened_unused", label: "Aperto mai usato" },
  { value: "used", label: "Usato" },
  { value: "very_worn", label: "Molto Usurato" },
  { value: "broken", label: "Rotto" },
];

const getConditionLabel = (value: string) =>
  CONDITIONS.find(c => c.value === value)?.label ?? value;

type SortOption = "date_desc" | "date_asc" | "price_asc" | "price_desc" | "alpha_asc" | "alpha_desc";

interface Listing {
  id: string;
  user_id: string;
  product_name: string;
  image_url: string | null;
  categories: string[];
  condition: string;
  sale_link: string | null;
  price: number | null;
  shipping_cost: number | null;
  free_shipping: boolean;
  created_at: string;
}

interface ProfileInfo {
  display_name: string;
  username: string | null;
  city: string | null;
}

const MarketGuidelines = () => {
  const [open, setOpen] = useState(false);
  const rules = [
    { icon: Info, title: "Bacheca Annunci", desc: "Il Market è una bacheca pubblica: gli utenti pubblicano annunci ma nessuna transazione avviene sul sito. Ogni trattativa è esterna e sotto la responsabilità delle parti." },
    { icon: Tag, title: "Prezzo Consigliato", desc: "Quando colleghi prodotti dal database, viene mostrato un prezzo consigliato basato sui valori di riferimento. È un'indicazione utile per orientarsi, non un prezzo obbligatorio." },
    { icon: Scale, title: "Libertà di Prezzo", desc: "I venditori sono liberi di impostare qualsiasi prezzo. Il prezzo consigliato serve solo come riferimento per aiutare acquirenti e venditori a valutare l'equità dell'offerta." },
    { icon: AlertTriangle, title: "Quando Segnalare", desc: "Usa il tasto Segnala per: annunci con contenuti offensivi o inappropriati, sospetti tentativi di truffa, prodotti contraffatti spacciati per originali, o spam ripetuto." },
    { icon: Shield, title: "Cosa NON segnalare", desc: "Non segnalare annunci solo perché il prezzo ti sembra alto o basso. Il prezzo è a discrezione del venditore. Usa il prezzo consigliato come guida per i tuoi acquisti." },
  ];
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
          <Info size={14} className="text-primary" />
          <span className="font-medium">Regolamento Market</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rules.map((r) => (
            <div key={r.title} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                <r.icon size={16} className="text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{r.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const PAGE_SIZE = 24;
const ITEMS_PER_PAGE = 24;

const Market = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { clubs: userClubs } = useUserClubs();
  const userClub = userClubs.length > 0 ? userClubs[0] : null;
  const isMobile = useIsMobile();
  const [listings, setListings] = useState<Listing[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportListingId, setReportListingId] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState("");
  const [reportSubReason, setReportSubReason] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const resetReport = () => { setReportCategory(""); setReportSubReason(""); setReportReason(""); setReportListingId(null); };

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ listingId?: string; wantedId?: string; targetUserId: string } | null>(null);

  // Likes state
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  // Form state
  const [productName, setProductName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [condition, setCondition] = useState("");
  const [saleLink, setSaleLink] = useState("");
  const [price, setPrice] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [linkedComponentIds, setLinkedComponentIds] = useState<string[]>([]);

  // Recommended prices per listing (loaded once)
  const [listingRecommendedPrices, setListingRecommendedPrices] = useState<Record<string, number>>({});

  const fetchListings = async (append = false) => {
    const from = append ? listings.length : 0;
    const { data } = await supabase
      .from("market_listings")
      .select("id, user_id, product_name, categories, condition, price, image_url, sale_link, free_shipping, shipping_cost, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    const items = (data ?? []) as Listing[];
    const allItems = append ? [...listings, ...items] : items;
    setListings(allItems);
    setHasMore(items.length === PAGE_SIZE);

    const newUserIds = [...new Set(items.map(l => l.user_id).filter(id => !profiles[id]))];
    const itemIds = items.map(l => l.id);

    // Parallelize profiles + likes + recommended prices for new items
    const [profilesRes, allLikesRes, myLikesRes, recPricesRes] = await Promise.all([
      newUserIds.length > 0
        ? supabase.from("profiles").select("user_id, display_name, username, city").in("user_id", newUserIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("market_likes").select("listing_id").in("listing_id", itemIds),
      user
        ? supabase.from("market_likes").select("listing_id").eq("user_id", user.id).in("listing_id", itemIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("market_listing_components").select("listing_id, component_id, collection_components(recommended_price)").in("listing_id", itemIds),
    ]);

    if (newUserIds.length > 0) {
      const map: Record<string, ProfileInfo> = { ...profiles };
      (profilesRes.data ?? []).forEach((p: any) => {
        map[p.user_id] = { display_name: p.display_name || p.username || "Utente", username: p.username || null, city: p.city || null };
      });
      setProfiles(map);
    }

    // Likes
    const counts: Record<string, number> = {};
    (allLikesRes.data ?? []).forEach((l: any) => { counts[l.listing_id] = (counts[l.listing_id] || 0) + 1; });
    setLikesCount(prev => ({ ...prev, ...counts }));
    if (user) {
      setUserLikes(prev => {
        const next = new Set(prev);
        ((myLikesRes.data ?? []) as any[]).forEach((l: any) => next.add(l.listing_id));
        return next;
      });
    }

    // Recommended prices
    const prices: Record<string, number> = {};
    ((recPricesRes.data ?? []) as any[]).forEach((r: any) => {
      const p = r.collection_components?.recommended_price || 0;
      prices[r.listing_id] = (prices[r.listing_id] || 0) + p;
    });
    setListingRecommendedPrices(prev => ({ ...prev, ...prices }));

    setLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchListings(true);
  };

  useEffect(() => { fetchListings(); }, []);
  // Track listing IDs separately
  const listingIdsKey = listings.map(l => l.id).join(",");

  const toggleLike = async (listingId: string) => {
    if (!user) { toast({ title: "Accedi per mettere like", variant: "destructive" }); return; }
    if (likingIds.has(listingId)) return;
    setLikingIds(prev => new Set(prev).add(listingId));
    const liked = userLikes.has(listingId);
    setUserLikes(prev => { const next = new Set(prev); if (liked) next.delete(listingId); else next.add(listingId); return next; });
    setLikesCount(prev => ({ ...prev, [listingId]: (prev[listingId] || 0) + (liked ? -1 : 1) }));
    if (liked) await supabase.from("market_likes").delete().eq("listing_id", listingId).eq("user_id", user.id);
    else await supabase.from("market_likes").insert({ listing_id: listingId, user_id: user.id });
    setLikingIds(prev => { const next = new Set(prev); next.delete(listingId); return next; });
  };

  const resetForm = () => {
    setProductName(""); setSelectedCategories([]); setCondition(""); setSaleLink(""); setPrice("");
    setFreeShipping(false); setShippingCost(""); setImageUrl(""); setEditingListing(null);
    setLinkedComponentIds([]);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = async (listing: Listing) => {
    setEditingListing(listing); setProductName(listing.product_name); setSelectedCategories(listing.categories);
    setCondition(listing.condition); setSaleLink(listing.sale_link || ""); setPrice(listing.price != null ? String(listing.price) : "");
    setFreeShipping(listing.free_shipping); setShippingCost(listing.shipping_cost != null ? String(listing.shipping_cost) : "");
    setImageUrl(listing.image_url || ""); setDialogOpen(true);
    // Load linked components
    const { data } = await supabase.from("market_listing_components").select("component_id").eq("listing_id", listing.id);
    setLinkedComponentIds((data ?? []).map((r: any) => r.component_id));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!productName.trim() || selectedCategories.length === 0 || !condition) {
      toast({ title: "Compila tutti i campi obbligatori", variant: "destructive" }); return;
    }
    const profanityError = validateNoProfanity(productName);
    if (profanityError) { toast({ title: profanityError, variant: "destructive" }); return; }
    if (!saleLink.trim()) { toast({ title: "Il link di vendita è obbligatorio", variant: "destructive" }); return; }
    try { new URL(saleLink.trim()); } catch { toast({ title: "Inserisci un link valido (es. https://...)", variant: "destructive" }); return; }

    setSubmitting(true);
    const finalImageUrl = imageUrl.trim() || null;

    const payload = {
      product_name: productName.trim(), categories: selectedCategories, condition,
      sale_link: saleLink.trim() || null, image_url: finalImageUrl,
      price: price ? parseFloat(price) : null,
      free_shipping: freeShipping, shipping_cost: !freeShipping && shippingCost ? parseFloat(shippingCost) : null,
    };

    let listingId: string | null = null;
    if (editingListing) {
      const { error } = await supabase.from("market_listings").update(payload).eq("id", editingListing.id);
      if (error) { toast({ title: "Errore aggiornamento", variant: "destructive" }); setSubmitting(false); return; }
      listingId = editingListing.id;
      toast({ title: "Annuncio aggiornato!" });
    } else {
      const { data: insertData, error } = await supabase.from("market_listings").insert({ ...payload, user_id: user.id }).select("id").single();
      if (error) { toast({ title: "Errore creazione annuncio", variant: "destructive" }); setSubmitting(false); return; }
      listingId = insertData.id;
      toast({ title: "Annuncio pubblicato!" });
    }

    // Save linked components
    if (listingId) {
      await supabase.from("market_listing_components").delete().eq("listing_id", listingId);
      if (linkedComponentIds.length > 0) {
        await supabase.from("market_listing_components").insert(
          linkedComponentIds.map(cid => ({ listing_id: listingId!, component_id: cid }))
        );
      }
    }

    setSubmitting(false); setDialogOpen(false); resetForm(); fetchListings();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("market_listings").delete().eq("id", id);
    if (error) toast({ title: "Errore eliminazione", variant: "destructive" });
    else { toast({ title: "Annuncio eliminato" }); fetchListings(); }
  };

  const handleReport = async () => {
    const finalReason = `[${reportCategory}] ${reportSubReason}${reportReason.trim() ? ` — ${reportReason.trim()}` : ""}`;
    if (!user || !reportListingId || !reportSubReason) return;
    const { count } = await supabase.from("market_reports").select("id", { count: "exact", head: true }).eq("reporter_id", user.id).eq("listing_id", reportListingId).neq("status", "dismissed");
    if ((count ?? 0) > 0) {
      toast({ title: "Hai già segnalato questo annuncio" }); setReportDialogOpen(false); resetReport(); return;
    }
    const { error } = await supabase.from("market_reports").insert({
      listing_id: reportListingId, reporter_id: user.id, reason: finalReason,
    });
    if (error) {
      if (error.code === "23505") toast({ title: "Hai già segnalato questo annuncio" });
      else toast({ title: "Errore invio segnalazione", variant: "destructive" });
    }
    else toast({ title: "Segnalazione inviata" });
    setReportDialogOpen(false); resetReport();
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };
  const toggleFilterCategory = (cat: string) => {
    setFilterCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...listings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.product_name.toLowerCase().includes(q));
    }
    if (filterCategories.length > 0) {
      result = result.filter(l => filterCategories.some(fc => l.categories.includes(fc)));
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case "date_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "price_asc": return (a.price ?? Infinity) - (b.price ?? Infinity);
        case "price_desc": return (b.price ?? 0) - (a.price ?? 0);
        case "alpha_asc": return a.product_name.localeCompare(b.product_name);
        case "alpha_desc": return b.product_name.localeCompare(a.product_name);
        default: return 0;
      }
    });
    return result;
  }, [listings, searchQuery, filterCategories, sortBy]);

  const totalPages = Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE);
  const paginatedListings = filteredAndSorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterCategories, sortBy]);

  const PaginationControls = () => totalPages > 1 ? (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>←</Button>
      <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
      <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>→</Button>
    </div>
  ) : null;

  const openChatForListing = (listingId: string, ownerId: string) => {
    if (!user) { toast({ title: "Accedi per contattare", variant: "destructive" }); return; }
    setChatTarget({ listingId, targetUserId: ownerId });
    setChatOpen(true);
  };

  const openChatForWanted = (wantedId: string, ownerId: string) => {
    if (!user) { toast({ title: "Accedi per contattare", variant: "destructive" }); return; }
    setChatTarget({ wantedId, targetUserId: ownerId });
    setChatOpen(true);
  };

  const listingsGrid = (
    <>
      {/* Filters bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-9 sm:h-10 px-2.5 sm:px-3">
              <Filter size={15} /> <span className="hidden sm:inline">Categorie</span>
              {filterCategories.length > 0 && (
                <Badge variant="default" className="ml-0.5 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                  {filterCategories.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Filtra per categoria</p>
                {filterCategories.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-auto py-0.5 px-2 text-xs" onClick={() => setFilterCategories([])}>Reset</Button>
                )}
              </div>
              {CATEGORIES.map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={filterCategories.includes(cat)} onCheckedChange={() => toggleFilterCategory(cat)} />
                  {cat}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-auto sm:w-[160px] shrink-0 h-9 sm:h-10 px-2.5 sm:px-3 gap-1.5">
            <SelectValue placeholder="Ordina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Più recenti</SelectItem>
            <SelectItem value="date_asc">Meno recenti</SelectItem>
            <SelectItem value="price_asc">Prezzo ↑</SelectItem>
            <SelectItem value="price_desc">Prezzo ↓</SelectItem>
            <SelectItem value="alpha_asc">A → Z</SelectItem>
            <SelectItem value="alpha_desc">Z → A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : filteredAndSorted.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">
          {listings.length === 0 ? "Nessun annuncio ancora. Sii il primo a vendere!" : "Nessun risultato trovato."}
        </p>
      ) : (
        <>
          <PaginationControls />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-4">
            {paginatedListings.map((listing) => {
              const profile = profiles[listing.user_id];
              return (
                <Card key={listing.id} className="bg-card border-border card-glow overflow-hidden group">
                  <div className="aspect-square bg-secondary/50 relative overflow-hidden">
                    {listing.image_url ? (
                      <img src={listing.image_url} alt={listing.product_name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ShoppingBag size={40} /></div>
                    )}
                    <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {user && (user.id === listing.user_id || isAdmin) && (
                        <>
                          <Button size="icon" variant="secondary" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => openEdit(listing)}><Pencil size={13} /></Button>
                          <Button size="icon" variant="destructive" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleDelete(listing.id)}><Trash2 size={13} /></Button>
                        </>
                      )}
                      {user && user.id !== listing.user_id && (
                        <Button size="icon" variant="outline" className="h-7 w-7 sm:h-8 sm:w-8 border-orange-500/30 text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 hover:border-orange-500/50" title="Segnala annuncio" onClick={() => { setReportListingId(listing.id); setReportDialogOpen(true); }}>
                          <Flag size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-2.5 sm:p-3 space-y-1.5">
                    <h3 className="font-semibold text-sm truncate">{listing.product_name}</h3>
                    {profile?.username ? (
                      <Link to={`/profilo/${profile.username}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        {profile.display_name}
                      </Link>
                    ) : (
                      <p className="text-xs text-muted-foreground">{profile?.display_name || "Utente"}</p>
                    )}
                    {listing.price != null && (
                      <div>
                        <p className="text-lg font-bold text-primary">€{listing.price.toFixed(2)}</p>
                        {listingRecommendedPrices[listing.id] > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            Consigliato: €{listingRecommendedPrices[listing.id].toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                    {listing.price == null && listingRecommendedPrices[listing.id] > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Consigliato: €{listingRecommendedPrices[listing.id].toFixed(2)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {listing.categories.slice(0, 2).map(cat => (
                        <Badge key={cat} variant="outline" className="text-[10px] px-1.5 py-0">{cat}</Badge>
                      ))}
                      {listing.categories.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{listing.categories.length - 2}</Badge>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{getConditionLabel(listing.condition)}</Badge>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Truck size={12} />
                      {listing.free_shipping ? (
                        <span className="text-primary font-medium">Spedizione gratuita</span>
                      ) : listing.shipping_cost != null ? (
                        <span>Spedizione: €{listing.shipping_cost.toFixed(2)}</span>
                      ) : (
                        <span>Spedizione da concordare</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-1">
                      {profile?.city && (
                        <span className="flex items-center gap-0.5 truncate"><MapPin size={12} /> {profile.city}</span>
                      )}
                      <span className="flex items-center gap-0.5 shrink-0">
                        <BncIcon name="calendar" size={12} /> {format(new Date(listing.created_at), "dd MMM yy", { locale: it })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLike(listing.id); }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          disabled={likingIds.has(listing.id)}
                        >
                          <Heart size={16} className={userLikes.has(listing.id) ? "fill-primary text-primary" : ""} />
                          {(likesCount[listing.id] || 0) > 0 && (
                            <span className={userLikes.has(listing.id) ? "text-primary font-medium" : ""}>{likesCount[listing.id]}</span>
                          )}
                        </button>
                        {user && user.id !== listing.user_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openChatForListing(listing.id, listing.user_id); }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <BncIcon name="chat" size={16} />
                          </button>
                        )}
                      </div>
                      {listing.sale_link && (
                        <a href={listing.sale_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <Button variant="default" size="sm" className="gap-1.5 font-bold h-7 text-xs">
                            <ExternalLink size={12} /> INFO
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="mt-6"><PaginationControls /></div>
          {hasMore && !searchQuery && filterCategories.length === 0 && listings.length < 200 && (
            <div className="flex justify-center mt-4">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore} className="text-xs text-muted-foreground">
                {loadingMore ? "Caricamento..." : "Carica altri annunci"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-3 sm:px-4 pt-20 sm:pt-24 pb-10 sm:pb-16">
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <h1 className="section-title text-xl sm:text-3xl truncate">Market</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {userClub && (
              <Link to={`/clubs/${userClub.club_id}?tab=orders`}>
                <Button variant="outline" size="sm" className="gap-1.5 px-2 sm:px-3" title="Ordini Club">
                  <Package size={16} /> <span className="hidden sm:inline">Ordini Club</span>
                </Button>
              </Link>
            )}
            {user && (
              <Button variant="outline" size="sm" className="gap-1.5 px-2 sm:px-3" title="Chat" onClick={() => { setChatTarget(null); setChatOpen(true); }}>
                <BncIcon name="chat" size={16} /> <span className="hidden sm:inline">Chat</span>
              </Button>
            )}
            {user && (
              <Button onClick={openCreate} size="sm" className="gap-1.5 px-2.5 sm:px-3">
                <Plus size={16} /> <span className="hidden xs:inline sm:inline">Vendi</span>
              </Button>
            )}
          </div>
        </div>

        {/* Regolamento Market */}
        <MarketGuidelines />

        {isMobile ? (
          /* Mobile: Tabs layout - sticky for quick switching */
          <Tabs defaultValue="sell">
            <TabsList className="w-full mb-3 sticky top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-border">
              <TabsTrigger value="sell" className="flex-1 gap-1.5 text-xs"><ShoppingBag size={13} /> Vendita</TabsTrigger>
              <TabsTrigger value="wanted" className="flex-1 gap-1.5 text-xs"><Search size={13} /> Cerco</TabsTrigger>
            </TabsList>
            <TabsContent value="sell">{listingsGrid}</TabsContent>
            <TabsContent value="wanted">
              <MarketWantedSection onContact={openChatForWanted} />
            </TabsContent>
          </Tabs>
        ) : (
          /* Desktop: Side-by-side layout */
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">{listingsGrid}</div>
            <div className="w-64 shrink-0">
              <div className="sticky top-24">
                <MarketWantedSection onContact={openChatForWanted} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl h-[90vh] md:h-[85vh] flex flex-col p-4 md:p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingListing ? "Modifica Annuncio" : "Nuovo Annuncio"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden">
            {/* Left column: product details — compact */}
            <div className="space-y-3 overflow-y-auto md:overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome Prodotto/i *</Label>
                  <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="es. Dran Sword 3-60T" />
                </div>
                <div className="space-y-2">
                  <Label>Immagine prodotto</Label>
                  {imageUrl && (
                    <div className="relative w-32 h-32 rounded-md overflow-hidden border border-border">
                      <img src={imageUrl} alt="Anteprima" className="w-full h-full object-cover" />
                      <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setImageUrl("")}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploadingImage || !user}
                    onChange={async (e) => {
                      let file = e.target.files?.[0];
                      if (!file || !user) return;
                      setUploadingImage(true);
                      try { file = await prepareImageForUpload(file, { maxDimension: 1600 }); }
                      catch (err: any) { toast({ title: err?.message || "Immagine non valida", variant: "destructive" }); setUploadingImage(false); return; }
                      const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
                      const path = `${user.id}/${Date.now()}.${ext}`;
                      const { error: upErr } = await supabase.storage.from('market-images').upload(path, file, { upsert: false, contentType: file.type });
                      if (upErr) {
                        toast({ title: "Errore upload immagine", description: upErr.message, variant: "destructive" });
                        setUploadingImage(false);
                        return;
                      }
                      const { data: pub } = supabase.storage.from('market-images').getPublicUrl(path);
                      setImageUrl(pub.publicUrl);
                      setUploadingImage(false);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Carica una foto del prodotto. Verrà ottimizzata automaticamente. Gli annunci vengono eliminati dopo 30 giorni.
                  </p>
                </div>
              </div>
              <div>
                <Label>Categoria *</Label>
                <div className="grid grid-cols-3 md:grid-cols-3 gap-x-3 gap-y-1 mt-1.5">
                  {CATEGORIES.map(cat => (
                    <label key={cat} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={selectedCategories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                      <span className="truncate">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stato *</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map(c => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prezzo (€)</Label>
                  <Input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="15.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={freeShipping} onCheckedChange={(v) => { setFreeShipping(!!v); if (v) setShippingCost(""); }} />
                    <span className="text-sm font-medium">Spedizione Gratuita</span>
                  </label>
                </div>
                {!freeShipping && (
                  <div>
                    <Label>Spedizione (€)</Label>
                    <Input type="number" step="0.01" min="0" value={shippingCost} onChange={e => setShippingCost(e.target.value)} placeholder="5.00" />
                  </div>
                )}
              </div>
              <div>
                <Label>Link vendita *</Label>
                <Input value={saleLink} onChange={e => setSaleLink(e.target.value)} placeholder="https://www.vinted.it/..." required />
                <p className="text-xs text-muted-foreground mt-1">Link Vinted, Subito, ecc.</p>
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? "Pubblicazione..." : editingListing ? "Salva Modifiche" : "Pubblica Annuncio"}
              </Button>
            </div>

            {/* Right column: component picker — takes more space */}
            <MarketComponentPicker selectedIds={linkedComponentIds} onChange={setLinkedComponentIds} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={(o) => { setReportDialogOpen(o); if (!o) resetReport(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Flag size={16} className="text-orange-500" /> Segnala Annuncio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!reportCategory ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Seleziona la tipologia:</p>
                {REPORT_CATEGORIES.map(cat => (
                  <Button key={cat.value} variant="outline" className="w-full justify-start gap-2 h-auto py-3 text-left" onClick={() => setReportCategory(cat.value)}>
                    <cat.icon size={16} className="shrink-0 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{cat.label}</p>
                      <p className="text-xs text-muted-foreground font-normal">{cat.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
            ) : !reportSubReason ? (
              <div className="space-y-2">
                <Button variant="ghost" size="sm" className="gap-1 text-xs -ml-2" onClick={() => setReportCategory("")}>
                  ← Indietro
                </Button>
                <p className="text-sm font-medium">{REPORT_CATEGORIES.find(c => c.value === reportCategory)?.label}</p>
                <p className="text-xs text-muted-foreground mb-2">Seleziona il motivo specifico:</p>
                {REPORT_CATEGORIES.find(c => c.value === reportCategory)?.reasons.map(r => (
                  <Button key={r} variant="outline" className="w-full justify-start text-sm h-auto py-2.5" onClick={() => setReportSubReason(r)}>
                    {r}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Button variant="ghost" size="sm" className="gap-1 text-xs -ml-2" onClick={() => setReportSubReason("")}>
                  ← Indietro
                </Button>
                <div className="rounded-md bg-muted/50 p-2.5 space-y-0.5">
                  <p className="text-xs text-muted-foreground">{REPORT_CATEGORIES.find(c => c.value === reportCategory)?.label}</p>
                  <p className="text-sm font-medium">{reportSubReason}</p>
                </div>
                <div>
                  <Label className="text-xs">Dettagli aggiuntivi (opzionale)</Label>
                  <Textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Aggiungi dettagli se necessario..." rows={2} className="mt-1" />
                </div>
                <Button onClick={handleReport} className="w-full">Invia Segnalazione</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <MarketChatDialog
        open={chatOpen}
        onOpenChange={(open) => { setChatOpen(open); if (!open) setChatTarget(null); }}
        initialChatTarget={chatTarget}
      />

      <Footer />
    </div>
  );
};

export default Market;
