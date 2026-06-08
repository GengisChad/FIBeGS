import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Pencil, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;
const KEY = "academy_rulebook_url";
const LABEL_KEY = "academy_rulebook_label";

export function RulebookDownloadButton() {
  const { isAdmin } = useAdmin();
  const [url, setUrl] = useState<string>("");
  const [label, setLabel] = useState<string>("SCARICA REGOLAMENTO");
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftLabel, setDraftLabel] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("site_settings").select("key,value").in("key", [KEY, LABEL_KEY]);
      const u = (data || []).find((r: any) => r.key === KEY)?.value || "";
      const l = (data || []).find((r: any) => r.key === LABEL_KEY)?.value || "SCARICA REGOLAMENTO";
      setUrl(u); setLabel(l); setDraftUrl(u); setDraftLabel(l);
    })();
  }, []);

  const save = async () => {
    const { error } = await sb.from("site_settings").upsert(
      [{ key: KEY, value: draftUrl }, { key: LABEL_KEY, value: draftLabel }],
      { onConflict: "key" }
    );
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    setUrl(draftUrl); setLabel(draftLabel); setEditing(false);
    toast({ title: "Aggiornato" });
  };

  if (editing && isAdmin) {
    return (
      <div className="flex flex-col gap-2 w-full sm:w-72 rounded-md border border-border bg-card p-3">
        <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="Etichetta tasto" />
        <Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://..." />
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" onClick={save}><Check size={14} /></Button>
          <Button size="icon" variant="ghost" onClick={() => { setDraftUrl(url); setDraftLabel(label); setEditing(false); }}><X size={14} /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full flex items-center">
      <button
        type="button"
        disabled={!url}
        onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
        className="group w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs uppercase tracking-[0.2em] font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={url ? label : "URL non configurato"}
      >
        <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
        <span className="truncate">{label}</span>
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 text-primary"
          title="Modifica link/etichetta"
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}
