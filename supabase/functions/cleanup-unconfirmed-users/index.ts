import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin for ALL code paths
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin"
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for force delete of a specific user
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    if (body.force_user_id) {

      await supabase.from("profiles").delete().eq("user_id", body.force_user_id);
      const { error } = await supabase.auth.admin.deleteUser(body.force_user_id);
      if (error) throw error;
      console.log(`Force deleted user ${body.force_user_id}`);
      return new Response(
        JSON.stringify({ success: true, deleted: 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find unconfirmed users older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (listError) throw listError;

    const unconfirmed = (users || []).filter(
      (u) => !u.email_confirmed_at && u.created_at < cutoff
    );

    console.log(`Found ${unconfirmed.length} unconfirmed users older than 24h`);

    let deleted = 0;
    for (const user of unconfirmed) {
      await supabase.from("profiles").delete().eq("user_id", user.id);
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`Failed to delete user ${user.id}:`, error.message);
      } else {
        deleted++;
        console.log(`Deleted unconfirmed user ${user.email} (created ${user.created_at})`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: users?.length || 0, deleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: 'An internal error occurred' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
