import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Swords, Check, Plus, Heart } from "lucide-react";
import { DeckCreatorDialog } from "./DeckCreatorDialog";

interface TournamentDeckSelectorProps {
  tournamentId: string;
  onSelected?: () => void;
}

export const TournamentDeckSelector = ({ tournamentId, onSelected }: TournamentDeckSelectorProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [myDecks, setMyDecks] = useState<any[]>([]);
  const [likedDecks, setLikedDecks] = useState<any[]>([]);
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user, open]);

  const fetchData = async () => {
    if (!user) return;

    const [{ data: decks }, { data: selection }, { data: likes }] = await Promise.all([
      (supabase as any)
        .from("decks")
        .select("id, user_id, name, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("tournament_deck_selections")
        .select("deck_id")
        .eq("tournament_id", tournamentId)
        .eq("user_id", user.id)
        .maybeSingle(),
      (supabase as any)
        .from("deck_likes")
        .select("deck_id")
        .eq("user_id", user.id),
    ]);

    setMyDecks(decks || []);
    setCurrentSelection(selection?.deck_id || null);

    // Fetch liked decks that aren't mine
    const likedDeckIds = (likes || [])
      .map((l: any) => l.deck_id)
      .filter((id: string) => !(decks || []).some((d: any) => d.id === id));

    if (likedDeckIds.length > 0) {
      const { data: likedDecksData } = await (supabase as any)
        .from("decks")
        .select("id, user_id, name, description, created_at")
        .in("id", likedDeckIds);
      
      if (likedDecksData && likedDecksData.length > 0) {
        const ownerIds = [...new Set(likedDecksData.map((d: any) => d.user_id))] as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", ownerIds);
        const pMap = new Map((profiles || []).map(p => [p.user_id, p]));
        setLikedDecks(likedDecksData.map((d: any) => ({ ...d, ownerName: pMap.get(d.user_id)?.display_name || pMap.get(d.user_id)?.username || "Utente" })));
      } else {
        setLikedDecks([]);
      }
    } else {
      setLikedDecks([]);
    }
  };

  const handleSelect = async (deckId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      if (currentSelection) {
        const { error } = await (supabase as any)
          .from("tournament_deck_selections")
          .update({ deck_id: deckId, updated_at: new Date().toISOString() })
          .eq("tournament_id", tournamentId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("tournament_deck_selections")
          .insert({ tournament_id: tournamentId, user_id: user.id, deck_id: deckId });
        if (error) throw error;
      }
      setCurrentSelection(deckId);
      toast.success("Deck selezionato per il torneo!");
      setOpen(false);
      onSelected?.();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Errore sconosciuto"));
    } finally {
      setSaving(false);
    }
  };

  const allDecks = [...myDecks, ...likedDecks];
  const selectedDeck = allDecks.find(d => d.id === currentSelection);

  return (
    <div className="space-y-2">
      {currentSelection && selectedDeck ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Swords size={14} />
            Deck selezionato: <span className="font-bold">{selectedDeck.name}</span>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Cambia deck</Button>
            </DialogTrigger>
            <DeckSelectorContent
              myDecks={myDecks}
              likedDecks={likedDecks}
              currentSelection={currentSelection}
              saving={saving}
              onSelect={handleSelect}
              onCreated={fetchData}
            />
          </Dialog>
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Swords size={14} />
              Seleziona Deck
            </Button>
          </DialogTrigger>
          <DeckSelectorContent
            myDecks={myDecks}
            likedDecks={likedDecks}
            currentSelection={currentSelection}
            saving={saving}
            onSelect={handleSelect}
            onCreated={fetchData}
          />
        </Dialog>
      )}
    </div>
  );
};

const DeckSelectorContent = ({
  myDecks,
  likedDecks,
  currentSelection,
  saving,
  onSelect,
  onCreated,
}: {
  myDecks: any[];
  likedDecks: any[];
  currentSelection: string | null;
  saving: boolean;
  onSelect: (id: string) => void;
  onCreated: () => void;
}) => (
  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Seleziona il tuo Deck</DialogTitle>
    </DialogHeader>

    <DeckCreatorDialog
      onCreated={onCreated}
      trigger={
        <Button variant="outline" className="w-full gap-2 mb-3">
          <Plus size={14} /> Crea nuovo deck
        </Button>
      }
    />

    {myDecks.length === 0 && likedDecks.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-4">
        Non hai ancora creato nessun deck. Creane uno!
      </p>
    ) : (
      <div className="space-y-4">
        {myDecks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">I tuoi deck</p>
            {myDecks.map(deck => (
              <DeckSelectButton key={deck.id} deck={deck} currentSelection={currentSelection} saving={saving} onSelect={onSelect} />
            ))}
          </div>
        )}

        {likedDecks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Heart size={10} className="text-red-500" /> Deck preferiti
            </p>
            {likedDecks.map((deck: any) => (
              <DeckSelectButton key={deck.id} deck={deck} currentSelection={currentSelection} saving={saving} onSelect={onSelect} subtitle={`di ${deck.ownerName}`} />
            ))}
          </div>
        )}
      </div>
    )}
  </DialogContent>
);

const DeckSelectButton = ({ deck, currentSelection, saving, onSelect, subtitle }: {
  deck: any; currentSelection: string | null; saving: boolean; onSelect: (id: string) => void; subtitle?: string;
}) => (
  <button
    type="button"
    disabled={saving}
    onClick={() => onSelect(deck.id)}
    className={`w-full text-left rounded-xl border p-3 transition-all ${
      currentSelection === deck.id
        ? "border-primary bg-primary/5 ring-1 ring-primary"
        : "border-border hover:border-primary/40"
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="font-medium text-sm flex items-center gap-2">
        <Swords size={13} className="text-primary" />
        {deck.name}
      </span>
      {currentSelection === deck.id && (
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check size={12} className="text-primary-foreground" />
        </div>
      )}
    </div>
    {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    {deck.description && (
      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{deck.description}</p>
    )}
  </button>
);
