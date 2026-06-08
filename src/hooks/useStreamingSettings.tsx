import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StreamingSettings {
  tournament_id: string;
  enabled: boolean;
  highlighted_match_id: string | null;
  updated_at: string;
}

export function useStreamingSettings(tournamentId: string | undefined) {
  const [settings, setSettings] = useState<StreamingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!tournamentId) return;
    const { data } = await (supabase as any)
      .from("tournament_streaming_settings")
      .select("*")
      .eq("tournament_id", tournamentId)
      .maybeSingle();
    setSettings(
      data ?? {
        tournament_id: tournamentId,
        enabled: false,
        highlighted_match_id: null,
        updated_at: new Date().toISOString(),
      }
    );
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Realtime subscription so OBS overlay updates instantly
  useEffect(() => {
    if (!tournamentId) return;
    const ch = supabase
      .channel(`streaming-settings-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_streaming_settings",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload: any) => {
          if (payload.new) setSettings(payload.new as StreamingSettings);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  const update = useCallback(
    async (patch: Partial<Pick<StreamingSettings, "enabled" | "highlighted_match_id">>) => {
      if (!tournamentId) return;
      const next = {
        tournament_id: tournamentId,
        enabled: settings?.enabled ?? false,
        highlighted_match_id: settings?.highlighted_match_id ?? null,
        ...patch,
      };
      // Optimistic
      setSettings((prev) => ({ ...(prev ?? next), ...next } as StreamingSettings));
      const { error } = await (supabase as any)
        .from("tournament_streaming_settings")
        .upsert(next, { onConflict: "tournament_id" });
      if (error) {
        console.error("[streaming-settings] upsert error", error);
        fetchSettings();
      }
    },
    [tournamentId, settings, fetchSettings]
  );

  return { settings, loading, update };
}
