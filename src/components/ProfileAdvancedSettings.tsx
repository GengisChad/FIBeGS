import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Settings, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ProfileAdvancedSettings = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Current password for verification
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const verifyCurrentPassword = async (): Promise<boolean> => {
    if (!currentPassword.trim()) {
      toast.error("Inserisci la password attuale per confermare le modifiche");
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });
    if (error) {
      toast.error("Password attuale non corretta");
      return false;
    }
    return true;
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Inserisci un'email valida");
      return;
    }
    setEmailSaving(true);
    const verified = await verifyCurrentPassword();
    if (!verified) {
      setEmailSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email di conferma inviata al nuovo indirizzo. Controlla la tua casella.");
      setNewEmail("");
      setCurrentPassword("");
      setEmailConfirmOpen(false);
    }
    setEmailSaving(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error("La nuova password deve avere almeno 6 caratteri");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Le password non corrispondono");
      return;
    }
    setPasswordSaving(true);
    const verified = await verifyCurrentPassword();
    if (!verified) {
      setPasswordSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      if (error.message.toLowerCase().includes("leaked") || error.message.toLowerCase().includes("breach") || error.message.toLowerCase().includes("pwned") || error.message.toLowerCase().includes("compromised")) {
        toast.error("Questa password risulta compromessa in un data breach noto. Scegli una password diversa e più sicura.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Password aggiornata con successo!");
      setNewPassword("");
      setConfirmNewPassword("");
      setCurrentPassword("");
      setPasswordConfirmOpen(false);
    }
    setPasswordSaving(false);
  };

  if (!user) return null;

  const canSubmitEmail = newEmail.trim().length > 0;
  const canSubmitPassword = newPassword.length > 0 && confirmNewPassword.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full text-left">
            <h2 className="font-display text-lg flex items-center gap-2">
              <Settings size={18} className="text-primary" /> Impostazioni Avanzate
            </h2>
            <span className="text-xs text-muted-foreground">{open ? "Chiudi" : "Apri"}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-6">
          {/* Current email display */}
          <div className="text-sm text-muted-foreground">
            Email attuale: <span className="font-medium text-foreground">{user.email}</span>
          </div>

          {/* Email change */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Mail size={14} className="text-primary" /> Cambia Email</h3>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Nuova email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-secondary flex-1"
              />
              <Button size="sm" variant="outline" disabled={!canSubmitEmail} onClick={() => setEmailConfirmOpen(true)}>
                Cambia
              </Button>
            </div>
          </div>

          {/* Password change */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Lock size={14} className="text-primary" /> Cambia Password</h3>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPasswords ? "text" : "password"}
                  placeholder="Nuova password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary pr-10"
                />
                <button type="button" onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Input
                type={showPasswords ? "text" : "password"}
                placeholder="Ripeti nuova password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="bg-secondary"
              />
              <Button size="sm" variant="outline" disabled={!canSubmitPassword} onClick={() => setPasswordConfirmOpen(true)}>
                Aggiorna Password
              </Button>
            </div>
          </div>

          {/* Current password section */}
          {(canSubmitEmail || canSubmitPassword) && (
            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Lock size={14} className="text-destructive" /> Password attuale (richiesta per confermare)
              </h3>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Inserisci la password attuale"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-secondary pr-10"
                />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Email confirm dialog */}
          <AlertDialog open={emailConfirmOpen} onOpenChange={setEmailConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma cambio email</AlertDialogTitle>
                <AlertDialogDescription>
                  Stai per cambiare la tua email a <strong>{newEmail}</strong>. Riceverai un'email di conferma al nuovo indirizzo. Vuoi procedere?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleEmailChange} disabled={emailSaving}>
                  {emailSaving ? "Invio..." : "Conferma"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Password confirm dialog */}
          <AlertDialog open={passwordConfirmOpen} onOpenChange={setPasswordConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma cambio password</AlertDialogTitle>
                <AlertDialogDescription>
                  Sei sicuro di voler cambiare la tua password? Dopo il cambio dovrai usare la nuova password per accedere.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handlePasswordChange} disabled={passwordSaving}>
                  {passwordSaving ? "Aggiornamento..." : "Conferma"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default ProfileAdvancedSettings;
