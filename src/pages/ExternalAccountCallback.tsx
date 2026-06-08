import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEEP_LINK_SCHEME = "app.lovable.ef1750244baf4d0fadc732f6a508595c";

const getFunctionErrorMessage = async (err: any) => {
  const response = err?.context;
  if (response && typeof response.clone === "function") {
    const payload = await response.clone().json().catch(() => null);
    if (payload?.error || payload?.detail) {
      return [payload.error, payload.detail].filter(Boolean).join(": ");
    }
  }
  return err?.message ?? String(err);
};

/**
 * Callback page used after the OAuth provider (Challonge / Challengermode)
 * redirects back. Supports both web and Android (deep-links back into app).
 *
 * Used by routes:
 *   /challonge-callback
 *   /challengermode-callback
 */
export default function ExternalAccountCallback({ platform }: { platform: "challonge" | "challengermode" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Collegamento account in corso...");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const isAndroid = /Android/i.test(navigator.userAgent || "");

    // Android in-app browser: re-emit the URL to the native app via custom scheme
    if (isAndroid && window.location.search) {
      try {
        const path = platform === "challonge" ? "challonge-callback" : "challengermode-callback";
        window.location.replace(`${DEEP_LINK_SCHEME}://${path}${window.location.search}`);
        // Continue execution: if scheme handler is missing, fall through to web flow.
      } catch { /* ignore */ }
    }

    if (error) {
      toast.error(`Errore OAuth: ${error}`);
      navigate("/profile", { replace: true });
      return;
    }
    if (!code) {
      toast.error("Codice OAuth mancante");
      navigate("/profile", { replace: true });
      return;
    }

    (async () => {
      try {
        const redirect_uri = `${window.location.origin}/${platform}-callback`;
        const { data, error: invokeErr } = await supabase.functions.invoke("link-external-account", {
          body: { action: "callback", platform, code, state, redirect_uri },
        });
        if (invokeErr) throw new Error(await getFunctionErrorMessage(invokeErr));
        if ((data as any)?.error) throw new Error((data as any).error);
        const username = (data as any)?.username;
        const bf = (data as any)?.backfill;
        const replaced = bf?.ghost_user_ids_replaced ?? 0;
        toast.success(
          `Account ${platform} collegato${username ? ` come ${username}` : ""}` +
          (replaced ? ` · ${replaced} partecipazioni passate ricollegate` : "")
        );
      } catch (err: any) {
        console.error(err);
        toast.error(`Collegamento fallito: ${err.message ?? err}`);
      } finally {
        navigate("/profile", { replace: true });
      }
    })();
  }, [searchParams, navigate, platform]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
