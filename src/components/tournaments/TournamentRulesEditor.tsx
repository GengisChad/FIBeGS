import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tournamentId: string;
  initialCustomRules: string | null;
  initialBanlist: string | null;
  initialSwissWinPoints: number | null;
  initialTopWinPoints: number | null;
  onSaved?: () => void;
}

export default function TournamentRulesEditor({
  tournamentId,
  initialCustomRules,
  initialBanlist,
  initialSwissWinPoints,
  initialTopWinPoints,
  onSaved,
}: Props) {
  const [customRules, setCustomRules] = useState(initialCustomRules || "");
  const [banlist, setBanlist] = useState(initialBanlist || "all");
  const [swissPts, setSwissPts] = useState(initialSwissWinPoints != null ? String(initialSwissWinPoints) : "");
  const [topPts, setTopPts] = useState(initialTopWinPoints != null ? String(initialTopWinPoints) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("tournaments").update({
      custom_rules: customRules.trim() || null,
      banlist,
      custom_swiss_win_points: swissPts ? parseInt(swissPts) : null,
      custom_top_win_points: topPts ? parseInt(topPts) : null,
    }).eq("id", tournamentId);
    setSaving(false);
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success("Regole aggiornate");
    onSaved?.();
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText size={18} className="text-primary" />
        <div>
          <h3 className="font-semibold">Regole personalizzate</h3>
          <p className="text-xs text-muted-foreground">Modifica banlist, punteggi e regole custom anche dopo la creazione.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Banlist</label>
          <Select value={banlist} onValueChange={setBanlist}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL</SelectItem>
              <SelectItem value="hasbro">Hasbro Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Punti vittoria Swiss</label>
          <Input type="number" value={swissPts} onChange={(e) => setSwissPts(e.target.value)} placeholder="Default (4)" min={0} max={20} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Punti vittoria Top</label>
          <Input type="number" value={topPts} onChange={(e) => setTopPts(e.target.value)} placeholder="Default (4)" min={0} max={20} />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Regole custom (opzionale)</label>
        <Textarea value={customRules} onChange={(e) => setCustomRules(e.target.value)} rows={4} maxLength={1000}
          placeholder="Es. Vietati i Bey della serie X, formato 1on1, ecc." />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save size={14} /> {saving ? "Salvataggio…" : "Salva regole"}
        </Button>
      </div>
    </Card>
  );
}
