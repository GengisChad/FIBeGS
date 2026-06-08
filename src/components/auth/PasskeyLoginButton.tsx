import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loginWithPasskey, passkeySupported } from "@/lib/passkeys";

interface Props {
  emailOrUsername?: string;
  onSuccess?: () => void;
  className?: string;
}

export default function PasskeyLoginButton({ emailOrUsername, onSuccess, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(passkeySupported());
  }, []);

  if (!supported) return null;

  const handle = async () => {
    setBusy(true);
    const res = await loginWithPasskey(emailOrUsername);
    setBusy(false);
    if (res.ok) {
      toast.success("Accesso effettuato");
      onSuccess?.();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handle}
      disabled={busy}
      className={className}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Fingerprint className="mr-2 h-4 w-4" />
      )}
      Accedi con passkey
    </Button>
  );
}
