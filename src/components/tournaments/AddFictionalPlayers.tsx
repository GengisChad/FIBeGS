import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface GuestProfile {
  user_id: string;
  display_name: string;
}

interface Props {
  tournamentId: string;
  onPlayersAdded: (addedProfiles?: GuestProfile[]) => void;
  guestUserIds?: string[];
}

export const AddFictionalPlayers = ({ tournamentId, onPlayersAdded, guestUserIds = [] }: Props) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [open, setOpen] = useState(false);

  const handleAdd = async () => {
    const names = text
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0 && n.length <= 50);

    if (names.length === 0) {
      toast.error("Inserisci almeno un nome");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("add-fictional-players", {
        body: { tournament_id: tournamentId, names },
      });

      if (error) {
        toast.error("Errore nell'aggiunta dei giocatori");
        console.error(error);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data.added} giocatore/i fittizi aggiunti!`);
        setText("");
        onPlayersAdded(data.added_profiles as GuestProfile[] | undefined);
      }
    } catch (err) {
      toast.error("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAllGuests = async () => {
    if (guestUserIds.length === 0) {
      toast.info("Nessun guest da rimuovere");
      return;
    }
    setRemoving(true);
    try {
      const { error } = await supabase
        .from("tournament_registrations")
        .delete()
        .eq("tournament_id", tournamentId)
        .in("user_id", guestUserIds);
      if (error) {
        toast.error("Errore nella rimozione dei guest");
        console.error(error);
      } else {
        toast.success(`${guestUserIds.length} guest rimossi`);
        onPlayersAdded();
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="bg-secondary/30 rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-primary" />
          <span className="text-sm font-semibold">Aggiungi giocatori ospite</span>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Inserisci i nomi separati da virgola o andando a capo. Disponibile solo per tornei Normal.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Mario Rossi, Luigi Verdi\nAnna Bianchi"}
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAdd} disabled={loading || !text.trim()} className="gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Aggiungi
            </Button>

            {guestUserIds.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={removing} className="gap-2">
                    {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Rimuovi tutti i guest ({guestUserIds.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rimuovere tutti i guest?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Verranno rimossi <strong>{guestUserIds.length}</strong> giocatori ospite dal torneo.
                      Questa azione non può essere annullata.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRemoveAllGuests}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Rimuovi tutti
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
