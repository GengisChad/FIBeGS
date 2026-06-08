import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, Layers, Plus, ExternalLink } from "lucide-react";
import { BEY_CATALOG, getBey } from "../data/beys";
import { useRpg } from "../state/rpgStore";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { loadUserSiteDecks, SiteDeckSummary } from "../data/siteDeckLoader";
import { useNavigate } from "react-router-dom";

export const DeckBuilder = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, setDeck, setSiteDeck } = useRpg();
  const [siteDecks, setSiteDecks] = useState<SiteDeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFallback, setSelectedFallback] = useState<string[]>(profile.selected_deck);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadUserSiteDecks(user.id)
      .then(setSiteDecks)
      .finally(() => setLoading(false));
  }, [user]);

  const toggleFallback = (id: string) => {
    setSelectedFallback((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return [...cur.slice(1), id];
      return [...cur, id];
    });
  };

  const useSiteDeck = async (id: string) => {
    await setSiteDeck(id);
    toast({ title: "Deck del sito selezionato per l'RPG" });
    onBack();
  };

  const useFallback = async () => {
    if (selectedFallback.length !== 3) { toast({ title: "Scegli 3 Beyblade", variant: "destructive" }); return; }
    await setDeck(selectedFallback);
    await setSiteDeck(null);
    toast({ title: "Deck di prova salvato" });
    onBack();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">I tuoi deck del sito</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/decks")}>
            <Plus className="h-4 w-4 mr-2" />Crea/Modifica nei Deck del sito
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Il deck RPG va assemblato esattamente come nella sezione Deck del sito: blade, ratchet, bit ecc.
          Seleziona qui sotto uno dei tuoi deck per usarlo in battaglia.
        </p>

        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Caricamento deck...</div>
        ) : siteDecks.length === 0 ? (
          <Card className="p-6 text-center space-y-3 border-dashed">
            <p className="text-sm text-muted-foreground">Non hai ancora un deck. Creane uno nella sezione Deck del sito.</p>
            <Button onClick={() => navigate("/decks")} size="sm"><Plus className="h-4 w-4 mr-2" />Vai ai Deck</Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {siteDecks.map((d) => {
              const active = profile.site_deck_id === d.id;
              return (
                <Card
                  key={d.id}
                  onClick={() => useSiteDeck(d.id)}
                  className={`p-4 cursor-pointer transition-all ${active ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/40"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold truncate">{d.name}</div>
                    {active && <Check className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="space-y-1">
                    {d.beyblades.map((b) => (
                      <div key={b.position} className="text-xs flex justify-between">
                        <span className="truncate">{b.position}. {b.blade_name}</span>
                        <span className="text-muted-foreground">{b.blade_type}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Fallback catalog deck for when no site deck is ready */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Deck di prova (catalogo RPG)</h3>
        <p className="text-xs text-muted-foreground">Usalo se non hai ancora un deck pronto sul sito.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BEY_CATALOG.map((b) => {
            const active = selectedFallback.includes(b.id);
            return (
              <Card
                key={b.id}
                onClick={() => toggleFallback(b.id)}
                className={`p-3 cursor-pointer transition-all ${active ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/40"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{b.emoji}</span>
                    <div>
                      <div className="font-bold text-sm">{b.name}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{b.type} · {b.hp} HP</div>
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
              </Card>
            );
          })}
        </div>
        <Button variant="secondary" size="sm" onClick={useFallback} disabled={selectedFallback.length !== 3}>
          Usa deck di prova ({selectedFallback.length}/3)
        </Button>
      </div>
    </div>
  );
};
