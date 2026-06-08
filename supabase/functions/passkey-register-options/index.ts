import { createClient } from "npm:@supabase/supabase-js@2";
import { generateRegistrationOptions } from "npm:@simplewebauthn/server@13";
import { corsHeaders, rpFromRequest, RP_NAME } from "../_shared/webauthn.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsRes, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsRes.claims.sub as string;
    const email = (claimsRes.claims.email as string) || "user@ibna.it";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { rpID } = rpFromRequest(req);

    // Exclude already-registered credentials for this user
    const { data: existing } = await admin
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", userId)
      .is("revoked_at", null);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: email,
      userDisplayName: email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: (existing || []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports as any) || undefined,
      })),
      timeout: 60_000,
    });

    await admin.from("passkey_challenges").insert({
      challenge: options.challenge,
      user_id: userId,
      type: "register",
    });
    await admin.rpc("cleanup_expired_passkey_challenges");

    return json({ options });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
