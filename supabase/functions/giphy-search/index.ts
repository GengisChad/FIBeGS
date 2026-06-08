import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache: key -> { data, expiry }
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(query: string, limit: number, offset: number): string {
  return `${query || "__trending__"}:${limit}:${offset}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 20, offset = 0 } = await req.json();
    const cacheKey = getCacheKey(query, limit, offset);

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }

    const apiKey = Deno.env.get("GIPHY_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GIPHY_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=g&lang=it`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}&rating=g`;

    const response = await fetch(endpoint);
    const data = await response.json();

    const gifs = (data.data || []).map((gif: any) => ({
      id: gif.id,
      title: gif.title,
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small.url || gif.images.preview_gif?.url || gif.images.fixed_height.url,
      width: parseInt(gif.images.fixed_height.width),
      height: parseInt(gif.images.fixed_height.height),
    }));

    const result = { gifs, pagination: data.pagination };

    // Store in cache
    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    // Evict old entries if cache grows too large
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (v.expiry < now) cache.delete(k);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
