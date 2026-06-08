import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useRefereeTestStatus = (testType: string = "referee") => {
  const { user } = useAuth();
  const [passed, setPassed] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoredPerfect, setScoredPerfect] = useState(false);
  const [headJudgePassed, setHeadJudgePassed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const check = async () => {
      // Batch all initial queries in parallel to reduce round-trips
      const [passedRes, settingsRes, lastFailedRes, hjRes] = await Promise.all([
        supabase
          .from("referee_test_attempts" as any)
          .select("id, score, total_questions")
          .eq("user_id", user.id)
          .eq("passed", true)
          .eq("test_type", testType)
          .maybeSingle(),
        supabase
          .from("referee_test_settings")
          .select("cooldown_days")
          .eq("test_type", testType)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("referee_test_attempts" as any)
          .select("attempted_at")
          .eq("user_id", user.id)
          .eq("passed", false)
          .eq("test_type", testType)
          .order("attempted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Only fetch head_judge status if checking referee test
        testType === "referee"
          ? supabase
              .from("referee_test_attempts" as any)
              .select("id")
              .eq("user_id", user.id)
              .eq("passed", true)
              .eq("test_type", "head_judge")
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const passedAttempt = passedRes.data;

      if (passedAttempt) {
        setPassed(true);
        if (testType === "referee") {
          const att = passedAttempt as any;
          setScoredPerfect(att.score === att.total_questions);
          setHeadJudgePassed(!!hjRes.data);
        }
        setLoading(false);
        return;
      }

      // Check cooldown from already-fetched data
      const cooldownDays = settingsRes.data?.cooldown_days ?? 7;
      const lastFailed = lastFailedRes.data;

      if (lastFailed) {
        const retryAt = new Date((lastFailed as any).attempted_at);
        retryAt.setDate(retryAt.getDate() + cooldownDays);
        if (retryAt > new Date()) {
          setCooldownUntil(retryAt);
        }
      }

      setLoading(false);
    };

    check();
  }, [user, testType]);

  return { passed, cooldownUntil, loading, isLoggedIn: !!user, scoredPerfect, headJudgePassed };
};
