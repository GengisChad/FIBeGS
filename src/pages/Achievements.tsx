import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Trophy, Target, Star, CheckCircle, Lock, Clock, Gift } from "lucide-react";
import { motion } from "framer-motion";

const CONDITION_LABELS: Record<string, string> = {
  tournament_count: "Tornei giocati",
  tournament_wins: "Tornei vinti",
  match_wins: "Match vinti",
  top_placement: "Piazzamenti top",
  forum_posts: "Post nel forum",
  forum_likes_received: "Like ricevuti",
  decks_created: "Deck creati",
  collection_count: "Pezzi collezione",
};

const Achievements = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [achProgress, setAchProgress] = useState<Record<string, number>>({});
  const [misProgress, setMisProgress] = useState<Record<string, number>>({});
  const [completedAchs, setCompletedAchs] = useState<Set<string>>(new Set());
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [achRes, misRes] = await Promise.all([
        supabase.from("achievements").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("missions").select("*").eq("is_active", true)
          .lte("starts_at", new Date().toISOString())
          .gte("ends_at", new Date().toISOString())
          .order("sort_order"),
      ]);
      setAchievements(achRes.data ?? []);
      setMissions(misRes.data ?? []);

      if (user) {
        const [uaRes, umRes, apRes, mpRes] = await Promise.all([
          supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
          supabase.from("user_missions").select("mission_id, completed_at").eq("user_id", user.id),
          supabase.rpc("get_achievement_progress", { _user_id: user.id }),
          supabase.rpc("get_mission_progress", { _user_id: user.id }),
        ]);
        setCompletedAchs(new Set((uaRes.data ?? []).map((r: any) => r.achievement_id)));
        setCompletedMissions(new Set((umRes.data ?? []).filter((r: any) => r.completed_at).map((r: any) => r.mission_id)));
        const ap: Record<string, number> = {};
        (apRes.data ?? []).forEach((r: any) => { ap[r.achievement_id] = r.current_progress; });
        setAchProgress(ap);
        const mp: Record<string, number> = {};
        (mpRes.data ?? []).forEach((r: any) => { mp[r.mission_id] = r.current_progress; });
        setMisProgress(mp);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const claimAchievement = async (id: string) => {
    setClaiming(id);
    const { data, error } = await supabase.rpc("claim_achievement", { _achievement_id: id });
    setClaiming(null);
    if (error || (data as any)?.error) {
      toast({ title: "Errore", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    const result = data as any;
    setCompletedAchs(prev => new Set([...prev, id]));
    toast({
      title: "🏆 Achievement sbloccato!",
      description: `${result.points_awarded > 0 ? `+${result.points_awarded} punti` : ""}${result.badge_awarded ? " + Badge assegnato" : ""}`,
    });
  };

  const claimMission = async (id: string) => {
    setClaiming(id);
    const { data, error } = await supabase.rpc("claim_mission", { _mission_id: id });
    setClaiming(null);
    if (error || (data as any)?.error) {
      toast({ title: "Errore", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    const result = data as any;
    setCompletedMissions(prev => new Set([...prev, id]));
    toast({
      title: "🎯 Missione completata!",
      description: `${result.points_awarded > 0 ? `+${result.points_awarded} punti` : ""}${result.badge_awarded ? " + Badge assegnato" : ""}`,
    });
  };

  const completedCount = achievements.filter(a => completedAchs.has(a.id)).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Achievement & Missioni</h1>
        </div>
        {user && achievements.length > 0 && (
          <p className="text-sm text-muted-foreground mb-6">
            {completedCount}/{achievements.length} achievement completati
          </p>
        )}

        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList className="w-full">
            <TabsTrigger value="achievements" className="flex-1 gap-1.5"><Star size={14} /> Achievement</TabsTrigger>
            <TabsTrigger value="missions" className="flex-1 gap-1.5"><Target size={14} /> Missioni</TabsTrigger>
          </TabsList>

          <TabsContent value="achievements" className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Caricamento...</p>
            ) : achievements.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nessun achievement disponibile</p>
            ) : (
              achievements.map((a, i) => {
                const completed = completedAchs.has(a.id);
                const progress = achProgress[a.id] ?? 0;
                const pct = Math.min(100, Math.round((progress / a.condition_value) * 100));
                const canClaim = !completed && progress >= a.condition_value && user;
                return (
                  <motion.div key={a.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                    <Card className={`transition-shadow ${completed ? "border-primary/30 bg-primary/5" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg p-2 ${completed ? "bg-primary/20" : "bg-secondary"}`}>
                            {a.icon_url
                              ? <img src={a.icon_url} alt="" className="w-8 h-8 object-contain" />
                              : completed ? <CheckCircle size={24} className="text-primary" /> : <Lock size={24} className="text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm">{a.name}</h3>
                              {completed && <Badge className="text-[10px]">Completato</Badge>}
                            </div>
                            {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span>{CONDITION_LABELS[a.condition_type] || a.condition_type}</span>
                              <span>·</span>
                              <span>{progress}/{a.condition_value}</span>
                              {a.bonus_points > 0 && <><span>·</span><Gift size={12} /><span>+{a.bonus_points} pt</span></>}
                            </div>
                            {user && !completed && (
                              <Progress value={pct} className="h-1.5 mt-2" />
                            )}
                          </div>
                          {canClaim && (
                            <Button size="sm" onClick={() => claimAchievement(a.id)} disabled={claiming === a.id}>
                              {claiming === a.id ? "..." : "Riscatta"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="missions" className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Caricamento...</p>
            ) : missions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nessuna missione attiva al momento</p>
            ) : (
              missions.map((m, i) => {
                const completed = completedMissions.has(m.id);
                const progress = misProgress[m.id] ?? 0;
                const pct = Math.min(100, Math.round((progress / m.condition_value) * 100));
                const canClaim = !completed && progress >= m.condition_value && user;
                const endsAt = new Date(m.ends_at);
                const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86400000));
                return (
                  <motion.div key={m.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                    <Card className={`transition-shadow ${completed ? "border-primary/30 bg-primary/5" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg p-2 ${completed ? "bg-primary/20" : "bg-secondary"}`}>
                            {m.icon_url
                              ? <img src={m.icon_url} alt="" className="w-8 h-8 object-contain" />
                              : completed ? <CheckCircle size={24} className="text-primary" /> : <Target size={24} className="text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm">{m.name}</h3>
                              <Badge variant="secondary" className="text-[10px]">
                                {m.period === "weekly" ? "Settimanale" : "Mensile"}
                              </Badge>
                              {completed && <Badge className="text-[10px]">Completata</Badge>}
                            </div>
                            {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span>{CONDITION_LABELS[m.condition_type] || m.condition_type}</span>
                              <span>·</span>
                              <span>{progress}/{m.condition_value}</span>
                              {m.bonus_points > 0 && <><span>·</span><Gift size={12} /><span>+{m.bonus_points} pt</span></>}
                              <span>·</span>
                              <Clock size={12} />
                              <span>{daysLeft}g rimasti</span>
                            </div>
                            {user && !completed && (
                              <Progress value={pct} className="h-1.5 mt-2" />
                            )}
                          </div>
                          {canClaim && (
                            <Button size="sm" onClick={() => claimMission(m.id)} disabled={claiming === m.id}>
                              {claiming === m.id ? "..." : "Riscatta"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default Achievements;
