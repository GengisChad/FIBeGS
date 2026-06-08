import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackScope, FeedbackStep, FeedbackQuestion, FeedbackQuestionType } from "@/hooks/useFeedbackTemplate";

const SCOPES: { value: FeedbackScope; label: string }[] = [
  { value: "tournament", label: "Tornei" },
  { value: "event", label: "Eventi" },
  { value: "championship", label: "Campionati" },
];

const QTYPES: { value: FeedbackQuestionType; label: string }[] = [
  { value: "rating", label: "Voto 1-5 stelle" },
  { value: "text", label: "Testo libero" },
  { value: "boolean", label: "Sì / No" },
  { value: "single_choice", label: "Scelta singola" },
  { value: "multi_choice", label: "Scelta multipla" },
];

export const FeedbackTemplateEditor = () => {
  const [scope, setScope] = useState<FeedbackScope>("tournament");
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Configura questionario feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={scope} onValueChange={(v) => setScope(v as FeedbackScope)}>
          <TabsList className="bg-card border border-border">
            {SCOPES.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
            ))}
          </TabsList>
          {SCOPES.map((s) => (
            <TabsContent key={s.value} value={s.value} className="mt-4">
              <ScopeEditor scope={s.value} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

const ScopeEditor = ({ scope }: { scope: FeedbackScope }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("Questionario feedback");
  const [steps, setSteps] = useState<FeedbackStep[]>([]);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_feedback_templates" as any)
        .select("id, name, steps, is_active")
        .eq("scope", scope)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const t = data as any;
        setTemplateId(t.id);
        setName(t.name ?? "Questionario feedback");
        setSteps((t.steps ?? []) as FeedbackStep[]);
        setActive(!!t.is_active);
      } else {
        setTemplateId(null);
        setSteps([]);
      }
      setLoading(false);
    })();
  }, [scope]);

  const updateStep = (i: number, fn: (s: FeedbackStep) => FeedbackStep) =>
    setSteps((arr) => arr.map((s, idx) => (idx === i ? fn(s) : s)));

  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const addStep = () => setSteps((arr) => [...arr, { title: "Nuovo step", description: "", questions: [] }]);
  const removeStep = (i: number) => setSteps((arr) => arr.filter((_, idx) => idx !== i));

  const addQuestion = (si: number) => updateStep(si, (s) => ({
    ...s,
    questions: [...s.questions, { id: `q_${Date.now()}`, type: "rating", label: "Nuova domanda", required: false }],
  }));

  const updateQuestion = (si: number, qi: number, patch: Partial<FeedbackQuestion>) =>
    updateStep(si, (s) => ({ ...s, questions: s.questions.map((q, idx) => idx === qi ? { ...q, ...patch } : q) }));

  const removeQuestion = (si: number, qi: number) =>
    updateStep(si, (s) => ({ ...s, questions: s.questions.filter((_, idx) => idx !== qi) }));

  const save = async () => {
    setSaving(true);
    const payload = { scope, name, steps: steps as any, is_active: active, created_by: user?.id ?? null };
    let error;
    if (templateId) {
      const res = await supabase.from("event_feedback_templates" as any).update(payload).eq("id", templateId);
      error = res.error;
    } else {
      const res = await supabase.from("event_feedback_templates" as any).insert(payload).select("id").maybeSingle();
      error = res.error;
      if (res.data) setTemplateId((res.data as any).id);
    }
    setSaving(false);
    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else toast({ title: "Salvato" });
  };

  if (loading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>Nome questionario</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} id="active" />
          <Label htmlFor="active">Attivo</Label>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Salva
        </Button>
      </div>

      <div className="space-y-3">
        {steps.map((step, si) => (
          <div key={si} className="rounded-lg border border-border p-3 space-y-3 bg-secondary/30">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input value={step.title} onChange={(e) => updateStep(si, (s) => ({ ...s, title: e.target.value }))} placeholder="Titolo step" />
                <Textarea value={step.description ?? ""} onChange={(e) => updateStep(si, (s) => ({ ...s, description: e.target.value }))} placeholder="Descrizione (opz.)" rows={2} />
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => moveStep(si, -1)}><ArrowUp size={14} /></Button>
                <Button size="icon" variant="ghost" onClick={() => moveStep(si, 1)}><ArrowDown size={14} /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeStep(si)}><Trash2 size={14} className="text-destructive" /></Button>
              </div>
            </div>

            <div className="space-y-2 pl-3 border-l-2 border-border">
              {step.questions.map((q, qi) => (
                <div key={qi} className="rounded border border-border p-2 space-y-2 bg-background">
                  <div className="flex gap-2">
                    <Input className="flex-1" value={q.label} onChange={(e) => updateQuestion(si, qi, { label: e.target.value })} placeholder="Testo domanda" />
                    <Select value={q.type} onValueChange={(v) => updateQuestion(si, qi, { type: v as FeedbackQuestionType })}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QTYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => removeQuestion(si, qi)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!q.required} onCheckedChange={(c) => updateQuestion(si, qi, { required: c })} id={`req-${si}-${qi}`} />
                    <Label htmlFor={`req-${si}-${qi}`} className="text-xs">Obbligatoria</Label>
                  </div>
                  {(q.type === "single_choice" || q.type === "multi_choice") && (
                    <Textarea
                      placeholder="Opzioni (una per riga)"
                      value={(q.options ?? []).join("\n")}
                      onChange={(e) => updateQuestion(si, qi, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                      rows={3}
                    />
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addQuestion(si)} className="gap-1.5">
                <Plus size={14} /> Aggiungi domanda
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={addStep} className="gap-1.5">
          <Plus size={14} /> Aggiungi step
        </Button>
      </div>
    </div>
  );
};
