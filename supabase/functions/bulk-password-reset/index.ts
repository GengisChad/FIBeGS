import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their JWT
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const redirectTo = body.redirect_to || "https://ibna.it/reset-password";

    // Use service role to list all users and send password reset emails
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get all users (paginate)
    let allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;
      if (!users || users.length === 0) break;
      allUsers = allUsers.concat(users);
      if (users.length < perPage) break;
      page++;
    }

    // Filter only email-based users (exclude ghost profiles)
    const emailUsers = allUsers.filter(u => u.email && !u.email.includes("@ghost."));

    let sent = 0;
    let errors = 0;

    // Send password reset to each user with a small delay to avoid rate limits
    for (const u of emailUsers) {
      try {
        const { error } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: u.email!,
          options: { redirectTo },
        });
        if (error) {
          console.error(`Failed to send reset to ${u.email}:`, error.message);
          errors++;
        } else {
          sent++;
        }
        // Small delay to avoid rate limiting
        if (sent % 30 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        console.error(`Error for ${u.email}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_users: emailUsers.length,
        sent, 
        errors 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Bulk password reset error:", error);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
