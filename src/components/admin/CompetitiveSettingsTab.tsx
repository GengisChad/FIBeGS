import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trophy, RefreshCw, Save, Calendar, Swords, Settings, Award, FlaskConical } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface CompetitiveSettings {
  points_per_win: number;
  participation_bonus: number;
  ranked_limit: number;
  ranked_limit_period: "monthly" | "weekly";
  min_players_ranked: number;
}

const DEFAULT_SETTINGS: CompetitiveSettings = {
  points_per_win: 4,
  participation_bonus: 2,
  ranked_limit: 3,
  ranked_limit_period: "monthly",
  min_players_ranked: 16,
};

const CompetitiveSettingsTab = () => {
  const [settings, setSettings] = useState<CompetitiveSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<any>(null);

  // Season form
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [seasonBfl, setSeasonBfl] = useState("10");

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "competitive_points_per_win",
        "competitive_participation_bonus",
        "competitive_ranked_limit",
        "competitive_ranked_limit_period",
        "competitive_min_players_ranked",
      ]);

    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { map[r.key] = r.value; });

    setSettings({
      points_per_win: parseInt(map["competitive_points_per_win"]) || DEFAULT_SETTINGS.points_per_win,
      participation_bonus: parseInt(map["competitive_participation_bonus"]) || DEFAULT_SETTINGS.participation_bonus,
      ranked_limit: parseInt(map["competitive_ranked_limit"]) || DEFAULT_SETTINGS.ranked_limit,
      ranked_limit_period: (map["competitive_ranked_limit_period"] as "monthly" | "weekly") || DEFAULT_SETTINGS.ranked_limit_period,
      min_players_ranked: parseInt(map["competitive_min_players_ranked"]) || DEFAULT_SETTINGS.min_players_ranked,
    });
  };

  const fetchSeasons = async () => {
    const { data } = await supabase
      .from("ranking_seasons")
      .select("*")
      .order("created_at", { ascending: false });
    setSeasons(data ?? []);
    setActiveSeason((data ?? []).find((s: any) => s.is_active) || null);
  };

  useEffect(() => {
    Promise.all([fetchSettings(), fetchSeasons()]).then(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const entries = [
      { key: "competitive_points_per_win", value: String(settings.points_per_win) },
      { key: "competitive_participation_bonus", value: String(settings.participation_bonus) },
      { key: "competitive_ranked_limit", value: String(settings.ranked_limit) },
      { key: "competitive_ranked_limit_period", value: settings.ranked_limit_period },
      { key: "competitive_min_players_ranked", value: String(settings.min_players_ranked) },
    ];

    for (const entry of entries) {
      await (supabase as any).from("site_settings").upsert(
        { key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }

    toast({ title: "Impostazioni competitive salvate!" });
    setSaving(false);
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    const bfl = activeSeason?.bfl ?? 10;
    const monthlyEnabled = !!activeSeason?.monthly_bfl_enabled;
    const monthlyBfl = activeSeason?.monthly_bfl ?? 2;
    const { error } = await supabase.rpc("recalculate_all_rankings", {
      _bfl: bfl,
      _monthly_bfl_enabled: monthlyEnabled,
      _monthly_bfl: monthlyBfl,
    } as any);
    if (error) {
      toast({ title: "Errore nel ricalcolo", variant: "destructive" });
    } else {
      toast({ title: "Classifica ricalcolata!" });
    }
    setRecalculating(false);
  };

  const handleCreateSeason = async () => {
    if (!seasonName || !seasonStart || !seasonEnd) {
      toast({ title: "Compila tutti i campi", variant: "destructive" });
      return;
    }
    await supabase.from("ranking_seasons").update({ is_active: false } as any).eq("is_active", true);
    const { error } = await supabase.from("ranking_seasons").insert({
      name: seasonName,
      start_date: seasonStart,
      end_date: seasonEnd,
      is_active: true,
      bfl: parseInt(seasonBfl) || 10,
    } as any);

    if (error) {
      toast({ title: "Errore nella creazione", variant: "destructive" });
    } else {
      toast({ title: "Stagione creata!" });
      setSeasonName("");
      setSeasonStart("");
      setSeasonEnd("");
      setSeasonBfl("10");
      fetchSeasons();
    }
  };

  const handleUpdateBfl = async (newBfl: number) => {
    if (!activeSeason || isNaN(newBfl) || newBfl < 1) return;
    const { error } = await supabase.from("ranking_seasons").update({ bfl: newBfl } as any).eq("id", activeSeason.id);
    if (!error) {
      toast({ title: `BFL aggiornato a ${newBfl}` });
      fetchSeasons();
    }
  };

  const handleUpdateMonthlyBfl = async (newVal: number) => {
    if (!activeSeason || isNaN(newVal) || newVal < 1) return;
    const { error } = await supabase.from("ranking_seasons").update({ monthly_bfl: newVal } as any).eq("id", activeSeason.id);
    if (!error) {
      toast({ title: `BFL mensile aggiornato a ${newVal}` });
      fetchSeasons();
    }
  };

  const handleToggleMonthlyBfl = async (enabled: boolean) => {
    if (!activeSeason) return;
    const { error } = await supabase.from("ranking_seasons").update({ monthly_bfl_enabled: enabled } as any).eq("id", activeSeason.id);
    if (!error) {
      toast({ title: enabled ? "BFL mensile attivato (BETA)" : "BFL mensile disattivato" });
      fetchSeasons();
    }
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <div className="space-y-6">
      {/* Points System */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy size={18} className="text-primary" /> Sistema Punti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Punti per vittoria</Label>
              <Input
                type="number"
                min={0}
                value={settings.points_per_win}
                onChange={(e) => setSettings(s => ({ ...s, points_per_win: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Bonus partecipazione</Label>
              <Input
                type="number"
                min={0}
                value={settings.participation_bonus}
                onChange={(e) => setSettings(s => ({ ...s, participation_bonus: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Min. giocatori Ranked</Label>
              <Input
                type="number"
                min={2}
                value={settings.min_players_ranked}
                onChange={(e) => setSettings(s => ({ ...s, min_players_ranked: parseInt(e.target.value) || 8 }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Formula: {settings.participation_bonus} (partecipazione) + {settings.points_per_win} × vittorie (Swiss + Top Cut, esclusi tiebreaker)
          </p>
        </CardContent>
      </Card>

      {/* Ranked Limits */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Swords size={18} className="text-primary" /> Limiti Ranked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Limite tornei ranked per club</Label>
              <Input
                type="number"
                min={1}
                value={settings.ranked_limit}
                onChange={(e) => setSettings(s => ({ ...s, ranked_limit: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label>Periodo limite</Label>
              <Select
                value={settings.ranked_limit_period}
                onValueChange={(v) => setSettings(s => ({ ...s, ranked_limit_period: v as "monthly" | "weekly" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensile</SelectItem>
                  <SelectItem value="weekly">Settimanale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ogni club può organizzare max {settings.ranked_limit} torneo/i ranked {settings.ranked_limit_period === "monthly" ? "al mese" : "a settimana"}.
          </p>
        </CardContent>
      </Card>

      {/* Save & Recalculate */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save size={14} /> {saving ? "Salvataggio..." : "Salva impostazioni"}
        </Button>
        <Button variant="outline" onClick={handleRecalculate} disabled={recalculating} className="gap-2">
          <RefreshCw size={14} className={recalculating ? "animate-spin" : ""} />
          {recalculating ? "Ricalcolo..." : "Ricalcola tutte le classifiche"}
        </Button>
      </div>

      <Separator />

      {/* Season Management */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar size={18} className="text-primary" /> Stagioni
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSeason ? (
            <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{activeSeason.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeSeason.start_date} → {activeSeason.end_date}
                  </p>
                </div>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Attiva</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-xs">BFL (Best Finish Limit)</Label>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={activeSeason.bfl}
                  onChange={(e) => handleUpdateBfl(parseInt(e.target.value) || 10)}
                />
                <span className="text-[10px] text-muted-foreground">Migliori N tornei della stagione</span>
              </div>

              <Separator className="my-2" />

              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={14} className="text-amber-500" />
                    <p className="text-sm font-semibold">BFL Mensile</p>
                    <span className="text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">Beta</span>
                  </div>
                  <Switch
                    checked={!!activeSeason.monthly_bfl_enabled}
                    onCheckedChange={handleToggleMonthlyBfl}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Pre-filtra i tornei mese per mese: per ogni giocatore vengono considerati solo i suoi top N tornei di ogni mese, e su questi viene poi applicato il BFL stagionale.
                </p>
                {activeSeason.monthly_bfl_enabled && (
                  <div className="flex items-center gap-3 pt-1">
                    <Label className="text-xs">Top N tornei al mese</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={activeSeason.monthly_bfl ?? 2}
                      onChange={(e) => handleUpdateMonthlyBfl(parseInt(e.target.value) || 2)}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna stagione attiva.</p>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Crea nuova stagione</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="SEASON 2026" />
              </div>
              <div>
                <Label>BFL</Label>
                <Input type="number" value={seasonBfl} onChange={(e) => setSeasonBfl(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inizio</Label>
                <Input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
              </div>
              <div>
                <Label>Fine</Label>
                <Input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleCreateSeason} className="gap-2">
              <Calendar size={14} /> Crea Stagione
            </Button>
          </div>

          {/* Past seasons */}
          {seasons.filter(s => !s.is_active).length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium">Stagioni passate</p>
              <div className="space-y-2">
                {seasons.filter(s => !s.is_active).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-secondary/20 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.start_date} → {s.end_date}</p>
                    </div>
                    {s.closed_at && <span className="text-[10px] text-muted-foreground">Chiusa</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompetitiveSettingsTab;
