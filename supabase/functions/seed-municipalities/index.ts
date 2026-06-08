import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Region code mapping to match existing regions table
const REGION_NAME_MAP: Record<string, string> = {
  "Abruzzo": "Abruzzo",
  "Basilicata": "Basilicata",
  "Calabria": "Calabria",
  "Campania": "Campania",
  "Emilia-Romagna": "Emilia-Romagna",
  "Friuli-Venezia Giulia": "Friuli Venezia Giulia",
  "Lazio": "Lazio",
  "Liguria": "Liguria",
  "Lombardia": "Lombardia",
  "Marche": "Marche",
  "Molise": "Molise",
  "Piemonte": "Piemonte",
  "Puglia": "Puglia",
  "Sardegna": "Sardegna",
  "Sicilia": "Sicilia",
  "Toscana": "Toscana",
  "Trentino-Alto Adige": "Trentino-Alto Adige",
  "Umbria": "Umbria",
  "Valle d'Aosta": "Valle d'Aosta",
  "Veneto": "Veneto",
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

    // Check if already seeded
    const { count } = await supabase
      .from("municipalities")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ success: true, message: `Already seeded with ${count} municipalities` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch regions
    const { data: regions } = await supabase.from("regions").select("id, name");
    if (!regions) throw new Error("Could not fetch regions");

    const regionMap = new Map(regions.map((r) => [r.name, r.id]));

    // Fetch comuni from GitHub dataset
    const res = await fetch(
      "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json"
    );
    if (!res.ok) throw new Error("Failed to fetch comuni dataset");

    const comuni: Array<{
      nome: string;
      provincia: { nome: string; codice: string };
      regione: { nome: string };
    }> = await res.json();

    console.log(`Fetched ${comuni.length} municipalities`);

    // Map to our schema
    const rows = comuni.map((c) => {
      const regionName = REGION_NAME_MAP[c.regione.nome] || c.regione.nome;
      const regionId = regionMap.get(regionName);
      if (!regionId) {
        console.warn(`No region match for: ${c.regione.nome} -> ${regionName}`);
      }
      return {
        name: c.nome,
        province: c.provincia.nome,
        province_code: c.provincia.codice,
        region_id: regionId,
      };
    }).filter((r) => r.region_id);

    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("municipalities").insert(batch);
      if (error) {
        console.error(`Batch ${i} error:`, error);
        throw error;
      }
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${rows.length}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Seeded ${inserted} municipalities` }),
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
