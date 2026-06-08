import { useState, useEffect, useCallback } from "react";
import {
  Book, Target, Zap, AlertTriangle, Shield, Users, Swords, Trophy,
  ExternalLink, ChevronRight, Pencil, Check, X, Plus, Trash2, Download, Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";

const iconMap: Record<string, React.ElementType> = {
  Shield, Book, Target, Swords, Zap, AlertTriangle, Users, Trophy,
};
const iconKeys = Object.keys(iconMap);

interface RuleCategory {
  icon: string;
  title: string;
  rules: string[];
}

const defaultCategories: RuleCategory[] = [
  { icon: "Users", title: "Formato 3on3 — Preparazione", rules: [
    "Posiziona i 3 Bey nell'ordine in cui vuoi giocarli, poi andranno al Bey Check.",
    "Non puoi usare lo stesso pezzo più volte tra i 3 Bey (anche se in colori diversi). Lock Chip CX: Valkyrie ed Emperor limitati a 1 ciascuno, gli altri sono riutilizzabili.",
    "Durante la partita non puoi cambiare ordine dei Bey, combinazioni o ordine di gioco senza approvazione del giudice.",
    "Se non puoi preparare 3 Bey, riceverai un Bey in prestito dal giudice da usare obbligatoriamente.",
  ]},
  { icon: "Swords", title: "Formato 3on3 — Risultati", rules: [
    "Il primo a raggiungere 4 punti vince il match. 7 punti in Semifinale e Finale.",
    "Le battaglie si svolgono un Bey alla volta, seguendo l'ordine assegnato.",
    "In caso di pareggio, si disputa un rematch con gli stessi Bey.",
    "Se dopo 3 battaglie non c'è un vincitore, puoi riordinare i tuoi Bey e la partita prosegue.",
  ]},
  { icon: "Zap", title: "Punti & Finishing Move", rules: [
    "Xtreme Finish: 3 punti — il Bey avversario entra completamente nella Xtreme Zone.",
    "Over Finish: 2 punti — il Bey avversario entra nella Over Zone senza poter tornare.",
    "Burst Finish: 1 punto — le parti del Bey avversario si staccano e separano prima del tuo.",
    "Spin Finish: 1 punto — la rotazione del Bey avversario raggiunge lo zero prima del tuo.",
    "Own Finish: si verifica quando dalla fase di lancio fino al compimento di un Over/Xtreme Finish non c'è stato alcun contatto tra i due Bey. Il round si ripete.",
    "Se entrambi i Bey subiscono lo stesso finish simultaneamente, il round è pareggio e viene ripetuto.",
  ]},
  { icon: "Target", title: "Risultati Match — Circuito FIB", rules: [
    "Il primo a raggiungere 4 punti vince il match (formato standard e 3on3).",
    "In Semifinale e Finale la soglia sale a 7 punti.",
    "Lo stadio ufficiale per i tornei Ranked è lo Xtreme Stadium (normale).",
    "Ogni arbitro nei tornei Ranked deve registrare gli scontri tramite dispositivo video (smartphone, action cam, funzione VAR dell'app FIB).",
  ]},
  { icon: "Shield", title: "Beyblade Ammessi & Check", rules: [
    "Solo Bey della generazione Beyblade X (4ª Gen, da Luglio 2023). Nessun Bey, lanciatore o stadio di altre generazioni.",
    "I Bey \"Hall of Fame\" sono vietati nel 1on1, ma ammessi nel 3on3 e Team Battle.",
    "È consentita solo la personalizzazione con parti ufficiali della serie Beyblade X.",
    "Adesivi ammessi: devono essere dello stesso materiale degli originali, applicati solo nelle aree designate dal regolamento e non devono entrare in contatto con parti meccaniche in movimento.",
    "Danni o macchie a Bey/stadio avversari causati da adesivi non conformi comportano la squalifica.",
    "Lo smontaggio e la ricombinazione dei Ratchet è ammesso, purché il risultato sia un componente esistente e conforme alla resistenza al burst.",
    "Il giudice controllerà ogni parte e restituirà il Bey senza rimontarlo.",
    "Launcher e accessori: è vietato omettere parti previste o combinarle in modi non conformi. Vietato l'uso di lanciatori/impugnature modificati che alterano il funzionamento originale.",
    "Adesivi su lanciatori: vietati se entrano in contatto con parti meccaniche in movimento del lanciatore.",
  ]},
  { icon: "Book", title: "Metodo di Lancio", rules: [
    "Lancia il Bey da un'altezza massima di 20 cm rispetto allo stadio.",
    "Decidi la posizione di tiro (sinistra, destra o centrale) con carta-forbice-sasso. Non si può cambiare durante la partita.",
    "Comando ufficiale: \"Tre, Due, Uno, Pronti LANCIO!!\" — lancia solo al \"LANCIO!\".",
    "Divieto di lanciare mantenendo il Bey a contatto con lo stadio (squalifica se intenzionale).",
    "È vietato interferire con il lancio o la postura dell'avversario. Contatti intenzionali comportano la squalifica.",
  ]},
  { icon: "AlertTriangle", title: "Condotta & Stadi", rules: [
    "Dopo il lancio fai un passo indietro. Non guardare all'interno dello stadio.",
    "Non toccare stadio o Bey finché il giudice non dà il permesso.",
    "Le decisioni del giudice su esiti e finishing move sono definitive.",
    "Xtreme Stadium: Over Zone (tasche laterali), Xtreme Zone (tasca centrale), Battle Zone (il resto).",
    "Infinity Stadium: Over Zone nelle 4 posizioni, Xtreme Zone nei 2 fori centrali.",
  ]},
  { icon: "Trophy", title: "FAQ Circuito FIB", rules: [
    "Accessori stampati 3D ammessi: linguetta string launcher, ganci cintura, tasche Xtreme Zone, basette gommate a clip per stadio.",
    "Team Battle: eliminazione diretta, 3 match per set. Il 4° membro è riserva.",
    "È vietato pubblicare foto/video che identifichino giocatori senza consenso.",
    "Il regolamento può essere aggiornato — verifica sempre la versione più recente su ibna.it.",
    "Partecipando a un evento si presume la conoscenza del regolamento Edizione 12.",
  ]},
];

export const GameplayRulesSection = () => {
  const { isAdmin } = useAdmin();
  const [categories, setCategories] = useState<RuleCategory[]>(defaultCategories);
  const [regulationUrl, setRegulationUrl] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [editUrlValue, setEditUrlValue] = useState("");
  const [editingCards, setEditingCards] = useState(false);
  const [editCategories, setEditCategories] = useState<RuleCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [subtitle, setSubtitle] = useState("Regolamento ufficiale 12ª Edizione (Marzo 2026) per tutti i tornei FIB.");
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [editSubtitleValue, setEditSubtitleValue] = useState("");

  // Convert Google Drive share link to embeddable preview URL
  const getEmbedUrl = (url: string) => {
    // Google Drive file link
    const driveMatch = url.match(/\/file\/d\/([^/]+)/);
    if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    // Google Drive open link
    const openMatch = url.match(/[?&]id=([^&]+)/);
    if (openMatch) return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
    // Already a preview link or direct PDF
    return url;
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase.from("site_settings" as any).select("key, value").in("key", ["regulation_url", "rules_categories", "rules_subtitle"]) as any);
      if (data) {
        for (const row of data as any[]) {
          if (row.key === "regulation_url") {
            setRegulationUrl(row.value);
            setEditUrlValue(row.value);
          }
          if (row.key === "rules_categories") {
            try {
              const parsed = JSON.parse(row.value);
              if (Array.isArray(parsed) && parsed.length > 0) setCategories(parsed);
            } catch {}
          }
          if (row.key === "rules_subtitle" && row.value) {
            setSubtitle(row.value);
            setEditSubtitleValue(row.value);
          }
        }
      }
    };
    load();
  }, []);

  const startEditCards = () => {
    setEditCategories(JSON.parse(JSON.stringify(categories)));
    setEditingCards(true);
  };

  const saveCards = async () => {
    setSaving(true);
    const { error } = await (supabase.from("site_settings" as any) as any)
      .update({ value: JSON.stringify(editCategories), updated_at: new Date().toISOString() })
      .eq("key", "rules_categories");
    setSaving(false);
    if (error) {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } else {
      setCategories(editCategories);
      setEditingCards(false);
      toast({ title: "Regole aggiornate!" });
    }
  };

  const saveSubtitle = async () => {
    setSaving(true);
    // Upsert: try update first, then insert if not found
    const { error } = await (supabase.from("site_settings" as any) as any)
      .update({ value: editSubtitleValue, updated_at: new Date().toISOString() })
      .eq("key", "rules_subtitle");
    if (error) {
      // Try insert
      await (supabase.from("site_settings" as any) as any)
        .insert({ key: "rules_subtitle", value: editSubtitleValue });
    }
    setSaving(false);
    setSubtitle(editSubtitleValue);
    setEditingSubtitle(false);
    toast({ title: "Sottotitolo aggiornato!" });
  };

  const saveUrl = async () => {
    setSaving(true);
    const { error } = await (supabase.from("site_settings" as any) as any)
      .update({ value: editUrlValue, updated_at: new Date().toISOString() })
      .eq("key", "regulation_url");
    setSaving(false);
    if (error) {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } else {
      setRegulationUrl(editUrlValue);
      setEditingUrl(false);
      toast({ title: "Link regolamento aggiornato!" });
    }
  };

  // Edit helpers
  const updateCatTitle = (idx: number, title: string) => {
    setEditCategories(prev => prev.map((c, i) => i === idx ? { ...c, title } : c));
  };
  const updateCatIcon = (idx: number, icon: string) => {
    setEditCategories(prev => prev.map((c, i) => i === idx ? { ...c, icon } : c));
  };
  const updateRule = (catIdx: number, ruleIdx: number, value: string) => {
    setEditCategories(prev => prev.map((c, i) => i === catIdx ? { ...c, rules: c.rules.map((r, j) => j === ruleIdx ? value : r) } : c));
  };
  const removeRule = (catIdx: number, ruleIdx: number) => {
    setEditCategories(prev => prev.map((c, i) => i === catIdx ? { ...c, rules: c.rules.filter((_, j) => j !== ruleIdx) } : c));
  };
  const addRule = (catIdx: number) => {
    setEditCategories(prev => prev.map((c, i) => i === catIdx ? { ...c, rules: [...c.rules, ""] } : c));
  };
  const removeCategory = (idx: number) => {
    setEditCategories(prev => prev.filter((_, i) => i !== idx));
  };
  const addCategory = () => {
    setEditCategories(prev => [...prev, { icon: "Book", title: "Nuova Sezione", rules: [""] }]);
  };

  return (
    <section id="gameplay-rules" className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="text-primary font-medium uppercase tracking-wider text-sm">
            Regolamento Ufficiale
          </span>
          <h2 className="section-title mt-2">
            REGOLE <span className="gradient-text">BEYBLADE X</span>
          </h2>
          {editingSubtitle ? (
            <div className="flex items-center gap-2 justify-center mt-4 max-w-xl mx-auto">
              <Input
                value={editSubtitleValue}
                onChange={(e) => setEditSubtitleValue(e.target.value)}
                className="text-center text-sm"
              />
              <Button size="icon" variant="ghost" onClick={saveSubtitle} disabled={saving}><Check size={14} /></Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingSubtitle(false)}><X size={14} /></Button>
            </div>
          ) : (
            <p
              className={`text-muted-foreground mt-4 max-w-xl mx-auto ${isAdmin ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}
              onClick={() => { if (isAdmin) { setEditSubtitleValue(subtitle); setEditingSubtitle(true); } }}
            >
              {subtitle}
            </p>
          )}
          {isAdmin && !editingCards && (
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={startEditCards}>
              <Pencil size={14} /> Modifica tutte le regole
            </Button>
          )}
          {isAdmin && editingCards && (
            <div className="flex justify-center gap-2 mt-4">
              <Button size="sm" onClick={saveCards} disabled={saving} className="gap-2">
                <Check size={14} /> {saving ? "Salvataggio..." : "Salva modifiche"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingCards(false)} className="gap-2">
                <X size={14} /> Annulla
              </Button>
            </div>
          )}
        </div>

        {/* EDIT MODE */}
        {editingCards ? (
          <div className="space-y-6 max-w-5xl mx-auto">
            {editCategories.map((cat, catIdx) => (
              <div key={catIdx} className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <select
                    className="bg-secondary border border-border rounded px-2 py-1 text-sm"
                    value={cat.icon}
                    onChange={(e) => updateCatIcon(catIdx, e.target.value)}
                  >
                    {iconKeys.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <Input
                    value={cat.title}
                    onChange={(e) => updateCatTitle(catIdx, e.target.value)}
                    className="font-bold text-lg flex-1"
                  />
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeCategory(catIdx)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="space-y-2">
                  {cat.rules.map((rule, ruleIdx) => (
                    <div key={ruleIdx} className="flex items-start gap-2">
                      <ChevronRight size={14} className="text-primary shrink-0 mt-3" />
                      <Textarea
                        value={rule}
                        onChange={(e) => updateRule(catIdx, ruleIdx, e.target.value)}
                        className="flex-1 min-h-[40px] text-sm resize-none"
                        rows={1}
                      />
                      <Button size="icon" variant="ghost" className="shrink-0 text-destructive" onClick={() => removeRule(catIdx, ruleIdx)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => addRule(catIdx)}>
                    <Plus size={14} /> Aggiungi regola
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-center">
              <Button variant="outline" onClick={addCategory} className="gap-2">
                <Plus size={16} /> Aggiungi sezione
              </Button>
            </div>
          </div>
        ) : (
          /* VIEW MODE */
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {categories.map((category, index) => {
              const IconComp = iconMap[category.icon] || Book;
              return (
                <div
                  key={index}
                  className="bg-card rounded-2xl border border-border p-6 card-glow"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComp size={20} className="text-primary" />
                    </div>
                    <h3 className="font-display text-xl">{category.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {category.rules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight size={14} className="text-primary shrink-0 mt-1" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* Regulation link + admin edit */}
        <div className="text-center mt-10 space-y-4">
          {regulationUrl && (
            <Button variant="outline" className="gap-2" onClick={() => setPdfOpen(true)}>
              <Book size={18} />
              Leggi Regolamento Completo
            </Button>
          )}

          {isAdmin && (
            <div className="max-w-lg mx-auto mt-4">
              {editingUrl ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={editUrlValue}
                    onChange={(e) => setEditUrlValue(e.target.value)}
                    placeholder="URL del regolamento completo"
                    className="flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={saveUrl} disabled={saving}>
                    <Check size={18} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingUrl(false); setEditUrlValue(regulationUrl); }}>
                    <X size={18} />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setEditingUrl(true)}>
                  <Pencil size={14} /> Modifica link regolamento
                </Button>
              )}
            </div>
          )}
        </div>

        {/* PDF Viewer Dialog */}
        <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
          <DialogContent
            hideClose
            className="max-w-[95vw] w-full sm:max-w-4xl h-[90vh] sm:h-[85vh] p-0 gap-0 flex flex-col overflow-hidden"
          >
            <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-semibold">Regolamento Completo</DialogTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(regulationUrl, '_blank')}
                    title="Apri in nuova scheda"
                  >
                    <Maximize2 size={16} />
                  </Button>
                  <a href={regulationUrl} target="_blank" rel="noopener noreferrer" download>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Scarica PDF">
                      <Download size={16} />
                    </Button>
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => setPdfOpen(false)}>
                    <X size={16} />
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              <iframe
                src={getEmbedUrl(regulationUrl)}
                className="w-full h-full border-0"
                allow="autoplay"
                title="Regolamento PDF"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};
