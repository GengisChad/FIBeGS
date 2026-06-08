import { Link } from "react-router-dom";
import { Trophy, Medal, Award } from "lucide-react";

const rankings = [
  { rank: 1, name: "Alessandro Rossi", points: 2450, wins: 42, location: "Milano", icon: Trophy },
  { rank: 2, name: "Marco Bianchi", points: 2280, wins: 38, location: "Roma", icon: Medal },
  { rank: 3, name: "Luca Ferrari", points: 2150, wins: 35, location: "Napoli", icon: Award },
  { rank: 4, name: "Giovanni Russo", points: 2050, wins: 32, location: "Torino" },
  { rank: 5, name: "Francesco Colombo", points: 1980, wins: 30, location: "Firenze" },
  { rank: 6, name: "Andrea Ricci", points: 1920, wins: 28, location: "Bologna" },
];

export const RankingsSection = () => {
  return (
    <section id="rankings" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-primary font-medium uppercase tracking-wider text-sm">Top Players</span>
          <h2 className="section-title mt-2">
            CLASSIFICA <span className="gradient-text">NAZIONALE</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            I migliori blader italiani in competizione. Scala la classifica partecipando ai tornei ufficiali.
          </p>
        </div>

        {/* Rankings Table */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-2xl border border-border overflow-hidden card-glow">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-secondary/50 border-b border-border text-sm font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Blader</div>
              <div className="col-span-2 text-center">Punti</div>
              <div className="col-span-2 text-center">Vittorie</div>
              <div className="col-span-2 text-right">Città</div>
            </div>

            {/* Table Rows */}
            {rankings.map((player, index) => (
              <div
                key={player.rank}
                className="grid grid-cols-12 gap-4 px-6 py-5 border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Rank */}
                <div className="col-span-1 flex items-center">
                  {player.icon ? (
                    <player.icon
                      size={24}
                      className={
                        player.rank === 1
                          ? "text-primary"
                          : player.rank === 2
                          ? "text-gray-400"
                          : "text-amber-700"
                      }
                    />
                  ) : (
                    <span className="text-muted-foreground font-medium">{player.rank}</span>
                  )}
                </div>

                {/* Name */}
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors">
                    <span className="font-display text-lg">{player.name.charAt(0)}</span>
                  </div>
                  <span className="font-medium text-foreground">{player.name}</span>
                </div>

                {/* Points */}
                <div className="col-span-2 flex items-center justify-center">
                  <span className="font-semibold text-primary">{player.points.toLocaleString()}</span>
                </div>

                {/* Wins */}
                <div className="col-span-2 flex items-center justify-center">
                  <span className="text-muted-foreground">{player.wins}</span>
                </div>

                {/* Location */}
                <div className="col-span-2 flex items-center justify-end">
                  <span className="text-sm text-muted-foreground">{player.location}</span>
                </div>
              </div>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center mt-8">
            <Link to="/rankings" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Vedi classifica completa →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
