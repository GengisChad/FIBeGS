import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CloudUpload, ScanSearch, Database } from "lucide-react";
import { toast } from "sonner";

interface ReportRow {
  table: string;
  column: string;
  bucket?: string;
  found: number;
  migrated?: number;
  errors?: any[];
  error?: string;
}

export default function LegacyMigrationAdminTab() {
  const [busy, setBusy] = useState<"dry" | "run" | null>(null);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [lastDryRun, setLastDryRun] = useState<boolean | null>(null);

  const [progress, setProgress] = useState<string>("");

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? "dry" : "run");
    setReport(null);
    setProgress("");
    try {
      if (dryRun) {
        const { data, error } = await supabase.functions.invoke("migrate-legacy-assets", { body: { dryRun: true } });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setReport(((data as any)?.report ?? []) as ReportRow[]);
        setLastDryRun(true);
        toast.success("Scansione completata");
      } else {
        // Loop in small batches to stay under the 150s edge timeout
        const aggregate = new Map<string, ReportRow>();
        let pass = 0;
        while (true) {
          pass++;
          setProgress(`Batch #${pass} in corso…`);
          const { data, error } = await supabase.functions.invoke("migrate-legacy-assets", {
            body: { dryRun: false, batchSize: 5, concurrency: 3 },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          const rows = ((data as any)?.report ?? []) as ReportRow[];
          for (const r of rows) {
            const key = `${r.table}.${r.column}`;
            const prev = aggregate.get(key);
            aggregate.set(key, {
              ...r,
              migrated: (prev?.migrated ?? 0) + (r.migrated ?? 0),
              errors: [...(prev?.errors ?? []), ...(r.errors ?? [])].slice(0, 10),
            });
          }
          setReport(Array.from(aggregate.values()));
          setLastDryRun(false);
          const remaining = (data as any)?.totalRemaining ?? 0;
          if ((data as any)?.done || remaining === 0) {
            toast.success("Migrazione completata");
            break;
          }
          if (pass > 200) {
            toast.message(`Interrotto dopo ${pass} batch — riprova per continuare.`);
            break;
          }
        }
      }
    } catch (err: any) {
      toast.error(`Errore: ${err.message ?? err}`);
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const totalFound = report?.reduce((s, r) => s + (r.found ?? 0), 0) ?? 0;
  const totalMigrated = report?.reduce((s, r) => s + (r.migrated ?? 0), 0) ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database size={18} /> Migrazione asset legacy
        </CardTitle>
        <CardDescription>
          Sposta avatar, banner, loghi club e flyer torneo dal vecchio progetto Lovable
          (xbfwxwqnduwsvvxpdany) allo storage di questo Supabase e aggiorna i link nel database.
          Esegui prima una scansione (dry-run) per vedere quanti file verrebbero migrati.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run(true)} disabled={!!busy} variant="outline">
            {busy === "dry" ? <Loader2 className="animate-spin mr-2" size={14} /> : <ScanSearch size={14} className="mr-2" />}
            Scansiona (dry-run)
          </Button>
          <Button onClick={() => run(false)} disabled={!!busy}>
            {busy === "run" ? <Loader2 className="animate-spin mr-2" size={14} /> : <CloudUpload size={14} className="mr-2" />}
            Esegui migrazione
          </Button>
          {progress && <span className="text-xs text-muted-foreground self-center">{progress}</span>}
        </div>

        {report && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
              <span className="font-medium">
                {lastDryRun ? "Risultato scansione" : "Risultato migrazione"}
              </span>
              <span className="text-muted-foreground">
                {totalFound} trovati{!lastDryRun && ` · ${totalMigrated} migrati`}
              </span>
            </div>
            <div className="divide-y divide-border text-sm">
              {report.map((r, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">
                      {r.table}.{r.column}
                      {r.bucket && <span className="text-muted-foreground"> → {r.bucket}</span>}
                    </div>
                    {r.error && <div className="text-destructive text-xs">{r.error}</div>}
                    {!!r.errors?.length && (
                      <div className="text-destructive text-[11px]">
                        {r.errors.length} errori (es: {r.errors[0]?.err})
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {r.found} trovati{!lastDryRun && ` · ${r.migrated ?? 0} migrati`}
                  </div>
                </div>
              ))}
              {report.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Nessun riferimento al vecchio progetto trovato.
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          La migrazione è idempotente: i file già migrati vengono saltati. Esegui di nuovo
          dopo eventuali nuovi caricamenti se vuoi essere sicuro che nulla resti sul vecchio cloud.
        </p>
      </CardContent>
    </Card>
  );
}
