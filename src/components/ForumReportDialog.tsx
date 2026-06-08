import { useState, useEffect } from "react";
import { Flag, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ForumReportDialogProps {
  postId?: string;
  replyId?: string;
  children: React.ReactNode;
}

export const ForumReportDialog = ({ postId, replyId, children }: ForumReportDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    const check = async () => {
      const query = (supabase as any).from("forum_reports")
        .select("id", { count: "exact", head: true })
        .eq("reporter_id", user.id)
        .neq("status", "dismissed");
      if (postId) query.eq("post_id", postId);
      else if (replyId) query.eq("reply_id", replyId);
      const { count } = await query;
      setAlreadyReported((count ?? 0) > 0);
    };
    check();
  }, [user, open, postId, replyId]);

  const handleReport = async () => {
    if (!user) { toast.error("Accedi per segnalare"); return; }
    if (!reason.trim()) { toast.error("Inserisci una motivazione"); return; }
    setSending(true);
    const { error } = await (supabase as any).from("forum_reports").insert({
      ...(postId ? { post_id: postId } : { reply_id: replyId }),
      reporter_id: user.id,
      reason: reason.trim(),
    });
    if (error) {
      if (error.code === "23505") {
        toast.error("Hai già segnalato questo contenuto");
        setAlreadyReported(true);
      } else {
        toast.error("Errore nella segnalazione");
      }
    } else {
      toast.success("Segnalazione inviata");
      setOpen(false);
      setReason("");
      setAlreadyReported(true);
    }
    setSending(false);
  };

  if (!user) return null;

  return (
    <>
      <span onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag size={16} className="text-orange-500" />
              Segnala {postId ? "Post" : "Commento"}
            </DialogTitle>
          </DialogHeader>
          {alreadyReported ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle size={32} className="text-green-500" />
              <p className="text-sm text-muted-foreground">Hai già segnalato questo contenuto. Lo staff lo esaminerà.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Descrivi il motivo della segnalazione..."
                rows={3}
              />
              <Button onClick={handleReport} disabled={sending || !reason.trim()} className="w-full">
                {sending ? "Invio..." : "Invia segnalazione"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
