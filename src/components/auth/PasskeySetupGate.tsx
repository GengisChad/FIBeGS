import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PasskeySetupDialog from "@/components/auth/PasskeySetupDialog";
import {
  passkeySupported,
  platformPasskeySupported,
  shouldShowPasskeyPrompt,
} from "@/lib/passkeys";


/**
 * After a successful login, if the user has no passkey registered for the
 * current device fingerprint, prompt them to set one up.
 *
 * The prompt is snoozable (7 days) and only appears when WebAuthn + a
 * platform authenticator are available.
 */
export default function PasskeySetupGate() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (loading || !user) return;
    if (!passkeySupported()) return;
    if (!shouldShowPasskeyPrompt()) return;

    (async () => {
      const platformOk = await platformPasskeySupported();
      if (!platformOk || cancelled) return;

      const { data } = await supabase
        .from("user_passkeys")
        .select("id")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .limit(1);

      if (cancelled) return;
      if (!data || data.length === 0) {
        // Delay a bit so it doesn't pop instantly on first load
        setTimeout(() => !cancelled && setOpen(true), 1500);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  if (!user) return null;
  return <PasskeySetupDialog open={open} onOpenChange={setOpen} />;
}
