import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const WEB_ORIGIN = "https://ibna.it";
const DEEP_LINK_SCHEME = "app.lovable.ef1750244baf4d0fadc732f6a508595c";

/**
 * On native platforms (Capacitor), OAuth redirects can't return to the WebView.
 * This hook listens for deep-link callbacks and sets the Supabase session.
 */
export const useCapacitorDeepLinks = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    import("@capacitor/app").then(({ App: CapApp }) => {
      const listener = CapApp.addListener("appUrlOpen", async (event) => {
        const url = event.url;
        const isOAuth =
          url.includes("/~oauth") ||
          url.includes("://oauth") ||
          url.includes("access_token") ||
          url.includes("code=");

        const isExternalCallback =
          url.includes("challonge-callback") ||
          url.includes("challengermode-callback");

        // Always close system browser for auth-type deep links
        if (isOAuth || isExternalCallback || url.includes("reset-password")) {
          import("@capacitor/browser")
            .then(({ Browser }) => Browser.close())
            .catch(() => {});
        }

        // External platform OAuth (Challonge / Challengermode): bounce to in-app route
        if (isExternalCallback) {
          try {
            const querySplit = url.split("?");
            const query = querySplit[1] ? `?${querySplit[1].split("#")[0]}` : "";
            const path = url.includes("challonge-callback") ? "/challonge-callback" : "/challengermode-callback";
            window.location.href = `${path}${query}`;
          } catch (e) {
            console.error("external callback parse error", e);
          }
          return;
        }

        // Password recovery: route to reset page
        if (url.includes("type=recovery") || url.includes("reset-password")) {
          window.location.href = url.includes("reset-password")
            ? url
            : "/reset-password";
          return;
        }

        if (isOAuth) {
          try {
            // Parse code from query OR tokens from hash
            const queryStr = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
            const hashStr = url.includes("#") ? url.split("#")[1] : "";
            const queryParams = new URLSearchParams(queryStr);
            const hashParams = new URLSearchParams(hashStr);

            const code = queryParams.get("code");
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            if (code) {
              await supabase.auth.exchangeCodeForSession(url);
            } else if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          } catch (err) {
            console.error("Deep link auth error:", err);
          }
        }
      });


      listener.then((l) => {
        cleanup = () => l.remove();
      });
    }).catch(() => {});

    return () => {
      cleanup?.();
    };
  }, []);
};

/**
 * Open OAuth URL directly in system browser on native.
 * Uses standard Supabase OAuth for external Supabase projects.
 */
export const openOAuthInBrowser = async (provider: "google" | "apple") => {
  // On native we want Supabase/Google to redirect back to the web /~oauth page,
  // which will immediately bounce to the app via the custom scheme deep link.
  // (Google does NOT allow custom schemes as redirect URIs, so we MUST go via https first.)
  const isNative = Capacitor.isNativePlatform();
  const redirectTo = isNative
    ? `${WEB_ORIGIN}/~oauth`
    : `${window.location.origin}/~oauth`;

  if (isNative) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error };
    if (data?.url) {
      const { Browser } = await import("@capacitor/browser");
      Browser.addListener("browserFinished", () => {
        supabase.auth.getSession();
      });
      await Browser.open({ url: data.url, windowName: "_blank" });
    }
    return { error: null };
  }

  // On web: standard Supabase OAuth redirect via /~oauth callback page
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) return { error };
  return { error: null };
};

