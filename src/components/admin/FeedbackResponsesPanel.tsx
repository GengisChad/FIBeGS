import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FeedbackResponsesDialog } from "@/components/feedback/FeedbackResponsesDialog";
import { FeedbackScope } from "@/hooks/useFeedbackTemplate";

export const FeedbackResponsesPanel = () => {
  const [scope, setScope] = useState<"all" | FeedbackScope>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [openTarget, setOpenTarget] = useState<{ scope: FeedbackScope; id: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("event_feedback_responses" as any)
        .select("id, user_id, target_type, target_id, answers, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (scope !== "all") q = q.eq("target_type", scope);
      const { data } = await q;
      const list = (data ?? []) as any[];
      setRows(list);

      const uids = Array.from(new Set(list.map((r) => r.user_id)));
      if (uids.length) {
        const { data: ps } = await supabase
          .from("profiles").select("user_id, display_name, username").in("user_id", uids);
        const pm: Record<string, any> = {};
        (ps ?? []).forEach((p: any) => { pm[p.user_id] = p; });
        setProfiles(pm);
      }

      const byType: Record<string, string[]> = {};
      list.forEach((r) => { (byType[r.target_type] ??= []).push(r.target_id); });
      const tmap: Record<string, string> = {};
      const tournIds = [...(byType.tournament ?? []), ...(byType.event ?? [])];
      if (tournIds.length) {
        const { data } = await supabase.from("tournaments").select("id, title, event_type").in("id", Array.from(new Set(tournIds)));
        (data ?? []).forEach((t: any) => {
          const key = (t.event_type === "event") ? "event" : "tournament";
          tmap[`${key}:${t.id}`] = t.title;
        });
      }
      if (byType.championship?.length) {
        const { data } = await supabase.from("championships").select("id, name").in("id", Array.from(new Set(byType.championship)));
        (data ?? []).forEach((t: any) => { tmap[`championship:${t.id}`] = t.name; });
      }
      setTargets(tmap);
      setLoading(false);
    })();
  }, [scope]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => {
      const p = profiles[r.user_id];
      const tname = targets[`${r.target_type}:${r.target_id}`] ?? "";
      return (p?.display_name ?? "").toLowerCase().includes(s)
        || (p?.username ?? "").toLowerCase().includes(s)
        || tname.toLowerCase().includes(s);
    });
  }, [rows, search, profiles, targets]);

  const exportCsv = () => {
    const header = ["Data", "Utente", "Tipo", "Evento", "Risposte"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const p = profiles[r.user_id];
      const tname = targets[`${r.target_type}:${r.target_id}`] ?? r.target_id;
      const ans = JSON.stringify(r.answers ?? {}).replace(/"/g, '""');
      lines.push([
        new Date(r.submitted_at).toISOString(),
        `"${(p?.display_name ?? p?.username ?? r.user_id).replace(/"/g, '""')}"`,
        r.target_type,
        `"${tname.replace(/"/g, '""')}"`,
        `"${ans}"`,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `feedback_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Risposte questionari ({filtered.length})</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Cerca..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-[180px]" />
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="tournament">Tornei</SelectItem>
                <SelectItem value="event">Eventi</SelectItem>
                <SelectItem value="championship">Campionati</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
              <Download size={14} /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna risposta.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Utente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const p = profiles[r.user_id];
                const tname = targets[`${r.target_type}:${r.target_id}`] ?? r.target_id.slice(0, 8);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.submitted_at).toLocaleString("it-IT")}</TableCell>
                    <TableCell>{p?.display_name ?? p?.username ?? r.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs uppercase">{r.target_type}</TableCell>
                    <TableCell className="text-xs">{tname}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setOpenTarget({ scope: r.target_type, id: r.target_id })}>
                        <Eye size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {openTarget && (
          <FeedbackResponsesDialog
            open={!!openTarget}
            onOpenChange={(v) => !v && setOpenTarget(null)}
            scope={openTarget.scope}
            targetId={openTarget.id}
          />
        )}
      </CardContent>
    </Card>
  );
};
