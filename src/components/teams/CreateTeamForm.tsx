import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CityCombobox } from "@/components/CityCombobox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { Upload, Search, X, Users } from "lucide-react";

interface Props { onDone?: () => void; onCancel?: () => void; }
interface SearchResult { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; }
interface Region { id: string; name: string }

const slugify = (s: string) => s.toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 40) || `team-${Date.now()}`;

export const CreateTeamForm = ({ onDone, onCancel }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [regionId, setRegionId] = useState<string>("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [invited, setInvited] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("regions").select("id, name").order("name").then(({ data }) => setRegions((data || []) as Region[]));
  }, []);

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { toast.error("Logo troppo grande (max 2MB)"); return; }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const search = async () => {
    const q = query.trim();
    if (!q || !user) return;
    setSearching(true);
    // Escape special PostgREST chars in or() filter
    const safe = q.replace(/[(),]/g, " ");
    const { data } = await supabase.from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
      .neq("user_id", user.id)
      .limit(50);
    const lower = q.toLowerCase();
    const invitedIds = new Set(invited.map(m => m.user_id));
    const unique = Array.from(new Map(((data || []) as SearchResult[]).map(p => [p.user_id, p])).values())
      .filter(p => !invitedIds.has(p.user_id));
    const ranked = unique
      .map((p) => {
        const u = (p.username || "").toLowerCase();
        const d = (p.display_name || "").toLowerCase();
        let score = 99;
        if (u === lower || d === lower) score = 0;
        else if (u.startsWith(lower) || d.startsWith(lower)) score = 1;
        else if (u.includes(lower) || d.includes(lower)) score = 2;
        return { p, score, len: (p.display_name || p.username || "").length };
      })
      .sort((a, b) => a.score - b.score || a.len - b.len)
      .slice(0, 15)
      .map((x) => x.p);
    setResults(ranked);
    setSearching(false);
  };

  const addMember = (p: SearchResult) => {
    if (invited.some(m => m.user_id === p.user_id)) return;
    if (invited.length >= 2) { toast.error("Puoi invitare al massimo 2 giocatori oltre te"); return; }
    setInvited(prev => [...prev, p]);
    setQuery(""); setResults([]);
  };

  const submit = async () => {
    if (!user || !name.trim()) return;
    const err = validateNoProfanity(name, description || "", city || "");
    if (err) { toast.error(err); return; }
    setSubmitting(true);

    let logoUrl: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("team-logos").upload(path, logoFile, { upsert: false });
      if (upErr) { toast.error("Upload logo fallito: " + upErr.message); setSubmitting(false); return; }
      logoUrl = supabase.storage.from("team-logos").getPublicUrl(path).data.publicUrl;
    }

    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: t, error } = await (supabase as any).from("teams").insert({
      name: name.trim(), slug, description: description.trim() || null,
      logo_url: logoUrl, city: city.trim() || null, region_id: regionId || null,
      created_by: user.id,
    }).select("id").maybeSingle();

    if (error || !t) {
      toast.error("Errore creazione squadra: " + (error?.message || "sconosciuto"));
      setSubmitting(false); return;
    }

    if (invited.length > 0) {
      const rows = invited.map(m => ({
        team_id: t.id, invited_user_id: m.user_id, invited_by: user.id,
      }));
      const { error: iErr } = await (supabase as any).from("team_invites").insert(rows);
      if (iErr) toast.warning("Squadra creata, ma alcuni inviti sono falliti: " + iErr.message);
    }

    toast.success("Squadra creata!");
    onDone?.();
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-16 w-16">
          <AvatarImage src={logoPreview || undefined} />
          <AvatarFallback><Users size={20} /></AvatarFallback>
        </Avatar>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
          <Button type="button" variant="outline" size="sm" asChild>
            <span><Upload size={14} className="mr-1" /> Carica logo</span>
          </Button>
        </label>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Nome squadra *</label>
        <Input value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder="Es. Dragoon Riders" />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Descrizione</label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={300} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Regione</label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            value={regionId} onChange={e => setRegionId(e.target.value)}>
            <option value="">—</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Città</label>
          <CityCombobox value={city} onChange={setCity} regionId={regionId || undefined} placeholder="Cerca comune..." />
        </div>
      </div>

      <div className="border border-border rounded-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Users size={12} /> Invita membri ({invited.length})
        </div>
        <div className="flex gap-2">
          <Input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), search())}
            placeholder="Cerca per username o nome..." className="h-9" />
          <Button size="sm" onClick={search} disabled={searching}><Search size={14} /></Button>
        </div>
        {results.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {results.map(p => (
              <button key={p.user_id} type="button" onClick={() => addMember(p)}
                className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left">
                <Avatar className="h-6 w-6"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{(p.display_name || p.username || "?")[0]}</AvatarFallback></Avatar>
                <span className="text-sm truncate flex-1">{p.display_name || p.username}</span>
              </button>
            ))}
          </div>
        )}
        {invited.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
            {invited.map(m => (
              <span key={m.user_id} className="inline-flex items-center gap-1 bg-secondary/50 rounded-full pl-1 pr-2 py-0.5 text-xs">
                <Avatar className="h-4 w-4"><AvatarImage src={m.avatar_url || undefined} /><AvatarFallback>{(m.display_name || m.username || "?")[0]}</AvatarFallback></Avatar>
                {m.display_name || m.username}
                <button onClick={() => setInvited(prev => prev.filter(x => x.user_id !== m.user_id))}><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Annulla</Button>}
        <Button onClick={submit} disabled={submitting || !name.trim()}>{submitting ? "Creazione..." : "Crea squadra"}</Button>
      </div>
    </div>
  );
};

export default CreateTeamForm;
