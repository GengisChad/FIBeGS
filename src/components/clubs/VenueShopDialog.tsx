import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { toast } from "sonner";
import { Plus, Trash2, Store, Clock, CalendarDays, ImagePlus, X, Check, ChevronsUpDown } from "lucide-react";

interface Venue {
  id: string;
  club_id: string;
  name: string;
  address: string;
  city: string;
  is_shop?: boolean;
  shop_logo_url?: string | null;
  shop_phone?: string | null;
  shop_email?: string | null;
  shop_website?: string | null;
  shop_description?: string | null;
  shop_instagram?: string | null;
  shop_facebook?: string | null;
  shop_tiktok?: string | null;
  shop_whatsapp?: string | null;
  shop_hours?: Record<string, { open: string; close: string }[]> | null;
  shop_owner_user_id?: string | null;
}

interface MemberOption {
  user_id: string;
  display_name?: string | null;
  username?: string | null;
}

interface Schedule {
  id: string;
  venue_id: string;
  title: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Props {
  venue: Venue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  /** True if current user is club leader/vice/admin (can assign shop owner) */
  canManageFull?: boolean;
  /** True if current user is the assigned shop owner for this venue */
  isShopOwner?: boolean;
  /** Member options for shop-owner assignment dropdown (leader only) */
  memberOptions?: MemberOption[];
}

const DAYS = [
  { v: 1, l: "Lun" }, { v: 2, l: "Mar" }, { v: 3, l: "Mer" },
  { v: 4, l: "Gio" }, { v: 5, l: "Ven" }, { v: 6, l: "Sab" }, { v: 0, l: "Dom" },
];

const emptyHours = (): Record<string, { open: string; close: string }[]> =>
  ({ "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] });

export default function VenueShopDialog({ venue, open, onOpenChange, onSaved, canManageFull = false, isShopOwner = false, memberOptions = [] }: Props) {
  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [shopOwnerId, setShopOwnerId] = useState<string>(venue.shop_owner_user_id ?? "");
  const [savingOwner, setSavingOwner] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");

  const selectedOwner = memberOptions.find(m => m.user_id === shopOwnerId);
  const selectedOwnerLabel = selectedOwner
    ? (selectedOwner.display_name || selectedOwner.username || selectedOwner.user_id.slice(0, 8))
    : "";

  const ownerSearchTrim = ownerSearch.trim().toLowerCase();
  const filteredOwners = ownerSearchTrim
    ? memberOptions.filter(m =>
        (m.display_name || "").toLowerCase().includes(ownerSearchTrim) ||
        (m.username || "").toLowerCase().includes(ownerSearchTrim)
      ).slice(0, 30)
    : [];

  const canEditShop = isShopOwner || canManageFull;

  const [isShop, setIsShop] = useState(!!venue.is_shop);
  const [logoUrl, setLogoUrl] = useState(venue.shop_logo_url ?? "");
  const [phone, setPhone] = useState(venue.shop_phone ?? "");
  const [email, setEmail] = useState(venue.shop_email ?? "");
  const [website, setWebsite] = useState(venue.shop_website ?? "");
  const [description, setDescription] = useState(venue.shop_description ?? "");
  const [instagram, setInstagram] = useState(venue.shop_instagram ?? "");
  const [facebook, setFacebook] = useState(venue.shop_facebook ?? "");
  const [tiktok, setTiktok] = useState(venue.shop_tiktok ?? "");
  const [whatsapp, setWhatsapp] = useState(venue.shop_whatsapp ?? "");
  const [hours, setHours] = useState<Record<string, { open: string; close: string }[]>>(
    venue.shop_hours ?? emptyHours()
  );

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newSched, setNewSched] = useState({ day_of_week: 2, start_time: "18:00", end_time: "22:00", title: "" });

  useEffect(() => {
    if (!open) return;
    setIsShop(!!venue.is_shop);
    setLogoUrl(venue.shop_logo_url ?? "");
    setPhone(venue.shop_phone ?? "");
    setEmail(venue.shop_email ?? "");
    setWebsite(venue.shop_website ?? "");
    setDescription(venue.shop_description ?? "");
    setInstagram(venue.shop_instagram ?? "");
    setFacebook(venue.shop_facebook ?? "");
    setTiktok(venue.shop_tiktok ?? "");
    setWhatsapp(venue.shop_whatsapp ?? "");
    setHours(venue.shop_hours ?? emptyHours());
    setShopOwnerId(venue.shop_owner_user_id ?? "");
    fetchSchedules();
  }, [open, venue.id]);

  const saveShopOwner = async () => {
    setSavingOwner(true);
    const { error } = await supabase
      .from("club_venues")
      .update({ shop_owner_user_id: shopOwnerId || null, is_shop: !!shopOwnerId } as any)
      .eq("id", venue.id);
    setSavingOwner(false);
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success(shopOwnerId ? "Negoziante assegnato" : "Negoziante rimosso");
    if (shopOwnerId) setIsShop(true);
    onSaved?.();
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from("club_free_play_schedules" as any)
      .select("*")
      .eq("venue_id", venue.id)
      .order("day_of_week");
    setSchedules((data as any) ?? []);
  };

  const handleLogoUpload = async (file: File) => {
    try { file = await prepareImageForUpload(file, { maxDimension: 640, preservePng: true }); }
    catch (err: any) { toast.error(err?.message || "Immagine non valida"); return; }
    const ext = file.name.split(".").pop();
    const path = `${venue.club_id}/shop-${venue.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("club-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error("Upload fallito"); return; }
    const { data } = supabase.storage.from("club-logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
  };

  const addHourSlot = (day: string) => {
    setHours(prev => ({ ...prev, [day]: [...(prev[day] || []), { open: "09:00", close: "13:00" }] }));
  };
  const updateHourSlot = (day: string, idx: number, field: "open" | "close", value: string) => {
    setHours(prev => ({
      ...prev,
      [day]: prev[day].map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };
  const removeHourSlot = (day: string, idx: number) => {
    setHours(prev => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }));
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("club_venues").update({
      is_shop: isShop,
      shop_logo_url: logoUrl || null,
      shop_phone: phone || null,
      shop_email: email || null,
      shop_website: website || null,
      shop_description: description || null,
      shop_instagram: instagram || null,
      shop_facebook: facebook || null,
      shop_tiktok: tiktok || null,
      shop_whatsapp: whatsapp || null,
      shop_hours: hours,
    } as any).eq("id", venue.id);
    setSaving(false);
    if (error) { toast.error("Errore nel salvataggio"); return; }
    toast.success("Profilo negoziante salvato");
    onSaved?.();
  };

  const addSchedule = async () => {
    const { error } = await supabase.from("club_free_play_schedules" as any).insert({
      club_id: venue.club_id,
      venue_id: venue.id,
      title: newSched.title || null,
      day_of_week: newSched.day_of_week,
      start_time: newSched.start_time,
      end_time: newSched.end_time,
      is_active: true,
    });
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success("Free play aggiunto");
    setNewSched({ day_of_week: 2, start_time: "18:00", end_time: "22:00", title: "" });
    fetchSchedules();
    onSaved?.();
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Eliminare questa ricorrenza?")) return;
    const { error } = await supabase.from("club_free_play_schedules" as any).delete().eq("id", id);
    if (error) { toast.error("Errore"); return; }
    fetchSchedules();
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store size={18} /> {venue.name}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Leader assigns shop owner */}
        {canManageFull && (
          <div className="p-3 rounded-lg bg-secondary/40 border border-border mb-2 space-y-2">
            <div>
              <p className="text-sm font-medium">Negoziante della sede</p>
              <p className="text-xs text-muted-foreground">
                Assegna un membro del club come negoziante. Solo lui potrà configurare profilo, orari e free play del negozio.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex-1 relative">
                <Input
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  placeholder={selectedOwnerLabel ? `Attuale: ${selectedOwnerLabel}` : "Cerca per nome o username..."}
                />
                {ownerSearchTrim && (
                  <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {filteredOwners.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nessun membro trovato.</div>
                    ) : filteredOwners.map(m => (
                      <button
                        type="button"
                        key={m.user_id}
                        onClick={() => {
                          setShopOwnerId(m.user_id);
                          setOwnerSearch("");
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                      >
                        {shopOwnerId === m.user_id && <Check className="h-4 w-4 shrink-0" />}
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{m.display_name || m.username || m.user_id.slice(0, 8)}</span>
                          {m.display_name && m.username && (
                            <span className="text-xs text-muted-foreground truncate">@{m.username}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {shopOwnerId && (
                <Button size="sm" variant="ghost" onClick={() => setShopOwnerId("")}>
                  <X size={14} />
                </Button>
              )}
              <Button
                size="sm"
                disabled={savingOwner || shopOwnerId === (venue.shop_owner_user_id ?? "")}
                onClick={saveShopOwner}
              >
                {savingOwner ? "..." : "Salva"}
              </Button>
            </div>
          </div>
        )}

        {!canManageFull && isShopOwner && (
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 mb-2">
            <p className="text-xs">Sei il negoziante di questa sede. Configura profilo, orari e free play qui sotto.</p>
          </div>
        )}

        {!canEditShop && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground">
            Nessun negoziante assegnato. Il club leader può assegnare un membro come negoziante per abilitare le funzioni di negozio e free play.
          </div>
        )}

        {canEditShop && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border mb-2">
            <div>
              <p className="text-sm font-medium">Modalità negoziante attiva</p>
              <p className="text-xs text-muted-foreground">Disattiva per nascondere il profilo negozio.</p>
            </div>
            <Switch checked={isShop} onCheckedChange={setIsShop} />
          </div>
        )}

        {canEditShop && isShop && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="profile"><Store size={14} className="mr-1" /> Profilo</TabsTrigger>
              <TabsTrigger value="hours"><Clock size={14} className="mr-1" /> Orari</TabsTrigger>
              <TabsTrigger value="freeplay"><CalendarDays size={14} className="mr-1" /> Free Play</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-3 pt-3">
              <div>
                <Label>Logo</Label>
                <div className="flex items-center gap-3 mt-1">
                  {logoUrl ? (
                    <div className="relative">
                      <img src={logoUrl} alt="Logo negozio" className="w-16 h-16 rounded-lg object-cover border border-border" />
                      <button onClick={() => setLogoUrl("")} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border border-border">
                      <Store size={24} className="text-muted-foreground" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                    <span className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-secondary rounded-lg hover:bg-secondary/70">
                      <ImagePlus size={14} /> Carica logo
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <Label>Descrizione</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Breve descrizione del negozio..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Telefono</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39..." />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@..." />
                </div>
              </div>
              <div>
                <Label>Sito web</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Instagram</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@..." /></div>
                <div><Label>Facebook</Label><Input value={facebook} onChange={(e) => setFacebook(e.target.value)} /></div>
                <div><Label>TikTok</Label><Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@..." /></div>
                <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+39..." /></div>
              </div>
            </TabsContent>

            <TabsContent value="hours" className="space-y-2 pt-3">
              <p className="text-xs text-muted-foreground">Aggiungi gli orari di apertura per ogni giorno.</p>
              {DAYS.map(d => (
                <div key={d.v} className="border border-border rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{d.l}</span>
                    <Button size="sm" variant="ghost" onClick={() => addHourSlot(String(d.v))}>
                      <Plus size={12} className="mr-1" /> Slot
                    </Button>
                  </div>
                  {(hours[String(d.v)] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Chiuso</p>
                  ) : (
                    <div className="space-y-1">
                      {hours[String(d.v)].map((slot, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input type="time" value={slot.open} onChange={(e) => updateHourSlot(String(d.v), i, "open", e.target.value)} className="w-28" />
                          <span className="text-xs text-muted-foreground">→</span>
                          <Input type="time" value={slot.close} onChange={(e) => updateHourSlot(String(d.v), i, "close", e.target.value)} className="w-28" />
                          <Button size="icon" variant="ghost" onClick={() => removeHourSlot(String(d.v), i)}>
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="freeplay" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">Le sessioni di free play ricorrenti compaiono nel calendario del club (visibili solo ai membri).</p>

              <div className="space-y-2">
                {schedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nessuna sessione ricorrente.</p>
                ) : schedules.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border border-border">
                    <div className="text-sm">
                      <span className="font-medium">{DAYS.find(d => d.v === s.day_of_week)?.l ?? "?"}</span>
                      <span className="text-muted-foreground"> · {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                      {s.title && <span className="ml-2 text-xs">"{s.title}"</span>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteSchedule(s.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aggiungi ricorrenza</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Giorno</Label>
                    <Select value={String(newSched.day_of_week)} onValueChange={(v) => setNewSched(p => ({ ...p, day_of_week: parseInt(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => <SelectItem key={d.v} value={String(d.v)}>{d.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Titolo (opzionale)</Label>
                    <Input value={newSched.title} onChange={(e) => setNewSched(p => ({ ...p, title: e.target.value }))} placeholder="Es. Free Play serale" />
                  </div>
                  <div>
                    <Label className="text-xs">Inizio</Label>
                    <Input type="time" value={newSched.start_time} onChange={(e) => setNewSched(p => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Fine</Label>
                    <Input type="time" value={newSched.end_time} onChange={(e) => setNewSched(p => ({ ...p, end_time: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={addSchedule} size="sm" className="w-full">
                  <Plus size={14} className="mr-1" /> Aggiungi al calendario
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Chiudi</Button>
          {canEditShop && (
            <Button disabled={saving} onClick={saveProfile}>{saving ? "Salvataggio..." : "Salva profilo"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
