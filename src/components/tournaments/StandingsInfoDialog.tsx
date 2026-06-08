import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, BarChart3, Swords, Users, Scale, Percent, Target, Zap } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

// ---------- piccoli helper grafici ----------
const Pill = ({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" | "win" | "loss" }) => {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/30",
    win: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    loss: "bg-red-500/10 text-red-500 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
};

const Bar = ({ value, max = 100, tone = "primary" }: { value: number; max?: number; tone?: "primary" | "muted" }) => (
  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
    <div
      className={`h-full rounded-full ${tone === "primary" ? "bg-primary" : "bg-muted-foreground/40"}`}
      style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
    />
  </div>
);

// ---------- contenuti card ----------
type Step = {
  icon: typeof Trophy;
  label: string;
  tag: string;
  desc: string;
  example: ReactNode;
};

const steps: Step[] = [
  {
    icon: Trophy,
    label: "Punti torneo",
    tag: "3 / 0",
    desc:
      "Il criterio principale: 3 punti per ogni match vinto (BYE incluso), 0 per la sconfitta. Non esistono pareggi: ogni match ha sempre un vincitore. Si sommano i risultati di tutti i turni Swiss e Top Cut. I match di spareggio per il piazzamento (3°/4°, 5°-8°…) non assegnano punti.",
    example: (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span>5V · 0S</span>
          <Pill tone="primary">15 pt</Pill>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span>4V · 1S</span>
          <Pill tone="primary">12 pt</Pill>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span>2V · 3S</span>
          <Pill>6 pt</Pill>
        </div>
      </div>
    ),
  },
  {
    icon: Users,
    label: "Scontro diretto",
    tag: "H2H",
    desc:
      "Il primo tiebreaker quando due o più giocatori chiudono a pari punti: vince chi ha battuto direttamente gli altri nei match disputati tra di loro nello Swiss. Si applica solo all'interno del gruppo di pari-punti; se tutti si sono battuti a vicenda o non si sono mai incontrati il criterio è neutro e si passa al successivo. È il più equo perché si basa su un risultato reale sul tavolo, non su una stima.",
    example: (
      <div className="space-y-1.5 text-[11px]">
        <div className="text-muted-foreground mb-1">3 giocatori a 9 punti:</div>
        <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-1 items-center font-mono">
          <span></span>
          <span className="text-center text-muted-foreground">A</span>
          <span className="text-center text-muted-foreground">B</span>
          <span className="text-center text-muted-foreground">C</span>
          <span className="text-muted-foreground">A vs</span>
          <span className="text-center">—</span>
          <span className="text-center"><Pill tone="win">W</Pill></span>
          <span className="text-center"><Pill tone="loss">L</Pill></span>
          <span className="text-muted-foreground">B vs</span>
          <span className="text-center"><Pill tone="loss">L</Pill></span>
          <span className="text-center">—</span>
          <span className="text-center"><Pill tone="win">W</Pill></span>
          <span className="text-muted-foreground">C vs</span>
          <span className="text-center"><Pill tone="win">W</Pill></span>
          <span className="text-center"><Pill tone="loss">L</Pill></span>
          <span className="text-center">—</span>
        </div>
        <div className="pt-1 border-t border-border/60 text-muted-foreground">
          Ordine H2H: <span className="text-foreground font-semibold">C &gt; A &gt; B</span>
        </div>
      </div>
    ),
  },
  {
    icon: BarChart3,
    label: "OMW%",
    tag: "Opponents' Match Win %",
    desc:
      "Media delle percentuali di vittoria match di tutti gli avversari incontrati nello Swiss. Misura quanto era difficile il tuo tabellone: chi ha incrociato giocatori forti ottiene un OMW% più alto. Ogni avversario ha un floor minimo del 33% per evitare valori distorti. È lo stesso dato che alcuni regolamenti chiamano \"Resistance\".",
    example: (
      <div className="space-y-1.5 text-[11px]">
        <div className="text-muted-foreground mb-1">I tuoi 3 avversari nello Swiss:</div>
        <div className="space-y-1">
          {[
            { name: "Avv. A", wp: 80 },
            { name: "Avv. B", wp: 60 },
            { name: "Avv. C", wp: 33 },
          ].map((o) => (
            <div key={o.name} className="flex items-center gap-2">
              <span className="w-14 shrink-0">{o.name}</span>
              <Bar value={o.wp} />
              <span className="w-10 text-right font-mono tabular-nums">{o.wp}%</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <span className="text-muted-foreground">Media</span>
          <Pill tone="primary">OMW% = 57,7%</Pill>
        </div>
      </div>
    ),
  },
  {
    icon: Scale,
    label: "Median Buchholz",
    tag: "MBH",
    desc:
      "Somma dei punti finali di tutti i tuoi avversari, scartando il migliore e il peggiore. Riduce l'effetto di un avversario estremamente forte o estremamente debole e fornisce una stima più stabile della difficoltà del tabellone rispetto a OMW%. Utile per disambiguare quando anche OMW% è identico.",
    example: (
      <div className="space-y-1.5 text-[11px]">
        <div className="text-muted-foreground mb-1">Punti finali dei tuoi avversari:</div>
        <div className="flex flex-wrap gap-1">
          <Pill>15 ✗</Pill>
          <Pill tone="primary">12</Pill>
          <Pill tone="primary">9</Pill>
          <Pill tone="primary">7</Pill>
          <Pill>3 ✗</Pill>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <span className="text-muted-foreground">12 + 9 + 7 (scarto 15 e 3)</span>
          <Pill tone="primary">MBH = 28</Pill>
        </div>
      </div>
    ),
  },
  {
    icon: Percent,
    label: "PW% — Punti partita",
    tag: "Point Win %",
    desc:
      "Percentuale di punti vinti dentro i match disputati. Anche se ogni turno è una singola partita, il punteggio finale (es. 6-2) conta: PW% premia chi vince in modo netto rispetto a chi vince di misura. Si calcola come (punti tuoi) / (punti totali del match) mediato su tutti i match Swiss, con floor minimo del 33%.",
    example: (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span>Match 1</span>
          <Pill tone="win">6</Pill><span>-</span><Pill tone="loss">0</Pill>
        </div>
        <div className="flex items-center justify-between">
          <span>Match 2</span>
          <Pill tone="win">5</Pill><span>-</span><Pill tone="loss">3</Pill>
        </div>
        <div className="flex items-center justify-between">
          <span>Match 3</span>
          <Pill tone="win">4</Pill><span>-</span><Pill tone="loss">2</Pill>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <span className="text-muted-foreground">15 punti vinti / 20 totali</span>
          <Pill tone="primary">PW% = 75%</Pill>
        </div>
      </div>
    ),
  },
  {
    icon: Target,
    label: "OPW% — Punti avversari",
    tag: "Opponents' Point Win %",
    desc:
      "Come OMW%, ma calcolato sulla PW% dei tuoi avversari invece che sulla loro percentuale di vittoria match. Affina ulteriormente la stima della forza del tabellone considerando quanto nettamente i tuoi avversari hanno vinto i loro match.",
    example: (
      <div className="space-y-1.5 text-[11px]">
        <div className="text-muted-foreground mb-1">PW% dei tuoi avversari:</div>
        <div className="space-y-1">
          {[
            { name: "Avv. A", v: 70 },
            { name: "Avv. B", v: 55 },
            { name: "Avv. C", v: 40 },
          ].map((o) => (
            <div key={o.name} className="flex items-center gap-2">
              <span className="w-14 shrink-0">{o.name}</span>
              <Bar value={o.v} tone="muted" />
              <span className="w-10 text-right font-mono tabular-nums">{o.v}%</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <span className="text-muted-foreground">Media</span>
          <Pill tone="primary">OPW% = 55,0%</Pill>
        </div>
      </div>
    ),
  },
  {
    icon: Swords,
    label: "Differenza punti",
    tag: "Point Diff",
    desc:
      "Differenza cumulativa tra i punti segnati e quelli subiti in tutti i match Swiss. Una vittoria 6-2 vale +4, una 6-5 vale +1, una sconfitta 3-6 vale -3. Tiebreaker più \"crudo\" della PW%: premia il dominio assoluto a parità di tutto il resto.",
    example: (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span>Win 6-2</span><Pill tone="win">+4</Pill>
        </div>
        <div className="flex items-center justify-between">
          <span>Win 6-5</span><Pill tone="win">+1</Pill>
        </div>
        <div className="flex items-center justify-between">
          <span>Loss 3-6</span><Pill tone="loss">−3</Pill>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <span className="text-muted-foreground">Totale</span>
          <Pill tone="primary">Diff = +2</Pill>
        </div>
      </div>
    ),
  },
];

export const StandingsInfoDialog = ({ open, onClose }: Props) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[96vw] max-w-[900px] max-h-[92vh] p-0 gap-0 flex flex-col [&>button]:hidden">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border">
          <DialogTitle className="text-lg font-bold">Come funziona la classifica</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            I criteri vengono applicati nell'ordine elencato qui sotto. Quando due giocatori sono pari su un criterio, si passa al successivo finché non emerge una differenza.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {steps.map((step, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card p-4 flex flex-col">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <step.icon size={14} className="text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground truncate">{step.label}</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {step.tag}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] leading-[1.65] text-muted-foreground mb-3">
                  {step.desc}
                </p>
                <div className="mt-auto rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Esempio
                  </div>
                  {step.example}
                </div>
              </div>
            ))}

            {/* Spareggio */}
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 md:col-span-2">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap size={18} className="text-primary" />
                </div>
                <div>
                  <span className="text-sm font-bold text-foreground">Spareggio</span>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">ultimo resort</p>
                </div>
              </div>
              <p className="text-[13px] leading-[1.7] text-muted-foreground">
                Se dopo tutti i criteri attivi due o più giocatori sono ancora perfettamente pari sul confine della qualificazione Top Cut, viene generato un match di spareggio per decidere chi avanza.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 shrink-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
