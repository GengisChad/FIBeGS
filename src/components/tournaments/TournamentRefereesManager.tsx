import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, X, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface RefereeRow {
  id: string;
  user_id: string;
  source: "club_staff" | "manual";
  profile: Profile | null;
}

interface Props {
  tournamentId: string;
  clubId: string | null;
  canManage: boolean;
}

export const TournamentRefereesManager = ({ tournamentId, clubId, canManage }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<RefereeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    // Club staff (auto-included)
    let staffRows: RefereeRow[] = [];
    if (clubId) {
      const { data: staff } = await supabase
        .from("club_members")
        .select("user_id, role")
        .eq("club_id", clubId)
        .in("role", ["leader", "vice_leader", "staff"]);
      const staffIds = (staff || []).map((s: any) => s.user_id);
      if (staffIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", staffIds);
        staffRows = staffIds.map((uid) => ({
          id: `staff-${uid}`,
          user_id: uid,
          source: "club_staff" as const,
          profile: ((profs || []) as Profile[]).find((p) => p.user_id === uid) || null,
        }));
      }
    }

    // Manual referees
    const { data: refs } = await supabase
      .from("tournament_referees")
      .select("id, user_id")
      .eq("tournament_id", tournamentId);
    const refIds = (refs || []).map((r: any) => r.user_id);
    let manualRows: RefereeRow[] = [];
    if (refIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", refIds);
      manualRows = (refs || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        source: "manual" as const,
        profile: ((profs || []) as Profile[]).find((p) => p.user_id === r.user_id) || null,
      }));
    }

    // Merge: club staff first, then manual that aren't already staff
    const staffSet = new Set(staffRows.map((r) => r.user_id));
    const filteredManual = manualRows.filter((r) => !staffSet.has(r.user_id));
    setRows([...staffRows, ...filteredManual]);
    setLoading(false);
  }, [tournamentId, clubId]);

  useEffect(() => { load(); }, [load]);

  const search = async () => {
    if (!q.trim() || !user) { setResults([]); return; }
    setSearching(true);
    const safe = q.trim().replace(/[(),]/g, " ");
    const { data } = await supabase.from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
      .limit(20);
    const taken = new Set(rows.map((r) => r.user_id));
    setResults(((data || []) as Profile[]).filter((p) => !taken.has(p.user_id)).slice(0, 8));
    setSearching(false);
  };

  const addReferee = async (p: Profile) => {
    const { error } = await supabase.from("tournament_referees").insert({
      tournament_id: tournamentId,
      user_id: p.user_id,
      added_by: user?.id ?? null,
    });
    if (error) {
      toast.error("Impossibile aggiungere l'arbitro: " + error.message);
      return;
    }
    toast.success("Arbitro aggiunto");
    setQ(""); setResults([]);
    load();
  };

  const removeReferee = async (row: RefereeRow) => {
    if (row.source !== "manual") return;
    const { error } = await supabase.from("tournament_referees").delete().eq("id", row.id);
    if (error) {
      toast.error("Impossibile rimuovere: " + error.message);
      return;
    }
    toast.success("Arbitro rimosso");
    load();
  };

  const renderProfile = (p: Profile | null, fallbackId: string) => {
    const name = p?.display_name || p?.username || fallbackId.slice(0, 8);
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={p?.avatar_url || undefined} />
          <AvatarFallback>{(name[0] || "?").toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
          {p?.username && <div className="text-xs text-muted-foreground truncate">@{p.username}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Shield className="text-primary mt-0.5" size={18} />
        <div className="text-xs text-muted-foreground">
          Gli arbitri autorizzati possono inserire i risultati dei match di questo torneo (in base al criterio di scoring scelto).
          Lo staff del club organizzatore è incluso automaticamente.
        </div>
      </div>

      {canManage && (
        <Card className="p-3 border-dashed">
          <div className="text-xs uppercase font-bold tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
            <UserPlus size={14} className="text-primary" /> Aggiungi arbitro
          </div>
          <div className="flex items-center gap-1 mb-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
              placeholder="Cerca utente per nome o username..."
              className="h-9 text-sm"
            />
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={search} disabled={searching}>
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="space-y-1 max-h-56 overflow-y-auto border rounded p-1 bg-background">
              {results.map((p) => (
                <button key={p.user_id} onClick={() => addReferee(p)}
                  className="w-full flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted text-left">
                  {renderProfile(p, p.user_id)}
                  <UserPlus size={14} className="text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div>
        <div className="text-xs uppercase font-bold tracking-wide text-muted-foreground mb-2">
          Arbitri autorizzati ({rows.length})
        </div>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin" size={18} /></div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-4">
            Nessun arbitro autorizzato.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="p-2 flex items-center justify-between gap-2">
                {renderProfile(r.profile, r.user_id)}
                <div className="flex items-center gap-2 shrink-0">
                  {r.source === "club_staff" ? (
                    <Badge variant="secondary" className="text-[10px]">Staff Club</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Arbitro</Badge>
                  )}
                  {canManage && r.source === "manual" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeReferee(r)}>
                      <X size={14} />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
