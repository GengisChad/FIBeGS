// Unified OAuth handler for Challonge & Challengermode account linking.
// Actions:
//   POST { action: "start", platform, redirect_uri } -> returns { auth_url, state }
//   POST { action: "callback", platform, code, redirect_uri, state } -> exchanges code, saves account, runs backfill
//   POST { action: "unlink", platform } -> removes the link
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PKCE helpers (S256)
function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function genCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}
async function codeChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

const PLATFORMS = {
  challonge: {
    auth_url: "https://api.challonge.com/oauth/authorize",
    token_url: "https://api.challonge.com/oauth/token",
    me_url: "https://api.challonge.com/v2.1/me.json",
    scope: "me tournaments:read participants:read",
    use_pkce: false,
    api_headers: {
      "Authorization-Type": "v2",
      "Content-Type": "application/vnd.api+json",
    },
    client_id: () => Deno.env.get("CHALLONGE_CLIENT_ID")!,
    client_secret: () => Deno.env.get("CHALLONGE_CLIENT_SECRET")!,
    redirect_uri: () => Deno.env.get("CHALLONGE_REDIRECT_URI") ?? null,
    parseMe: (j: any) => ({
      id: String(j?.data?.id ?? j?.user?.id ?? j?.id ?? ""),
      username: j?.data?.attributes?.username ?? j?.user?.username ?? j?.username ?? "",
    }),
  },
challengermode: {
  auth_url: "https://www.challengermode.com/oauth/authorize",
  token_url: "https://www.challengermode.com/oauth/token",
  me_url: "https://publicapi.challengermode.com/mk1/v1/me/userinfo",
  scope: "openid offline_access",
  use_pkce: true,
  api_headers: {},
  client_id: () => Deno.env.get("CHALLENGERMODE_CLIENT_ID")!,
  client_secret: () => Deno.env.get("CHALLENGERMODE_CLIENT_SECRET")!,
  redirect_uri: () => {
    const v = Deno.env.get("CHALLENGERMODE_REDIRECT_URI");
    return v && v.trim() ? v.trim() : null;
  },
  parseMe: (j: any) => {
    const id = String(j?.sub ?? "").trim();
    if (!id) throw new Error("missing 'sub' in /me response");
    const username = String(j?.nickname ?? "").trim();
    if (!username) throw new Error("missing 'nickname' in /me response");
    return {
      id,
      username,
    };
  },
},
} as const;

type PlatformKey = keyof typeof PLATFORMS;

