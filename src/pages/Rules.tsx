import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CommunityGuidelines } from "@/components/CommunityGuidelines";
import { Ranked3DModelsSection } from "@/components/Ranked3DModelsSection";
import { RulebookDownloadButton } from "@/components/RulebookDownloadButton";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, CheckCircle2, Lock, Crown, Trophy, ScrollText, Shield, Users, Settings, Wrench } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminEditableText } from "@/components/admin/AdminEditableText";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableCourseItem } from "@/components/admin/SortableCourseItem";

const sb = supabase as any;

type CourseCategory = "judge" | "club_leader" | "tecnico";

interface CourseListItem {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  required_for_test: boolean;
  position: number;
  category: CourseCategory;
  completed?: boolean;
}

interface SectionRow { section_key: string; is_visible: boolean; position: number; }

const Rules = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [comingSoon, setComingSoon] = useState<{ judge: boolean; club_leader: boolean; tecnico: boolean }>({ judge: false, club_leader: false, tecnico: true });
  const [judgePerfectScore, setJudgePerfectScore] = useState(false);

  useEffect(() => {
    (async () => {
      const coursesQuery = sb.from("judge_courses")
        .select("id,title,description,cover_image_url,required_for_test,is_published,position,category")
        .order("position");
      const [{ data: vis }, { data: cs }, { data: settings }] = await Promise.all([
        sb.from("rules_section_visibility").select("*").order("position"),
        isAdmin ? coursesQuery : coursesQuery.eq("is_published", true),
        sb.from("site_settings").select("key,value").in("key", ["coming_soon_judge", "coming_soon_club_leader", "coming_soon_tecnico"]),
      ]);
      setSections((vis || []) as SectionRow[]);
      const settingsMap = new Map<string, string>((settings || []).map((s: any) => [s.key, s.value]));
      setComingSoon({
        judge: settingsMap.get("coming_soon_judge") === "true",
        club_leader: settingsMap.get("coming_soon_club_leader") === "true",
        // Default: tecnico in arrivo finché non viene esplicitamente disattivato
        tecnico: settingsMap.get("coming_soon_tecnico") !== "false",
      });
      let progress: any[] = [];
      if (user) {
        const { data: p } = await sb.from("judge_course_progress")
          .select("course_id,completed").eq("user_id", user.id);
        progress = p || [];
        // Verifica se l'utente ha mai ottenuto 100% al test Judge FIBeGS (sblocca Head Judge)
        const { data: attempts } = await sb.from("referee_test_attempts")
          .select("score,total_questions")
          .eq("user_id", user.id)
          .eq("test_type", "referee");
        const hasPerfect = (attempts || []).some((a: any) => a.total_questions > 0 && a.score >= a.total_questions);
        setJudgePerfectScore(hasPerfect);
      } else {
        setJudgePerfectScore(false);
      }
      setCourses((cs || []).map((c: any) => ({
        ...c,
        completed: progress.find(p => p.course_id === c.id)?.completed === true,
      })));
    })();
  }, [user?.id, isAdmin]);

  const toggleComingSoon = async (category: CourseCategory) => {
    const key = category === "judge" ? "coming_soon_judge" : category === "club_leader" ? "coming_soon_club_leader" : "coming_soon_tecnico";
    const newVal = !comingSoon[category];
    setComingSoon(prev => ({ ...prev, [category]: newVal }));
    await sb.from("site_settings").upsert(
      { key, value: String(newVal), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderCourses = async (category: CourseCategory, activeId: string, overId: string) => {
    if (activeId === overId) return;
    const inCat = courses.filter(c => c.category === category && c.required_for_test);
    const oldIdx = inCat.findIndex(c => c.id === activeId);
    const newIdx = inCat.findIndex(c => c.id === overId);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(inCat, oldIdx, newIdx);

    // Compute new positions: keep other courses' positions, reassign the reordered ones
    // using the slots they currently occupy (sorted ascending).
    const slots = inCat.map(c => c.position).sort((a, b) => a - b);
    const updates = reordered.map((c, i) => ({ id: c.id, position: slots[i] }));

    // Optimistic local update + re-sort by position
    setCourses(prev => {
      const map = new Map(updates.map(u => [u.id, u.position]));
      return prev
        .map(c => map.has(c.id) ? { ...c, position: map.get(c.id)! } : c)
        .sort((a, b) => a.position - b.position);
    });

    await Promise.all(
      updates.map(u =>
        sb.from("judge_courses").update({ position: u.position }).eq("id", u.id)
      )
    );
  };

  const isVisible = (key: string) => {
    if (sections.length === 0) return true;
    const s = sections.find(x => x.section_key === key);
    return s ? s.is_visible : true;
  };

  // Strip "CORSO NN · " prefix for cleaner card titles
  const cleanTitle = (t: string) => t.replace(/^CORSO\s+\d+\s*[·\-:]\s*/i, "").replace(/^CORSO\s+MASTER\s*[·\-:]\s*/i, "");

  const renderSection = (key: string) => {
    if (!isVisible(key)) return null;
    switch (key) {
      case "ranked_3d_models":
        return <Ranked3DModelsSection key={key} />;
      case "judge_courses":
        return courses.length > 0 ? (
          <section key={key} className="py-12 container mx-auto px-4">
            <div className="academy-shell relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
              {/* Top neon bar */}
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap px-5 md:px-8 pt-6 pb-5 border-b border-border/60">
                <div className="flex items-start gap-4 md:gap-5 relative">
                  {/* Icon mark — minimal */}
                  <div className="relative shrink-0">
                    <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center backdrop-blur-sm">
                      <GraduationCap className="text-primary" size={22} strokeWidth={1.75} />
                    </div>
                  </div>

                  {/* Typography */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-baseline gap-3">
                      <h2 className="font-display text-3xl md:text-4xl tracking-wide leading-none uppercase">
                        <span className="text-foreground">FIBeGS</span>{" "}
                        <span className="text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.35)]">ACADEMY</span>
                      </h2>
                      <div className="hidden md:block h-[2px] flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
                    </div>
                    <AdminEditableText
                      settingKey="academy_subtitle"
                      defaultValue="Corsi monotematici di specializzazione arbitrale"
                      as="p"
                      className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mt-2 leading-relaxed"
                    />
                    <div className="mt-3 flex flex-col">
                      <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-tighter">// ELITE TRAINING</span>
                      <div className="h-px w-8 bg-primary/50 mt-1" />
                    </div>
                  </div>
                </div>
                <div className="flex items-stretch w-full sm:w-auto sm:justify-end">
                  <div className="rounded-md border border-primary/40 bg-primary/5 overflow-hidden w-full sm:w-auto sm:min-w-[220px] flex flex-col">
                    <div className="px-4 py-2 text-center">
                      <AdminEditableText
                        settingKey="academy_edition"
                        defaultValue="EDIZIONE 12"
                        as="div"
                        className="font-display text-lg md:text-xl text-primary leading-none tracking-wider"
                      />
                      <AdminEditableText
                        settingKey="academy_season"
                        defaultValue="STAGIONE 2026"
                        as="div"
                        className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1"
                      />
                    </div>
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                    <RulebookDownloadButton />
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 md:p-8 space-y-8">
                <div>
                  <AdminEditableText
                    settingKey="academy_catalog_title"
                    defaultValue="Catalogo Argomenti Specifici"
                    as="h3"
                    className="font-display text-2xl md:text-3xl tracking-wide"
                  />
                  <AdminEditableText
                    settingKey="academy_catalog_intro"
                    defaultValue="Ogni modulo esplora nel dettaglio le casistiche, la fisica e le regole di sbarramento. Leggi attentamente ogni corso: la conoscenza superficiale non basta per superare l'esame per l'abilitazione Ufficiale FIBeGS."
                    multiline
                    as="p"
                    className="text-sm text-muted-foreground mt-2 max-w-3xl"
                  />
                </div>

                {/* Category tabs (Judge / Club Leader / Tecnico) */}
                {(() => {
                  const categoryLabel = (cat: CourseCategory) =>
                    cat === "club_leader" ? "Club Leader" : cat === "tecnico" ? "Tecnico" : "Judge";
                  const renderTrack = (category: CourseCategory) => {
                    const tracked = courses.filter(c => c.category === category);
                    const baseCourses = tracked.filter(c => c.required_for_test);
                    const masterCourse = tracked.find(c => !c.required_for_test);
                    const baseCompleted = baseCourses.filter(c => c.completed).length;
                    const baseTotal = baseCourses.length;
                    const allBaseDone = baseTotal > 0 && baseCompleted >= baseTotal;
                    const isComingSoon = comingSoon[category];
                    const examUnlocked = allBaseDone && !isComingSoon;
                    // Head Judge (ex Masterclass) sotto Judge: si sblocca SOLO con 100% al test Judge FIBeGS
                    const masterUnlocked = category === "judge"
                      ? judgePerfectScore && !isComingSoon
                      : allBaseDone && !isComingSoon;

                    // Non-admin "In Arrivo" compact placeholder for the whole category
                    if (isComingSoon && !isAdmin) {
                      return (
                        <div className="space-y-4 max-w-xl mx-auto">
                          <Card className="relative p-5 md:p-6 border-dashed border-primary/30 bg-primary/5 overflow-hidden text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Lock className="text-primary" size={22} strokeWidth={1.75} />
                              </div>
                              <div className="font-display text-2xl md:text-3xl tracking-[0.15em] text-primary">
                                IN ARRIVO
                              </div>
                              <p className="text-xs md:text-sm text-muted-foreground max-w-sm">
                                I corsi {categoryLabel(category)} non sono ancora disponibili. Torna presto.
                              </p>
                            </div>
                          </Card>

                          <Card className="relative p-4 md:p-5 border-dashed bg-background/40 overflow-hidden">
                            <div className="flex items-center gap-3">
                              <Lock className="text-muted-foreground" size={24} />
                              <div className="flex-1 min-w-1">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">In Arrivo</div>
                                <h3 className="font-display text-lg md:text-xl tracking-wide">{category === "club_leader" ? "Test Ufficiale Club Leader" : category === "tecnico" ? "Corsi Tecnico (Beycrafter)" : "Esame Ufficiale Judge FIBeGS"}</h3>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Disponibile non appena verranno pubblicati i corsi.
                            </p>
                          </Card>
                        </div>
                      );
                    }

                    const firstIncompleteIdx = baseCourses.findIndex(c => !c.completed);
                    const unlockedUntil = firstIncompleteIdx === -1 ? baseCourses.length - 1 : firstIncompleteIdx;

                    const testRoute = category === "club_leader" ? "/test-club-leader" : category === "tecnico" ? "/test-arbitri" : "/test-arbitri";
                    const examTitle = category === "club_leader" ? "Test Ufficiale Club Leader" : category === "tecnico" ? "Certificazione Tecnico Beycrafter" : "Esame Ufficiale Judge FIBeGS";
                    const examDesc = category === "club_leader"
                      ? "Valutazione finale per ottenere la qualifica di Club Leader FIBeGS."
                      : category === "tecnico"
                        ? "Test di certificazione per la qualifica di Tecnico Beycrafter. In arrivo."
                        : "Estrazione di 50 domande sulla casistica FIBeGS. Threshold Judge: min. 27/30. La perfezione sblocca il livello Head Judge FIBeGS.";

                    const renderCard = (c: CourseListItem, idx: number) => {
                      const num = String(idx + 1).padStart(2, "0");
                      const isLocked = user ? idx > unlockedUntil : idx > 0;
                      const isNext = idx === unlockedUntil && !c.completed;

                      const cardInner = (
                        <Card className={`relative h-full p-4 md:p-5 flex flex-col bg-background/40 border-border transition-all ${isLocked ? "opacity-60 grayscale" : "hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.35)]"} ${c.completed ? "border-primary/50" : ""} ${isNext ? "border-primary shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5)] ring-1 ring-primary/40" : ""}`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.15em] uppercase text-primary">
                              Corso {num}
                            </span>
                            <div className="flex items-center gap-2">
                              {c.completed ? (
                                <CheckCircle2 className="text-primary" size={16} />
                              ) : isLocked ? (
                                <Lock className="text-muted-foreground" size={16} />
                              ) : isNext ? (
                                <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-primary animate-pulse">Prossimo</span>
                              ) : null}
                              {isAdmin && (
                                <Link
                                  to={`/corso-judges/${c.id}?edit=1`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 transition-all"
                                  title="Modifica corso"
                                >
                                  <Settings size={12} />
                                </Link>
                              )}
                            </div>
                          </div>
                          <h4 className="font-display text-lg md:text-xl leading-tight tracking-wide mb-2 line-clamp-3">
                            {cleanTitle(c.title)}
                          </h4>
                          {c.description && !isLocked && (
                            <p className="text-xs md:text-[13px] text-muted-foreground leading-relaxed line-clamp-4 mb-4">
                              {c.description}
                            </p>
                          )}
                          {isLocked && (
                            <p className="text-xs text-muted-foreground italic mb-4">
                              Completa il corso precedente per sbloccarlo.
                            </p>
                          )}
                          <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-border/60">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <ScrollText size={12} /> Modulo Integrale
                            </span>
                            <span className={`text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap ${isLocked ? "text-muted-foreground" : "text-primary group-hover:translate-x-0.5 transition-transform"}`}>
                              {isLocked ? <><Lock size={12} /> Bloccato</> : c.completed ? "Rivedi →" : "Inizia →"}
                            </span>
                          </div>
                        </Card>
                      );

                      return isLocked ? (
                        <div key={c.id} className="block cursor-not-allowed h-full">{cardInner}</div>
                      ) : (
                        <Link key={c.id} to={`/corso-judges/${c.id}`} className="group block h-full">{cardInner}</Link>
                      );
                    };

                    if (tracked.length === 0) {
                      const createCourseForCategory = async () => {
                        const { data, error } = await sb.from("judge_courses").insert({
                          title: `CORSO 01 · Nuovo corso ${categoryLabel(category)}`,
                          category,
                          position: 1,
                          required_for_test: true,
                          is_published: false,
                        }).select().single();
                        if (error) { alert("Errore: " + error.message); return; }
                        if (data?.id) window.location.href = `/corso-judges/${data.id}?edit=1`;
                      };
                      return (
                        <div className="space-y-6">
                          <Card className="p-8 border-dashed bg-background/40 text-center">
                            <p className="text-sm text-muted-foreground italic mb-4">
                              Nessun corso pubblicato in questa categoria.
                            </p>
                            {isAdmin && (
                              <button
                                onClick={createCourseForCategory}
                                className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-all"
                              >
                                <Settings size={14} /> Crea primo corso {categoryLabel(category)}
                              </button>
                            )}
                          </Card>
                          <Card className="relative p-5 md:p-6 border-dashed bg-background/40 overflow-hidden">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Lock className="text-muted-foreground" size={28} />
                                <div className="flex-1">
                                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">Bloccato</div>
                                  <h3 className="font-display text-xl md:text-2xl tracking-wide">{examTitle}</h3>
                                </div>
                              </div>
                              {isAdmin && (
                                <Link
                                  to={testRoute}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                                  title="Anteprima test (admin)"
                                >
                                  <Settings size={12} /> Anteprima Test
                                </Link>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-3">{examDesc}</p>
                          </Card>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {/* Admin toggle: coming soon mode */}
                        {isAdmin && (
                          <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${isComingSoon ? "border-primary/60 bg-primary/10" : "border-border bg-background/40"}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <Lock size={16} className={isComingSoon ? "text-primary" : "text-muted-foreground"} />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">
                                  Modalità "In Arrivo" — {categoryLabel(category)}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {isComingSoon
                                    ? "Attiva: i non-admin vedono solo il placeholder con i corsi sfocati e il test bloccato."
                                    : "Disattivata: corsi e test sono visibili a tutti."}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleComingSoon(category)}
                              className={`shrink-0 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${isComingSoon ? "border-primary bg-primary text-primary-foreground hover:opacity-90" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"}`}
                            >
                              {isComingSoon ? "Disattiva" : "Attiva In Arrivo"}
                            </button>
                          </div>
                        )}

                        {/* Progress */}
                        <Card className="p-4 md:p-5 border-border bg-background/60">
                          <div className="flex items-center gap-3">
                            <Trophy className="text-primary shrink-0" size={20} />
                            <div className="flex-1">
                              <Progress value={baseTotal ? (baseCompleted / baseTotal) * 100 : 0} className="h-2" />
                            </div>
                            <div className="text-sm font-semibold whitespace-nowrap">
                              <span className={allBaseDone ? "text-primary" : "text-foreground"}>{baseCompleted}</span>
                              <span className="text-muted-foreground"> / {baseTotal} </span>
                              <span className="hidden sm:inline text-muted-foreground">Corsi Completati</span>
                            </div>
                          </div>
                          {!user && (
                            <p className="text-xs text-muted-foreground mt-3">Accedi per salvare i tuoi progressi.</p>
                          )}
                        </Card>

                        {/* Mobile carousel */}
                        <div className="sm:hidden -mx-5 px-5">
                          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                            {baseCourses.map((c, idx) => (
                              <div key={c.id} className="snap-center shrink-0 w-[85%]">
                                {renderCard(c, idx)}
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-center text-muted-foreground mt-1">← Scorri per vedere gli altri corsi →</p>
                        </div>

                        {/* Desktop grid */}
                        {isAdmin ? (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e: DragEndEvent) => {
                              if (e.over) reorderCourses(category, String(e.active.id), String(e.over.id));
                            }}
                          >
                            <SortableContext items={baseCourses.map(c => c.id)} strategy={rectSortingStrategy}>
                              <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr gap-4">
                                {baseCourses.map((c, idx) => (
                                  <SortableCourseItem key={c.id} id={c.id} handle="icon">
                                    {renderCard(c, idx)}
                                  </SortableCourseItem>
                                ))}
                              </div>
                              <p className="hidden sm:block text-[11px] text-muted-foreground italic mt-2">
                                Admin: trascina dall'icona in alto a sinistra per riordinare i corsi.
                              </p>
                            </SortableContext>
                          </DndContext>
                        ) : (
                          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr gap-4">
                            {baseCourses.map((c, idx) => renderCard(c, idx))}
                          </div>
                        )}

                        {/* Exam + Master cards */}
                        <div className={`grid gap-4 ${masterCourse ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                          {examUnlocked ? (
                            <Link to={testRoute} className="block group">
                              <Card className="relative p-5 md:p-6 h-full overflow-hidden border-primary/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent hover:border-primary transition-all">
                                <div className="flex items-center gap-3">
                                  <Trophy className="text-primary" size={28} />
                                  <div className="flex-1">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-1">Sbloccato</div>
                                    <h3 className="font-display text-xl md:text-2xl tracking-wide">{examTitle}</h3>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-3">{examDesc}</p>
                              </Card>
                            </Link>
                          ) : (
                            <Card className="relative p-5 md:p-6 h-full border-dashed bg-background/40 overflow-hidden">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Lock className="text-muted-foreground" size={28} />
                                  <div className="flex-1">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">Bloccato</div>
                                    <h3 className="font-display text-xl md:text-2xl tracking-wide">{examTitle}</h3>
                                  </div>
                                </div>
                                {isAdmin && (
                                  <Link
                                    to={testRoute}
                                    className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                                    title="Anteprima test (admin)"
                                  >
                                    <Settings size={12} /> Anteprima
                                  </Link>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-3">
                                Completa i {baseTotal} corsi {categoryLabel(category)} per sbloccare il test ({baseCompleted}/{baseTotal}).
                              </p>
                            </Card>
                          )}

                          {masterCourse && (
                            masterUnlocked ? (
                              <div className="relative group">
                                <Link to={`/corso-judges/${masterCourse.id}`} className="block">
                                  <Card className="relative p-5 md:p-6 h-full overflow-hidden border-amber-400/60 bg-gradient-to-br from-amber-500/15 via-amber-400/5 to-transparent hover:border-amber-400 transition-all">
                                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />
                                    <div className="flex items-center gap-3 relative">
                                      <Crown className="text-amber-400" size={28} />
                                      <div className="flex-1">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold mb-1">{category === "judge" ? "Head Judge FIBeGS" : "Masterclass"}</div>
                                        <h3 className="font-display text-xl md:text-2xl tracking-wide">{category === "judge" ? "Head Judge FIBeGS" : cleanTitle(masterCourse.title)}</h3>
                                      </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-3 relative">
                                      {category === "judge"
                                        ? "Accesso al livello Head Judge FIBeGS. Sbloccato grazie al 100% al test Judge FIBeGS."
                                        : (masterCourse.description || "Approfondimento avanzato.")}
                                    </p>
                                  </Card>
                                </Link>
                                {isAdmin && (
                                  <Link
                                    to={`/corso-judges/${masterCourse.id}?edit=1`}
                                    className="absolute top-3 right-3 inline-flex items-center justify-center w-6 h-6 rounded-md border border-amber-400/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:scale-105 transition-all z-10"
                                    title="Modifica corso"
                                  >
                                    <Settings size={12} />
                                  </Link>
                                )}
                              </div>
                            ) : (
                              <Card className="relative p-5 md:p-6 h-full border-dashed bg-background/40 overflow-hidden">
                                <div className="flex items-center gap-3">
                                  <Lock className="text-muted-foreground" size={28} />
                                  <div className="flex-1">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">Bloccato</div>
                                    <h3 className="font-display text-xl md:text-2xl tracking-wide">{category === "judge" ? "Head Judge FIBeGS" : "Masterclass"}</h3>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-3">
                                  {category === "judge"
                                    ? "Si sblocca raggiungendo il 100% di risposte esatte al test Judge FIBeGS."
                                    : "Si sblocca completando tutti i corsi di questo percorso."}
                                </p>
                              </Card>
                            )
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <Tabs defaultValue="judge" className="w-full">
                      <TabsList className="grid grid-cols-3 w-full max-w-xl mx-auto mb-6">
                        <TabsTrigger value="judge" className="gap-2"><Shield size={14} />Judge</TabsTrigger>
                        <TabsTrigger value="club_leader" className="gap-2"><Users size={14} />Club Leader</TabsTrigger>
                        <TabsTrigger value="tecnico" className="gap-2"><Wrench size={14} />Tecnico</TabsTrigger>
                      </TabsList>
                      <TabsContent value="judge">{renderTrack("judge")}</TabsContent>
                      <TabsContent value="club_leader">{renderTrack("club_leader")}</TabsContent>
                      <TabsContent value="tecnico">{renderTrack("tecnico")}</TabsContent>
                    </Tabs>
                  );
                })()}
              </div>
            </div>
          </section>
        ) : null;
      case "community_guidelines":
        return <CommunityGuidelines key={key} />;
      default:
        return null;
    }
  };

  const order = sections.length > 0
    ? sections.map(s => s.section_key).filter(k => k !== "gameplay_rules" && k !== "referee_test_card")
    : ["ranked_3d_models", "judge_courses", "community_guidelines"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-20">
        {order.map(renderSection)}
      </div>
      <Footer />
    </div>
  );
};

export default Rules;

