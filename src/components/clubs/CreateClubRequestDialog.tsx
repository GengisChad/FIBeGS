import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CityCombobox } from "@/components/CityCombobox";
import { MapPin, Search, AlertTriangle, CheckCircle, Send, X, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Region {
  id: string;
  name: string;
  code: string;
}

interface GeoResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface SearchResult {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const REQUIRED_INVITES = 7;

export const CreateClubRequestDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [clubName, setClubName] = useState("");
  const [description, setDescription] = useState("");
  const [regionId, setRegionId] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const [distanceCheck, setDistanceCheck] = useState<{ ok: boolean; nearClub?: string; distance?: number } | null>(null);
  const [checkingDistance, setCheckingDistance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialReason, setSpecialReason] = useState("");
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Invite members state
  const [invitedMembers, setInvitedMembers] = useState<SearchResult[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    const checkPending = async () => {
      const { count } = await supabase
        .from("club_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "pending");
      setHasPendingRequest((count ?? 0) > 0);
    };
    checkPending();
  }, [user, open]);

  useEffect(() => {
    const fetchRegions = async () => {
      const { data } = await supabase.from("regions").select("*").order("name");
      if (data) setRegions(data);
    };
    fetchRegions();
  }, []);

  useEffect(() => {
    setDistanceCheck(null);
  }, [coords]);

  const handleMemberSearch = async (query: string) => {
    setMemberSearch(query);
    if (query.length < 2) {
      setMemberResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);
    setMemberResults((data as SearchResult[]) ?? []);
    setSearching(false);
  };

  const addMember = (profile: SearchResult) => {
    if (invitedMembers.length >= REQUIRED_INVITES) {
      toast.error(`Massimo ${REQUIRED_INVITES} membri da invitare`);
      return;
    }
    if (profile.user_id === user?.id) {
      toast.error("Sei già il leader del club");
      return;
    }
    if (invitedMembers.some(m => m.user_id === profile.user_id)) {
      toast.error("Giocatore già aggiunto");
      return;
    }
    setInvitedMembers(prev => [...prev, profile]);
    setMemberSearch("");
    setMemberResults([]);
  };

  const removeMember = (userId: string) => {
    setInvitedMembers(prev => prev.filter(m => m.user_id !== userId));
  };

  const geocodeAddress = async () => {
    if (!address.trim() || !city.trim()) {
      setGeocodeError("Inserisci città e indirizzo prima di cercare");
      return;
    }

    setGeocoding(true);
    setGeocodeError("");
    setCoords(null);
    setDistanceCheck(null);

    try {
      const query = encodeURIComponent(`${address.trim()}, ${city.trim()}, Italia`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=it`,
        { headers: { "Accept-Language": "it" } }
      );
      const results: GeoResult[] = await res.json();

      if (results.length === 0) {
        setGeocodeError("Indirizzo non trovato. Prova con più dettagli.");
        setGeocoding(false);
        return;
      }

      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      setCoords({ lat, lng });
      await checkDistanceFromClubs(lat, lng);
    } catch {
      setGeocodeError("Errore nella ricerca dell'indirizzo.");
    }
    setGeocoding(false);
  };

  const checkDistanceFromClubs = async (lat: number, lng: number) => {
    setCheckingDistance(true);
    const { data: clubs } = await supabase
      .from("clubs")
      .select("name, latitude, longitude")
      .eq("is_active", true);

    if (clubs) {
      for (const club of clubs) {
        if (club.latitude && club.longitude) {
          const dist = haversineKm(lat, lng, Number(club.latitude), Number(club.longitude));
          if (dist < 10) {
            setDistanceCheck({
              ok: false,
              nearClub: club.name,
              distance: Math.round(dist * 10) / 10,
            });
            setCheckingDistance(false);
            return;
          }
        }
      }
    }
    setDistanceCheck({ ok: true });
    setCheckingDistance(false);
  };

  const resetForm = () => {
    setClubName("");
    setDescription("");
    setRegionId("");
    setCity("");
    setAddress("");
    setCoords(null);
    setDistanceCheck(null);
    setSpecialReason("");
    setInvitedMembers([]);
    setMemberSearch("");
    setMemberResults([]);
  };

  const handleSubmit = async (isSpecial = false) => {
    if (!user || !clubName.trim() || !coords) return;
    if (!isSpecial && !distanceCheck?.ok) return;
    if (invitedMembers.length < REQUIRED_INVITES) {
      toast.error(`Devi invitare esattamente ${REQUIRED_INVITES} giocatori`);
      return;
    }
    const profanityError = validateNoProfanity(clubName, description, city, address, specialReason);
    if (profanityError) { toast.error(profanityError); return; }

    setSubmitting(true);

    // Create club request
    const { data: request, error } = await supabase.from("club_requests").insert({
      user_id: user.id,
      club_name: clubName.trim(),
      description: description.trim() || null,
      region_id: regionId || null,
      city: city.trim() || null,
      address: address.trim() || null,
      latitude: coords.lat,
      longitude: coords.lng,
      ...(isSpecial ? { special_reason: specialReason.trim() } : {}),
    } as any).select("id").single();

    if (error || !request) {
      toast.error("Errore nell'invio della richiesta");
      setSubmitting(false);
      return;
    }

    // Create invitations
    const inviteInserts = invitedMembers.map(m => ({
      request_id: request.id,
      user_id: m.user_id,
    }));

    const { error: inviteError } = await supabase
      .from("club_request_invites")
      .insert(inviteInserts as any);

    if (inviteError) {
      // Rollback: delete the orphaned request so the user can retry
      await supabase.from("club_requests").delete().eq("id", request.id);
      toast.error("Errore nell'invio degli inviti: " + inviteError.message);
      setSubmitting(false);
      return;
    }

    // Send notifications to invited members
    const notifications = invitedMembers.map(m => ({
      user_id: m.user_id,
      type: "club_invite",
      title: "Invito Club",
      message: `Sei stato invitato a far parte del nuovo club "${clubName.trim()}" come membro fondatore.`,
      link: "/clubs",
    }));

    const { error: notifError } = await supabase.from("notifications").insert(notifications);
    if (notifError) {
      console.warn("Notification insert failed:", notifError.message);
    } else {
      // Trigger push delivery on-demand (no cron needed)
      supabase.functions.invoke("auto-push-notification").catch((e) => {
        console.warn("Push trigger failed:", e?.message);
      });
    }

    toast.success(isSpecial
      ? "Richiesta speciale inviata! Gli inviti sono stati mandati ai giocatori."
      : "Richiesta inviata! Gli inviti sono stati mandati ai giocatori."
    );
    onOpenChange(false);
    setShowSpecialDialog(false);
    resetForm();
    setSubmitting(false);
  };

  const canSubmit = clubName.trim() && city.trim() && address.trim() && regionId && coords && distanceCheck?.ok && !submitting && invitedMembers.length === REQUIRED_INVITES;
  const canSubmitSpecial = clubName.trim() && city.trim() && address.trim() && regionId && coords && specialReason.trim().length >= 20 && !submitting && invitedMembers.length === REQUIRED_INVITES;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Richiedi un nuovo Club</DialogTitle>
          </DialogHeader>

          {hasPendingRequest ? (
            <div className="flex items-center gap-2 bg-muted rounded-xl p-4 mt-4 text-sm text-muted-foreground">
              <AlertTriangle size={16} className="text-yellow-500 shrink-0" />
              Hai già una richiesta in attesa di approvazione. Attendi che venga gestita prima di inviarne un'altra.
            </div>
          ) : (
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Nome del Club *</label>
              <Input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Es. Beyblade Milano"
                maxLength={100}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Descrizione</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrivi il tuo club..."
                maxLength={500}
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Regione</label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona regione" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Città *</label>
              <CityCombobox
                value={city}
                onChange={(v) => {
                  setCity(v);
                  setCoords(null);
                  setDistanceCheck(null);
                }}
                regionId={regionId || undefined}
                placeholder="Cerca comune..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                <MapPin size={14} className="inline mr-1" />
                Indirizzo sede di gioco *
              </label>
              <div className="flex gap-2">
                <Input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setCoords(null);
                    setDistanceCheck(null);
                  }}
                  placeholder="Es. Via Roma 15"
                  maxLength={200}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={geocodeAddress}
                  disabled={geocoding || !address.trim() || !city.trim()}
                  className="shrink-0"
                >
                  {geocoding ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <Search size={16} />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Inserisci l'indirizzo e premi il tasto cerca per verificare la posizione.
              </p>
            </div>

            {geocodeError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertTriangle size={16} />
                {geocodeError}
              </div>
            )}

            {coords && !distanceCheck && checkingDistance && (
              <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                Verifica distanza dai club esistenti...
              </div>
            )}

            {distanceCheck && !distanceCheck.ok && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Sede troppo vicina!</p>
                    <p>Il club <strong>{distanceCheck.nearClub}</strong> si trova a soli {distanceCheck.distance} km. La distanza minima tra due sedi è di 10 km.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setShowSpecialDialog(true)}
                  disabled={!clubName.trim() || !city.trim() || !address.trim() || !regionId || invitedMembers.length < REQUIRED_INVITES}
                >
                  <Send size={14} className="mr-2" />
                  Invia richiesta speciale
                </Button>
              </div>
            )}

            {distanceCheck?.ok && coords && (
              <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-green-500/10 text-green-400">
                <CheckCircle size={16} />
                Posizione verificata! Nessun club nelle vicinanze.
              </div>
            )}

            {/* Invite Members Section */}
            <div className="border border-border rounded-xl p-3 space-y-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users size={14} className="text-primary" />
                Membri fondatori ({invitedMembers.length}/{REQUIRED_INVITES}) *
              </label>
              <p className="text-xs text-muted-foreground">
                Invita {REQUIRED_INVITES} giocatori registrati. Tu sarai il leader del club. 
                Ogni invitato dovrà accettare l'invito prima che la richiesta venga inoltrata allo staff.
              </p>

              {/* Current invited members */}
              {invitedMembers.length > 0 && (
                <div className="space-y-1.5">
                  {invitedMembers.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={m.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px] bg-secondary">
                          {(m.display_name || m.username || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{m.display_name || m.username}</span>
                        {m.username && <span className="text-[10px] text-muted-foreground">@{m.username}</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeMember(m.user_id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search for members */}
              {invitedMembers.length < REQUIRED_INVITES && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={memberSearch}
                    onChange={(e) => handleMemberSearch(e.target.value)}
                    placeholder="Cerca per username..."
                    className="pl-9"
                  />
                  {memberResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {memberResults
                        .filter(r => !invitedMembers.some(m => m.user_id === r.user_id) && r.user_id !== user?.id)
                        .map((r) => (
                          <button
                            key={r.user_id}
                            onClick={() => addMember(r)}
                            className="w-full flex items-center gap-2 p-2.5 hover:bg-secondary/50 transition-colors text-left"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={r.avatar_url || undefined} />
                              <AvatarFallback className="text-[9px] bg-secondary">
                                {(r.display_name || r.username || "?").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">{r.display_name || r.username}</span>
                              {r.username && <span className="text-[10px] text-muted-foreground">@{r.username}</span>}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                  {searching && <p className="text-xs text-muted-foreground mt-1">Ricerca...</p>}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              📋 La richiesta verrà inoltrata allo staff solo dopo che tutti i {REQUIRED_INVITES} giocatori avranno accettato l'invito.
            </p>
            <Button onClick={() => handleSubmit(false)} disabled={!canSubmit} className="w-full" variant="hero">
              {submitting ? "Invio..." : "Invia Richiesta"}
            </Button>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Special request motivation dialog */}
      <Dialog open={showSpecialDialog} onOpenChange={setShowSpecialDialog}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Richiesta Speciale</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Club nel raggio di 10 km</p>
                <p className="text-xs mt-1 opacity-80">
                  Il club <strong>{distanceCheck?.nearClub}</strong> si trova a {distanceCheck?.distance} km dalla sede proposta.
                  Spiega perché il tuo club dovrebbe essere approvato nonostante la vicinanza.
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Motivazione (minimo 20 caratteri) *
              </label>
              <Textarea
                value={specialReason}
                onChange={(e) => setSpecialReason(e.target.value)}
                placeholder="Spiega perché il tuo club dovrebbe essere approvato nonostante la vicinanza a un altro club esistente..."
                maxLength={1000}
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {specialReason.trim().length}/1000 caratteri
              </p>
            </div>

            <Button
              onClick={() => handleSubmit(true)}
              disabled={!canSubmitSpecial}
              className="w-full"
              variant="hero"
            >
              {submitting ? "Invio..." : "Invia Richiesta Speciale"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
