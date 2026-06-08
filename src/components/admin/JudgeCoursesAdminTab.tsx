import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/forum/RichTextEditor";
import { sanitizeUserHtml } from "@/lib/sanitizeUserHtml";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Eye, Pencil, FileText, Image as ImageIcon, Video, HelpCircle, Heading2, GripVertical } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableCourseItem } from "./SortableCourseItem";

type StepType = "paragraph" | "subparagraph" | "image" | "video" | "quiz";

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  required_for_test: boolean;
  position: number;
}

interface QuizData {
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
}

interface Step {
  id: string;
  course_id: string;
  position: number;
  step_type: StepType;
  title: string | null;
  content_html: string | null;
  media_url: string | null;
  quiz: QuizData | null;
}

const sb = supabase as any;

const STEP_ICONS: Record<StepType, JSX.Element> = {
  paragraph: <FileText size={14} />,
  subparagraph: <Heading2 size={14} />,
  image: <ImageIcon size={14} />,
  video: <Video size={14} />,
  quiz: <HelpCircle size={14} />,
};

function isYouTube(u: string) { return /youtu\.?be/.test(u); }
function ytEmbed(u: string) {
  const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : u;
}

export default function JudgeCoursesAdminTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [previewStepIdx, setPreviewStepIdx] = useState(0);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(false);

  const loadCourses = async () => {
    const { data } = await sb.from("judge_courses").select("*").order("position");
    setCourses(data || []);
  };
  const loadSteps = async (courseId: string) => {
    const { data } = await sb.from("judge_course_steps").select("*").eq("course_id", courseId).order("position");
    setSteps(data || []);
    setPreviewStepIdx(0);
  };

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { if (selected) loadSteps(selected.id); }, [selected?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onCoursesDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = courses.findIndex(c => c.id === active.id);
    const newIdx = courses.findIndex(c => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(courses, oldIdx, newIdx);
    setCourses(reordered);
    // Persist new positions (sequential)
    await Promise.all(
      reordered.map((c, i) =>
        c.position !== i
          ? sb.from("judge_courses").update({ position: i }).eq("id", c.id)
          : Promise.resolve()
      )
    );
    loadCourses();
  };

  const createCourse = async () => {
    const { data, error } = await sb.from("judge_courses").insert({
      title: "Nuovo corso",
      position: courses.length,
    }).select().single();
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    await loadCourses();
    setSelected(data);
  };

  const saveCourse = async () => {
    if (!selected) return;
    setLoading(true);
    const { error } = await sb.from("judge_courses").update({
      title: selected.title,
      description: selected.description,
      cover_image_url: selected.cover_image_url,
      is_published: selected.is_published,
      required_for_test: selected.required_for_test,
    }).eq("id", selected.id);
    setLoading(false);
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    toast({ title: "Corso salvato" });
    loadCourses();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Eliminare il corso e tutti i suoi step?")) return;
    const { error } = await sb.from("judge_courses").delete().eq("id", id);
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    setSelected(null); setSteps([]); loadCourses();
  };

  const addStep = async (type: StepType) => {
    if (!selected) return;
    const { error } = await sb.from("judge_course_steps").insert({
      course_id: selected.id,
      position: steps.length,
      step_type: type,
      title: type === "quiz" ? "Quiz" : "",
      content_html: "",
      quiz: type === "quiz" ? { question: "", options: ["", ""], correctIndex: 0, explanation: "" } : null,
    });
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    loadSteps(selected.id);
  };

  const updateStep = async (s: Step) => {
    const { error } = await sb.from("judge_course_steps").update({
      title: s.title,
      content_html: s.content_html,
      media_url: s.media_url,
      quiz: s.quiz,
    }).eq("id", s.id);
    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else toast({ title: "Step salvato" });
  };

  const updateStepLocal = (id: string, patch: Partial<Step>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const deleteStep = async (id: string) => {
    if (!confirm("Eliminare lo step?")) return;
    await sb.from("judge_course_steps").delete().eq("id", id);
    if (selected) loadSteps(selected.id);
  };

  const moveStep = async (s: Step, dir: -1 | 1) => {
    const idx = steps.findIndex(x => x.id === s.id);
    const swap = steps[idx + dir];
    if (!swap) return;
    await Promise.all([
      sb.from("judge_course_steps").update({ position: swap.position }).eq("id", s.id),
      sb.from("judge_course_steps").update({ position: s.position }).eq("id", swap.id),
    ]);
    if (selected) loadSteps(selected.id);
  };

  const uploadMedia = async (s: Step, file: File) => {
    try { file = await prepareImageForUpload(file, { maxDimension: 1600 }); }
    catch (err: any) { return toast({ title: err?.message || "File non valido", variant: "destructive" }); }
    const path = `${s.course_id}/${s.id}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("judge-course-media").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast({ title: "Upload fallito", description: error.message, variant: "destructive" });
    const { data } = supabase.storage.from("judge-course-media").getPublicUrl(path);
    updateStepLocal(s.id, { media_url: data.publicUrl });
    await sb.from("judge_course_steps").update({ media_url: data.publicUrl }).eq("id", s.id);
  };

  const previewStep = steps[previewStepIdx];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-4">
      {/* Course list */}
      <Card className="p-3 space-y-2 self-start">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Corsi ({courses.length})</h3>
          <Button size="sm" onClick={createCourse}><Plus size={14} /> Nuovo</Button>
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><GripVertical size={10} /> Trascina per riordinare</p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onCoursesDragEnd}
        >
          <SortableContext items={courses.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {courses.map(c => (
              <SortableCourseItem key={c.id} id={c.id} handle="row">
                <button
                  onClick={() => setSelected(c)}
                  className={`w-full text-left px-3 py-2 rounded border transition flex items-start gap-2 ${selected?.id === c.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                >
                  <GripVertical size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground flex gap-1 flex-wrap mt-0.5">
                      <Badge variant={c.is_published ? "default" : "outline"} className="text-[9px] px-1.5 py-0">{c.is_published ? "Pubblicato" : "Bozza"}</Badge>
                      {c.required_for_test && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Obbligatorio</Badge>}
                      {(c as any).category === "club_leader" && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Club Leader</Badge>}
                    </div>
                  </div>
                </button>
              </SortableCourseItem>
            ))}
          </SortableContext>
        </DndContext>
      </Card>

      {/* Editor / preview */}
      <Card className="p-4 space-y-4">
        {!selected ? (
          <p className="text-muted-foreground text-sm">Seleziona o crea un corso per iniziare.</p>
        ) : (
          <>
            <div className="grid gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Titolo</Label>
                  <Input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} />
                </div>
                <div>
                  <Label>URL Copertina (opzionale)</Label>
                  <Input value={selected.cover_image_url || ""} onChange={(e) => setSelected({ ...selected, cover_image_url: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrizione breve</Label>
                <Textarea rows={2} value={selected.description || ""} onChange={(e) => setSelected({ ...selected, description: e.target.value })} />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={selected.is_published} onCheckedChange={(v) => setSelected({ ...selected, is_published: v })} />
                  Pubblicato
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={selected.required_for_test} onCheckedChange={(v) => setSelected({ ...selected, required_for_test: v })} />
                  Obbligatorio per test judges
                </label>
                <Button onClick={saveCourse} disabled={loading} size="sm" className="ml-auto"><Save size={14} /> Salva corso</Button>
                <Button onClick={() => deleteCourse(selected.id)} variant="destructive" size="sm"><Trash2 size={14} /> Elimina</Button>
              </div>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList>
                <TabsTrigger value="edit"><Pencil size={14} className="mr-1" /> Editor</TabsTrigger>
                <TabsTrigger value="preview"><Eye size={14} className="mr-1" /> Anteprima</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <h3 className="font-semibold mr-2">Step ({steps.length})</h3>
                  <Button size="sm" variant="outline" onClick={() => addStep("paragraph")}><FileText size={12} className="mr-1" /> Paragrafo</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("subparagraph")}><Heading2 size={12} className="mr-1" /> Sottoparagrafo</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("image")}><ImageIcon size={12} className="mr-1" /> Immagine</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("video")}><Video size={12} className="mr-1" /> Video</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("quiz")}><HelpCircle size={12} className="mr-1" /> Quiz</Button>
                </div>

                {steps.map((s, i) => (
                  <Card key={s.id} className="p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="gap-1 uppercase text-[10px]">{STEP_ICONS[s.step_type]} {s.step_type}</Badge>
                      <span className="text-xs text-muted-foreground">Step #{i + 1}</span>
                      <div className="ml-auto flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => moveStep(s, -1)} disabled={i === 0}><ArrowUp size={14} /></Button>
                        <Button size="icon" variant="ghost" onClick={() => moveStep(s, 1)} disabled={i === steps.length - 1}><ArrowDown size={14} /></Button>
                        <Button size="icon" variant="ghost" onClick={() => updateStep(s)} title="Salva step"><Save size={14} /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteStep(s.id)}><Trash2 size={14} /></Button>
                      </div>
                    </div>

                    <Input
                      placeholder="Titolo step (opzionale)"
                      value={s.title || ""}
                      onChange={(e) => updateStepLocal(s.id, { title: e.target.value })}
                    />

                    {(s.step_type === "paragraph" || s.step_type === "subparagraph") && (
                      <div className="bg-background rounded border">
                        <RichTextEditor
                          initialContent={s.content_html || ""}
                          onChange={(html) => updateStepLocal(s.id, { content_html: html })}
                          placeholder="Scrivi il contenuto. Formatta con la toolbar (grassetto, liste, link, immagini, colori…)"
                        />
                      </div>
                    )}

                    {s.step_type === "image" && (
                      <div className="space-y-2">
                        <input type="file" accept="image/*" onChange={(e) => {
                          const f = e.target.files?.[0]; if (f) uploadMedia(s, f);
                        }} />
                        {s.media_url && <img src={s.media_url} alt="" className="max-h-48 rounded border" />}
                        <Input placeholder="Oppure URL diretto" value={s.media_url || ""}
                          onChange={(e) => updateStepLocal(s.id, { media_url: e.target.value })} />
                        <div className="bg-background rounded border">
                          <RichTextEditor
                            initialContent={s.content_html || ""}
                            onChange={(html) => updateStepLocal(s.id, { content_html: html })}
                            placeholder="Didascalia formattata (opzionale)"
                          />
                        </div>
                      </div>
                    )}

                    {s.step_type === "video" && (
                      <div className="space-y-2">
                        <Input placeholder="URL video (YouTube, mp4, ecc.)" value={s.media_url || ""}
                          onChange={(e) => updateStepLocal(s.id, { media_url: e.target.value })} />
                        <div className="bg-background rounded border">
                          <RichTextEditor
                            initialContent={s.content_html || ""}
                            onChange={(html) => updateStepLocal(s.id, { content_html: html })}
                            placeholder="Descrizione formattata (opzionale)"
                          />
                        </div>
                      </div>
                    )}

                    {s.step_type === "quiz" && s.quiz && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Domanda"
                          value={s.quiz.question || ""}
                          onChange={(e) => updateStepLocal(s.id, { quiz: { ...s.quiz!, question: e.target.value } })}
                        />
                        {(s.quiz.options || []).map((opt, oi) => (
                          <div key={oi} className="flex gap-2 items-center">
                            <input type="radio" name={`correct-${s.id}`}
                              checked={s.quiz!.correctIndex === oi}
                              onChange={() => updateStepLocal(s.id, { quiz: { ...s.quiz!, correctIndex: oi } })}
                            />
                            <Input value={opt}
                              onChange={(e) => updateStepLocal(s.id, {
                                quiz: { ...s.quiz!, options: s.quiz!.options!.map((o, j) => j === oi ? e.target.value : o) }
                              })} />
                            <Button size="icon" variant="ghost" onClick={() => updateStepLocal(s.id, {
                              quiz: { ...s.quiz!, options: s.quiz!.options!.filter((_, j) => j !== oi) }
                            })}><Trash2 size={14} /></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => updateStepLocal(s.id, {
                          quiz: { ...s.quiz!, options: [...(s.quiz!.options || []), ""] }
                        })}>+ Opzione</Button>
                        <Textarea rows={2} placeholder="Spiegazione (mostrata dopo la risposta)"
                          value={s.quiz.explanation || ""}
                          onChange={(e) => updateStepLocal(s.id, { quiz: { ...s.quiz!, explanation: e.target.value } })}
                        />
                      </div>
                    )}
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="preview">
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nessuno step da mostrare.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {steps.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPreviewStepIdx(i)}
                          className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center border transition ${i === previewStepIdx ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                        >{i + 1}</button>
                      ))}
                    </div>
                    {previewStep && (
                      <Card className="p-6 bg-background space-y-3">
                        {previewStep.title && (
                          <h2 className={previewStep.step_type === "subparagraph" ? "text-lg font-semibold" : "text-2xl font-bold"}>{previewStep.title}</h2>
                        )}
                        {(previewStep.step_type === "paragraph" || previewStep.step_type === "subparagraph") && previewStep.content_html && (
                          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(previewStep.content_html) }} />
                        )}
                        {previewStep.step_type === "image" && previewStep.media_url && (
                          <img src={previewStep.media_url} alt="" className="rounded-lg w-full" />
                        )}
                        {previewStep.step_type === "video" && previewStep.media_url && (
                          isYouTube(previewStep.media_url) ? (
                            <div className="aspect-video"><iframe src={ytEmbed(previewStep.media_url)} className="w-full h-full rounded-lg" allowFullScreen /></div>
                          ) : <video src={previewStep.media_url} controls className="w-full rounded-lg" />
                        )}
                        {previewStep.step_type !== "paragraph" && previewStep.step_type !== "subparagraph" && previewStep.content_html && (
                          <div className="prose prose-invert max-w-none text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(previewStep.content_html) }} />
                        )}
                        {previewStep.step_type === "quiz" && previewStep.quiz && (
                          <div className="space-y-2">
                            <p className="font-medium">{previewStep.quiz.question}</p>
                            {(previewStep.quiz.options || []).map((opt, i) => (
                              <div key={i} className={`px-3 py-2 rounded border ${i === previewStep.quiz!.correctIndex ? "border-green-500 bg-green-500/10" : "border-border"}`}>{opt}</div>
                            ))}
                            {previewStep.quiz.explanation && <p className="text-sm italic text-muted-foreground">💡 {previewStep.quiz.explanation}</p>}
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </Card>
    </div>
  );
}
