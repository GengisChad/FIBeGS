import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

const rules = [
  {
    category: "Equipaggiamento",
    items: [
      { text: "Solo Beyblade originali Takara Tomy o Hasbro", allowed: true },
      { text: "Modifiche ai componenti non sono permesse", allowed: false },
      { text: "Launcher ufficiali obbligatori", allowed: true },
      { text: "Parti di ricambio devono essere originali", allowed: true },
    ],
  },
  {
    category: "Formato Torneo",
    items: [
      { text: "Match al meglio di 3 round", allowed: true },
      { text: "2 punti per Burst, 1 punto per Ring Out o Spin Finish", allowed: true },
      { text: "Tempo massimo per round: 60 secondi", allowed: true },
      { text: "Cambio Beyblade permesso tra match", allowed: true },
    ],
  },
  {
    category: "Condotta",
    items: [
      { text: "Rispetto verso avversari e giudici", allowed: true },
      { text: "Linguaggio offensivo o comportamento scorretto", allowed: false },
      { text: "Decisioni dell'arbitro sono definitive", allowed: true },
      { text: "Ritardi oltre 5 minuti = sconfitta a tavolino", warning: true },
    ],
  },
];

export const RulesSection = () => {
  return (
    <section id="rules" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-primary font-medium uppercase tracking-wider text-sm">Regolamento</span>
          <h2 className="section-title mt-2">
            REGOLE <span className="gradient-text">UFFICIALI</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Le regole da seguire per partecipare ai tornei ufficiali della community italiana.
          </p>
        </div>

        {/* Rules Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {rules.map((section, index) => (
            <div
              key={section.category}
              className="bg-card rounded-2xl border border-border p-6 card-glow"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <h3 className="font-display text-2xl mb-6 text-center gradient-text">
                {section.category}
              </h3>
              <ul className="space-y-4">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    {"warning" in item && item.warning ? (
                      <AlertCircle size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                    ) : item.allowed ? (
                      <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    )}
                    <span className="text-sm text-muted-foreground">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Download Button */}
        <div className="text-center mt-12">
          <a
            href="#"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-secondary border border-border text-foreground hover:border-primary/50 transition-colors"
          >
            Scarica Regolamento Completo (PDF)
          </a>
        </div>
      </div>
    </section>
  );
};
