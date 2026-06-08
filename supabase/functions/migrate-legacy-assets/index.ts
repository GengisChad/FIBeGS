// Migrates assets hosted on the OLD Lovable Cloud project (xbfwxwqnduwsvvxpdany)
// into this project's Supabase storage and updates DB rows to point to the new URLs.
// Admin-only. Supports dry-run.
//
// Usage:
//   POST /migrate-legacy-assets   { "dryRun": true }   -> returns counts only
//   POST /migrate-legacy-assets   { "dryRun": false }  -> performs migration
//
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LEGACY_HOST = "xbfwxwqnduwsvvxpdany.supabase.co";

// Mapping of (table, column) -> destination bucket
const TARGETS: Array<{ table: string; column: string; bucket: string; idCol?: string }> = [
  { table: "clubs", column: "banner_url", bucket: "club-banners" },
  { table: "clubs", column: "logo_url", bucket: "club-logos" },
  { table: "tournaments", column: "image_url", bucket: "tournament-flyers" },
  { table: "profiles", column: "avatar_url", bucket: "avatars", idCol: "user_id" },
  { table: "profiles", column: "banner_url", bucket: "profile-banners", idCol: "user_id" },
  { table: "championships", column: "banner_url", bucket: "club-banners" },
  { table: "championships", column: "logo_url", bucket: "club-logos" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;
    // Small batch per invocation to stay well under the 150s edge timeout.
    // Admin UI should re-invoke until `remaining` is 0 across all targets.
    const batchPerTable = Math.min(Math.max(Number(body?.batchSize) || 5, 1), 25);
    const concurrency = Math.min(Math.max(Number(body?.concurrency) || 3, 1), 6);
    const scanLimit = Math.min(Math.max(Number(body?.scanLimit) || 1000, 1), 5000);
    const startedAt = Date.now();
    const TIME_BUDGET_MS = 120_000; // hard stop before platform timeout

    async function migrateOne(t: typeof TARGETS[number], row: any, idCol: string) {
      const url: string = row[t.column];
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        const ext = (url.split("?")[0].split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const fileName = `${t.column}-${row[idCol]}-${Date.now()}.${ext}`;
        const path = t.idCol === "user_id" ? `${row[idCol]}/${fileName}` : fileName;
        const { error: upErr } = await admin.storage.from(t.bucket).upload(path, new Uint8Array(arrayBuf), {
          contentType: res.headers.get("content-type") || `image/${ext}`,
          upsert: true,
        });
        if (upErr) throw upErr;
        const { data: pub } = admin.storage.from(t.bucket).getPublicUrl(path);
        await admin.from(t.table).update({ [t.column]: pub.publicUrl }).eq(idCol, row[idCol]);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, id: row[idCol], err: String(e?.message || e) };
      }
    }

    const report: any[] = [];
    let timedOut = false;
    for (const t of TARGETS) {
      const idCol = t.idCol ?? "id";
      // Count remaining (capped) for visibility
      const { count: remainingCount } = await admin
        .from(t.table)
        .select(idCol, { count: "exact", head: true })
        .ilike(t.column, `%${LEGACY_HOST}%`);

      const limit = dryRun ? scanLimit : batchPerTable;
      const { data: rows, error } = await admin
        .from(t.table)
        .select(`${idCol}, ${t.column}`)
        .ilike(t.column, `%${LEGACY_HOST}%`)
        .limit(limit);
      if (error) {
        report.push({ table: t.table, column: t.column, error: error.message, remaining: remainingCount ?? null });
        continue;
      }
      const found = rows?.length ?? 0;
      let migrated = 0; const errors: any[] = [];
      if (!dryRun && rows && rows.length) {
        for (let i = 0; i < rows.length; i += concurrency) {
          if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
          const chunk = rows.slice(i, i + concurrency);
          const results = await Promise.all(chunk.map((r) => migrateOne(t, r, idCol)));
          for (const r of results) {
            if (r.ok) migrated++;
            else errors.push({ id: (r as any).id, err: (r as any).err });
          }
        }
      }
      report.push({
        table: t.table, column: t.column, bucket: t.bucket,
        found, migrated, remaining: Math.max((remainingCount ?? found) - migrated, 0),
        errors: errors.slice(0, 10),
      });
      if (timedOut) break;
    }

    const totalRemaining = report.reduce((a, r) => a + (Number(r.remaining) || 0), 0);
    return new Response(JSON.stringify({
      dryRun, timedOut, elapsedMs: Date.now() - startedAt,
      totalRemaining, done: !dryRun && totalRemaining === 0,
      hint: dryRun ? "Esegui senza dryRun. La funzione lavora in batch: ripeti finché done=true." : undefined,
      report,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
