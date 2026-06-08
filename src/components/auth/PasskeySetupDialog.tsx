import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { registerPasskey, snoozePasskeyPrompt } from "@/lib/passkeys";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => void;
}

export default function PasskeySetupDialog({ open, onOpenChange, onRegistered }: Props) {
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    const res = await registerPasskey();
    setBusy(false);
    if (res.ok) {
      toast.success("Passkey configurata su questo dispositivo");
      onRegistered?.();
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  const handleSkip = () => {
    snoozePasskeyPrompt(7);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Accesso rapido con passkey</DialogTitle>
          <DialogDescription className="text-center">
            Configura una passkey su questo dispositivo per accedere in un attimo
            con impronta, Face ID o PIN — senza dover ricordare la password.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              La passkey resta solo sul tuo dispositivo. Aiuta FIB a prevenire
              account multipli e accessi non autorizzati.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={handleSkip} disabled={busy} className="sm:flex-1">
            Più tardi
          </Button>
          <Button onClick={handleEnable} disabled={busy} className="sm:flex-1">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Configurazione…
              </>
            ) : (
              <>
                <Fingerprint className="mr-2 h-4 w-4" /> Configura passkey
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
