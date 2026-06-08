import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FeedbackScope, useFeedbackTemplate } from "@/hooks/useFeedbackTemplate";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: FeedbackScope;
  targetId: string;
}

export const FeedbackResponsesDialog = ({ open, onOpenChange, scope, targetId }: Props) => {
  const { template } = useFeedbackTemplate(scope);
  const [responses, setResponses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_feedback_responses" as any)
        .select("id, user_id, answers, submitted_at")
        .eq("target_type", scope)
        .eq("target_id", targetId)
        .order("submitted_at", { ascending: false });
      const list = (data ?? []) as any[];
      setResponses(list);
      const uids = Array.from(new Set(list.map((r) => r.user_id)));
      if (uids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", uids);
        const map: Record<string, any> = {};
        (ps ?? []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, [open, scope, targetId]);

  const questions = (template?.steps ?? []).flatMap((s) => s.questions);
  const ratingsAvg: Record<string, { sum: number; count: number }> = {};
  responses.forEach((r) => {
    questions.forEach((q) => {
      if (q.type === "rating") {
        const v = r.answers?.[q.id];
        if (typeof v === "number") {
          ratingsAvg[q.id] ??= { sum: 0, count: 0 };
          ratingsAvg[q.id].sum += v;
          ratingsAvg[q.id].count += 1;
        }
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Risposte feedback ({responses.length})</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : responses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Nessuna risposta ricevuta.</p>
        ) : (
          <div className="space-y-4">
            {Object.keys(ratingsAvg).length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <h4 className="text-sm font-semibold">Medie</h4>
                {questions.filter((q) => q.type === "rating" && ratingsAvg[q.id]).map((q) => {
                  const r = ratingsAvg[q.id];
                  const avg = r.sum / r.count;
                  return (
                    <div key={q.id} className="flex items-center justify-between text-sm">
                      <span>{q.label}</span>
                      <span className="flex items-center gap-1 font-semibold">
                        <Star size={14} className="fill-primary text-primary" />
                        {avg.toFixed(2)} <span className="text-xs text-muted-foreground">({r.count})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-3 pr-2">
                {responses.map((r) => {
                  const p = profiles[r.user_id];
                  return (
                    <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{p?.display_name ?? p?.username ?? r.user_id.slice(0, 8)}</span>
                        <span>{new Date(r.submitted_at).toLocaleString("it-IT")}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {questions.map((q) => {
                          const v = r.answers?.[q.id];
                          if (v === undefined || v === null || v === "") return null;
                          return (
                            <div key={q.id}>
                              <span className="text-muted-foreground">{q.label}: </span>
                              <span className="font-medium">
                                {q.type === "rating" ? `${v}/5` :
                                 q.type === "boolean" ? (v ? "Sì" : "No") :
                                 Array.isArray(v) ? v.join(", ") : String(v)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
