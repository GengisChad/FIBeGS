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
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get("id");

    if (!tournamentId) {
      return new Response("Missing tournament id", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("title, city, event_date, image_url, clubs(name)")
      .eq("id", tournamentId)
      .single();

    if (!tournament) {
      return new Response("Tournament not found", { status: 404 });
    }

    const title = tournament.title || "Torneo";
    const clubName = (tournament.clubs as any)?.name || "";
    const city = tournament.city || "";
    const date = tournament.event_date
      ? new Date(tournament.event_date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const description = [clubName, city, date].filter(Boolean).join(" · ");
    // Strip cache-busting params for OG image (crawlers may not follow them)
    let imageUrl = tournament.image_url || "https://storage.googleapis.com/gpt-engineer-file-uploads/v3relY0xs3YX8ZwyzkK6Swp62GI3/social-images/social-1772913124082-IBNA_new_Logo_-_White.webp";
    try {
      const imgUrlObj = new URL(imageUrl);
      imgUrlObj.searchParams.delete("t");
      imgUrlObj.searchParams.delete("v");
      imageUrl = imgUrlObj.toString();
    } catch { /* keep as-is */ }
    const siteUrl = "https://ibna.it";

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:url" content="${siteUrl}/tournaments/${tournamentId}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <title>${escapeHtml(title)}</title>
  <meta http-equiv="refresh" content="0;url=${siteUrl}/tournaments/${tournamentId}" />
</head>
<body>
  <p>Reindirizzamento a <a href="${siteUrl}/tournaments/${tournamentId}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal error", { status: 500 });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
