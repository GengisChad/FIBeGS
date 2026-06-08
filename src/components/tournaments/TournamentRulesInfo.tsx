import { useState, useEffect } from "react";
import { Info, Trophy, Target, MapPin, Shield, Pencil, Save, Award, Swords } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";

interface SwissLimit { range: string; max: number }
interface TopCutLimit { top: string; min: number }
interface ScoreLabel { label: string; suffix: string }
interface ClassificaType { label: string; desc: string }

interface AllSettings {
  points_per_win: number;
  participation_bonus: number;
  ranked_limit: number;
  ranked_limit_period: string;
  min_players_ranked: number;
  bfl: number;
  swiss_limits: SwissLimit[];
  topcut_limits: TopCutLimit[];
  tiebreaker_tournament: string[];
  tiebreaker_general: string[];
  score_labels: ScoreLabel[];
  score_note: string;
  swiss_note: string;
  classifiche_header: string;
  classifiche_types: ClassificaType[];
  regole_extra: { label: string; value: string }[];
}

const DEFAULT_SWISS: SwissLimit[] = [
  { range: "≤ 8", max: 3 },
  { range: "9–16", max: 4 },
  { range: "17–32", max: 5 },
  { range: "33–64", max: 6 },
  { range: "65–128", max: 7 },
  { range: "129+", max: 8 },
];

const DEFAULT_TOPCUT: TopCutLimit[] = [
  { top: "Top 4", min: 6 },
  { top: "Top 8", min: 16 },
  { top: "Top 16", min: 32 },
  { top: "Top 32", min: 64 },
];

const DEFAULT_TB_TOURNAMENT = [
  "Vittoria torneo (vincitore sempre 1°)",
  "Punti totali (Swiss + Top Cut)",
  "Match vinti",
  "Game Win Difference",
];

const DEFAULT_TB_GENERAL = [
  "N° tornei vinti",
  "Punti totali",
  "Match vinti",
];

const DEFAULT_SCORE_LABELS: ScoreLabel[] = [
  { label: "Vittoria match", suffix: "pt" },
  { label: "Partecipazione", suffix: "pt" },
  { label: "BYE", suffix: "pt" },
  { label: "Spareggi / Sconfitta", suffix: "pt" },
];

const DEFAULT_SCORE_NOTE = "Non esistono pareggi: ogni match si vince raggiungendo il punteggio.";
const DEFAULT_SWISS_NOTE = "Normal: nessun limite turni Swiss.";
const DEFAULT_CLASSIFICHE_HEADER = "Solo tornei RANKED";

const DEFAULT_CLASSIFICHE_TYPES: ClassificaType[] = [
  { label: "Nazionale", desc: "Tutti" },
  { label: "Regionale", desc: "Per regione" },
  { label: "Città", desc: "Per città" },
  { label: "Club", desc: "Tornei club" },
];

const DEFAULT_REGOLE_EXTRA: { label: string; value: string }[] = [
  { label: "Bot (giocatori fittizi)", value: "Vietati" },
  { label: "Modalità", value: "Solo" },
];

const DEFAULTS: AllSettings = {
  points_per_win: 4,
  participation_bonus: 2,
  ranked_limit: 3,
  ranked_limit_period: "monthly",
  min_players_ranked: 8,
  bfl: 5,
  swiss_limits: DEFAULT_SWISS,
  topcut_limits: DEFAULT_TOPCUT,
  tiebreaker_tournament: DEFAULT_TB_TOURNAMENT,
  tiebreaker_general: DEFAULT_TB_GENERAL,
  score_labels: DEFAULT_SCORE_LABELS,
  score_note: DEFAULT_SCORE_NOTE,
  swiss_note: DEFAULT_SWISS_NOTE,
  classifiche_header: DEFAULT_CLASSIFICHE_HEADER,
  classifiche_types: DEFAULT_CLASSIFICHE_TYPES,
  regole_extra: DEFAULT_REGOLE_EXTRA,
};

const SITE_KEYS = [
  "competitive_points_per_win",
  "competitive_participation_bonus",
  "competitive_ranked_limit",
  "competitive_ranked_limit_period",
  "competitive_min_players_ranked",
  "competitive_swiss_limits",
  "competitive_topcut_limits",
  "competitive_tiebreaker_tournament",
  "competitive_tiebreaker_general",
  "competitive_score_labels",
  "competitive_score_note",
  "competitive_swiss_note",
  "competitive_classifiche_header",
  "competitive_classifiche_types",
  "competitive_regole_extra",
];

