import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X, Repeat } from "lucide-react";

interface Result { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; }
interface Props {
  inviteId: string;
  onReplace: (inviteId: string, newUserId: string) => Promise<boolean>;
  excludeUserIds?: string[];
  compact?: boolean;
}

export const ReplaceInviteControl = ({ inviteId, onReplace, excludeUserIds = [], compact = false }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
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
      .sort((a, b) => a.s - b.s).slice(0, 10).map(x => x.p);
    setResults(ranked);
    setLoading(false);
  };

  const pick = async (p: Result) => {
    const ok = await onReplace(inviteId, p.user_id);
    if (ok) { setOpen(false); setQ(""); setResults([]); }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" className={`${compact ? "h-6 px-1.5 text-[10px]" : "h-7 px-2"} gap-1`} onClick={() => setOpen(true)}>
        <Repeat size={12} /> Sostituisci
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 border-t border-border/50 pt-2 mt-2">
      <div className="flex items-center gap-1">
        <Input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Cerca utente..." className="h-8 text-xs" />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={search} disabled={loading}>
          <Search size={12} />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setOpen(false); setResults([]); setQ(""); }}>
          <X size={12} />
        </Button>
      </div>
      {results.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {results.map(p => (
            <button key={p.user_id} onClick={() => pick(p)}
              className="w-full flex items-center gap-2 p-1 rounded hover:bg-muted text-left">
              <Avatar className="h-6 w-6"><AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback>{(p.display_name || p.username || "?")[0]}</AvatarFallback></Avatar>
              <span className="text-xs truncate">{p.display_name || p.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReplaceInviteControl;
