import { useEffect, useState } from "react";
import { Heart, Users, Shield, MessageCircle, Ban, Award, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { AdminEditableText } from "@/components/admin/AdminEditableText";

const sb = supabase as any;

const iconMap: Record<string, React.ElementType> = {
  Heart, Users, Shield, MessageCircle, Ban, Award,
};
const iconKeys = Object.keys(iconMap);

interface Guideline { icon: string; title: string; description: string; }

const defaultGuidelines: Guideline[] = [
  { icon: "Heart", title: "Rispetto Reciproco", description: "Tratta tutti i membri con rispetto e cortesia. Nessuna forma di discriminazione è tollerata." },
  { icon: "Users", title: "Spirito di Comunità", description: "Aiuta i nuovi blader, condividi consigli e celebra i successi di tutti." },
  { icon: "Shield", title: "Fair Play", description: "Gioca sempre in modo onesto. Le regole esistono per garantire divertimento a tutti." },
  { icon: "MessageCircle", title: "Comunicazione Positiva", description: "Mantieni le discussioni costruttive. Critiche sempre rispettose e costruttive." },
  { icon: "Ban", title: "Zero Tolleranza", description: "Comportamenti tossici, cheat e modifiche illegali comportano ban immediato." },
  { icon: "Award", title: "Integrità Competitiva", description: "Rispetta gli arbitri, accetta le sconfitte con dignità e vinci con umiltà." },
];

export const CommunityGuidelines = () => {
  const { isAdmin } = useAdmin();
  const [items, setItems] = useState<Guideline[]>(defaultGuidelines);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Guideline[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("site_settings").select("value").eq("key", "community_guidelines_items").maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
        } catch { /* ignore */ }
      }
    })();
  }, []);

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(items))); setEditing(true); };
  const save = async () => {
    setSaving(true);
    const { error } = await sb.from("site_settings").upsert(
      { key: "community_guidelines_items", value: JSON.stringify(draft), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) { toast({ title: "Errore", variant: "destructive" }); return; }
    setItems(draft); setEditing(false); toast({ title: "Linee guida aggiornate" });
  };

  const update = (i: number, patch: Partial<Guideline>) => setDraft(prev => prev.map((g, idx) => idx === i ? { ...g, ...patch } : g));
  const remove = (i: number) => setDraft(prev => prev.filter((_, idx) => idx !== i));
  const add = () => setDraft(prev => [...prev, { icon: "Heart", title: "Nuova linea guida", description: "" }]);

  return (
    <section id="community-guidelines" className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <AdminEditableText
            settingKey="community_eyebrow"
            defaultValue="Community"
            as="span"
            className="text-primary font-medium uppercase tracking-wider text-sm"
          />
          <h2 className="section-title mt-2">
            LINEE <span className="gradient-text">GUIDA</span>
          </h2>
          <AdminEditableText
            settingKey="community_subtitle"
            defaultValue="Le regole della nostra community per un ambiente sano e divertente per tutti i blader."
            multiline
            as="p"
            className="text-muted-foreground mt-4 max-w-xl mx-auto"
          />
          {isAdmin && !editing && (
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={startEdit}>
              <Pencil size={14} /> Modifica linee guida
            </Button>
          )}
          {isAdmin && editing && (
            <div className="flex justify-center gap-2 mt-4">
              <Button size="sm" onClick={save} disabled={saving} className="gap-2"><Check size={14} /> {saving ? "Salvataggio…" : "Salva"}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="gap-2"><X size={14} /> Annulla</Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-4 max-w-3xl mx-auto">
            {draft.map((g, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <select className="bg-secondary border border-border rounded px-2 py-1 text-sm" value={g.icon} onChange={(e) => update(i, { icon: e.target.value })}>
                    {iconKeys.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <Input value={g.title} onChange={(e) => update(i, { title: e.target.value })} className="font-semibold flex-1" />
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(i)}><Trash2 size={14} /></Button>
                </div>
                <Textarea value={g.description} onChange={(e) => update(i, { description: e.target.value })} rows={2} />
              </div>
            ))}
            <div className="text-center">
              <Button variant="outline" onClick={add} className="gap-2"><Plus size={16} /> Aggiungi linea guida</Button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {items.map((item, index) => {
              const Icon = iconMap[item.icon] || Heart;
              return (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-base mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
