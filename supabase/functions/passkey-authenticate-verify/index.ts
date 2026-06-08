import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyAuthenticationResponse } from "npm:@simplewebauthn/server@13";
import { corsHeaders, rpFromRequest } from "../_shared/webauthn.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { response, fingerprint } = body || {};
    if (!response?.id) return json({ verified: false, error: "Missing response" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up credential
    const { data: cred } = await admin
      .from("user_passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports, revoked_at")
      .eq("credential_id", response.id)
      .maybeSingle();

    if (!cred || cred.revoked_at) {
      return json({ verified: false, error: "Passkey non riconosciuta" }, 400);
    }

    // Latest challenge — either targeted to this user or anonymous
    const { data: chRow } = await admin
      .from("passkey_challenges")
      .select("id, challenge, user_id, expires_at")
      .eq("type", "authenticate")
      .gt("expires_at", new Date().toISOString())
      .or(`user_id.eq.${cred.user_id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!chRow) return json({ verified: false, error: "Challenge scaduta" }, 400);

    const { rpID, origin } = rpFromRequest(req);

    // public_key comes back as base64 or \x hex from postgres. We stored bytea — supabase-js returns a base64 string for bytea.
    const pkRaw = cred.public_key as any;
    let publicKey: Uint8Array;
    if (typeof pkRaw === "string") {
      // supabase-js returns "\\x..." for bytea
      if (pkRaw.startsWith("\\x")) {
        const hex = pkRaw.slice(2);
        publicKey = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      } else {
        // base64
        const bin = atob(pkRaw);
        publicKey = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) publicKey[i] = bin.charCodeAt(i);
      }
    } else {
      publicKey = new Uint8Array(pkRaw);
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: chRow.challenge,
      expectedOrigin: [origin, "https://ibna.it", "https://www.ibna.it"].filter(Boolean),
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey,
        counter: Number(cred.counter),
        transports: (cred.transports as any) || undefined,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return json({ verified: false, error: "Verifica fallita" }, 400);
    }

    await admin
      .from("user_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", cred.id);

    await admin.from("passkey_challenges").delete().eq("id", chRow.id);

    // Track fingerprint usage
    if (fingerprint) {
      const { data: fpRow } = await admin
        .from("device_fingerprints")
        .select("id, seen_user_ids")
        .eq("fingerprint_hash", fingerprint)
        .maybeSingle();
      if (fpRow) {
        const seen: string[] = fpRow.seen_user_ids || [];
        if (!seen.includes(cred.user_id)) seen.push(cred.user_id);
        await admin
          .from("device_fingerprints")
          .update({ seen_user_ids: seen, last_seen_at: new Date().toISOString() })
          .eq("id", fpRow.id);
      }
    }

    // Get user email then issue a magiclink token hash
    const { data: userData } = await admin.auth.admin.getUserById(cred.user_id);
    const email = userData?.user?.email;
    if (!email) return json({ verified: false, error: "Utente senza email" }, 500);

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      return json({ verified: false, error: linkErr?.message || "Impossibile generare sessione" }, 500);
    }

    return json({
      verified: true,
      email,
      tokenHash: linkData.properties.hashed_token,
    });
  } catch (e: any) {
    return json({ verified: false, error: e?.message || "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