function getRedirectUri(platform: PlatformKey, requested?: string): string | null {
  const configured = PLATFORMS[platform].redirect_uri();
  if (configured) return configured;
  if (!requested) return null;

  try {
    const url = new URL(requested);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    if (platform === "challengermode" && url.hostname.endsWith("ibna.it")) {
      return `https://ibna.it/challengermode-callback`;
    }
    if (platform === "challonge" && url.hostname.endsWith("ibna.it")) {
      return `https://ibna.it/challonge-callback`;
    }
    return requested;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;
    const platform = body?.platform as PlatformKey;
    if (!action) return json({ error: "missing action" }, 400);
    if (!PLATFORMS[platform]) {
      return json({ error: `invalid platform: ${platform}` }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cfg = PLATFORMS[platform];

    let userId: string | null = null;
    if (action !== "callback") {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user?.id) {
        console.error("getUser failed", userErr);
        return json({ error: "Unauthorized" }, 401);
      }
      userId = userData.user.id;
    }

    // Optional: parent linking external account on behalf of a child profile
    const childProfileId = (body?.child_profile_id as string | undefined) || null;
    if (childProfileId) {
      const { data: childRow, error: cErr } = await adminClient
        .from("child_profiles")
        .select("id, parent_user_id")
        .eq("id", childProfileId)
        .maybeSingle();
      if (cErr || !childRow) return json({ error: "child not found" }, 404);
      if ((childRow as any).parent_user_id !== userId) {
        return json({ error: "not your child" }, 403);
      }
    }

    if (action === "start") {
      const redirect_uri = getRedirectUri(platform, body.redirect_uri as string | undefined);
      if (!redirect_uri) return json({ error: "redirect_uri required" }, 400);
      const clientId = cfg.client_id();
      if (!clientId) {
        console.error(`${platform} CLIENT_ID env missing`);
        return json({ error: `${platform} not configured (missing CLIENT_ID)` }, 500);
      }
      const state = crypto.randomUUID();

      let codeVerifier: string | null = null;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri,
        response_type: "code",
        scope: cfg.scope,
        state,
      });

      if (cfg.use_pkce) {
        codeVerifier = genCodeVerifier();
        const challenge = await codeChallengeS256(codeVerifier);
        params.set("code_challenge", challenge);
        params.set("code_challenge_method", "S256");
      }

      const { error: stErr } = await adminClient.from("oauth_pkce_states").insert({
        state,
        user_id: userId!,
        platform,
        code_verifier: codeVerifier,
        redirect_uri,
        child_profile_id: childProfileId,
      });
      if (stErr) {
        console.error("state insert error", stErr);
        return json({ error: "failed to store oauth state", detail: stErr.message }, 500);
      }

      return json({ auth_url: `${cfg.auth_url}?${params.toString()}`, state });
    }

    if (action === "unlink") {
      const q = adminClient.from("user_external_accounts").delete().eq("platform", platform);
      if (childProfileId) {
        await q.eq("child_profile_id", childProfileId);
      } else {
        await q.eq("user_id", userId!);
      }
      return json({ ok: true });
    }

    if (action === "callback") {
      const code = body.code as string;
      const state = body.state as string | undefined;
      let redirect_uri = body.redirect_uri as string;
      if (!code) return json({ error: "code required" }, 400);

      // Look up state -> verifier
      let codeVerifier: string | null = null;
      let stateChildProfileId: string | null = null;
      if (state) {
        const { data: st } = await adminClient
          .from("oauth_pkce_states")
          .select("code_verifier, redirect_uri, user_id, child_profile_id")
          .eq("state", state)
          .eq("platform", platform)
          .maybeSingle();
        if (st) {
          codeVerifier = (st as any).code_verifier ?? null;
          userId = (st as any).user_id ?? null;
          stateChildProfileId = (st as any).child_profile_id ?? null;
          if ((st as any).redirect_uri) redirect_uri = (st as any).redirect_uri;
          await adminClient.from("oauth_pkce_states").delete().eq("state", state);
        }
      }
      if (!userId) return json({ error: "oauth state expired or invalid" }, 400);
      if (!redirect_uri) return json({ error: "redirect_uri required" }, 400);

      // Exchange code for token
      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        client_id: cfg.client_id(),
        redirect_uri,
      };
      if (cfg.use_pkce && codeVerifier) {
        tokenParams.code_verifier = codeVerifier;
      }
      const clientSecret = cfg.client_secret();
      if (clientSecret) tokenParams.client_secret = clientSecret;

      const tokenRes = await fetch(cfg.token_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(tokenParams),
      });
      if (!tokenRes.ok) {
        const txt = await tokenRes.text();
        console.error(`${platform} token exchange failed`, tokenRes.status, txt);
        return json({ error: "token exchange failed", detail: txt }, 400);
      }
      const tokenJson: any = await tokenRes.json();
      const accessToken = tokenJson.access_token;
      const refreshToken = tokenJson.refresh_token ?? null;
      const expiresIn = Number(tokenJson.expires_in ?? 0);
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

      // Fetch user info
      const meRes = await fetch(cfg.me_url, {
        headers: {
          ...cfg.api_headers,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (!meRes.ok) {
        const txt = await meRes.text();
        console.error(`${platform} me fetch failed`, meRes.status, txt);
        return json({ error: "me fetch failed", detail: txt }, 400);
      }
      const meJson = await meRes.json();
      const { id: extId, username: extUsername } = cfg.parseMe(meJson);
      if (!extUsername) {
        console.error("missing username in me response", JSON.stringify(meJson).slice(0, 500));
        return json({ error: "missing username from platform" }, 400);
      }

      // Upsert link (either to user or to child profile)
      if (stateChildProfileId) {
        // Manual upsert: delete existing then insert
        await adminClient.from("user_external_accounts")
          .delete()
          .eq("child_profile_id", stateChildProfileId)
          .eq("platform", platform);
        const { error: upErr } = await adminClient.from("user_external_accounts").insert({
          user_id: null,
          child_profile_id: stateChildProfileId,
          platform,
          external_user_id: extId || null,
          external_username: extUsername,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
        });
        if (upErr) {
          console.error("child upsert error", upErr);
          return json({ error: upErr.message }, 500);
        }

        const { data: backfill, error: bfErr } = await adminClient.rpc(
          "link_external_account_backfill_child",
          { _child_id: stateChildProfileId, _platform: platform, _external_username: extUsername },
        );
        if (bfErr) console.error("child backfill error", bfErr);

        return json({
          ok: true,
          platform,
          username: extUsername,
          child_profile_id: stateChildProfileId,
          backfill: backfill ?? null,
        });
      }

      // Manual upsert: delete existing then insert (no unique constraint on user_id,platform)
      await adminClient.from("user_external_accounts")
        .delete()
        .eq("user_id", userId)
        .eq("platform", platform);
      const { error: upErr } = await adminClient.from("user_external_accounts").insert({
        user_id: userId,
        platform,
        external_user_id: extId || null,
        external_username: extUsername,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
      });
      if (upErr) {
        console.error("upsert error", upErr);
        return json({ error: upErr.message }, 500);
      }

      const { data: backfill, error: bfErr } = await adminClient.rpc(
        "link_external_account_backfill",
        { _user_id: userId, _platform: platform, _external_username: extUsername },
      );
      if (bfErr) console.error("backfill error", bfErr);

      const { data: reconcile, error: rcErr } = await adminClient.rpc(
        "reconcile_imported_account_points",
        { _user_id: userId },
      );
      if (rcErr) console.error("reconcile error", rcErr);

      return json({
        ok: true,
        platform,
        username: extUsername,
        backfill: backfill ?? null,
        reconcile: reconcile ?? null,
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (err: any) {
    console.error("link-external-account error", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
