import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyRegistrationResponse } from "npm:@simplewebauthn/server@13";
import { corsHeaders, rpFromRequest } from "../_shared/webauthn.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsRes, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsRes.claims.sub as string;

    const body = await req.json();
    const { response, fingerprint, deviceName, deviceOs, userAgent, platform } = body || {};
    if (!response) return json({ error: "Missing response" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull the latest pending challenge for this user
    const { data: chRow } = await admin
      .from("passkey_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", userId)
      .eq("type", "register")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!chRow) return json({ error: "No active challenge" }, 400);

    const { rpID, origin } = rpFromRequest(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: chRow.challenge,
      expectedOrigin: [origin, "https://ibna.it", "https://www.ibna.it"].filter(Boolean),
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return json({ verified: false, error: "Verifica fallita" }, 400);
    }

    const { credential, credentialBackedUp, credentialDeviceType, aaguid } =
      verification.registrationInfo as any;

    // Insert credential — encode bytea as PostgreSQL hex literal (\x<hex>)
    // because PostgREST does not accept raw Uint8Array / JSON byte arrays.
    const credentialId: string = credential.id;
    const publicKey: Uint8Array = credential.publicKey;
    const publicKeyHex =
      "\\x" + Array.from(publicKey).map((b) => b.toString(16).padStart(2, "0")).join("");
    const counter: number = credential.counter ?? 0;
    const transports: string[] = credential.transports ?? response?.response?.transports ?? [];

    let keyAlreadyRegistered = false;
    const { error: insErr } = await admin.from("user_passkeys").insert({
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKeyHex, // bytea hex literal
      counter,
      transports,
      device_name: deviceName || null,
      device_os: deviceOs || null,
      device_fingerprint: fingerprint || null,
      aaguid: aaguid || null,
      backup_eligible: credentialDeviceType === "multiDevice",
      backup_state: !!credentialBackedUp,
      last_used_at: new Date().toISOString(),
    });
    if (insErr) {
      console.error("[passkey-register-verify] insert error:", insErr);
      if (insErr.code === "23505") {
        const { data: existingKey } = await admin
          .from("user_passkeys")
          .select("id, user_id, revoked_at")
          .eq("credential_id", credentialId)
          .maybeSingle();

        if (existingKey?.user_id === userId && !existingKey.revoked_at) {
          keyAlreadyRegistered = true;
          await admin
            .from("user_passkeys")
            .update({
              device_name: deviceName || null,
              device_os: deviceOs || null,
              device_fingerprint: fingerprint || null,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", existingKey.id);
        } else {
          return json({ verified: false, error: "Questa passkey è già associata a un altro account." }, 409);
        }
      } else {
        return json({ verified: false, error: insErr.message }, 400);
      }
    }

    // Upsert fingerprint claim
    if (fingerprint) {
      const { error: cleanupErr } = await admin.rpc("cleanup_expired_passkey_challenges");
      if (cleanupErr) {
        console.warn("[passkey-register-verify] cleanup warning:", cleanupErr.message);
      }
      const { data: fpRow } = await admin
        .from("device_fingerprints")
        .select("id, first_user_id, seen_user_ids")
        .eq("fingerprint_hash", fingerprint)
        .maybeSingle();

      if (!fpRow) {
        await admin.from("device_fingerprints").insert({
          fingerprint_hash: fingerprint,
          first_user_id: userId,
          seen_user_ids: [userId],
          user_agent: userAgent || null,
          platform: platform || null,
        });
      } else {
        const seen: string[] = fpRow.seen_user_ids || [];
        if (!seen.includes(userId)) seen.push(userId);
        await admin
          .from("device_fingerprints")
          .update({
            first_user_id: fpRow.first_user_id || userId,
            seen_user_ids: seen,
            last_seen_at: new Date().toISOString(),
            user_agent: userAgent || null,
            platform: platform || null,
          })
          .eq("id", fpRow.id);
      }
    }

    await admin.from("passkey_challenges").delete().eq("id", chRow.id);

    return json({ verified: true, alreadyRegistered: keyAlreadyRegistered || undefined });
  } catch (e: any) {
    console.error("[passkey-register-verify] fatal:", e?.message, e?.stack);
    return json({ verified: false, error: e?.message || "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
