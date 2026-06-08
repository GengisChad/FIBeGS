import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ALLOWED = ["image/png", "image/svg+xml", "image/webp", "image/jpeg"];

type Props = {
  iconKey: string;
  currentUrl: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const IconUploadDialog = ({ iconKey, currentUrl, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setBusy(false);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Formato non valido", description: "Usa PNG, SVG, WebP o JPG.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File troppo grande", description: "Massimo 2MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const safeKey = iconKey.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = `${safeKey}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("custom-icons")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("custom-icons").getPublicUrl(path);
      const url = pub.publicUrl;

      const { error: dbErr } = await (supabase as any)
        .from("custom_icons")
        .upsert(
          { icon_key: iconKey, image_url: url, updated_by: user.id },
          { onConflict: "icon_key" }
        );
      if (dbErr) throw dbErr;

      toast({ title: "Icona aggiornata", description: iconKey });
      await qc.invalidateQueries({ queryKey: ["custom-icons-map"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Errore upload", description: e?.message || "Riprova", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("custom_icons").delete().eq("icon_key", iconKey);
      if (error) throw error;
      toast({ title: "Icona ripristinata", description: iconKey });
      await qc.invalidateQueries({ queryKey: ["custom-icons-map"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizza icona</DialogTitle>
          <DialogDescription className="font-mono text-xs">{iconKey}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {currentUrl && (
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <img src={currentUrl} alt="" className="h-10 w-10 object-contain" />
              <div className="text-xs text-muted-foreground flex-1 break-all">Icona attuale</div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="icon-file">Nuova icona (PNG, SVG, WebP, JPG · max 2MB)</Label>
            <Input
              id="icon-file"
              type="file"
              accept={ALLOWED.join(",")}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={busy}
            />
          </div>

          {file && (
            <div className="flex items-center gap-3 rounded-md border border-primary/40 p-3">
              <img src={URL.createObjectURL(file)} alt="" className="h-10 w-10 object-contain" />
              <div className="text-xs flex-1 truncate">{file.name}</div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            La modifica è visibile solo sulle versioni di anteprima. Il sito Live ({" "}
            <code>ibna.it</code>) continua a usare l'icona originale.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {currentUrl && (
            <Button variant="outline" onClick={handleReset} disabled={busy} className="gap-2">
              <Trash2 size={14} /> Ripristina
            </Button>
          )}
          <Button onClick={handleUpload} disabled={!file || busy} className="gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Carica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IconUploadDialog;
