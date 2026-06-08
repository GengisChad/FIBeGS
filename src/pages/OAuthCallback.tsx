import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const DEEP_LINK_SCHEME = "app.lovable.ef1750244baf4d0fadc732f6a508595c";

/**
 * OAuth callback page reached after Supabase redirects back from the provider.
 * - On Android (in-app Custom Tab): immediately re-redirect to the app's
 *   custom scheme so the OS reopens the native app and closes the browser.
 * - On normal web/PWA: complete the code exchange and bounce to the home page.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Completamento accesso...");

  useEffect(() => {
    const run = async () => {
      const { search, hash } = window.location;
      const ua = navigator.userAgent || "";
      const isAndroid = /Android/i.test(ua);

      // 1) Try deep-link back to the native app (no-op on plain web)
      if (isAndroid) {
        try {
          const deepLink = `${DEEP_LINK_SCHEME}://oauth${search}${hash}`;
          window.location.replace(deepLink);
        } catch {
          /* ignore */
        }
      }

      // 2) Web fallback: exchange code for session
      try {
        const params = new URLSearchParams(search);
        const code = params.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        }
      } catch (err) {
        console.error("OAuth callback exchange error:", err);
        setStatus("Errore durante il login. Riprova.");
        return;
      }

      navigate("/", { replace: true });
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
