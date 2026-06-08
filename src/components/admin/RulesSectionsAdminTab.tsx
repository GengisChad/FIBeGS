import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;

const SECTION_LABELS: Record<string, { title: string; description: string }> = {
  gameplay_rules: { title: "Regole di Gioco", description: "Regolamento principale dei tornei" },
  ranked_3d_models: { title: "Modelli 3D Ranked", description: "Galleria stadi/strumenti omologati" },
  judge_courses: { title: "Corsi Judges", description: "Corsi di formazione obbligatori" },
  referee_test_card: { title: "Banner Test Arbitri", description: "Card di accesso al test arbitri/head judge" },
  community_guidelines: { title: "Linee Guida Community", description: "Comportamento e netiquette" },
};

interface Row { section_key: string; is_visible: boolean; position: number; }

export default function RulesSectionsAdminTab() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data } = await sb.from("rules_section_visibility").select("*").order("position");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (key: string, v: boolean) => {
    setRows(prev => prev.map(r => r.section_key === key ? { ...r, is_visible: v } : r));
    const { error } = await sb.from("rules_section_visibility").update({ is_visible: v, updated_at: new Date().toISOString() }).eq("section_key", key);
    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
  };

  const move = async (key: string, dir: -1 | 1) => {
    const idx = rows.findIndex(r => r.section_key === key);
    const swap = rows[idx + dir];
    if (!swap) return;
    const cur = rows[idx];
    const newRows = [...rows];
    newRows[idx] = { ...cur, position: swap.position };
    newRows[idx + dir] = { ...swap, position: cur.position };
    newRows.sort((a, b) => a.position - b.position);
    setRows(newRows);
    await Promise.all([
      sb.from("rules_section_visibility").update({ position: swap.position }).eq("section_key", cur.section_key),
      sb.from("rules_section_visibility").update({ position: cur.position }).eq("section_key", swap.section_key),
    ]);
  };

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-lg">Visibilità sezioni · Pagina Regole</h3>
        <p className="text-sm text-muted-foreground">Mostra, nascondi e riordina le sezioni della pagina <code>/regole</code>.</p>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const meta = SECTION_LABELS[r.section_key] || { title: r.section_key, description: "" };
          return (
            <div key={r.section_key} className={`flex items-center gap-3 p-3 rounded-lg border ${r.is_visible ? "border-border bg-card" : "border-dashed border-muted bg-muted/30 opacity-70"}`}>
              <div className="flex flex-col gap-0.5">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(r.section_key, -1)} disabled={i === 0}><ArrowUp size={12} /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(r.section_key, 1)} disabled={i === rows.length - 1}><ArrowDown size={12} /></Button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium flex items-center gap-2">
                  {r.is_visible ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-muted-foreground" />}
                  {meta.title}
                </p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <Switch checked={r.is_visible} onCheckedChange={(v) => toggle(r.section_key, v)} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
