import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // --- Auth: require admin role ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- End auth ---

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find forum posts with images older than 30 days
    const { data: oldPosts, error: fetchError } = await supabase
      .from("forum_posts")
      .select("id, image_url, user_id")
      .not("image_url", "is", null)
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (fetchError) throw fetchError;

    let deletedCount = 0;

    for (const post of oldPosts || []) {
      if (!post.image_url) continue;

      // Extract storage path from URL
      const url = new URL(post.image_url);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/forum-images\/(.+)/);
      if (!pathMatch) continue;

      const filePath = decodeURIComponent(pathMatch[1]);

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from("forum-images")
        .remove([filePath]);

      if (!storageError) {
        // Clear image_url from post
        await supabase
          .from("forum_posts")
          .update({ image_url: null })
          .eq("id", post.id);
        deletedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, deleted: deletedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
