import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, Users } from "lucide-react";

interface Result { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; }

interface Props {
  excludeUserIds?: string[];
  onInvite: (userId: string) => Promise<boolean>;
}

export const InviteSearchCard = ({ excludeUserIds = [], onInvite }: Props) => {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!q.trim() || !user) { setResults([]); return; }
    setLoading(true);
    const safe = q.trim().replace(/[(),]/g, " ");
    const { data } = await supabase.from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
      .neq("user_id", user.id)
      .limit(50);
    const lower = q.trim().toLowerCase();
    const excluded = new Set([user.id, ...excludeUserIds]);
    const unique = Array.from(new Map(((data || []) as Result[]).map(p => [p.user_id, p])).values())
      .filter(p => !excluded.has(p.user_id));
    const ranked = unique
      .map(p => {
        const u = (p.username || "").toLowerCase();
        const d = (p.display_name || "").toLowerCase();
        let s = 99;
        if (u === lower || d === lower) s = 0;
        else if (u.startsWith(lower) || d.startsWith(lower)) s = 1;
        else if (u.includes(lower) || d.includes(lower)) s = 2;
        return { p, s };
      })
      .sort((a, b) => a.s - b.s).slice(0, 8).map(x => x.p);
    setResults(ranked);
    setLoading(false);
  };

  const pick = async (p: Result) => {
    const ok = await onInvite(p.user_id);
    if (ok) { setQ(""); setResults([]); }
  };

  return (
    <Card className="p-4 border-dashed bg-muted/30 flex flex-col">
      <div className="flex items-center gap-2 mb-3 text-xs uppercase font-bold tracking-wide text-muted-foreground">
        <Users size={14} className="text-primary" /> Posto libero
      </div>
      <div className="flex items-center gap-1 mb-2">
        <Input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Cerca utente..." className="h-8 text-xs" />
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={search} disabled={loading}>
          <Search size={14} />
        </Button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto max-h-40">
        {results.length === 0 && (
          <div className="text-[11px] text-muted-foreground italic text-center py-3">
            Cerca un giocatore per invitarlo nel team.
          </div>
        )}
        {results.map(p => (
          <button key={p.user_id} onClick={() => pick(p)}
            className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left">
            <Avatar className="h-7 w-7"><AvatarImage src={p.avatar_url || undefined} />
              <AvatarFallback>{(p.display_name || p.username || "?")[0]}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{p.display_name || p.username}</div>
              {p.username && <div className="text-[10px] text-muted-foreground truncate">@{p.username}</div>}
            </div>
            <UserPlus size={12} className="text-primary shrink-0" />
          </button>
        ))}
      </div>
    </Card>
  );
};

export default InviteSearchCard;