function tryParseJson<T>(val: string | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export const TournamentRulesInfo = ({ externalOpen, onExternalClose }: { externalOpen?: boolean; onExternalClose?: () => void } = {}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); if (!v && onExternalClose) onExternalClose(); };
  const [settings, setSettings] = useState<AllSettings>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<AllSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: siteData }, { data: seasonData }] = await Promise.all([
        supabase.from("site_settings").select("key, value").in("key", SITE_KEYS),
        supabase.from("ranking_seasons").select("bfl").eq("is_active", true).limit(1),
      ]);
      const map: Record<string, string> = {};
      (siteData ?? []).forEach((r: any) => { map[r.key] = r.value; });
      const s: AllSettings = {
        points_per_win: parseInt(map["competitive_points_per_win"]) || DEFAULTS.points_per_win,
        participation_bonus: parseInt(map["competitive_participation_bonus"]) || DEFAULTS.participation_bonus,
        ranked_limit: parseInt(map["competitive_ranked_limit"]) || DEFAULTS.ranked_limit,
        ranked_limit_period: map["competitive_ranked_limit_period"] || DEFAULTS.ranked_limit_period,
        min_players_ranked: parseInt(map["competitive_min_players_ranked"]) || DEFAULTS.min_players_ranked,
        bfl: (seasonData as any)?.[0]?.bfl ?? DEFAULTS.bfl,
        swiss_limits: tryParseJson(map["competitive_swiss_limits"], DEFAULTS.swiss_limits),
        topcut_limits: tryParseJson(map["competitive_topcut_limits"], DEFAULTS.topcut_limits),
        tiebreaker_tournament: tryParseJson(map["competitive_tiebreaker_tournament"], DEFAULTS.tiebreaker_tournament),
        tiebreaker_general: tryParseJson(map["competitive_tiebreaker_general"], DEFAULTS.tiebreaker_general),
        score_labels: tryParseJson(map["competitive_score_labels"], DEFAULTS.score_labels),
        score_note: map["competitive_score_note"] || DEFAULTS.score_note,
        swiss_note: map["competitive_swiss_note"] || DEFAULTS.swiss_note,
        classifiche_header: map["competitive_classifiche_header"] || DEFAULTS.classifiche_header,
        classifiche_types: tryParseJson(map["competitive_classifiche_types"], DEFAULTS.classifiche_types),
        regole_extra: tryParseJson(map["competitive_regole_extra"], DEFAULTS.regole_extra),
      };
      setSettings(s);
      setEditValues(s);
    })();
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const entries = [
      { key: "competitive_points_per_win", value: String(editValues.points_per_win) },
      { key: "competitive_participation_bonus", value: String(editValues.participation_bonus) },
      { key: "competitive_ranked_limit", value: String(editValues.ranked_limit) },
      { key: "competitive_ranked_limit_period", value: editValues.ranked_limit_period },
      { key: "competitive_min_players_ranked", value: String(editValues.min_players_ranked) },
      { key: "competitive_swiss_limits", value: JSON.stringify(editValues.swiss_limits) },
      { key: "competitive_topcut_limits", value: JSON.stringify(editValues.topcut_limits) },
      { key: "competitive_tiebreaker_tournament", value: JSON.stringify(editValues.tiebreaker_tournament) },
      { key: "competitive_tiebreaker_general", value: JSON.stringify(editValues.tiebreaker_general) },
      { key: "competitive_score_labels", value: JSON.stringify(editValues.score_labels) },
      { key: "competitive_score_note", value: editValues.score_note },
      { key: "competitive_swiss_note", value: editValues.swiss_note },
      { key: "competitive_classifiche_header", value: editValues.classifiche_header },
      { key: "competitive_classifiche_types", value: JSON.stringify(editValues.classifiche_types) },
      { key: "competitive_regole_extra", value: JSON.stringify(editValues.regole_extra) },
    ];
    for (const entry of entries) {
      await (supabase as any).from("site_settings").upsert(
        { key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }
    // Update BFL on active season
    if (editValues.bfl !== settings.bfl) {
      await (supabase as any).from("ranking_seasons").update({ bfl: editValues.bfl }).eq("is_active", true);
    }
    setSettings(editValues);
    setEditing(false);
    setSaving(false);
    toast.success("Impostazioni aggiornate!");
  };

  const s = editing ? editValues : settings;
  const periodLabel = s.ranked_limit_period === "weekly" ? "settimanale" : "mensile";
  const swissData = s.swiss_limits ?? DEFAULT_SWISS;
  const topCutData = s.topcut_limits ?? DEFAULT_TOPCUT;
  const tbTournament = s.tiebreaker_tournament ?? DEFAULT_TB_TOURNAMENT;
  const tbGeneral = s.tiebreaker_general ?? DEFAULT_TB_GENERAL;
  const scoreLabels = s.score_labels ?? DEFAULT_SCORE_LABELS;
  const scoreNote = s.score_note ?? DEFAULT_SCORE_NOTE;
  const swissNote = s.swiss_note ?? DEFAULT_SWISS_NOTE;
  const classificheHeader = s.classifiche_header ?? DEFAULT_CLASSIFICHE_HEADER;
  const classificheTypes = s.classifiche_types ?? DEFAULT_CLASSIFICHE_TYPES;
  const regoleExtra = s.regole_extra ?? DEFAULT_REGOLE_EXTRA;

  const updateSwiss = (idx: number, max: number) => {
    setEditValues(v => ({ ...v, swiss_limits: (v.swiss_limits ?? DEFAULT_SWISS).map((r, i) => i === idx ? { ...r, max } : r) }));
  };
  const updateTopCut = (idx: number, min: number) => {
    setEditValues(v => ({ ...v, topcut_limits: (v.topcut_limits ?? DEFAULT_TOPCUT).map((r, i) => i === idx ? { ...r, min } : r) }));
  };
  const updateTbTournament = (idx: number, text: string) => {
    setEditValues(v => ({ ...v, tiebreaker_tournament: (v.tiebreaker_tournament ?? DEFAULT_TB_TOURNAMENT).map((t, i) => i === idx ? text : t) }));
  };
  const updateTbGeneral = (idx: number, text: string) => {
    setEditValues(v => ({ ...v, tiebreaker_general: (v.tiebreaker_general ?? DEFAULT_TB_GENERAL).map((t, i) => i === idx ? text : t) }));
  };
  const updateScoreLabel = (idx: number, label: string) => {
    setEditValues(v => ({ ...v, score_labels: (v.score_labels ?? DEFAULT_SCORE_LABELS).map((r, i) => i === idx ? { ...r, label } : r) }));
  };
  const updateClassificaType = (idx: number, field: "label" | "desc", val: string) => {
    setEditValues(v => ({ ...v, classifiche_types: (v.classifiche_types ?? DEFAULT_CLASSIFICHE_TYPES).map((r, i) => i === idx ? { ...r, [field]: val } : r) }));
  };
  const updateRegoleExtra = (idx: number, field: "label" | "value", val: string) => {
    setEditValues(v => ({ ...v, regole_extra: (v.regole_extra ?? DEFAULT_REGOLE_EXTRA).map((r, i) => i === idx ? { ...r, [field]: val } : r) }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(false); }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 h-9 px-4 rounded-lg"
        >
          <Info size={15} />
          Come funziona il sistema competitivo?
        </Button>
      </DialogTrigger>
      <DialogContent
        hideClose
        className="flex h-[92vh] w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl lg:max-w-[92vw] xl:max-w-7xl"
      >
        <DialogHeader className="shrink-0 px-4 pt-3 pb-2.5 border-b border-border flex-row items-center justify-between gap-2">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Shield size={16} className="text-primary" />
            Sistema Competitivo FIB
          </DialogTitle>
          {isAdmin && !editing && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-[11px] h-7" onClick={() => setEditing(true)}>
              <Pencil size={12} /> Modifica
            </Button>
          )}
          {isAdmin && editing && (
            <Button size="sm" className="gap-1.5 text-[11px] h-7" disabled={saving} onClick={handleSave}>
              <Save size={12} /> {saving ? "Salvataggio..." : "Salva"}
            </Button>
          )}
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-3 lg:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">

              {/* 1 — Punteggio Ranked */}
              <Card className="border-primary/20">
                <CardHeader className="px-3 py-2 pb-1.5">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <Trophy size={13} className="text-primary" />
                    Punteggio Ranked
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-1 space-y-1.5">
                  {editing ? (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground block">Punti vittoria</label>
                          <Input type="number" min={0} className="h-7 text-[11px]" value={editValues.points_per_win} onChange={(e) => setEditValues(v => ({ ...v, points_per_win: parseInt(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block">Bonus partecipazione</label>
                          <Input type="number" min={0} className="h-7 text-[11px]" value={editValues.participation_bonus} onChange={(e) => setEditValues(v => ({ ...v, participation_bonus: parseInt(e.target.value) || 0 }))} />
                        </div>
                      </div>
                      {(editValues.score_labels ?? DEFAULT_SCORE_LABELS).map((sl, idx) => (
                        <Input key={idx} className="h-6 text-[11px]" value={sl.label} onChange={(e) => updateScoreLabel(idx, e.target.value)} />
                      ))}
                      <Input className="h-6 text-[10px] italic" value={editValues.score_note} onChange={(e) => setEditValues(v => ({ ...v, score_note: e.target.value }))} />
                    </div>
                  ) : (
                    <>
                      {scoreLabels.map((sl, i) => {
                        const val = i === 0 ? s.points_per_win : i === 1 ? s.participation_bonus : i === 2 ? s.points_per_win : 0;
                        const isHighlight = i < 2;
                        return (
                          <div key={i} className={`flex items-center justify-between rounded px-2.5 py-1.5 ${isHighlight ? "bg-primary/5" : "bg-muted/50"}`}>
                            <span className="text-[11px] text-muted-foreground">{sl.label}</span>
                            <span className={`text-xs ${isHighlight ? "font-bold text-primary" : i === 3 ? "font-semibold text-muted-foreground" : "font-semibold text-foreground"}`}>
                              {val > 0 ? "+" : ""}{val} {sl.suffix}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  <p className="text-[10px] text-muted-foreground italic">{scoreNote}</p>
                </CardContent>
              </Card>

              {/* 2 — Tiebreaker */}
              <Card className="border-primary/20">
                <CardHeader className="px-3 py-2 pb-1.5">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <Award size={13} className="text-primary" />
                    Tiebreaker
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-1 space-y-2.5">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em] mb-1">Classifica Torneo</p>
                    <ol className="space-y-0.5">
                      {tbTournament.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-[11px]">
                          <span className="flex-shrink-0 h-4 w-4 rounded-full bg-primary/10 text-primary font-bold text-[9px] flex items-center justify-center">{i + 1}</span>
                          {editing ? (
                            <Input className="h-6 text-[11px] flex-1" value={item} onChange={(e) => updateTbTournament(i, e.target.value)} />
                          ) : (
                            <span className="text-foreground">{item}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="border-t border-border pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em] mb-1">Classifiche Generali</p>
                    <ol className="space-y-0.5">
                      {tbGeneral.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-[11px]">
                          <span className="flex-shrink-0 h-4 w-4 rounded-full bg-accent/80 text-accent-foreground font-bold text-[9px] flex items-center justify-center">{i + 1}</span>
                          {editing ? (
                            <Input className="h-6 text-[11px] flex-1" value={item} onChange={(e) => updateTbGeneral(i, e.target.value)} />
                          ) : (
                            <span className="text-foreground">{item}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>

              {/* 3 — Turni Swiss */}
              <Card>
                <CardHeader className="px-3 py-2 pb-1.5">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <Target size={13} className="text-primary" />
                    Turni Swiss
                    <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full ml-auto">Ranked</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-1">
                  <div className="space-y-0.5">
                    {swissData.map((row, idx) => (
                      <div key={row.range} className="flex items-center justify-between px-2 py-1 even:bg-muted/40 rounded text-[11px]">
                        <span className="text-muted-foreground">{row.range} giocatori</span>
                        {editing ? (
                          <Input type="number" min={1} className="h-6 w-14 text-[11px] text-right" value={row.max} onChange={(e) => updateSwiss(idx, parseInt(e.target.value) || 1)} />
                        ) : (
                          <span className="font-semibold text-foreground">max {row.max}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {editing ? (
                    <Input className="h-6 text-[10px] italic mt-2" value={editValues.swiss_note} onChange={(e) => setEditValues(v => ({ ...v, swiss_note: e.target.value }))} />
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-2 italic">{swissNote}</p>
                  )}
                </CardContent>
              </Card>

              {/* 4 — Top Cut */}
              <Card>
                <CardHeader className="px-3 py-2 pb-1.5">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <Swords size={13} className="text-primary" />
                    Limiti Top Cut
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-1">
                  <div className="space-y-0.5">
                    {topCutData.map((row, idx) => (
                      <div key={row.top} className="flex items-center justify-between px-2 py-1 even:bg-muted/40 rounded text-[11px]">
                        <span className="font-medium text-foreground">{row.top}</span>
                        {editing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-[10px]">min</span>
                            <Input type="number" min={2} className="h-6 w-14 text-[11px] text-right" value={row.min} onChange={(e) => updateTopCut(idx, parseInt(e.target.value) || 2)} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">min <span className="font-semibold text-foreground">{row.min}</span></span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 5 — Classifiche */}
              <Card>
                <CardHeader className="px-3 py-2 pb-1.5">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <MapPin size={13} className="text-primary" />
                    Classifiche
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-1 space-y-2">
                  <div className="rounded bg-primary/5 px-2.5 py-1.5 text-[11px] space-y-0.5">
                    {editing ? (
                      <Input className="h-6 text-[11px] font-medium" value={editValues.classifiche_header} onChange={(e) => setEditValues(v => ({ ...v, classifiche_header: e.target.value }))} />
                    ) : (
                      <p className="text-foreground font-medium">{classificheHeader}</p>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>Migliori</span>
                      {editing ? (
                        <Input type="number" min={1} className="h-6 w-12 text-[11px] text-center" value={editValues.bfl} onChange={(e) => setEditValues(v => ({ ...v, bfl: parseInt(e.target.value) || 1 }))} />
                      ) : (
                        <span className="font-bold text-primary">{s.bfl}</span>
                      )}
                      <span>risultati stagione (BFL)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {classificheTypes.map((c, idx) => (
                      <div key={idx} className="rounded border border-border px-2 py-1.5">
                        {editing ? (
                          <>
                            <Input className="h-5 text-[11px] font-semibold mb-0.5 p-0 border-0 bg-transparent" value={c.label} onChange={(e) => updateClassificaType(idx, "label", e.target.value)} />
                            <Input className="h-4 text-[9px] p-0 border-0 bg-transparent text-muted-foreground" value={c.desc} onChange={(e) => updateClassificaType(idx, "desc", e.target.value)} />
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] font-semibold text-foreground">{c.label}</p>
                            <p className="text-[9px] text-muted-foreground">{c.desc}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 6 — Regole Ranked */}
              <Card className="border-primary/20">
                <CardHeader className="px-3 py-2 pb-1.5">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <Shield size={13} className="text-primary" />
                    Regole Ranked
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-1">
                  {editing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Limite ranked/club</label>
                        <Input type="number" min={1} className="h-7 text-[11px]" value={editValues.ranked_limit} onChange={(e) => setEditValues(v => ({ ...v, ranked_limit: parseInt(e.target.value) || 1 }))} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Periodo</label>
                        <select className="w-full h-7 text-[11px] rounded-md border border-input bg-background px-2" value={editValues.ranked_limit_period} onChange={(e) => setEditValues(v => ({ ...v, ranked_limit_period: e.target.value }))}>
                          <option value="monthly">Mensile</option>
                          <option value="weekly">Settimanale</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Min. giocatori</label>
                        <Input type="number" min={2} className="h-7 text-[11px]" value={editValues.min_players_ranked} onChange={(e) => setEditValues(v => ({ ...v, min_players_ranked: parseInt(e.target.value) || 2 }))} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-1.5 text-[11px]">
                        <span className="text-muted-foreground">Limite {periodLabel}</span>
                        <span className="font-bold text-foreground">{s.ranked_limit}/club</span>
                      </div>
                      <div className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-1.5 text-[11px]">
                        <span className="text-muted-foreground">Min. giocatori</span>
                        <span className="font-bold text-foreground">{s.min_players_ranked}</span>
                      </div>
                      {regoleExtra.map((re, idx) => (
                        <div key={idx} className={`flex items-center justify-between rounded px-2.5 py-1.5 text-[11px] ${re.value.toLowerCase().includes("vietat") ? "bg-destructive/5" : "bg-muted/50"}`}>
                          {editing ? (
                            <>
                              <Input className="h-6 text-[11px] flex-1 mr-2" value={re.label} onChange={(e) => updateRegoleExtra(idx, "label", e.target.value)} />
                              <Input className="h-6 text-[11px] w-20 text-right font-bold" value={re.value} onChange={(e) => updateRegoleExtra(idx, "value", e.target.value)} />
                            </>
                          ) : (
                            <>
                              <span className="text-muted-foreground">{re.label}</span>
                              <span className={`font-bold ${re.value.toLowerCase().includes("vietat") ? "text-destructive" : "text-foreground"}`}>{re.value}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-border flex justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>Chiudi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
