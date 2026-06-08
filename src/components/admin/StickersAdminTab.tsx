import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Loader2, Smile } from "lucide-react";
import AdminPagination, { useAdminPagination, ADMIN_PAGE_SIZE } from "@/components/admin/AdminPagination";

interface Sticker {
  id: string;
  name: string;
  url: string;
  sort_order: number;
}

const StickersAdminTab = () => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [page, setPage] = useState(0);

  const fetchStickers = async () => {
    const { data } = await supabase
      .from("forum_stickers" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    setStickers((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchStickers(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Il file deve essere un'immagine", variant: "destructive" });
      return;
    }

    const name = newName.trim() || file.name.replace(/\.[^/.]+$/, "");
    setUploading(true);

    try { file = await prepareImageForUpload(file, { maxDimension: 512, preservePng: true }); }
    catch (err: any) { toast({ title: err?.message || "Immagine non valida", variant: "destructive" }); setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("stickers").upload(filePath, file, { contentType: file.type });
    if (uploadError) {
      toast({ title: "Errore nel caricamento", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("stickers").getPublicUrl(filePath);

    const { error: insertError } = await supabase
      .from("forum_stickers" as any)
      .insert({ name, url: urlData.publicUrl, sort_order: stickers.length } as any);

    if (insertError) {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } else {
      toast({ title: "Sticker aggiunto!" });
      setNewName("");
      fetchStickers();
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (sticker: Sticker) => {
    if (!confirm(`Eliminare lo sticker "${sticker.name}"?`)) return;

    // Extract file path from URL
    const urlParts = sticker.url.split("/stickers/");
    if (urlParts[1]) {
      await supabase.storage.from("stickers").remove([urlParts[1]]);
    }

    await supabase.from("forum_stickers" as any).delete().eq("id", sticker.id);
    toast({ title: "Sticker eliminato" });
    fetchStickers();
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Smile size={20} /> Gestione Stickers ({stickers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload form */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1">
            <Label className="text-sm mb-1.5 block">Nome sticker</Label>
            <Input
              placeholder="Nome (opzionale)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="flex items-end">
            <label className="cursor-pointer">
              <Button type="button" disabled={uploading} className="gap-2" asChild>
                <span>
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {uploading ? "Caricamento..." : "Carica Sticker"}
                </span>
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Stickers grid */}
        {stickers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nessuno sticker caricato</p>
        ) : (
          <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {stickers.slice(page * 24, (page + 1) * 24).map((sticker) => (
              <div key={sticker.id} className="relative group border border-border rounded-xl p-3 bg-secondary/20 flex flex-col items-center gap-2">
                <img src={sticker.url} alt={sticker.name} className="h-16 w-16 object-contain" />
                <span className="text-xs text-muted-foreground truncate w-full text-center">{sticker.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(sticker)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
          <AdminPagination page={page} totalItems={stickers.length} pageSize={24} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StickersAdminTab;
