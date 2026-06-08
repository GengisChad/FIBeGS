import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Upload, FileJson, CheckCircle, AlertTriangle } from "lucide-react";

const TournamentImportTab = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string>("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.tournament || !data.registrations) {
        toast({ title: "File non valido", description: "Il file deve contenere tournament e registrations", variant: "destructive" });
        return;
      }
      setImportData(data);
      setStatus("");
    } catch {
      toast({ title: "Errore nel parsing del file JSON", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!importData) return;
    setImporting(true);
    setStatus("Importazione torneo...");

    try {
      const t = importData.tournament;
      // Remove id to create new, or upsert with existing id
      const { data: existing } = await supabase.from("tournaments").select("id").eq("id", t.id).maybeSingle();

      if (existing) {
        // Tournament exists - update registrations, standings, matches, results
        setStatus("Torneo esistente trovato, aggiornamento dati...");

        // Clear existing data
        await Promise.all([
          supabase.from("tournament_results").delete().eq("tournament_id", t.id),
          supabase.from("tournament_matches").delete().eq("tournament_id", t.id),
          supabase.from("tournament_standings").delete().eq("tournament_id", t.id),
          supabase.from("tournament_registrations").delete().eq("tournament_id", t.id),
        ]);
      } else {
        // Create tournament
        setStatus("Creazione nuovo torneo...");
        const { error: tErr } = await supabase.from("tournaments").insert(t);
        if (tErr) throw new Error("Errore creazione torneo: " + tErr.message);
      }

      // Import registrations
      if (importData.registrations?.length > 0) {
        setStatus(`Importazione ${importData.registrations.length} iscrizioni...`);
        const { error } = await supabase.from("tournament_registrations").insert(
          importData.registrations.map((r: any) => ({ ...r, tournament_id: t.id }))
        );
        if (error) console.error("Reg import error:", error);
      }

      // Import standings
      if (importData.standings?.length > 0) {
        setStatus(`Importazione ${importData.standings.length} standings...`);
        const { error } = await supabase.from("tournament_standings").insert(
          importData.standings.map((s: any) => ({ ...s, tournament_id: t.id }))
        );
        if (error) console.error("Standings import error:", error);
      }

      // Import matches
      if (importData.matches?.length > 0) {
        setStatus(`Importazione ${importData.matches.length} match...`);
        // Insert in batches
        const batch = 100;
        for (let i = 0; i < importData.matches.length; i += batch) {
          const chunk = importData.matches.slice(i, i + batch).map((m: any) => ({ ...m, tournament_id: t.id }));
          await supabase.from("tournament_matches").insert(chunk);
        }
      }

      // Import results
      if (importData.results?.length > 0) {
        setStatus(`Importazione ${importData.results.length} risultati...`);
        const { error } = await supabase.from("tournament_results").insert(
          importData.results.map((r: any) => ({ ...r, tournament_id: t.id }))
        );
        if (error) console.error("Results import error:", error);
      }

      setStatus("Importazione completata!");
      toast({ title: "Torneo importato con successo!" });
    } catch (err: any) {
      setStatus("Errore: " + err.message);
      toast({ title: "Errore nell'importazione", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Upload size={20} /> Import Torneo Completo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Importa un torneo completo da un file JSON esportato, includendo iscritti, match, standings e risultati.
        </p>

        <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <FileJson size={16} className="mr-2" /> Seleziona file JSON
        </Button>

        {importData && (
          <div className="space-y-2 border rounded p-3 bg-secondary/30">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-primary" />
              <span className="text-sm font-medium">File caricato</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Torneo: <strong>{importData.tournament?.title}</strong></p>
              <p>Iscrizioni: {importData.registrations?.length || 0}</p>
              <p>Match: {importData.matches?.length || 0}</p>
              <p>Standings: {importData.standings?.length || 0}</p>
              <p>Risultati: {importData.results?.length || 0}</p>
              {importData.exported_at && <p>Esportato il: {new Date(importData.exported_at).toLocaleString("it")}</p>}
            </div>

            <Button onClick={handleImport} disabled={importing} className="mt-2">
              {importing ? "Importazione in corso..." : "Importa Torneo"}
            </Button>
          </div>
        )}

        {status && (
          <div className="flex items-center gap-2 text-sm">
            {importing ? <AlertTriangle size={14} className="text-warning animate-pulse" /> : <CheckCircle size={14} className="text-primary" />}
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TournamentImportTab;
