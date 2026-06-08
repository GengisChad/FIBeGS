import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin/staff
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check role
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isStaff } = await admin.rpc("has_role", { _user_id: user.id, _role: "staff" });
    if (!isAdmin && !isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { request_id, target_user_id, new_email } = body as {
      request_id: string;
      target_user_id: string;
      new_email: string;
    };

    if (!request_id || !target_user_id || !new_email) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if target already has this email; check email not already in use by another user
    const { data: targetUserData } = await admin.auth.admin.getUserById(target_user_id);
    const targetCurrentEmail = targetUserData?.user?.email?.toLowerCase();
    const alreadySet = targetCurrentEmail === new_email.toLowerCase();

    if (!alreadySet) {
      const { data: existing, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (!listErr && existing) {
        const conflict = existing.users.find((u) => u.email?.toLowerCase() === new_email.toLowerCase() && u.id !== target_user_id);
        if (conflict) {
          return new Response(JSON.stringify({
            error: "Email già usata da un altro account",
            conflict_user_id: conflict.id,
            conflict_created_at: conflict.created_at,
            conflict_confirmed: !!conflict.email_confirmed_at,
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update email + auto-confirm so the user can immediately use reset password
      const { error: updErr } = await admin.auth.admin.updateUserById(target_user_id, {
        email: new_email,
        email_confirm: true,
      });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate password recovery link (sends email automatically)
    const origin = req.headers.get("origin") || "https://ibna.it";
    const { error: resetErr } = await admin.auth.resetPasswordForEmail(new_email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (resetErr) {
      console.error("Reset email send failed:", resetErr.message);
    }

    // Mark request as approved
    await admin
      .from("credential_help_requests")
      .update({
        status: "approved",
        handled_by: user.id,
        handled_at: new Date().toISOString(),
        matched_user_id: target_user_id,
      })
      .eq("id", request_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-sync-credential-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
