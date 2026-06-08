import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await userClient.auth.getUser();
    console.error("auth getUser error:", error, "authHeader:", authHeader);

    const user = data?.user;
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body safely
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tournament_id, names } = body;

    if (!tournament_id || !names || !Array.isArray(names) || names.length === 0) {
      return new Response(JSON.stringify({ error: "Dati mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tournament info
    const { data: tournament, error: tErr } = await supabaseAdmin
      .from("tournaments")
      .select("id, is_ranked, club_id, max_participants")
      .eq("id", tournament_id)
      .single();

    if (tErr || !tournament) {
      return new Response(JSON.stringify({ error: "Torneo non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tournament.is_ranked) {
      return new Response(
        JSON.stringify({ error: "Non disponibile per tornei Ranked" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check authorization: admin or club staff
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    let isStaff = false;
    if (tournament.club_id) {
      const { data: staffCheck } = await supabaseAdmin.rpc("is_club_staff", {
        _user_id: user.id,
        _club_id: tournament.club_id,
      });
      isStaff = !!staffCheck;
    }

    if (!isAdmin && !isStaff) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current registration count
    const { count: currentCount } = await supabaseAdmin
      .from("tournament_registrations")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournament_id)
      .eq("status", "confirmed");

    const spotsLeft = tournament.max_participants - (currentCount || 0);
    const namesToAdd = names.slice(0, Math.max(0, spotsLeft));

    if (namesToAdd.length === 0) {
      return new Response(JSON.stringify({ error: "Torneo pieno", added: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let added = 0;
    const addedProfiles: Array<{ user_id: string; display_name: string }> = [];

    for (const name of namesToAdd) {
      const trimmed = String(name).trim();
      if (!trimmed || trimmed.length > 50) continue;

      // Guests are TEMPORARY: always create a new profile, no reuse.
      // The DB trigger will auto-delete the profile when the registration is removed
      // or when the tournament is cleaned up via cleanup_tournament_guests().
      const fakeUserId = crypto.randomUUID();

      const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
        user_id: fakeUserId,
        display_name: `[Guest] ${trimmed}`,
        username: null,
      });

      if (profileErr) {
        console.error("Profile insert error:", profileErr);
        continue;
      }

      const { error: regErr } = await supabaseAdmin
        .from("tournament_registrations")
        .insert({
          tournament_id,
          user_id: fakeUserId,
          status: "confirmed",
        });

      if (regErr) {
        console.error("Registration insert error:", regErr);
        // Clean up the orphan profile
        await supabaseAdmin.from("profiles").delete().eq("user_id", fakeUserId);
        continue;
      }

      added++;
      addedProfiles.push({ user_id: fakeUserId, display_name: `[Guest] ${trimmed}` });
    }

    return new Response(JSON.stringify({ added, added_profiles: addedProfiles }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("add-fictional-players fatal:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
