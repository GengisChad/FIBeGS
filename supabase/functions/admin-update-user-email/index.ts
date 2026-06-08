import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { target_user_id, new_email, send_reset } = await req.json() as {
      target_user_id: string; new_email?: string; send_reset?: boolean;
    };

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "Missing target_user_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let finalEmail = new_email;

    if (new_email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
        return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (existing) {
        const conflict = existing.users.find((u) => u.email?.toLowerCase() === new_email.toLowerCase() && u.id !== target_user_id);
        if (conflict) {
          return new Response(JSON.stringify({ error: "Email già usata da un altro account" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(target_user_id, { email: new_email, email_confirm: true });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (send_reset) {
      if (!finalEmail) {
        const { data: tgt } = await admin.auth.admin.getUserById(target_user_id);
        finalEmail = tgt?.user?.email ?? undefined;
      }
      if (!finalEmail) {
        return new Response(JSON.stringify({ error: "Utente senza email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const origin = req.headers.get("origin") || "https://ibna.it";
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(finalEmail, { redirectTo: `${origin}/reset-password` });
      if (resetErr) console.error("Reset email failed:", resetErr.message);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("admin-update-user-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
