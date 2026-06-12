import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award } from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
}

/** Icona badge con fallback elegante se l'immagine non carica (solo presentazione). */
const BadgeIcon = ({ iconUrl, name, size = 44 }: { iconUrl: string | null; name: string; size?: number }) => {
  const [broken, setBroken] = useState(false);
  if (iconUrl && !broken) {
    return (
      <img
        src={iconUrl}
        alt={name}
        width={size}
        height={size}
        className="object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className="rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center font-display font-bold text-primary shadow-[0_0_14px_-4px_hsl(var(--primary)/0.5)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

export const ProfileBadges = ({ userId, inline }: { userId: string; inline?: boolean }) => {
  const [badges, setBadges] = useState<BadgeData[]>([]);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      const { data: ub } = await supabase
        .from("user_badges" as any)
        .select("badge_id")
        .eq("user_id", userId);
      if (!ub || ub.length === 0) return;
      const badgeIds = (ub as any[]).map((r) => r.badge_id);
      const { data: b } = await supabase
        .from("badges" as any)
        .select("*")
        .in("id", badgeIds);
      setBadges((b as any[]) ?? []);
    };
    fetch();
  }, [userId]);

  if (badges.length === 0) return null;

  if (inline) {
    return badges.length > 0 ? (
      <div className="glass-tile p-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em] font-semibold mb-3 flex items-center gap-1.5">
          <Award size={14} className="text-primary" /> Badge
        </p>
        <div className="flex flex-wrap gap-2.5 fib-stagger">
          {badges.map((b) => (
            <div
              key={b.id}
              title={b.description || b.name}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <BadgeIcon iconUrl={b.icon_url} name={b.name} size={36} />
              <span className="text-xs font-semibold leading-tight max-w-[110px]">
                {b.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="glass-card p-5 mb-6">
      <h2 className="font-display text-xl flex items-center gap-2 mb-4">
        <Award size={20} className="text-primary" />
        Badge
      </h2>
      <div className="flex flex-wrap gap-3 fib-stagger">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.description || b.name}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 min-w-[84px]"
          >
            <BadgeIcon iconUrl={b.icon_url} name={b.name} size={48} />
            <span className="text-[11px] font-semibold leading-tight text-center max-w-[88px]">
              {b.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
