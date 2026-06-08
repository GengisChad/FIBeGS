import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sync the current Supabase session to the service worker so the SW can
 * post quick-reply messages on the user's behalf (e.g. from web push
 * notification actions on Chrome Android / desktop).
 */
export function useSwAuthSync() {
  useEffect(() => {
    const post = (session: { access_token: string; refresh_token: string; expires_at?: number; user?: { id: string } } | null) => {
      const sw = navigator.serviceWorker?.controller;
      if (!sw) return;
      if (session?.access_token) {
        sw.postMessage({
          type: "AUTH_SYNC",
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user_id: session.user?.id,
          },
        });
      } else {
        sw.postMessage({ type: "AUTH_CLEAR" });
      }
    };

    // Initial sync (also retry once SW takes control)
    supabase.auth.getSession().then(({ data }) => post(data.session as any));
    navigator.serviceWorker?.ready.then(() => {
      supabase.auth.getSession().then(({ data }) => post(data.session as any));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      post(session as any);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}
