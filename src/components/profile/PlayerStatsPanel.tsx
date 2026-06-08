import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Trophy, Target, TrendingUp, Medal, Swords, Percent, Crown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  userId: string;
  isChild?: boolean;
  bflTournamentIds?: string[];
  bflPoints?: number;
}

interface Row {
  tournament_id: string;
  wins: number;
  losses: number;
  draws: number;
  placement: number | null;
  scaled_points: number;
  event_date: string;
  is_ranked: boolean;
  is_external: boolean;
  title: string;
}

const PlayerStatsPanel = ({ userId, isChild, bflTournamentIds, bflPoints }: Props) => {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const col = isChild ? "child_id" : "user_id";
      const [{ data: standings }, { data: results }] = await Promise.all([
        (supabase as any).from("tournament_standings").select("tournament_id, wins, losses, draws").eq(col, userId).limit(500),
        (supabase as any).from("tournament_results").select("tournament_id, placement, scaled_points").eq(col, userId).limit(500),
      ]);
      const rMap = new Map((results || []).map((r: any) => [r.tournament_id, r]));
      const sMap = new Map((standings || []).map((s: any) => [s.tournament_id, s]));
      const ids = Array.from(new Set([...(standings || []).map((s: any) => s.tournament_id), ...(results || []).map((r: any) => r.tournament_id)]));
      if (ids.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }
      const { data: tournaments } = await supabase
        .from("tournaments")
        .select("id, title, event_date, is_ranked, is_external")
        .in("id", ids);
      const merged: Row[] = (tournaments || []).map((t: any) => {
        const s: any = sMap.get(t.id) || {};
        const r: any = rMap.get(t.id) || {};
        return {
          tournament_id: t.id,
          title: t.title,
          event_date: t.event_date,
          is_ranked: !!t.is_ranked,
          is_external: !!t.is_external,
          wins: s.wins || 0,
          losses: s.losses || 0,
          draws: s.draws || 0,
          placement: r.placement ?? null,
          scaled_points: r.scaled_points || 0,
        };
      });
      merged.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
      if (!cancelled) setRows(merged);
    })();
    return () => { cancelled = true; };
  }, [userId, isChild]);

  const bflSet = useMemo(() => new Set(bflTournamentIds || []), [bflTournamentIds]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const totalT = rows.length;
    const totalW = rows.reduce((s, r) => s + r.wins, 0);
    const totalL = rows.reduce((s, r) => s + r.losses, 0);
    const totalD = rows.reduce((s, r) => s + r.draws, 0);
    const matches = totalW + totalL + totalD;
    const winRate = matches > 0 ? Math.round((totalW / matches) * 100) : 0;
    const podium = rows.filter((r) => r.placement != null && r.placement <= 3).length;
    const wins1st = rows.filter((r) => r.placement === 1).length;
    const computedBflPoints = rows
      .filter((r) => bflSet.has(r.tournament_id))
      .reduce((s, r) => s + r.scaled_points, 0);
    const displayBflPoints = bflPoints != null ? bflPoints : computedBflPoints;
    const bestPlacement = rows.reduce<number | null>((b, r) => {
      if (r.placement == null) return b;
      return b == null ? r.placement : Math.min(b, r.placement);
    }, null);
    const avgPlacement = (() => {
      const placed = rows.filter((r) => r.placement != null);
      if (placed.length === 0) return null;
      return placed.reduce((s, r) => s + (r.placement || 0), 0) / placed.length;
    })();

    // Cumulative points curve: only tournaments counted in BFL (capped)
    let cum = 0;
    const pointsCurve = rows
      .filter((r) => bflSet.has(r.tournament_id))
      .map((r) => {
        cum += r.scaled_points;
        return {
          date: new Date(r.event_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
          points: cum,
          delta: r.scaled_points,
          title: r.title,
        };
      });

    // Placement distribution
    const buckets = [
      { label: "1°", min: 1, max: 1, color: "hsl(45 95% 55%)" },
      { label: "2°", min: 2, max: 2, color: "hsl(0 0% 75%)" },
      { label: "3°", min: 3, max: 3, color: "hsl(28 80% 50%)" },
      { label: "4°-8°", min: 4, max: 8, color: "hsl(var(--primary))" },
      { label: "9°+", min: 9, max: 9999, color: "hsl(var(--muted-foreground))" },
    ];
    const placementDist = buckets.map((b) => ({
      label: b.label,
      count: rows.filter((r) => r.placement != null && r.placement >= b.min && r.placement <= b.max).length,
      color: b.color,
    }));

    // Match outcome distribution for bar
    const outcomeDist = [
      { label: "Vittorie", count: totalW, color: "hsl(142 70% 45%)" },
      { label: "Pareggi", count: totalD, color: "hsl(45 90% 55%)" },
      { label: "Sconfitte", count: totalL, color: "hsl(0 75% 55%)" },
    ];

    return {
      totalT, totalW, totalL, totalD, matches, winRate, podium, wins1st,
      bflPoints: displayBflPoints, bestPlacement, avgPlacement, pointsCurve, placementDist, outcomeDist,
    };
  }, [rows, bflSet, bflPoints]);

  if (rows == null) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
        <p className="text-sm text-muted-foreground">Caricamento statistiche...</p>
      </div>
    );
  }

  if (rows.length === 0) return null;

  const s = stats!;

  const StatBox = ({ icon: Icon, label, value, sub }: any) => (
    <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-wide">
        <Icon size={12} /> {label}
      </div>
      <p className="font-display text-xl mt-1 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-6 mb-6">
      <h2 className="font-display text-lg mb-4 flex items-center gap-2">
        <BarChart3 size={18} className="text-primary" /> Statistiche giocatore
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <StatBox icon={Trophy} label="Tornei" value={s.totalT} />
        <StatBox icon={Swords} label="Match" value={s.matches} sub={`${s.totalW}V · ${s.totalD}P · ${s.totalL}S`} />
        <StatBox icon={Percent} label="Win rate" value={`${s.winRate}%`} sub={`${s.totalW}/${s.matches || 0}`} />
        <StatBox icon={Medal} label="Podi" value={s.podium} sub={`${s.wins1st}× 1° posto`} />
        <StatBox icon={Crown} label="Miglior pos." value={s.bestPlacement ?? "—"} />
        <StatBox icon={Target} label="Pos. media" value={s.avgPlacement != null ? s.avgPlacement.toFixed(1) : "—"} />
        <StatBox icon={TrendingUp} label="Vittorie tornei" value={s.wins1st} />
        <StatBox icon={Trophy} label="Punti BFL" value={s.bflPoints} sub="conteggiati nel BFL" />
      </div>

      <Tabs defaultValue="curve" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="curve">Curva punti</TabsTrigger>
          <TabsTrigger value="placements">Piazzamenti</TabsTrigger>
          <TabsTrigger value="matches">Match</TabsTrigger>
        </TabsList>

        <TabsContent value="curve" className="mt-4">
          {s.pointsCurve.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessun torneo ranked.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.pointsCurve} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(val: any, _name: any, p: any) => [`${val} pt (+${p.payload.delta})`, p.payload.title]}
                  />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>

        <TabsContent value="placements" className="mt-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.placementDist} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {s.placementDist.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.outcomeDist} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {s.outcomeDist.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerStatsPanel;
