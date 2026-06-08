import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  tournamentId: string;
  tournamentTitle: string;
  onImportComplete?: () => void;
}

export const TournamentBackup = ({ tournamentId, tournamentTitle, onImportComplete }: Props) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch all tournament-related data in parallel
      const [
        { data: matches },
        { data: standings },
        { data: results },
        { data: registrations },
        { data: tournament },
      ] = await Promise.all([
        supabase.from("tournament_matches").select("*").eq("tournament_id", tournamentId),
        supabase.from("tournament_standings").select("*").eq("tournament_id", tournamentId),
        supabase.from("tournament_results").select("*").eq("tournament_id", tournamentId),
        supabase.from("tournament_registrations").select("*").eq("tournament_id", tournamentId),
        supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      ]);

      // Fetch profile names for readability
      const allUserIds = new Set<string>();
      matches?.forEach(m => { if (m.player1_id) allUserIds.add(m.player1_id); if (m.player2_id) allUserIds.add(m.player2_id); });
      standings?.forEach(s => allUserIds.add(s.user_id));
      registrations?.forEach(r => allUserIds.add(r.user_id));

      const userIdsArr = [...allUserIds];
      let profilesMap: Record<string, string> = {};
      if (userIdsArr.length > 0) {
        // Fetch in chunks of 50
        for (let i = 0; i < userIdsArr.length; i += 50) {
          const chunk = userIdsArr.slice(i, i + 50);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, display_name")
            .in("user_id", chunk);
          profiles?.forEach(p => {
            profilesMap[p.user_id] = p.username || p.display_name || p.user_id;
          });
        }
      }

      const backup = {
        _meta: {
          version: 1,
          exported_at: new Date().toISOString(),
          tournament_id: tournamentId,
          tournament_title: tournamentTitle,
        },
        tournament: tournament,
        matches: matches ?? [],
        standings: standings ?? [],
        results: results ?? [],
        registrations: registrations ?? [],
        profiles_map: profilesMap,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${tournamentTitle.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup esportato con successo");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Errore durante l'esportazione");
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmImport(true);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setConfirmImport(false);
    try {
      const text = await pendingFile.text();
      const backup = JSON.parse(text);

      if (!backup._meta?.version || !backup.matches) {
        toast.error("File di backup non valido");
        return;
      }

      // 1. Delete existing data in order (results -> standings -> matches)
      await supabase.from("tournament_results").delete().eq("tournament_id", tournamentId);
      await supabase.from("tournament_standings").delete().eq("tournament_id", tournamentId);
      await supabase.from("tournament_matches").delete().eq("tournament_id", tournamentId);

      // 2. Restore tournament status
      if (backup.tournament) {
        const { id: _id, created_at: _ca, ...updateFields } = backup.tournament;
        await supabase.from("tournaments").update({
          status: updateFields.status,
          format: updateFields.format,
          top_cut_size: updateFields.top_cut_size,
          swiss_rounds: updateFields.swiss_rounds,
          groups_count: updateFields.groups_count,
        }).eq("id", tournamentId);
      }

      // 3. Restore standings
      if (backup.standings?.length > 0) {
        const standingsToInsert = backup.standings.map((s: any) => ({
          ...s,
          tournament_id: tournamentId,
        }));
        // Remove id to let DB generate new ones
        const cleaned = standingsToInsert.map(({ id: _id, ...rest }: any) => rest);
        const { error: sErr } = await supabase.from("tournament_standings").insert(cleaned);
        if (sErr) console.error("Standings restore error:", sErr);
      }

      // 4. Restore matches
      if (backup.matches?.length > 0) {
        const matchesToInsert = backup.matches.map(({ id: _id, ...rest }: any) => ({
          ...rest,
          tournament_id: tournamentId,
        }));
        const { error: mErr } = await supabase.from("tournament_matches").insert(matchesToInsert);
        if (mErr) console.error("Matches restore error:", mErr);
      }

      // 5. Restore results
      if (backup.results?.length > 0) {
        const resultsToInsert = backup.results.map(({ id: _id, ...rest }: any) => ({
          ...rest,
          tournament_id: tournamentId,
        }));
        const { error: rErr } = await supabase.from("tournament_results").insert(resultsToInsert);
        if (rErr) console.error("Results restore error:", rErr);
      }

      toast.success("Backup importato con successo! Ricarica la pagina.");
      onImportComplete?.();
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Errore durante l'importazione del backup");
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={exporting}>
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Backup
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
      >
        {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Ripristina
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma importazione backup</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione sovrascriverà tutti i match, classifiche e risultati attuali del torneo con i dati del backup. L'operazione non è reversibile. Continuare?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>Importa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
