import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CityCombobox } from "@/components/CityCombobox";
import { Users, Search, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TeamRow = {
  id: string; name: string; logo_url: string | null; city: string | null;
  description: string | null; region_id: string | null;
  member_count?: number;
};
type Region = { id: string; name: string };
type SortMode = "members" | "recent";

interface Props { scrollClassName?: string; }

export const FindTeamPanel = ({ scrollClassName = "h-[60vh]" }: Props) => {
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("members");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionNames, setRegionNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("regions").select("id, name").order("name").then(({ data }) => {
      const list = (data || []) as Region[];
      setRegions(list);
      const map: Record<string, string> = {};
      list.forEach(r => { map[r.id] = r.name; });
      setRegionNames(map);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    let req = (supabase as any).from("teams")
      .select("id, name, logo_url, city, description, region_id, created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    const q = query.trim();
    if (q) req = req.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
    if (regionId) req = req.eq("region_id", regionId);
    if (city.trim()) req = req.ilike("city", `%${city.trim()}%`);

    const { data } = await req;
    const list = (data || []) as TeamRow[];
    if (list.length > 0) {
      const ids = list.map(t => t.id);
      const { data: mems } = await (supabase as any).from("team_members").select("team_id").in("team_id", ids);
      const counts: Record<string, number> = {};
      (mems || []).forEach((m: any) => { counts[m.team_id] = (counts[m.team_id] || 0) + 1; });
      list.forEach(t => t.member_count = counts[t.id] || 0);
    }
    if (sort === "members") list.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    setTeams(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [regionId, city, sort]);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-2 shrink-0">
        <div className="flex gap-2">
          <Input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
            placeholder="Cerca per nome o città..." className="flex-1" />
          <button className="px-3 rounded-md bg-primary text-primary-foreground" onClick={load}>
            <Search size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            value={regionId} onChange={e => { setRegionId(e.target.value); setCity(""); }}>
            <option value="">Tutte le regioni</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <CityCombobox value={city} onChange={setCity} regionId={regionId || undefined} placeholder="Filtra per città..." />

          <select
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            value={sort} onChange={e => setSort(e.target.value as SortMode)}>
            <option value="members">Più membri</option>
            <option value="recent">Più recenti</option>
          </select>
        </div>
      </div>

      <ScrollArea className={`${scrollClassName} mt-3 -mx-2`}>
        <div className="px-2 space-y-2 pb-2">
          {loading && <div className="text-xs text-muted-foreground text-center py-6">Caricamento...</div>}
          {!loading && teams.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Nessuna squadra trovata.</div>}
          {teams.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors">
              <Avatar className="h-12 w-12">
                <AvatarImage src={t.logo_url || undefined} />
                <AvatarFallback><Users size={16} /></AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{t.member_count || 0}/3</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                  {t.city && <span className="flex items-center gap-0.5"><MapPin size={10} />{t.city}</span>}
                  {t.region_id && regionNames[t.region_id] && <span>· {regionNames[t.region_id]}</span>}
                </div>
                {t.description && <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{t.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <p className="text-[11px] text-muted-foreground pt-2 shrink-0">
        Per entrare in una squadra devi essere invitato dal proprietario. Max 3 giocatori per squadra.
      </p>
    </div>
  );
};

export default FindTeamPanel;
