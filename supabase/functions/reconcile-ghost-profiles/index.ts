import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const THRESHOLD = 0.80;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // SECURITY: Require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getUser(token);
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: claims.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dryRun ?? true;
    const minScore: number = typeof body.minScore === "number" ? body.minScore : THRESHOLD;

    // Use DB functions to get ghosts and real users (bypasses auth.users access issues)
    const [{ data: ghosts }, { data: realUsers }] = await Promise.all([
      supabase.rpc("get_ghost_profiles_with_results"),
      supabase.rpc("get_real_user_profiles"),
    ]);

    const activeGhosts = ghosts || [];
    const realLookup = (realUsers || []).map((u: any) => ({
      userId: u.user_id,
      username: (u.username || "").toLowerCase(),
      displayName: (u.display_name || "").toLowerCase(),
      originalName: u.display_name || u.username,
    }));

    // Find fuzzy matches
    const matches: {
      ghostId: string;
      ghostName: string;
      realUserId: string;
      realName: string;
      score: number;
    }[] = [];

    for (const ghost of activeGhosts) {
      const ghostLower = (ghost.display_name || ghost.username || "").toLowerCase();
      let bestScore = 0;
      let bestMatch: (typeof realLookup)[0] | null = null;

      for (const real of realLookup) {
        const s1 = similarity(ghostLower, real.username);
        const s2 = similarity(ghostLower, real.displayName);
        const score = Math.max(s1, s2);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = real;
        }
      }

      if (bestMatch && bestScore >= minScore) {
        matches.push({
          ghostId: ghost.user_id,
          ghostName: ghost.display_name || ghost.username || "",
          realUserId: bestMatch.userId,
          realName: bestMatch.originalName,
          score: Math.round(bestScore * 100),
        });
      }
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          mode: "dry_run",
          totalGhosts: activeGhosts.length,
          matchesFound: matches.length,
          matches: matches.sort((a, b) => b.score - a.score),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply matches
    let transferred = 0;
    const errors: string[] = [];

    for (const match of matches) {
      const { data: ghostTR } = await supabase
        .from("tournament_results")
        .select("id, tournament_id")
        .eq("user_id", match.ghostId);

      if (!ghostTR || ghostTR.length === 0) continue;

      const { data: realTR } = await supabase
        .from("tournament_results")
        .select("tournament_id")
        .eq("user_id", match.realUserId);

      const realTournamentIds = new Set((realTR || []).map((r: any) => r.tournament_id));
      const toTransfer = ghostTR.filter((r: any) => !realTournamentIds.has(r.tournament_id));

      if (toTransfer.length > 0) {
        const { error: updateErr } = await supabase
          .from("tournament_results")
          .update({ user_id: match.realUserId })
          .in("id", toTransfer.map((r: any) => r.id));

        if (updateErr) {
          errors.push(`${match.ghostName} → ${match.realName}: ${updateErr.message}`);
          continue;
        }
      }

      // Delete duplicate ghost results
      const duplicates = ghostTR.filter((r: any) => realTournamentIds.has(r.tournament_id));
      if (duplicates.length > 0) {
        await supabase
          .from("tournament_results")
          .delete()
          .in("id", duplicates.map((r: any) => r.id));
      }

      // Delete ghost profile
      await supabase.from("profiles").delete().eq("user_id", match.ghostId);
      transferred++;
    }

    // Recalculate rankings
    const { data: season } = await supabase
      .from("ranking_seasons")
      .select("bfl")
      .eq("is_active", true)
      .maybeSingle();

    await supabase.rpc("recalculate_all_rankings", { _bfl: season?.bfl ?? 10 });

    return new Response(
      JSON.stringify({ mode: "applied", transferred, errors, matchesAttempted: matches.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("reconcile-ghost-profiles fatal:", err);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
