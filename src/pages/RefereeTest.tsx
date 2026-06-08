import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useRefereeTestStatus } from "@/hooks/useRefereeTestStatus";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Shield, CheckCircle, Clock, Pencil, Plus, Trash2, Upload, ImageIcon, Video, Settings, ArrowLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { sanitizeUserHtml } from "@/lib/sanitizeUserHtml";
import { RichTextEditor } from "@/components/forum/RichTextEditor";

interface Question {
  id: string;
  question_text: string;
  media_url: string | null;
  media_type: string;
  is_multiple_choice: boolean;
  sort_order: number;
  answers: Answer[];
}

interface Answer {
  id: string;
  answer_text: string;
  is_correct: boolean;
  sort_order: number;
}

interface TestSettings {
  id: string;
  test_intro: string;
  pass_percentage: number;
  cooldown_days: number;
  badge_id: string | null;
}

const RefereeTest = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { passed, cooldownUntil, loading: statusLoading } = useRefereeTestStatus();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<TestSettings | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; percentage: number } | null>(null);
  const [countdown, setCountdown] = useState("");

  // Admin state
  const [editingIntro, setEditingIntro] = useState(false);
  const [introForm, setIntroForm] = useState("");
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ pass_percentage: 80, cooldown_days: 7, badge_id: "" });
  const [badges, setBadges] = useState<{ id: string; name: string }[]>([]);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [qForm, setQForm] = useState({ question_text: "", media_url: "", media_type: "image", is_multiple_choice: false });
  const [qAnswers, setQAnswers] = useState<{ text: string; is_correct: boolean }[]>([{ text: "", is_correct: false }]);
  const [savingQ, setSavingQ] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchQuestions();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      supabase.from("badges").select("id, name").then(({ data }) => {
        if (data) setBadges(data);
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const update = () => {
      const diff = cooldownUntil.getTime() - Date.now();
      if (diff <= 0) { setCountdown(""); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d}g ${h}h ${m}m`);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [cooldownUntil]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("referee_test_settings")
      .select("id, test_intro, pass_percentage, cooldown_days, badge_id")
      .eq("test_type", "referee")
      .limit(1)
      .maybeSingle();
    if (data) setSettings(data);
  };

  const fetchQuestions = async () => {
    const { data: qs } = await supabase
      .from("referee_test_questions" as any)
      .select("*")
      .eq("test_type", "referee")
      .order("sort_order");
    if (!qs) return;

    // Admins can read answers directly (RLS allows it), others use safe RPC
    let ans: any[] = [];
    if (isAdmin) {
      const qIds = (qs as any[]).map((q: any) => q.id);
      if (qIds.length > 0) {
        const { data } = await supabase
          .from("referee_test_answers")
          .select("*")
          .in("question_id", qIds)
          .order("sort_order");
        ans = data || [];
      }
    } else {
      const { data } = await supabase.rpc("get_test_answers_safe", { _test_type: "referee" });
      ans = (data || []).map((a: any) => ({ ...a, is_correct: false }));
    }

    setQuestions((qs as any[]).map((q: any) => ({
      ...q,
      answers: ans.filter((a: any) => a.question_id === q.id),
    })));
  };

  const handleSelectAnswer = (questionId: string, answerId: string, isMultiple: boolean) => {
    setUserAnswers(prev => {
      const current = prev[questionId] || [];
      if (isMultiple) {
        return {
          ...prev,
          [questionId]: current.includes(answerId)
            ? current.filter(a => a !== answerId)
            : [...current, answerId],
        };
      }
      return { ...prev, [questionId]: [answerId] };
    });
  };

  const handleSubmitTest = async () => {
    setSubmitting(true);
    const answers = questions.map(q => ({
      question_id: q.id,
      answer_ids: userAnswers[q.id] || [],
    }));

    const { data, error } = await supabase.rpc("submit_referee_test", {
      _answers: answers,
      _test_type: "referee",
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }

    const res = data as any;
    if (res.error === "already_passed") {
      toast({ title: "Hai già superato il test!" });
      return;
    }
    if (res.error === "cooldown") {
      toast({ title: "Devi attendere prima di riprovare", variant: "destructive" });
      return;
    }

    setResult({ score: res.score, total: res.total, passed: res.passed, percentage: res.percentage });
  };

  // Admin handlers
  const handleSaveIntro = async () => {
    if (!settings) return;
    await supabase.from("referee_test_settings").update({ test_intro: introForm }).eq("id", settings.id);
    setSettings({ ...settings, test_intro: introForm });
    setEditingIntro(false);
    toast({ title: "Intro aggiornata" });
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    await supabase.from("referee_test_settings").update({
      pass_percentage: settingsForm.pass_percentage,
      cooldown_days: settingsForm.cooldown_days,
      badge_id: settingsForm.badge_id || null,
    }).eq("id", settings.id);
    setSettings({ ...settings, ...settingsForm, badge_id: settingsForm.badge_id || null });
    setEditingSettings(false);
    toast({ title: "Impostazioni salvate" });
  };

  const handleMediaUpload = async (file: File): Promise<string | null> => {
    try { file = await prepareImageForUpload(file, { maxDimension: 1600 }); }
    catch (err: any) { toast({ title: err?.message || "File non valido", variant: "destructive" }); return null; }
    const ext = file.name.split(".").pop();
    const path = `questions/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("referee-test").upload(path, file, { contentType: file.type });
    if (error) { toast({ title: "Errore upload", variant: "destructive" }); return null; }
    return supabase.storage.from("referee-test").getPublicUrl(path).data.publicUrl;
  };

  const handleSaveQuestion = async () => {
    if (!qForm.question_text.trim() || qAnswers.filter(a => a.text.trim()).length < 2) {
      toast({ title: "Serve almeno un testo domanda e 2 risposte", variant: "destructive" });
      return;
    }
    if (!qAnswers.some(a => a.is_correct)) {
      toast({ title: "Seleziona almeno una risposta corretta", variant: "destructive" });
      return;
    }

    setSavingQ(true);

    if (editingQuestion) {
      // Update
      await supabase.from("referee_test_questions").update({
        question_text: qForm.question_text,
        media_url: qForm.media_url || null,
        media_type: qForm.media_type,
        is_multiple_choice: qForm.is_multiple_choice,
      }).eq("id", editingQuestion.id);

      // Delete old answers and re-insert
      await supabase.from("referee_test_answers").delete().eq("question_id", editingQuestion.id);
      const validAnswers = qAnswers.filter(a => a.text.trim());
      await supabase.from("referee_test_answers").insert(
        validAnswers.map((a, i) => ({
          question_id: editingQuestion.id,
          answer_text: a.text,
          is_correct: a.is_correct,
          sort_order: i,
        }))
      );
    } else {
      // Insert new
      const { data: newQ } = await supabase.from("referee_test_questions").insert({
        question_text: qForm.question_text,
        media_url: qForm.media_url || null,
        media_type: qForm.media_type,
        is_multiple_choice: qForm.is_multiple_choice,
        sort_order: questions.length,
      }).select().single();

      if (newQ) {
        const validAnswers = qAnswers.filter(a => a.text.trim());
        await supabase.from("referee_test_answers").insert(
          validAnswers.map((a, i) => ({
            question_id: newQ.id,
            answer_text: a.text,
            is_correct: a.is_correct,
            sort_order: i,
          }))
        );
      }
    }

    setSavingQ(false);
    setAddingQuestion(false);
    setEditingQuestion(null);
    resetQForm();
    fetchQuestions();
    toast({ title: "Domanda salvata" });
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm("Eliminare questa domanda?")) return;
    await supabase.from("referee_test_questions").delete().eq("id", qId);
    fetchQuestions();
    toast({ title: "Domanda eliminata" });
  };

  const resetQForm = () => {
    setQForm({ question_text: "", media_url: "", media_type: "image", is_multiple_choice: false });
    setQAnswers([{ text: "", is_correct: false }]);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQForm({
      question_text: q.question_text,
      media_url: q.media_url || "",
      media_type: q.media_type,
      is_multiple_choice: q.is_multiple_choice,
    });
    setQAnswers(q.answers.map(a => ({ text: a.answer_text, is_correct: a.is_correct })));
    setAddingQuestion(true);
  };

  const renderDescription = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 text-muted-foreground">
            {listItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
        listItems = [];
      }
    };
    lines.forEach((line, i) => {
      if (line.startsWith("- ") || line.startsWith("• ")) {
        listItems.push(line.substring(2));
      } else {
        flushList();
        elements.push(<p key={`p-${i}`} className="text-muted-foreground">{line || "\u00A0"}</p>);
      }
    });
    flushList();
    return elements;
  };

  const renderMedia = (url: string | null, type: string) => {
    if (!url) return null;
    if (type === "video") {
      if (url.includes("youtube") || url.includes("youtu.be")) {
        const videoId = url.includes("youtu.be") ? url.split("/").pop() : new URL(url).searchParams.get("v");
        return (
          <div className="aspect-video rounded-lg overflow-hidden mb-4">
            <iframe src={`https://www.youtube.com/embed/${videoId}`} className="w-full h-full" allowFullScreen />
          </div>
        );
      }
      return <video src={url} controls className="w-full rounded-lg mb-4 max-h-64" />;
    }
    return <img src={url} alt="" className="w-full rounded-lg mb-4 max-h-64 object-contain" />;
  };

  const canStartTest = !passed && !cooldownUntil && user && accepted;
  const allAnswered = questions.every(q => (userAnswers[q.id] || []).length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-20 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/rules" className="gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
                Torna alle regole
              </Link>
            </Button>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <Shield className="mx-auto mb-3 text-primary" size={48} />
            <h1 className="font-display text-4xl font-bold mb-2">
              Test Arbitri <span className="gradient-text">FIB</span>
            </h1>
          </div>

          {/* Result overlay */}
          {result && (
            <Card className="mb-8 border-2 border-primary">
              <CardContent className="pt-6 text-center space-y-4">
                {result.passed ? (
                  <>
                    <CheckCircle className="mx-auto text-green-500" size={48} />
                    <h2 className="text-2xl font-bold text-green-500">Test Superato!</h2>
                    <p className="text-muted-foreground">
                      Hai risposto correttamente al {result.percentage}% delle domande ({result.score}/{result.total}).
                    </p>
                    <Button onClick={() => navigate("/rules")}>Torna al Regolamento</Button>
                  </>
                ) : (
                  <>
                    <Clock className="mx-auto text-destructive" size={48} />
                    <h2 className="text-2xl font-bold text-destructive">Test Non Superato</h2>
                    <p className="text-muted-foreground">
                      Hai risposto correttamente al {result.percentage}% delle domande ({result.score}/{result.total}).
                      Serviva almeno l'{settings?.pass_percentage || 80}%.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Potrai riprovare tra {settings?.cooldown_days || 7} giorni.
                    </p>
                    <Button onClick={() => navigate("/rules")} variant="outline">Torna al Regolamento</Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Intro section */}
          {!testStarted && !result && (
            <Card className="mb-8">
              <CardContent className="pt-6 space-y-4">
                <div className="relative">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0"
                      onClick={() => { setIntroForm(settings?.test_intro || ""); setEditingIntro(true); }}
                    >
                      <Pencil size={14} />
                    </Button>
                  )}
                  <div className="space-y-2 pr-10">
                    {renderDescription(settings?.test_intro || "Descrizione del test non ancora configurata.")}
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-4">
                  {passed ? (
                    <div className="flex items-center gap-2 text-green-500 font-semibold">
                      <CheckCircle size={20} />
                      SEI ABILITATO - Hai già superato il test
                    </div>
                  ) : cooldownUntil ? (
                    <div className="flex items-center gap-2 text-destructive font-semibold">
                      <Clock size={20} />
                      Riprova tra {countdown}
                    </div>
                  ) : !user ? (
                    <p className="text-muted-foreground text-sm">Devi effettuare il login per avviare il test.</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="accept"
                          checked={accepted}
                          onCheckedChange={v => setAccepted(!!v)}
                        />
                        <label htmlFor="accept" className="text-sm cursor-pointer">
                          Ho letto e accetto le regole del test
                        </label>
                      </div>
                      <Button
                        disabled={!canStartTest || questions.length === 0}
                        onClick={() => { setCurrentStep(0); setTestStarted(true); }}
                        className="gap-2"
                      >
                        <Shield size={16} />
                        AVVIA TEST
                      </Button>
                      {questions.length === 0 && (
                        <p className="text-xs text-muted-foreground">Il test non è ancora disponibile.</p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test questions */}
          {testStarted && !result && (() => {
            const total = questions.length;
            const idx = Math.min(currentStep, Math.max(0, total - 1));
            const q = questions[idx];
            const answeredCount = questions.filter(qq => (userAnswers[qq.id] || []).length > 0).length;
            const isLast = idx === total - 1;
            const canNext = (userAnswers[q?.id] || []).length > 0;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${((idx + (canNext ? 1 : 0)) / total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{idx + 1}/{total}</span>
                </div>
                {q && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="mb-4">
                        {renderMedia(q.media_url, q.media_type)}
                        <div
                          className="prose prose-invert max-w-none font-medium"
                          dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(q.question_text) }}
                        />
                        {q.is_multiple_choice && (
                          <span className="text-xs text-muted-foreground">(Risposta multipla)</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {q.answers.map(a => {
                          const selected = (userAnswers[q.id] || []).includes(a.id);
                          return (
                            <button
                              key={a.id}
                              onClick={() => handleSelectAnswer(q.id, a.id, q.is_multiple_choice)}
                              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                                selected ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/50"
                              }`}
                            >
                              {a.answer_text}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div className="flex justify-between items-center pt-2">
                  <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={idx === 0}>
                    Indietro
                  </Button>
                  <span className="text-xs text-muted-foreground">{answeredCount}/{total} risposte</span>
                  {isLast ? (
                    <Button disabled={answeredCount < total || submitting} onClick={handleSubmitTest}>
                      {submitting ? "Invio..." : "Invia test"}
                    </Button>
                  ) : (
                    <Button disabled={!canNext} onClick={() => setCurrentStep(s => s + 1)}>Avanti</Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ADMIN PANEL */}
          {isAdmin && !testStarted && (
            <div className="mt-12 space-y-6">
              <div className="flex items-center gap-3">
                <Settings size={24} className="text-primary" />
                <h2 className="text-2xl font-bold">Pannello Admin - Gestione Test</h2>
              </div>

              {/* Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Impostazioni Test
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSettingsForm({
                        pass_percentage: settings?.pass_percentage || 80,
                        cooldown_days: settings?.cooldown_days || 7,
                        badge_id: settings?.badge_id || "",
                      });
                      setEditingSettings(true);
                    }}>
                      <Pencil size={14} className="mr-1" /> Modifica
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Soglia superamento:</span>
                      <p className="font-semibold">{settings?.pass_percentage || 80}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cooldown:</span>
                      <p className="font-semibold">{settings?.cooldown_days || 7} giorni</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Badge:</span>
                      <p className="font-semibold">
                        {settings?.badge_id
                          ? badges.find(b => b.id === settings.badge_id)?.name || "Selezionato"
                          : "Nessuno"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Questions list */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Domande ({questions.length})
                    <Button size="sm" onClick={() => { resetQForm(); setEditingQuestion(null); setAddingQuestion(true); }}>
                      <Plus size={14} className="mr-1" /> Aggiungi
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {questions.length === 0 && (
                    <p className="text-muted-foreground text-sm">Nessuna domanda creata.</p>
                  )}
                  {questions.map((q, i) => (
                    <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <Badge variant="outline">{i + 1}</Badge>
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-medium text-sm line-clamp-2 [&_*]:inline [&_p]:inline"
                          dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(q.question_text) }}
                        />
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {q.is_multiple_choice && <Badge variant="secondary" className="text-xs">Multipla</Badge>}
                          {q.media_url && <Badge variant="secondary" className="text-xs">{q.media_type}</Badge>}
                          <span className="text-xs text-muted-foreground">{q.answers.length} risposte</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEditQuestion(q)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* Edit intro dialog */}
      <Dialog open={editingIntro} onOpenChange={setEditingIntro}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica Introduzione Test</DialogTitle></DialogHeader>
          <Textarea rows={10} value={introForm} onChange={e => setIntroForm(e.target.value)} placeholder='Usa "- " per elenchi puntati' />
          <Button onClick={handleSaveIntro}>Salva</Button>
        </DialogContent>
      </Dialog>

      {/* Edit settings dialog */}
      <Dialog open={editingSettings} onOpenChange={setEditingSettings}>
        <DialogContent>
          <DialogHeader><DialogTitle>Impostazioni Test</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Soglia superamento (%)</Label>
              <Input type="number" min={1} max={100} value={settingsForm.pass_percentage}
                onChange={e => setSettingsForm({ ...settingsForm, pass_percentage: parseInt(e.target.value) || 80 })} />
            </div>
            <div>
              <Label>Giorni di cooldown</Label>
              <Input type="number" min={1} value={settingsForm.cooldown_days}
                onChange={e => setSettingsForm({ ...settingsForm, cooldown_days: parseInt(e.target.value) || 7 })} />
            </div>
            <div>
              <Label>Badge assegnato al superamento</Label>
              <Select value={settingsForm.badge_id} onValueChange={v => setSettingsForm({ ...settingsForm, badge_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona badge" /></SelectTrigger>
                <SelectContent>
                  {badges.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveSettings} className="w-full">Salva</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit question dialog */}
      <Dialog open={addingQuestion} onOpenChange={v => { if (!v) { setAddingQuestion(false); setEditingQuestion(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Modifica Domanda" : "Nuova Domanda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Media */}
            <div>
              <Label>Media (URL immagine/video/GIF oppure carica)</Label>
              <div className="flex gap-2">
                <Input
                  value={qForm.media_url}
                  onChange={e => setQForm({ ...qForm, media_url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1"
                />
                <label className="cursor-pointer">
                  <Button variant="outline" size="icon" asChild>
                    <span><Upload size={16} /></span>
                  </Button>
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={async e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await handleMediaUpload(f);
                    if (url) {
                      const type = f.type.startsWith("video") ? "video" : "image";
                      setQForm({ ...qForm, media_url: url, media_type: type });
                    }
                  }} />
                </label>
              </div>
              <Select value={qForm.media_type} onValueChange={v => setQForm({ ...qForm, media_type: v })}>
                <SelectTrigger className="mt-2 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Immagine</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="gif">GIF</SelectItem>
                </SelectContent>
              </Select>
              {qForm.media_url && renderMedia(qForm.media_url, qForm.media_type)}
            </div>

            {/* Question text */}
            <div>
              <Label>Testo domanda</Label>
              <div className="bg-background rounded border">
                <RichTextEditor
                  initialContent={qForm.question_text}
                  onChange={(html) => setQForm({ ...qForm, question_text: html })}
                  placeholder="Scrivi la domanda. Usa la toolbar per formattare (grassetto, liste, link, immagini, colori…)"
                />
              </div>
            </div>

            {/* Multiple choice toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={qForm.is_multiple_choice} onCheckedChange={v => setQForm({ ...qForm, is_multiple_choice: v })} />
              <Label>Risposta multipla</Label>
            </div>

            {/* Answers */}
            <div>
              <Label>Risposte</Label>
              <div className="space-y-2 mt-2">
                {qAnswers.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={a.is_correct}
                      onCheckedChange={v => {
                        const updated = [...qAnswers];
                        if (!qForm.is_multiple_choice) {
                          updated.forEach(u => u.is_correct = false);
                        }
                        updated[i].is_correct = !!v;
                        setQAnswers(updated);
                      }}
                    />
                    <Input
                      value={a.text}
                      onChange={e => {
                        const updated = [...qAnswers];
                        updated[i].text = e.target.value;
                        setQAnswers(updated);
                      }}
                      placeholder={`Risposta ${i + 1}`}
                      className="flex-1"
                    />
                    {qAnswers.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setQAnswers(qAnswers.filter((_, j) => j !== i))}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setQAnswers([...qAnswers, { text: "", is_correct: false }])}>
                  <Plus size={14} className="mr-1" /> Aggiungi risposta
                </Button>
              </div>
            </div>

            <Button onClick={handleSaveQuestion} disabled={savingQ} className="w-full">
              {savingQ ? "Salvataggio..." : "Salva Domanda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RefereeTest;
