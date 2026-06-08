import { Play } from "lucide-react";
import { useState } from "react";

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
}

export const YouTubeEmbed = ({ videoId, title = "Video" }: YouTubeEmbedProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <section className="py-8">
      <div className="flex items-center gap-3 mb-5">
        <Play size={20} className="text-primary" />
        <h2 className="font-display text-2xl gradient-text">In Evidenza</h2>
      </div>
      <div
        className="relative rounded-2xl overflow-hidden border border-border bg-card"
        style={{
          boxShadow: "0 20px 60px -15px hsl(0 0% 0% / 0.6), 0 0 30px hsl(var(--primary) / 0.08)",
        }}
      >
        {!loaded && (
          <button
            onClick={() => setLoaded(true)}
            className="relative w-full aspect-video bg-secondary/50 flex items-center justify-center group cursor-pointer"
          >
            <img
              src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-300"
              loading="lazy"
            />
            <div className="relative z-10 w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <Play size={28} className="text-primary-foreground ml-1" fill="currentColor" />
            </div>
          </button>
        )}
        {loaded && (
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        )}
      </div>
    </section>
  );
};
