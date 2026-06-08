import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/webauthn.ts";

/**
 * Called at signup time to determine whether the current device is already
 * tied to another active IBNA account (i.e. an account with at least one
 * active passkey). Returns { blocked: boolean, reason?: string }.
 *
 * Side effect: increments signup_attempts and records the user_agent.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { fingerprint, userAgent, platform } = await req.json();
    if (!fingerprint) return json({ blocked: false });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: fpRow } = await admin
      .from("device_fingerprints")
      .select("id, first_user_id, seen_user_ids, blocked, signup_attempts")
      .eq("fingerprint_hash", fingerprint)
      .maybeSingle();

    if (!fpRow) {
      await admin.from("device_fingerprints").insert({
        fingerprint_hash: fingerprint,
        signup_attempts: 1,
        user_agent: userAgent || null,
        platform: platform || null,
      });
      return json({ blocked: false });
    }

    // Check whitelist
    let whitelistedUsers: string[] = [];
    if (fpRow.first_user_id) {
      const { data: wl } = await admin
        .from("device_fingerprint_whitelist")
        .select("user_id")
        .eq("fingerprint_hash", fingerprint);
      whitelistedUsers = (wl || []).map((r) => r.user_id as string);
    }

    // Determine block: existing fingerprint tied to a user who already has an
    // active passkey, and that user is NOT in the whitelist.
    let blocked = false;
    let reason: string | undefined;

    if (fpRow.first_user_id && !whitelistedUsers.includes(fpRow.first_user_id)) {
      const { data: hasPk } = await admin.rpc("user_has_active_passkey", {
        _user_id: fpRow.first_user_id,
      });
      if (hasPk === true) {
        blocked = true;
        reason =
          "Questo dispositivo è già associato a un altro account IBNA protetto da passkey. Accedi con quell'account o contatta lo staff per assistenza.";
      }
    }

    await admin
      .from("device_fingerprints")
      .update({
        signup_attempts: (fpRow.signup_attempts || 0) + 1,
        last_seen_at: new Date().toISOString(),
        user_agent: userAgent || null,
        platform: platform || null,
        blocked: blocked || fpRow.blocked,
      })
      .eq("id", fpRow.id);

    return json({ blocked, reason });
  } catch (e: any) {
    // Fail open: never block signup due to internal errors
    return json({ blocked: false, error: e?.message });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
