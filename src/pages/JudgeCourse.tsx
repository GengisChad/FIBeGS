import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap, Pencil, Save, X, PlayCircle, Trash2, Plus, FileText, Heading2, Image as ImageIcon, Video, HelpCircle, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { sanitizeUserHtml } from "@/lib/sanitizeUserHtml";
import { RichTextEditor } from "@/components/forum/RichTextEditor";

const sb = supabase as any;

type StepType = "paragraph" | "subparagraph" | "image" | "video" | "quiz";
interface Course { id: string; title: string; description: string | null; required_for_test: boolean; position: number; category: "judge" | "club_leader"; is_published?: boolean; cover_image_url?: string | null; }
interface QuizData { question?: string; options?: string[]; correctIndex?: number; explanation?: string; }
interface Step {
  id: string; position: number; step_type: StepType; title: string | null;
  content_html: string | null; media_url: string | null; quiz: QuizData | null;
}

function isYouTube(url: string) { return /youtu\.?be/.test(url); }
function ytEmbed(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

// Strip "CORSO NN · " prefix for clean title
const cleanTitle = (t: string) =>
  t.replace(/^CORSO\s+\d+\s*[·\-:]\s*/i, "").replace(/^CORSO\s+MASTER\s*[·\-:]\s*/i, "");

export default function JudgeCourse() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [nextCourseId, setNextCourseId] = useState<string | null>(null);
  const [isLastInCategory, setIsLastInCategory] = useState(false);
  const [displayNum, setDisplayNum] = useState<string>("01");
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);

  // admin editing
  const [editingCourse, setEditingCourse] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [draftCourse, setDraftCourse] = useState<Partial<Course>>({});
  const [draftStep, setDraftStep] = useState<Partial<Step>>({});

  useEffect(() => {
    if (course && isAdmin && searchParams.get("edit") === "1" && !editingCourse) {
      setDraftCourse({ title: course.title, description: course.description, category: course.category, required_for_test: course.required_for_test, is_published: course.is_published, cover_image_url: course.cover_image_url });
      setEditingCourse(true);
    }
  }, [course, isAdmin, searchParams, editingCourse]);

  const loadAll = async (courseId: string) => {
    const { data: c } = await sb.from("judge_courses").select("*").eq("id", courseId).maybeSingle();
    const { data: s } = await sb.from("judge_course_steps").select("*").eq("course_id", courseId).order("position");
    setCourse(c); setSteps(s || []);

    // Find rank within category (required courses only) for display number + next
    if (c) {
      const { data: siblings } = await sb.from("judge_courses")
        .select("id,position,required_for_test")
        .eq("is_published", true)
        .eq("category", c.category)
        .eq("required_for_test", true)
        .order("position");
      const list = (siblings || []) as Array<{ id: string; position: number }>;
      const curIdx = list.findIndex(x => x.id === c.id);
      const nxt = curIdx >= 0 ? list[curIdx + 1] : null;
      setNextCourseId(nxt?.id || null);
      setIsLastInCategory(c.required_for_test && !nxt);
      // Display number = rank within category, not the raw position
      setDisplayNum(String((curIdx >= 0 ? curIdx : 0) + 1).padStart(2, "0"));
    }

    if (user) {
      const { data: p } = await sb.from("judge_course_progress")
        .select("*").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
      if (p) {
        setStepIdx(Math.min(p.current_step, (s || []).length - 1));
        setCompleted(p.completed);
      }
    }
  };

  useEffect(() => { if (id) loadAll(id); }, [id, user?.id]);

  const step = steps[stepIdx];
  const total = steps.length;
  const progress = total ? Math.round(((stepIdx + (completed ? 1 : 0)) / total) * 100) : 0;

  useEffect(() => { setQuizSelected(null); setQuizAnswered(false); }, [stepIdx]);

  const saveProgress = async (nextIdx: number, isCompleted = false) => {
    if (!user || !id) return;
    await sb.from("judge_course_progress").upsert({
      user_id: user.id, course_id: id, current_step: nextIdx,
      completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null,
    }, { onConflict: "user_id,course_id" });
  };

  const next = async () => {
    if (step?.step_type === "quiz" && !quizAnswered) {
      toast({ title: "Rispondi al quiz prima di procedere", variant: "destructive" });
      return;
    }
    if (stepIdx + 1 >= total) {
      setCompleted(true);
      await saveProgress(stepIdx, true);
      toast({ title: "Corso completato!", description: "Ottimo lavoro." });
      return;
    }
    const ni = stepIdx + 1;
    setStepIdx(ni);
    await saveProgress(ni);
  };
  const prev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  const submitQuiz = async () => {
    if (quizSelected == null || !step?.quiz) return;
    const correct = quizSelected === step.quiz.correctIndex;
    setQuizAnswered(true);
    if (user && id) {
      await sb.from("judge_course_quiz_answers").upsert({
        user_id: user.id, step_id: step.id, course_id: id,
        selected_index: quizSelected, is_correct: correct, attempts: 1,
      }, { onConflict: "user_id,step_id" });
    }
    toast({
      title: correct ? "Risposta corretta!" : "Risposta errata",
      description: step.quiz.explanation || undefined,
      variant: correct ? "default" : "destructive",
    });
  };

  // --- ADMIN: course meta editing ---
  const startEditCourse = () => {
    if (!course) return;
    setDraftCourse({ title: course.title, description: course.description, category: course.category, required_for_test: course.required_for_test, is_published: course.is_published, cover_image_url: course.cover_image_url });
    setEditingCourse(true);
  };
  const saveCourseEdits = async () => {
    if (!course) return;
    const { error } = await sb.from("judge_courses").update({
      title: draftCourse.title,
      description: draftCourse.description,
      category: draftCourse.category,
      required_for_test: draftCourse.required_for_test,
      is_published: draftCourse.is_published ?? false,
      cover_image_url: draftCourse.cover_image_url ?? null,
    }).eq("id", course.id);
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    toast({ title: "Corso aggiornato" });
    setEditingCourse(false);
    if (id) loadAll(id);
  };

  // --- ADMIN: step editing ---
  const startEditStep = (s: Step) => {
    setDraftStep({ ...s });
    setEditingStepId(s.id);
  };
  const saveStepEdits = async () => {
    if (!editingStepId) return;
    const { error } = await sb.from("judge_course_steps").update({
      title: draftStep.title,
      content_html: draftStep.content_html,
      media_url: draftStep.media_url,
      quiz: draftStep.quiz,
    }).eq("id", editingStepId);
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    toast({ title: "Step salvato" });
    setEditingStepId(null);
    if (id) loadAll(id);
  };
  const deleteStep = async (s: Step) => {
    if (!confirm("Eliminare lo step?")) return;
    await sb.from("judge_course_steps").delete().eq("id", s.id);
    if (id) loadAll(id);
    if (stepIdx >= steps.length - 1) setStepIdx(Math.max(0, steps.length - 2));
  };
  const moveStep = async (s: Step, dir: -1 | 1) => {
    const idx = steps.findIndex(x => x.id === s.id);
    const swap = steps[idx + dir];
    if (!swap) return;
    await Promise.all([
      sb.from("judge_course_steps").update({ position: swap.position }).eq("id", s.id),
      sb.from("judge_course_steps").update({ position: s.position }).eq("id", swap.id),
    ]);
    if (id) loadAll(id);
  };
  const addStep = async (type: StepType) => {
    if (!course) return;
    const { error } = await sb.from("judge_course_steps").insert({
      course_id: course.id,
      position: steps.length,
      step_type: type,
      title: type === "quiz" ? "Quiz" : "",
      content_html: "",
      quiz: type === "quiz" ? { question: "", options: ["", ""], correctIndex: 0, explanation: "" } : null,
    });
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    if (id) loadAll(id);
  };

  if (!course) return (
    <div className="min-h-screen bg-background"><Navbar /><div className="pt-32 text-center text-muted-foreground">Caricamento…</div><Footer /></div>
  );

  const num = displayNum;
  const isMaster = !course.required_for_test;
  const draftQuiz = (draftStep.quiz || {}) as QuizData;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-20 pb-16 container mx-auto px-3 md:px-4 max-w-4xl">
        <div className="academy-shell relative rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

          {/* Academy header */}
          <div className="flex items-start justify-between gap-4 flex-wrap px-5 md:px-8 pt-6 pb-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                <GraduationCap className="text-primary" size={20} />
              </div>
              <div>
                <h2 className="font-display text-2xl md:text-3xl tracking-wider leading-none">
                  <span className="text-foreground">FIBeGS</span> <span className="text-primary">ACADEMY</span>
                </h2>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                  Corsi monotematici di specializzazione arbitrale
                </p>
              </div>
            </div>
            <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-right">
              <div className="font-display text-lg text-primary leading-none tracking-wider">EDIZIONE 12</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Stagione 2026</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 px-5 md:px-8 py-4 border-b border-border/60 flex-wrap">
            <button type="button" onClick={() => navigate("/rules")} className="inline-flex items-center gap-2 text-sm rounded-md border border-border bg-background/60 px-3 py-2 hover:border-primary/50 transition">
              <ArrowLeft size={14} /> Torna ai corsi
            </button>
            <div className="flex items-center gap-2">
              {completed && <Badge className="gap-1"><CheckCircle2 size={12} /> Completato</Badge>}
              {isAdmin && !editingCourse && (
                <Button size="sm" variant="outline" onClick={startEditCourse}>
                  <Pencil size={14} className="mr-1" /> Modifica corso
                </Button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 md:p-8 space-y-6">
            {/* Course title + description */}
            <div>
              <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] uppercase ${isMaster ? "border-amber-400/50 bg-amber-400/10 text-amber-400" : "border-primary/40 bg-primary/10 text-primary"}`}>
                {isMaster ? "Masterclass" : `Corso ${num}`}
              </span>

              {editingCourse ? (
                <div className="mt-3 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
                  <Input
                    value={draftCourse.title || ""}
                    onChange={(e) => setDraftCourse(d => ({ ...d, title: e.target.value }))}
                    placeholder="Titolo corso"
                  />
                  <Textarea
                    rows={3}
                    value={draftCourse.description || ""}
                    onChange={(e) => setDraftCourse(d => ({ ...d, description: e.target.value }))}
                    placeholder="Descrizione breve"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                      <select
                        value={draftCourse.category || "judge"}
                        onChange={(e) => setDraftCourse(d => ({ ...d, category: e.target.value as any }))}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                      >
                        <option value="judge">Judge</option>
                        <option value="club_leader">Club Leader</option>
                        <option value="tecnico">Tecnico</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                      <select
                        value={draftCourse.required_for_test ? "base" : "master"}
                        onChange={(e) => setDraftCourse(d => ({ ...d, required_for_test: e.target.value === "base" }))}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                      >
                        <option value="base">Corso Base</option>
                        <option value="master">Masterclass</option>
                      </select>
                    </div>
                  </div>
                  <Input
                    placeholder="URL immagine di copertina (opzionale)"
                    value={draftCourse.cover_image_url || ""}
                    onChange={(e) => setDraftCourse(d => ({ ...d, cover_image_url: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md border border-border bg-background/50">
                    <input
                      type="checkbox"
                      checked={!!draftCourse.is_published}
                      onChange={(e) => setDraftCourse(d => ({ ...d, is_published: e.target.checked }))}
                    />
                    <span>Pubblicato (visibile a tutti gli utenti)</span>
                  </label>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingCourse(false)}><X size={14} className="mr-1" />Annulla</Button>
                    <Button size="sm" onClick={saveCourseEdits}><Save size={14} className="mr-1" />Salva</Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-3xl md:text-4xl tracking-wide mt-3 leading-tight">
                    {cleanTitle(course.title)}
                  </h1>
                  {course.description && (
                    <p className="text-muted-foreground mt-2">{course.description}</p>
                  )}
                </>
              )}
            </div>

            {/* Progress */}
            {total > 0 && (
              <div className="flex items-center gap-3">
                <Progress value={progress} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{stepIdx + 1} / {total}</span>
              </div>
            )}

            {/* Step content */}
            {step && (
              <Card className="p-4 md:p-6 space-y-4 bg-background/40">
                {/* Admin step toolbar */}
                {isAdmin && editingStepId !== step.id && (
                  <div className="flex items-center gap-1 justify-end -mt-1 -mr-1">
                    <Button size="icon" variant="ghost" title="Sposta su" onClick={() => moveStep(step, -1)} disabled={stepIdx === 0}><ArrowUp size={14} /></Button>
                    <Button size="icon" variant="ghost" title="Sposta giù" onClick={() => moveStep(step, 1)} disabled={stepIdx === total - 1}><ArrowDown size={14} /></Button>
                    <Button size="sm" variant="outline" onClick={() => startEditStep(step)}><Pencil size={14} className="mr-1" />Modifica step</Button>
                    <Button size="icon" variant="ghost" title="Elimina" onClick={() => deleteStep(step)}><Trash2 size={14} className="text-destructive" /></Button>
                  </div>
                )}

                {/* Inline step editor */}
                {isAdmin && editingStepId === step.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase text-[10px]">{step.step_type}</Badge>
                      <span className="text-xs text-muted-foreground">Step #{stepIdx + 1}</span>
                    </div>
                    <Input
                      placeholder="Titolo step"
                      value={draftStep.title || ""}
                      onChange={(e) => setDraftStep(d => ({ ...d, title: e.target.value }))}
                    />
                    {(step.step_type === "paragraph" || step.step_type === "subparagraph") && (
                      <div className="bg-background rounded border">
                        <RichTextEditor
                          initialContent={draftStep.content_html || ""}
                          onChange={(html) => setDraftStep(d => ({ ...d, content_html: html }))}
                          placeholder="Contenuto del paragrafo (HTML supportato)"
                        />
                      </div>
                    )}
                    {(step.step_type === "image" || step.step_type === "video") && (
                      <>
                        <Input
                          placeholder={step.step_type === "video" ? "URL video (YouTube, mp4…)" : "URL immagine"}
                          value={draftStep.media_url || ""}
                          onChange={(e) => setDraftStep(d => ({ ...d, media_url: e.target.value }))}
                        />
                        <div className="bg-background rounded border">
                          <RichTextEditor
                            initialContent={draftStep.content_html || ""}
                            onChange={(html) => setDraftStep(d => ({ ...d, content_html: html }))}
                            placeholder="Didascalia (opzionale)"
                          />
                        </div>
                      </>
                    )}
                    {step.step_type === "quiz" && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Domanda"
                          value={draftQuiz.question || ""}
                          onChange={(e) => setDraftStep(d => ({ ...d, quiz: { ...(d.quiz || {}), question: e.target.value } as QuizData }))}
                        />
                        {(draftQuiz.options || []).map((opt, oi) => (
                          <div key={oi} className="flex gap-2 items-center">
                            <input type="radio" name={`correct-${step.id}`}
                              checked={draftQuiz.correctIndex === oi}
                              onChange={() => setDraftStep(d => ({ ...d, quiz: { ...(d.quiz as QuizData), correctIndex: oi } }))}
                            />
                            <Input value={opt}
                              onChange={(e) => setDraftStep(d => ({
                                ...d,
                                quiz: { ...(d.quiz as QuizData), options: (d.quiz as QuizData).options!.map((o, j) => j === oi ? e.target.value : o) }
                              }))} />
                            <Button size="icon" variant="ghost" onClick={() => setDraftStep(d => ({
                              ...d, quiz: { ...(d.quiz as QuizData), options: (d.quiz as QuizData).options!.filter((_, j) => j !== oi) }
                            }))}><Trash2 size={14} /></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => setDraftStep(d => ({
                          ...d, quiz: { ...(d.quiz as QuizData), options: [...((d.quiz as QuizData).options || []), ""] }
                        }))}>+ Opzione</Button>
                        <Textarea
                          rows={2} placeholder="Spiegazione"
                          value={draftQuiz.explanation || ""}
                          onChange={(e) => setDraftStep(d => ({ ...d, quiz: { ...(d.quiz as QuizData), explanation: e.target.value } }))}
                        />
                      </div>
                    )}
                    <div className="flex gap-2 justify-end pt-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingStepId(null)}><X size={14} className="mr-1" />Annulla</Button>
                      <Button size="sm" onClick={saveStepEdits}><Save size={14} className="mr-1" />Salva step</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {step.title && (
                      <h2 className={`font-display tracking-wide ${step.step_type === "subparagraph" ? "text-lg" : "text-2xl md:text-3xl"}`}>
                        {step.title}
                      </h2>
                    )}

                    {(step.step_type === "paragraph" || step.step_type === "subparagraph") && step.content_html && (
                      <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(step.content_html) }} />
                    )}

                    {step.step_type === "image" && step.media_url && (
                      <>
                        <img src={step.media_url} alt={step.title || ""} className="rounded-lg w-full border border-border" />
                        {step.content_html && (
                          <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(step.content_html) }} />
                        )}
                      </>
                    )}

                    {step.step_type === "video" && (
                      step.media_url ? (
                        isYouTube(step.media_url) ? (
                          <div className="aspect-video">
                            <iframe src={ytEmbed(step.media_url)} className="w-full h-full rounded-lg" allowFullScreen />
                          </div>
                        ) : (
                          <video src={step.media_url} controls className="w-full rounded-lg" />
                        )
                      ) : (
                        // Gemini-style video placeholder
                        <div className="relative aspect-video rounded-lg border border-border bg-black/40 flex items-center justify-center overflow-hidden">
                          <div className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Simulazione Video
                          </div>
                          <PlayCircle className="text-primary" size={64} strokeWidth={1.5} />
                          {step.content_html && (
                            <div className="absolute bottom-4 left-4 right-4 text-center text-sm text-muted-foreground italic"
                              dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(step.content_html) }} />
                          )}
                        </div>
                      )
                    )}
                    {step.step_type === "video" && step.media_url && step.content_html && (
                      <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(step.content_html) }} />
                    )}

                    {step.step_type === "quiz" && step.quiz && (
                      <div className="space-y-3">
                        <p className="font-medium">{step.quiz.question}</p>
                        <div className="space-y-2">
                          {(step.quiz.options || []).map((opt, i) => {
                            const isCorrect = quizAnswered && i === step.quiz!.correctIndex;
                            const isWrong = quizAnswered && quizSelected === i && i !== step.quiz!.correctIndex;
                            return (
                              <button
                                key={i}
                                disabled={quizAnswered}
                                onClick={() => setQuizSelected(i)}
                                className={`w-full text-left px-3 py-2 rounded border transition ${
                                  isCorrect ? "border-primary bg-primary/10" :
                                  isWrong ? "border-destructive bg-destructive/10" :
                                  quizSelected === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                                }`}
                              >{opt}</button>
                            );
                          })}
                        </div>
                        {!quizAnswered ? (
                          <Button onClick={submitQuiz} disabled={quizSelected == null}>Conferma risposta</Button>
                        ) : (
                          step.quiz.explanation && <p className="text-sm text-muted-foreground italic">{step.quiz.explanation}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* Admin: add step toolbar */}
            {isAdmin && (
              <Card className="p-3 bg-background/40 border-dashed">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Aggiungi step:</span>
                  <Button size="sm" variant="outline" onClick={() => addStep("paragraph")}><FileText size={12} className="mr-1" />Paragrafo</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("subparagraph")}><Heading2 size={12} className="mr-1" />Sottoparagrafo</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("image")}><ImageIcon size={12} className="mr-1" />Immagine</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("video")}><Video size={12} className="mr-1" />Video</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("quiz")}><HelpCircle size={12} className="mr-1" />Quiz</Button>
                </div>
              </Card>
            )}

            {/* Nav */}
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={prev} disabled={stepIdx === 0}>
                <ArrowLeft size={14} className="mr-1" /> Indietro
              </Button>
              {!completed ? (
                <Button onClick={next}>
                  {stepIdx + 1 >= total ? "Completa corso" : "Avanti"} <ArrowRight size={14} className="ml-1" />
                </Button>
              ) : nextCourseId ? (
                <Button onClick={() => navigate(`/corso-judges/${nextCourseId}`)}>
                  Corso successivo <ArrowRight size={14} className="ml-1" />
                </Button>
              ) : isLastInCategory ? (
                <Button onClick={() => navigate(course.category === "club_leader" ? "/test-club-leader" : "/test-arbitri")}>
                  Vai al Test {course.category === "club_leader" ? "Club Leader" : "Judge"} <ArrowRight size={14} className="ml-1" />
                </Button>
              ) : (
                <Button onClick={() => navigate("/regole")}>
                  Torna ai corsi <ArrowRight size={14} className="ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
