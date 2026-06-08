import { Play, Clock, Eye } from "lucide-react";

const videos = [
  {
    id: 1,
    title: "Guida ai Combo Competitivi",
    description: "Le migliori combinazioni per dominare i tornei",
    duration: "15:32",
    views: "12.5K",
    category: "Strategia",
  },
  {
    id: 2,
    title: "Tecniche di Lancio Avanzate",
    description: "Migliora il tuo lancio con queste tecniche pro",
    duration: "22:18",
    views: "8.2K",
    category: "Tecnica",
  },
  {
    id: 3,
    title: "Analisi Nuovi Beyblade 2024",
    description: "Review completa delle ultime uscite",
    duration: "28:45",
    views: "15.1K",
    category: "Review",
  },
  {
    id: 4,
    title: "Preparazione al Torneo",
    description: "Come prepararsi mentalmente e tecnicamente",
    duration: "18:20",
    views: "6.8K",
    category: "Guida",
  },
];

export const GuidesSection = () => {
  return (
    <section id="guides" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-primary font-medium uppercase tracking-wider text-sm">Video Content</span>
          <h2 className="section-title mt-2">
            GUIDE & <span className="gradient-text">TUTORIAL</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Impara dalle guide dei migliori blader italiani. Strategie, tecniche e consigli per migliorare.
          </p>
        </div>

        {/* Videos Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="bg-card rounded-2xl border border-border overflow-hidden card-glow group cursor-pointer"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-secondary to-muted relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play size={24} className="text-primary-foreground ml-1" fill="currentColor" />
                  </div>
                </div>
                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm flex items-center gap-1">
                  <Clock size={12} className="text-muted-foreground" />
                  <span className="text-xs text-foreground">{video.duration}</span>
                </div>
                {/* Category Badge */}
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-primary/90 text-xs text-primary-foreground font-medium">
                  {video.category}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-display text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
                  {video.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{video.description}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye size={14} />
                  <span>{video.views} visualizzazioni</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All */}
        <div className="text-center mt-12">
          <a href="#" className="text-primary hover:text-primary/80 font-medium transition-colors">
            Vedi tutti i video →
          </a>
        </div>
      </div>
    </section>
  );
};
