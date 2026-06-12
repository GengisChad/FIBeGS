import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { LifeBuoy } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_OPTIONS = [
  {
    value: "apple_id_login",
    label: "Non posso accedere con Apple ID",
    description:
      "A seguito della migrazione di database il login tramite Apple ID non è ora disponibile, digita in basso il tuo username e l'email che vuoi utilizzare per l'account, lo staff provvederà a sostituirla, riceverai una mail di conferma per effettuare il recupero password.",
  },
  {
    value: "lost_email_access",
    label: "Non ho più accesso alla mia email",
    description:
      "Indica il tuo username e la nuova email che vuoi associare all'account. Lo staff verificherà la tua identità e provvederà alla sostituzione.",
  },
  {
    value: "other",
    label: "Altro problema con le credenziali",
    description: "Descrivi il tuo problema nel campo note. Lo staff ti contatterà appena possibile.",
  },
];

const schema = z.object({
  username: z.string().trim().min(2, "Inserisci il tuo username").max(50),
  new_email: z.string().trim().email("Email non valida").max(255),
  message: z.string().max(1000).optional(),
});

const CredentialHelpDialog = ({ open, onOpenChange }: Props) => {
  const [category, setCategory] = useState("apple_id_login");
  const [username, setUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentOption = CATEGORY_OPTIONS.find((c) => c.value === category)!;

  const reset = () => {
    setCategory("apple_id_login");
    setUsername("");
    setNewEmail("");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ username, new_email: newEmail, message });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("credential_help_requests").insert({
        category,
        username: parsed.data.username,
        new_email: parsed.data.new_email,
        message: parsed.data.message || null,
      });
      if (error) {
        toast.error("Errore nell'invio della richiesta: " + error.message);
        return;
      }
      toast.success("Richiesta inviata! Lo staff ti contatterà via email appena possibile.");
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy size={20} className="text-primary" />
            Hai problemi ad accedere?
          </DialogTitle>
          <DialogDescription>
            Compila il form per inviare una segnalazione allo staff FIBeGS.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo di problema</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
            {currentOption.description}
          </div>

          <div className="space-y-2">
            <Label htmlFor="help-username">Il tuo username *</Label>
            <Input
              id="help-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="il_tuo_username"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="help-email">Nuova email da associare *</Label>
            <Input
              id="help-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nuova@email.it"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="help-message">Note aggiuntive (opzionale)</Label>
            <Textarea
              id="help-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Aggiungi dettagli utili..."
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annulla
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Invio..." : "Invia richiesta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CredentialHelpDialog;
