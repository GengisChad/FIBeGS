import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, ChevronRight, ChevronLeft, Pencil, Upload, Film, BookOpen, FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import AdminPagination, { useAdminPagination } from "./AdminPagination";

type Category = { id: string; name: string; type: string; cover_url: string | null; sort_order: number };
type Series = { id: string; category_id: string; title: string; cover_url: string | null; sort_order: number; description: string | null; genre: string | null; year: number | null; episodes_count: number | null };
type Season = { id: string; series_id: string; title: string; sort_order: number; cover_url: string | null; description: string | null };
type StreamingLink = { platform: string; url: string };
type Episode = { id: string; season_id: string; title: string; episode_number: number; video_url: string | null; is_youtube: boolean; platform: string | null; sort_order: number; streaming_links: StreamingLink[] | null };
type Chapter = { id: string; season_id: string; title: string; chapter_number: number; pdf_url: string | null; sort_order: number };

type View = 
  | { level: "categories" }
  | { level: "series"; category: Category }
  | { level: "seasons"; series: Series; category: Category }
  | { level: "episodes"; season: Season; series: Series; category: Category };

const MediaAdminTab = () => {
  const [view, setView] = useState<View>({ level: "categories" });
  const [categories, setCategories] = useState<Category[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"category" | "series" | "season" | "episode" | "chapter">("category");
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSource, setBulkSource] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

  useEffect(() => { setPage(0); }, [view]);

  useEffect(() => {
    if (view.level === "categories") fetchCategories();
    else if (view.level === "series") fetchSeries(view.category.id);
    else if (view.level === "seasons") fetchSeasons(view.series.id);
    else if (view.level === "episodes") {
      fetchEpisodes(view.season.id);
      if (view.category.type === "manga") fetchChapters(view.season.id);
    }
  }, [view]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from("media_categories").select("*").order("sort_order");
    setCategories((data as Category[]) || []);
    setLoading(false);
  };

  const fetchSeries = async (categoryId: string) => {
    setLoading(true);
    const { data } = await supabase.from("media_series").select("*").eq("category_id", categoryId).order("sort_order");
    setSeriesList((data as Series[]) || []);
    setLoading(false);
  };

  const fetchSeasons = async (seriesId: string) => {
    setLoading(true);
    const { data } = await supabase.from("media_seasons").select("*").eq("series_id", seriesId).order("sort_order");
    setSeasons((data as Season[]) || []);
    setLoading(false);
  };

  const fetchEpisodes = async (seasonId: string) => {
    setLoading(true);
    const { data } = await supabase.from("media_episodes").select("*").eq("season_id", seasonId).order("sort_order");
    setEpisodes((data as unknown as Episode[]) || []);
    setLoading(false);
  };

  const fetchChapters = async (seasonId: string) => {
    const { data } = await supabase.from("media_chapters").select("*").eq("season_id", seasonId).order("sort_order");
    setChapters((data as Chapter[]) || []);
  };

  const openDialog = (mode: typeof dialogMode, item?: any) => {
    setDialogMode(mode);
    setEditItem(item || null);
    if (item) {
      setForm({ ...item });
    } else {
      const defaults: Record<string, any> = {
        category: { name: "", type: "anime", sort_order: 0 },
        series: { title: "", sort_order: 0, category_id: view.level === "series" ? view.category.id : "", description: "", genre: "", year: null, episodes_count: null },
        season: { title: "", sort_order: 0, series_id: view.level === "seasons" ? view.series.id : "", description: "" },
        episode: { title: "", episode_number: 1, video_url: "", is_youtube: false, platform: "", sort_order: 0, season_id: view.level === "episodes" ? view.season.id : "", streaming_links: [] },
        chapter: { title: "", chapter_number: 1, pdf_url: "", sort_order: 0, season_id: view.level === "episodes" ? view.season.id : "" },
      };
      setForm(defaults[mode]);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const tables: Record<string, string> = {
      category: "media_categories",
      series: "media_series",
      season: "media_seasons",
      episode: "media_episodes",
      chapter: "media_chapters",
    };
    const table = tables[dialogMode];
    const payload = { ...form };
    delete payload.id;
    delete payload.created_at;

    let error;
    if (editItem) {
      ({ error } = await supabase.from(table as any).update(payload).eq("id", editItem.id));
    } else {
      ({ error } = await supabase.from(table as any).insert(payload));
    }

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editItem ? "Modificato" : "Creato", description: "Operazione completata" });
      setDialogOpen(false);
      // Refresh
      if (view.level === "categories") fetchCategories();
      else if (view.level === "series") fetchSeries(view.category.id);
      else if (view.level === "seasons") fetchSeasons(view.series.id);
      else if (view.level === "episodes") {
        fetchEpisodes(view.season.id);
        if (view.category.type === "manga") fetchChapters(view.season.id);
      }
    }
  };

  const handleDelete = async (table: string, id: string) => {
    if (!confirm("Eliminare questo elemento?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Eliminato" });
      // Refresh
      if (view.level === "categories") fetchCategories();
      else if (view.level === "series") fetchSeries(view.category.id);
      else if (view.level === "seasons") fetchSeasons(view.series.id);
      else if (view.level === "episodes") {
        fetchEpisodes(view.season.id);
        if (view.category.type === "manga") fetchChapters(view.season.id);
      }
    }
  };

  const handleCoverUpload = async (file: File) => {
    setUploading(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 1200 }); }
    catch (err: any) { toast({ title: err?.message || "Immagine non valida", variant: "destructive" }); setUploading(false); return; }
    const path = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("media-covers").upload(path, file, { contentType: file.type });
    if (error) {
      toast({ title: "Errore upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("media-covers").getPublicUrl(path);
    setForm((f: any) => ({ ...f, cover_url: publicUrl }));
    setUploading(false);
    toast({ title: "Copertina caricata" });
  };

  const handlePdfUpload = async (file: File) => {
    setUploading(true);
    const path = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("manga-chapters").upload(path, file);
    if (error) {
      toast({ title: "Errore upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("manga-chapters").getPublicUrl(path);
    setForm((f: any) => ({ ...f, pdf_url: publicUrl }));
    setUploading(false);
    toast({ title: "PDF caricato" });
  };

  /**
   * Bulk import parser. Accepts format:
   * 1. Title
   * https://url.mp4
   * 
   * 2. Title
   * https://url.mp4
   */
  const parseBulkText = (text: string): { number: number; title: string; url: string }[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const result: { number: number; title: string; url: string }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      // Match "N. Title" or "N - Title" or "N) Title"
      const match = lines[i].match(/^(\d+)\s*[.\-)\]]\s*(.+)$/);
      if (match) {
        const num = parseInt(match[1]);
        const title = match[2].trim();
        // Next line should be the URL
        const nextLine = lines[i + 1];
        if (nextLine && /^https?:\/\//i.test(nextLine)) {
          result.push({ number: num, title, url: nextLine });
          i++; // skip URL line
        }
      }
    }
    return result;
  };

  const handleBulkImport = async () => {
    if (view.level !== "episodes") return;
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      toast({ title: "Nessun episodio trovato", description: "Formato: '1. Titolo' seguito dall'URL nella riga successiva", variant: "destructive" });
      return;
    }

    setBulkImporting(true);
    const seasonId = view.season.id;

    // Build all payloads at once — single batch upsert instead of N*2 queries
    const payloads = parsed.map(ep => {
      const isYoutube = /youtube\.com|youtu\.be/i.test(ep.url);
      return {
        season_id: seasonId,
        title: ep.title,
        episode_number: ep.number,
        video_url: ep.url,
        is_youtube: isYoutube,
        platform: isYoutube ? "youtube" : (bulkSource.trim() || ""),
        sort_order: ep.number,
      };
    });

    // Batch insert — use upsert-like approach: delete existing + insert all
    // First, get existing episode numbers for this season
    const { data: existing } = await supabase
      .from("media_episodes")
      .select("id, episode_number")
      .eq("season_id", seasonId)
      .in("episode_number", parsed.map(p => p.number));

    let updated = 0;
    let created = 0;
    let errors = 0;

    // Update existing in batch (group by chunks of 50)
    const existingMap = new Map((existing || []).map(e => [e.episode_number, e.id]));
    const toInsert = payloads.filter(p => !existingMap.has(p.episode_number));
    const toUpdate = payloads.filter(p => existingMap.has(p.episode_number));

    // Batch insert new episodes (single query)
    if (toInsert.length > 0) {
      const { error } = await supabase.from("media_episodes").insert(toInsert);
      if (error) errors += toInsert.length;
      else created = toInsert.length;
    }

    // Update existing ones (batch per chunk to avoid payload limits)
    for (const ep of toUpdate) {
      const id = existingMap.get(ep.episode_number);
      if (id) {
        const { error } = await supabase.from("media_episodes").update(ep).eq("id", id);
        if (error) errors++;
        else updated++;
      }
    }

    setBulkImporting(false);
    setBulkDialogOpen(false);
    setBulkText("");
    setBulkSource("");
    fetchEpisodes(seasonId);

    toast({
      title: "Importazione completata",
      description: `${created} creati, ${updated} aggiornati${errors ? `, ${errors} errori` : ""}`,
    });
  };

  // Breadcrumb
  const breadcrumb = () => {
    const crumbs: { label: string; onClick?: () => void }[] = [{ label: "Categorie", onClick: () => setView({ level: "categories" }) }];
    if (view.level === "series" || view.level === "seasons" || view.level === "episodes") {
      const cat = "category" in view ? view.category : undefined;
      if (cat) crumbs.push({ label: cat.name, onClick: () => setView({ level: "series", category: cat }) });
    }
    if (view.level === "seasons" || view.level === "episodes") {
      const ser = "series" in view ? view.series : undefined;
      const cat = "category" in view ? view.category : undefined;
      if (ser && cat) crumbs.push({ label: ser.title, onClick: () => setView({ level: "seasons", series: ser, category: cat }) });
    }
    if (view.level === "episodes") {
      crumbs.push({ label: view.season.title });
    }
    return crumbs;
  };

  const currentItems = view.level === "categories" ? categories :
    view.level === "series" ? seriesList :
    view.level === "seasons" ? seasons :
    episodes;

  const { getPageItems } = useAdminPagination(currentItems as any[]);
  const pagedItems = getPageItems(page);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Film size={20} /> Media
            </CardTitle>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground flex-wrap">
              {breadcrumb().map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} />}
                  {c.onClick ? (
                    <button onClick={c.onClick} className="hover:text-foreground transition-colors underline">{c.label}</button>
                  ) : (
                    <span className="text-foreground font-medium">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {view.level === "categories" && (
              <Button size="sm" onClick={() => openDialog("category")} className="gap-1"><Plus size={14} /> Categoria</Button>
            )}
            {view.level === "series" && (
              <Button size="sm" onClick={() => openDialog("series")} className="gap-1"><Plus size={14} /> Serie</Button>
            )}
            {view.level === "seasons" && (
              <Button size="sm" onClick={() => openDialog("season")} className="gap-1"><Plus size={14} /> Stagione</Button>
            )}
            {view.level === "episodes" && (
              <>
                {view.category.type === "anime" && (
                  <>
                    <Button size="sm" onClick={() => openDialog("episode")} className="gap-1"><Plus size={14} /> Episodio</Button>
                    <Button size="sm" variant="outline" onClick={() => setBulkDialogOpen(true)} className="gap-1"><FileUp size={14} /> Import di massa</Button>
                  </>
                )}
                {view.category.type === "manga" && (
                  <Button size="sm" onClick={() => openDialog("chapter")} className="gap-1"><Plus size={14} /> Capitolo</Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Caricamento...</p>
        ) : (
          <>
            {/* Categories */}
            {view.level === "categories" && (
              <div className="space-y-2">
                {pagedItems.length === 0 && <p className="text-muted-foreground text-center py-4">Nessuna categoria. Creane una!</p>}
                {(pagedItems as Category[]).map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                    <button onClick={() => setView({ level: "series", category: cat })} className="flex items-center gap-3 flex-1 text-left">
                      {cat.type === "anime" ? <Film size={18} className="text-primary" /> : <BookOpen size={18} className="text-primary" />}
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{cat.type}</p>
                      </div>
                    </button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog("category", cat)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete("media_categories", cat.id)}><Trash2 size={14} className="text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Series */}
            {view.level === "series" && (
              <div className="space-y-2">
                {pagedItems.length === 0 && <p className="text-muted-foreground text-center py-4">Nessuna serie. Aggiungine una!</p>}
                {(pagedItems as unknown as Series[]).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                    <button onClick={() => setView({ level: "seasons", series: s, category: view.category })} className="flex items-center gap-3 flex-1 text-left">
                      <ChevronRight size={16} className="text-muted-foreground" />
                      <p className="font-medium">{s.title}</p>
                    </button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog("series", s)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete("media_series", s.id)}><Trash2 size={14} className="text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Seasons */}
            {view.level === "seasons" && (
              <div className="space-y-2">
                {pagedItems.length === 0 && <p className="text-muted-foreground text-center py-4">Nessuna stagione. Aggiungine una!</p>}
                {(pagedItems as unknown as Season[]).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                    <button onClick={() => setView({ level: "episodes", season: s, series: view.series, category: view.category })} className="flex items-center gap-3 flex-1 text-left">
                      <ChevronRight size={16} className="text-muted-foreground" />
                      <p className="font-medium">{s.title}</p>
                    </button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog("season", s)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete("media_seasons", s.id)}><Trash2 size={14} className="text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Episodes / Chapters */}
            {view.level === "episodes" && (
              <div className="space-y-4">
                {view.category.type === "anime" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Episodi</h3>
                    {episodes.length === 0 && <p className="text-muted-foreground text-center py-4">Nessun episodio.</p>}
                    {episodes.map(ep => (
                      <div key={ep.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground w-8">#{ep.episode_number}</span>
                          <div>
                            <p className="font-medium text-sm">{ep.title}</p>
                            <p className="text-xs text-muted-foreground">{ep.is_youtube ? "YouTube" : ep.platform || "Link esterno"}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openDialog("episode", ep)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete("media_episodes", ep.id)}><Trash2 size={14} className="text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {view.category.type === "manga" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Capitoli</h3>
                    {chapters.length === 0 && <p className="text-muted-foreground text-center py-4">Nessun capitolo.</p>}
                    {chapters.map(ch => (
                      <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground w-8">#{ch.chapter_number}</span>
                          <div>
                            <p className="font-medium text-sm">{ch.title}</p>
                            {ch.pdf_url && <p className="text-xs text-primary">PDF caricato</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openDialog("chapter", ch)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete("media_chapters", ch.id)}><Trash2 size={14} className="text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <AdminPagination page={page} totalItems={currentItems.length} onPageChange={setPage} />
          </>
        )}

        {/* Dialog for create/edit */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editItem ? "Modifica" : "Crea"} {
                  dialogMode === "category" ? "Categoria" :
                  dialogMode === "series" ? "Serie" :
                  dialogMode === "season" ? "Stagione" :
                  dialogMode === "episode" ? "Episodio" : "Capitolo"
                }
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Category fields */}
              {dialogMode === "category" && (
                <>
                  <div>
                    <Label>Nome</Label>
                    <Input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="es. Anime Beyblade" />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.type || "anime"} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anime">Anime</SelectItem>
                        <SelectItem value="manga">Manga</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Copertina</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleCoverUpload(file); }} disabled={uploading} />
                      {uploading && <span className="text-xs text-muted-foreground">Caricamento...</span>}
                    </div>
                    {form.cover_url && <img src={form.cover_url} alt="Cover" className="mt-2 h-20 w-auto rounded-md object-cover border border-border" />}
                  </div>
                  <div>
                    <Label>Ordine</Label>
                    <Input type="number" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </>
              )}

              {/* Series fields */}
              {dialogMode === "series" && (
                <>
                  <div>
                    <Label>Titolo</Label>
                    <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="es. Beyblade X" />
                  </div>
                  <div>
                    <Label>Descrizione / Trama</Label>
                    <Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve sinossi della serie..." rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Genere</Label>
                      <Input value={form.genre || ""} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="es. Azione, Sport" />
                    </div>
                    <div>
                      <Label>Anno</Label>
                      <Input type="number" value={form.year ?? ""} onChange={e => setForm(f => ({ ...f, year: e.target.value ? parseInt(e.target.value) : null }))} placeholder="2024" />
                    </div>
                  </div>
                  <div>
                    <Label>Numero episodi/capitoli totali</Label>
                    <Input type="number" value={form.episodes_count ?? ""} onChange={e => setForm(f => ({ ...f, episodes_count: e.target.value ? parseInt(e.target.value) : null }))} placeholder="es. 52" />
                  </div>
                  <div>
                    <Label>Copertina</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleCoverUpload(file); }} disabled={uploading} />
                      {uploading && <span className="text-xs text-muted-foreground">Caricamento...</span>}
                    </div>
                    {form.cover_url && <img src={form.cover_url} alt="Cover" className="mt-2 h-20 w-auto rounded-md object-cover border border-border" />}
                  </div>
                  <div>
                    <Label>Ordine</Label>
                    <Input type="number" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </>
              )}

              {/* Season fields */}
              {dialogMode === "season" && (
                <>
                  <div>
                    <Label>Titolo</Label>
                    <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="es. Stagione 1" />
                  </div>
                  <div>
                    <Label>Descrizione</Label>
                    <Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrizione della stagione/volume..." rows={2} />
                  </div>
                  <div>
                    <Label>Copertina</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleCoverUpload(file); }} disabled={uploading} />
                      {uploading && <span className="text-xs text-muted-foreground">Caricamento...</span>}
                    </div>
                    {form.cover_url && <img src={form.cover_url} alt="Cover" className="mt-2 h-20 w-auto rounded-md object-cover border border-border" />}
                  </div>
                  <div>
                    <Label>Ordine</Label>
                    <Input type="number" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </>
              )}

              {/* Episode fields */}
              {dialogMode === "episode" && (
                <>
                  <div>
                    <Label>Titolo</Label>
                    <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Episodio 1 - ..." />
                  </div>
                  <div>
                    <Label>Numero episodio</Label>
                    <Input type="number" value={form.episode_number ?? 1} onChange={e => setForm(f => ({ ...f, episode_number: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label>URL Video</Label>
                    <Input value={form.video_url || ""} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://youtube.com/watch?v=... oppure URL diretto .mp4" />
                    <p className="text-[10px] text-muted-foreground mt-1">YouTube, o URL diretto (.mp4, .webm) per lettore embed integrato</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.is_youtube ?? false} onCheckedChange={v => setForm(f => ({ ...f, is_youtube: v, platform: v ? "youtube" : f.platform }))} />
                    <Label>Video YouTube (embed diretto)</Label>
                  </div>
                  {!form.is_youtube && (
                    <div>
                      <Label>Piattaforma</Label>
                      <Input value={form.platform || ""} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} placeholder="es. Crunchyroll, Amazon Prime" />
                    </div>
                  )}
                  {/* Streaming links */}
                  <div className="space-y-2">
                    <Label>Link Streaming Ufficiali</Label>
                    {(form.streaming_links || []).map((link: StreamingLink, idx: number) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Select
                          value={link.platform}
                          onValueChange={v => {
                            const links = [...(form.streaming_links || [])];
                            links[idx] = { ...links[idx], platform: v };
                            setForm(f => ({ ...f, streaming_links: links }));
                          }}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Piattaforma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="netflix">Netflix</SelectItem>
                            <SelectItem value="primevideo">Prime Video</SelectItem>
                            <SelectItem value="crunchyroll">Crunchyroll</SelectItem>
                            <SelectItem value="disneyplus">Disney+</SelectItem>
                            <SelectItem value="other">Altro</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={link.url}
                          onChange={e => {
                            const links = [...(form.streaming_links || [])];
                            links[idx] = { ...links[idx], url: e.target.value };
                            setForm(f => ({ ...f, streaming_links: links }));
                          }}
                          placeholder="https://www.netflix.com/watch/..."
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const links = (form.streaming_links || []).filter((_: any, i: number) => i !== idx);
                            setForm(f => ({ ...f, streaming_links: links }));
                          }}
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm(f => ({ ...f, streaming_links: [...(f.streaming_links || []), { platform: "netflix", url: "" }] }))}
                      className="gap-1"
                    >
                      <Plus size={14} /> Aggiungi link streaming
                    </Button>
                  </div>
                  <div>
                    <Label>Ordine</Label>
                    <Input type="number" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </>
              )}

              {/* Chapter fields */}
              {dialogMode === "chapter" && (
                <>
                  <div>
                    <Label>Titolo</Label>
                    <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Capitolo 1 - ..." />
                  </div>
                  <div>
                    <Label>Numero capitolo</Label>
                    <Input type="number" value={form.chapter_number ?? 1} onChange={e => setForm(f => ({ ...f, chapter_number: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label>PDF</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handlePdfUpload(file);
                        }}
                        disabled={uploading}
                      />
                      {uploading && <span className="text-xs text-muted-foreground">Caricamento...</span>}
                    </div>
                    {form.pdf_url && <p className="text-xs text-primary mt-1 truncate">{form.pdf_url}</p>}
                  </div>
                  <div>
                    <Label>Ordine</Label>
                    <Input type="number" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSave} disabled={uploading}>{editItem ? "Salva" : "Crea"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk import dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileUp size={18} /> Import di massa episodi
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Incolla la lista nel formato:<br />
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">1. Titolo episodio</code><br />
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://url-del-video.mp4</code><br />
                <span className="text-xs mt-1 block">Gli episodi con lo stesso numero verranno sovrascritti.</span>
              </p>
              <div>
                <Label className="text-xs">Fonte (es. Animeworld, AnimeSaturn...)</Label>
                <Input
                  value={bulkSource}
                  onChange={e => setBulkSource(e.target.value)}
                  placeholder="Animeworld"
                  className="mt-1"
                />
              </div>
              <Textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"1. La sfida\nhttps://esempio.com/ep01.mp4\n\n2. Il drago azzurro\nhttps://esempio.com/ep02.mp4"}
                rows={12}
                className="font-mono text-xs"
              />
              {bulkText && (
                <p className="text-xs text-muted-foreground">
                  Episodi rilevati: <span className="font-semibold text-foreground">{parseBulkText(bulkText).length}</span>
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleBulkImport} disabled={bulkImporting || parseBulkText(bulkText).length === 0}>
                {bulkImporting ? "Importazione..." : `Importa ${parseBulkText(bulkText).length} episodi`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default MediaAdminTab;
