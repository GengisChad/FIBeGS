import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Users, Shield, Trophy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Club {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface JoinClubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  club: Club | null;
  clubs?: Club[];
  organizerClubId?: string | null;
  onJoined: () => void;
}

export const JoinClubDialog = ({ open, onOpenChange, club, clubs, organizerClubId, onJoined }: JoinClubDialogProps) => {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [joining, setJoining] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  // Build the list: if clubs array provided use it, otherwise fall back to single club
  const clubList = clubs && clubs.length > 0 ? clubs : club ? [club] : [];
  const selectedClub = clubList.find(c => c.id === selectedClubId) || (clubList.length === 1 ? clubList[0] : null);

  if (clubList.length === 0) return null;

  const handleJoin = async () => {
    if (!user || !selectedClub) {
      if (!selectedClub) toast.error("Seleziona un club");
      return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      toast.error("Inserisci un numero di telefono valido (minimo 6 cifre)");
      return;
    }
    setJoining(true);
    const { data: memberData, error } = await supabase.from("club_members").insert({
      club_id: selectedClub.id,
      user_id: user.id,
      role: "member",
      city: city || null,
    }).select("id").single();
    if (error) {
      setJoining(false);
      if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("unique")) {
        toast.error("Fai già parte di un club. Devi prima lasciare il club attuale.");
      } else if (error.code === "42501" || error.message?.includes("row-level security")) {
        toast.error("Errore di permessi. Assicurati di essere loggato e riprova.");
      } else {
        console.error("Club join error:", error);
        toast.error("Errore nell'iscrizione al club: " + error.message);
      }
      return;
    }
    if (memberData && phone.trim()) {
      await supabase.from("club_member_phones").insert({
        club_member_id: memberData.id,
        club_id: selectedClub.id,
        user_id: user.id,
        phone: phone.trim(),
      });
    }
    setJoining(false);
    toast.success(`Ti sei unito a ${selectedClub.name}!`);
    onJoined();
    onOpenChange(false);
  };

  const showMultiple = clubList.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            Club richiesto
          </DialogTitle>
          <DialogDescription>
            Per iscriverti ai tornei Ranked devi far parte di un Club.
            {showMultiple ? " Scegli il club a cui unirti:" : " Ecco il club più vicino alla tua città!"}
          </DialogDescription>
        </DialogHeader>

        {/* Club list or single card */}
        <div className={cn("space-y-2", showMultiple && "max-h-[240px] overflow-y-auto pr-1")}>
          {clubList.map((c) => {
            const isOrganizer = c.id === organizerClubId;
            const isSelected = selectedClub?.id === c.id;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClubId(c.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-3 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-secondary/50 hover:border-primary/30",
                  isOrganizer && !isSelected && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={c.logo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {c.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base truncate">{c.name}</h3>
                      {isOrganizer && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
                          <Trophy size={10} /> Organizzatore
                        </span>
                      )}
                    </div>
                    {c.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin size={10} /> {c.city}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={18} className="text-primary shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selectedClub && (
          <Link
            to={`/clubs/${selectedClub.id}`}
            className="text-xs text-primary hover:underline"
            onClick={() => onOpenChange(false)}
          >
            Vedi pagina del club →
          </Link>
        )}

        {/* Registration fields */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="join-phone" className="text-sm">Telefono *</Label>
            <Input
              id="join-phone"
              type="tel"
              placeholder="+39 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-secondary border-border"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-city" className="text-sm">Città (opzionale)</Label>
            <Input
              id="join-city"
              type="text"
              placeholder="La tua città"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
        </div>

        <Button
          variant="hero"
          className="w-full mt-2"
          onClick={handleJoin}
          disabled={joining || !selectedClub}
        >
          <Users size={16} className="mr-2 shrink-0" />
          <span className="truncate">
            {joining ? "Iscrizione in corso..." : selectedClub ? `Unisciti a ${selectedClub.name}` : "Seleziona un club"}
          </span>
        </Button>
      </DialogContent>
    </Dialog>
  );
};
