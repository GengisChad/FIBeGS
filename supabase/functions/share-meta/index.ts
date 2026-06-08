import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://ibna.it";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const stripHtml = (s: string | null | undefined) =>
  (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);

function isBot(ua: string): boolean {
  return /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slackbot|twitterbot|linkedinbot|discordbot|skype|preview|embedly|pinterest|googlebot|bingbot|applebot|redditbot|vkshare|w3c_validator|quora link preview|outlook|msnbot/i.test(ua);
}

function renderHtml(opts: {
  title: string;
  description: string;
  image: string | null;
  url: string;
  type?: string;
  redirectTo: string;
}): string {
  const { title, description, image, url, type = "website", redirectTo } = opts;
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeUrl = escapeHtml(url);
  const safeRedirect = escapeHtml(redirectTo);
  const imgTag = image
    ? `<meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />`
    : "";
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<meta name="description" content="${safeDesc}" />
<link rel="canonical" href="${safeRedirect}" />
<meta property="og:type" content="${escapeHtml(type)}" />
<meta property="og:site_name" content="IBNA" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:url" content="${safeUrl}" />
${imgTag}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta http-equiv="refresh" content="0; url=${safeRedirect}" />
<script>window.location.replace(${JSON.stringify(redirectTo)});</script>
</head>
<body>
<p>Reindirizzamento a <a href="${safeRedirect}">${safeRedirect}</a>...</p>
</body>
</html>`;
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600",
    },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path can be /share-meta/<kind>/<id> or /functions/v1/share-meta/<kind>/<id>
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("share-meta");
  const segments = idx >= 0 ? parts.slice(idx + 1) : parts;
  const [kind, idOrSlug] = segments;

  const ua = req.headers.get("user-agent") || "";
  // Always serve HTML; humans get redirected via meta/JS, bots read og tags.

  try {
    if (kind === "tournament" && idOrSlug) {
      const { data } = await supabase
        .from("tournaments")
        .select("id, title, description, image_url, flyer_url, championship_id, club_id, clubs(name, banner_url, logo_url), championships(name, banner_url, logo_url)")
        .eq("id", idOrSlug)
        .maybeSingle();
      if (!data) return htmlResponse(renderHtml({
        title: "IBNA", description: "Italian Beyblade National Association",
        image: null, url: `${SITE}/tournaments/${idOrSlug}`,
        redirectTo: `${SITE}/tournaments/${idOrSlug}`,
      }));
      const t: any = data;
      const image = t.flyer_url || t.image_url || t.clubs?.banner_url || t.championships?.banner_url || t.clubs?.logo_url || t.championships?.logo_url || null;
      const desc = stripHtml(t.description) || `Torneo${t.clubs?.name ? ` organizzato da ${t.clubs.name}` : ""}${t.championships?.name ? ` — ${t.championships.name}` : ""}.`;
      return htmlResponse(renderHtml({
        title: `${t.title} — IBNA`,
        description: desc,
        image,
        url: `${SITE}/tournaments/${t.id}`,
        type: "event",
        redirectTo: `${SITE}/tournaments/${t.id}`,
      }));
    }

    if (kind === "championship" && idOrSlug) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const query = supabase
        .from("championships")
        .select("id, slug, name, description, banner_url, logo_url");
      const { data } = await (isUuid ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug)).maybeSingle();
      if (!data) return htmlResponse(renderHtml({
        title: "IBNA", description: "Italian Beyblade National Association",
        image: null, url: `${SITE}/campionati/${idOrSlug}`,
        redirectTo: `${SITE}/campionati/${idOrSlug}`,
      }));
      const c: any = data;
      const image = c.banner_url || c.logo_url || null;
      return htmlResponse(renderHtml({
        title: `${c.name} — IBNA`,
        description: stripHtml(c.description) || `Campionato ${c.name} su IBNA.`,
        image,
        url: `${SITE}/campionati/${c.slug}`,
        redirectTo: `${SITE}/campionati/${c.slug}`,
      }));
    }

    if (kind === "club" && idOrSlug) {
      const { data } = await supabase
        .from("clubs")
        .select("id, name, description, banner_url, logo_url, city")
        .eq("id", idOrSlug)
        .maybeSingle();
      if (!data) return htmlResponse(renderHtml({
        title: "IBNA", description: "Italian Beyblade National Association",
        image: null, url: `${SITE}/clubs/${idOrSlug}`,
        redirectTo: `${SITE}/clubs/${idOrSlug}`,
      }));
      const cl: any = data;
      const image = cl.banner_url || cl.logo_url || null;
      return htmlResponse(renderHtml({
        title: `${cl.name} — IBNA`,
        description: stripHtml(cl.description) || `${cl.name}${cl.city ? ` · ${cl.city}` : ""} su IBNA.`,
        image,
        url: `${SITE}/clubs/${cl.id}`,
        redirectTo: `${SITE}/clubs/${cl.id}`,
      }));
    }
  } catch (e) {
    console.error("share-meta error", e);
  }

  return htmlResponse(renderHtml({
    title: "IBNA — Italian Beyblade National Association",
    description: "Tornei, campionati e club Beyblade in Italia.",
    image: null,
    url: SITE,
    redirectTo: SITE,
  }));
});
