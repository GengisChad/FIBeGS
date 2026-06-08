import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Paperclip, X, Send, Loader2, Ticket } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { toast } from "@/hooks/use-toast";

export const FeedbackButton = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-feedback", handler);
    return () => window.removeEventListener("open-feedback", handler);
  }, []);


  const handleSubmit = async () => {
    if (!user || !message.trim()) return;
    const profanityError = validateNoProfanity(message);
    if (profanityError) { toast({ title: profanityError, variant: "destructive" }); return; }
    setSending(true);

    let attachmentUrl: string | null = null;

    if (file) {
      let prepared: File;
      try { prepared = await prepareImageForUpload(file, { maxDimension: 1600 }); }
      catch (err: any) { toast({ title: err?.message || "Immagine non valida", variant: "destructive" }); setSending(false); return; }
      const ext = prepared.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("feedback-attachments")
        .upload(path, prepared, { contentType: prepared.type });
      if (uploadErr) {
        toast({ title: "Errore nell'upload del file", variant: "destructive" });
        setSending(false);
        return;
      }
      // Bucket is private — store the path; signed URLs are generated on demand by admins
      attachmentUrl = path;
    }

    const deviceInfo = `${navigator.userAgent} | ${navigator.platform} | ${window.screen.width}x${window.screen.height}`;

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      message: message.trim(),
      attachment_url: attachmentUrl,
      device_info: deviceInfo,
    } as any);

    if (error) {
      toast({ title: "Errore nell'invio del feedback", variant: "destructive" });
    } else {
      toast({ title: "Feedback inviato! Grazie 🙏" });
      setMessage("");
      setFile(null);
      setOpen(false);
    }
    setSending(false);
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 bg-secondary text-secondary-foreground px-4 py-3 rounded-full shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300 font-semibold text-sm group border border-border"
        aria-label="Invia feedback"
      >
        <HelpCircle size={18} />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invia Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Scrivi il tuo feedback, suggerimento o segnalazione..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
            />
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={14} className="mr-1" />
                {file ? "Cambia file" : "Allega screenshot"}
              </Button>
              {file && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-destructive hover:text-destructive/80">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{message.length}/2000 caratteri</p>
            <p className="text-xs text-muted-foreground text-center">📋 Il feedback verrà visionato dagli admin e gestito entro 24h.</p>
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || sending}
              className="w-full"
            >
              {sending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
              Invia Feedback
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                setOpen(false);
                navigate("/tickets");
              }}
            >
              <Ticket size={16} /> I miei Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
