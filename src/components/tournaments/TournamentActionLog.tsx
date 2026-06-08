import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText } from "lucide-react";

interface Props {
  tournamentId: string;
}

export const TournamentActionLog = ({ tournamentId }: Props) => {
  const [actionLog, setActionLog] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tournaments").select("action_log").eq("id", tournamentId).single();
      if (data && (data as any).action_log) setActionLog((data as any).action_log);
    })();
  }, [tournamentId]);

  const lines = actionLog ? actionLog.split("\n").reverse() : [];

  return (
    <div className="bg-card rounded-2xl border border-border p-3 sm:p-6">
      <h3 className="font-display text-xl mb-4 flex items-center gap-2">
        <ScrollText size={20} /> Log Azioni
      </h3>
      {lines.length > 0 ? (
        <div className="bg-muted/50 rounded-lg border border-border p-3 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            {lines.map((line, i) => (
              <p key={i} className="text-xs font-mono text-muted-foreground leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Nessuna azione registrata.</p>
      )}
    </div>
  );
};
