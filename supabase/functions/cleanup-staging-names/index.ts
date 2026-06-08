// Pulizia una tantum dei nomi "{username}'s party" nei tornei staging già importati.
// Aggiorna participants, standings e matches in tutti gli imported_tournaments_staging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cleanName = (raw: any): string | null => {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[\u2018\u2019\u02BC\u201B]/g, "'");
  // Strip trailing "'s party", "' party", "'s team" etc. — handles names ending in s ("Ravakus' party")
  s = s.replace(/['']s?\s+(party|team|squad|lineup|roster)\s*$/i, "").trim();
  // Also strip leftover dangling apostrophe at the end (e.g. "mancius'")
  s = s.replace(/['']\s*$/g, "").trim();
  return s || null;
};

const cleanArray = (arr: any[], keys: string[]): { changed: boolean; out: any[] } => {
  let changed = false;
  const out = (arr || []).map((item) => {
    if (!item || typeof item !== "object") return item;
    const next = { ...item };
    for (const k of keys) {
      const v = next[k];
      if (typeof v === "string") {
        const cleaned = cleanName(v);
        if (cleaned !== v) {
          next[k] = cleaned;
          changed = true;
        }
      }
    }
    return next;
  });
  return { changed, out };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verifica admin via JWT
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Solo admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole);
    const { data: rows, error } = await admin
      .from("imported_tournaments_staging")
      .select("id, participants, standings, matches");

    if (error) throw error;

    let updated = 0;
    const stats = { participants: 0, standings: 0, matches: 0 };

    for (const row of rows || []) {
      const p = cleanArray(row.participants || [], ["externalName"]);
      const s = cleanArray(row.standings || [], ["externalName", "matchedDisplayName"]);
      const m = cleanArray(row.matches || [], [
        "team1Name", "team2Name", "winnerName", "player1", "player2",
      ]);

      if (p.changed || s.changed || m.changed) {
        const { error: upErr } = await admin
          .from("imported_tournaments_staging")
          .update({
            participants: p.out,
            standings: s.out,
            matches: m.out,
          })
          .eq("id", row.id);
        if (!upErr) {
          updated++;
          if (p.changed) stats.participants++;
          if (s.changed) stats.standings++;
          if (m.changed) stats.matches++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: rows?.length || 0,
        updated,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
