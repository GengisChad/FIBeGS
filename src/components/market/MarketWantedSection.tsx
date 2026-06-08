import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, MessageCircle, Search as SearchIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { validateNoProfanity } from "@/lib/profanityFilter";

const WANTED_CONDITIONS = [
  { value: "any", label: "Qualsiasi" },
  { value: "new", label: "Nuovo" },
  { value: "opened_unused", label: "Aperto mai usato" },
  { value: "used", label: "Usato" },
];

const getConditionLabel = (value: string) =>
  WANTED_CONDITIONS.find(c => c.value === value)?.label ?? value;

interface WantedPost {
  id: string;
  user_id: string;
  title: string;
  condition: string;
  max_price: number | null;
  created_at: string;
}

interface ProfileInfo {
  display_name: string;
  username: string | null;
}

interface MarketWantedSectionProps {
  onContact: (wantedId: string, ownerId: string) => void;
}

const MarketWantedSection = ({ onContact }: MarketWantedSectionProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<WantedPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [condition, setCondition] = useState("any");
  const [maxPrice, setMaxPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("market_wanted")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const items = (data ?? []) as WantedPost[];
    setPosts(items);

    const userIds = [...new Set(items.map(p => p.user_id).filter(id => !profiles[id]))];
    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", userIds);
      const map: Record<string, ProfileInfo> = { ...profiles };
      (pData ?? []).forEach((p: any) => {
        map[p.user_id] = { display_name: p.display_name || p.username || "Utente", username: p.username };
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim() || title.trim().length < 3) {
      toast({ title: "Il titolo deve avere almeno 3 caratteri", variant: "destructive" });
      return;
    }
    const profanityError = validateNoProfanity(title);
    if (profanityError) {
      toast({ title: profanityError, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("market_wanted").insert({
      user_id: user.id,
      title: title.trim(),
      condition,
      max_price: maxPrice ? parseFloat(maxPrice) : null,
    });
    if (error) toast({ title: "Errore creazione ricerca", variant: "destructive" });
    else {
      toast({ title: "Ricerca pubblicata!" });
      setDialogOpen(false);
      setTitle("");
      setCondition("any");
      setMaxPrice("");
      fetchPosts();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("market_wanted").delete().eq("id", id);
    toast({ title: "Ricerca eliminata" });
    fetchPosts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SearchIcon className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-lg">Cerco</h2>
        </div>
        {user && (
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus size={14} /> Cerca prodotto
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nessuna ricerca attiva.</p>
      ) : (
        <div className="space-y-2">
          {posts.map(post => {
            const profile = profiles[post.user_id];
            return (
              <Card key={post.id} className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {profile?.username ? (
                        <Link to={`/profilo/${profile.username}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                          {profile.display_name}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">{profile?.display_name || "Utente"}</span>
                      )}
                      <span className="text-xs text-muted-foreground">·</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{getConditionLabel(post.condition)}</Badge>
                      {post.max_price != null && (
                        <span className="text-xs font-semibold text-primary">max €{Number(post.max_price).toFixed(2)}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(post.created_at), "dd MMM", { locale: it })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {user && user.id !== post.user_id && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 h-7 text-xs font-bold"
                        onClick={() => onContact(post.id, post.user_id)}
                      >
                        <MessageCircle size={12} /> CONTATTA
                      </Button>
                    )}
                    {user && user.id === post.user_id && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(post.id)}>
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerca un prodotto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cosa cerchi? *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="es. Dran Sword 3-60T" maxLength={200} />
            </div>
            <div>
              <Label>Stato desiderato</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WANTED_CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Budget massimo (€)</Label>
              <Input type="number" step="0.01" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Opzionale" />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "Pubblicazione..." : "Pubblica Ricerca"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketWantedSection;
