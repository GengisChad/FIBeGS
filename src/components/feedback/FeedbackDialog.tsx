import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFeedbackTemplate, FeedbackScope, FeedbackQuestion } from "@/hooks/useFeedbackTemplate";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: FeedbackScope;
  targetId: string;
  onSubmitted?: () => void;
}

export const FeedbackDialog = ({ open, onOpenChange, scope, targetId, onSubmitted }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { template, loading } = useFeedbackTemplate(scope);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setStepIdx(0); setAnswers({}); }
  }, [open]);

  if (!open) return null;

  const steps = template?.steps ?? [];
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const progress = steps.length ? ((stepIdx + 1) / steps.length) * 100 : 0;

  const setAnswer = (qid: string, value: any) => setAnswers((a) => ({ ...a, [qid]: value }));

  const validateStep = (): boolean => {
    if (!step) return true;
    for (const q of step.questions) {
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
          toast({ title: "Campo obbligatorio", description: q.label, variant: "destructive" });
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    if (!validateStep() || !user || !template) return;
    setSubmitting(true);
    const { error } = await supabase.from("event_feedback_responses" as any).insert({
      user_id: user.id,
      target_type: scope,
      target_id: targetId,
      template_id: template.id,
      answers,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Feedback inviato", description: "Grazie!" });
    onSubmitted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template?.name ?? "Feedback"}</DialogTitle>
          {step?.description && <DialogDescription>{step.description}</DialogDescription>}
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : !template || steps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Nessun questionario configurato.</p>
        ) : (
          <div className="space-y-4">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">Step {stepIdx + 1} di {steps.length}</p>

            <div className="space-y-4">
              <h3 className="font-semibold">{step.title}</h3>
              {step.questions.map((q) => (
                <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => i - 1)}>
                Indietro
              </Button>
              {isLast ? (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />} Invia
                </Button>
              ) : (
                <Button onClick={handleNext}>Avanti</Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const QuestionField = ({ q, value, onChange }: { q: FeedbackQuestion; value: any; onChange: (v: any) => void }) => {
  return (
    <div className="space-y-2">
      <Label>{q.label}{q.required && <span className="text-destructive"> *</span>}</Label>
      {q.type === "rating" && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)} className="p-1">
              <Star size={28} className={n <= (value ?? 0) ? "fill-primary text-primary" : "text-muted-foreground"} />
            </button>
          ))}
        </div>
      )}
      {q.type === "text" && (
        <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
      )}
      {q.type === "boolean" && (
        <RadioGroup value={value === true ? "y" : value === false ? "n" : ""} onValueChange={(v) => onChange(v === "y")}>
          <div className="flex gap-4">
            <div className="flex items-center gap-2"><RadioGroupItem value="y" id={`${q.id}-y`} /><Label htmlFor={`${q.id}-y`}>Sì</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="n" id={`${q.id}-n`} /><Label htmlFor={`${q.id}-n`}>No</Label></div>
          </div>
        </RadioGroup>
      )}
      {q.type === "single_choice" && (
        <RadioGroup value={value ?? ""} onValueChange={onChange}>
          {(q.options ?? []).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
              <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
      {q.type === "multi_choice" && (
        <div className="space-y-2">
          {(q.options ?? []).map((opt) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const checked = arr.includes(opt);
            return (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox checked={checked} onCheckedChange={(c) => {
                  if (c) onChange([...arr, opt]); else onChange(arr.filter((o) => o !== opt));
                }} id={`${q.id}-${opt}`} />
                <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
