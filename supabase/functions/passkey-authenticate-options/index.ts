import { createClient } from "npm:@supabase/supabase-js@2";
import { generateAuthenticationOptions } from "npm:@simplewebauthn/server@13";
import { corsHeaders, rpFromRequest } from "../_shared/webauthn.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const emailOrUsername: string | undefined = body?.emailOrUsername;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { rpID } = rpFromRequest(req);

    let allowCredentials: { id: string; transports?: string[] }[] | undefined;
    let userId: string | null = null;

    if (emailOrUsername && emailOrUsername.trim()) {
      const q = emailOrUsername.trim();
      // Resolve to user_id via profiles (username) or auth.users (email)
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id")
        .ilike("username", q)
        .maybeSingle();
      if (profile?.user_id) {
        userId = profile.user_id as string;
      } else {
        const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const u = usersList?.users?.find(
          (x) => (x.email || "").toLowerCase() === q.toLowerCase()
        );
        if (u) userId = u.id;
      }

      if (userId) {
        const { data: creds } = await admin
          .from("user_passkeys")
          .select("credential_id, transports")
          .eq("user_id", userId)
          .is("revoked_at", null);
        allowCredentials = (creds || []).map((c) => ({
          id: c.credential_id,
          transports: (c.transports as any) || undefined,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      timeout: 60_000,
      allowCredentials,
    });

    await admin.from("passkey_challenges").insert({
      challenge: options.challenge,
      user_id: userId,
      type: "authenticate",
    });

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
