import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award } from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
}

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
      <div className="bg-secondary/40 rounded-xl p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Award size={14} className="text-primary" /> Badge
        </p>
        <div className="flex flex-wrap gap-3">
          {badges.map((b) => (
            <div
              key={b.id}
              title={b.description || b.name}
              className="flex flex-col items-center gap-1.5 min-w-[64px]"
            >
              {b.icon_url ? (
                <img src={b.icon_url} alt={b.name} className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                  {b.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center max-w-[72px]">
                {b.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mb-6">
      <h2 className="font-display text-lg flex items-center gap-2 mb-4">
        <Award size={18} className="text-primary" />
        Badge
      </h2>
      <div className="flex flex-wrap gap-4">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.description || b.name}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-colors min-w-[72px]"
          >
            {b.icon_url ? (
              <img src={b.icon_url} alt={b.name} className="w-12 h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                {b.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-[11px] font-medium text-muted-foreground leading-tight text-center max-w-[80px]">
              {b.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
