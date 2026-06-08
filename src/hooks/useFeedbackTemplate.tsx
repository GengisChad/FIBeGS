import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FeedbackScope = "tournament" | "event" | "championship";
export type FeedbackQuestionType = "rating" | "single_choice" | "multi_choice" | "text" | "boolean";

export interface FeedbackQuestion {
  id: string;
  type: FeedbackQuestionType;
  label: string;
  required?: boolean;
  options?: string[];
}

export interface FeedbackStep {
  title: string;
  description?: string;
  questions: FeedbackQuestion[];
}

export interface FeedbackTemplate {
  id: string;
  scope: FeedbackScope;
  name: string;
  steps: FeedbackStep[];
  is_active: boolean;
}

export function useFeedbackTemplate(scope: FeedbackScope) {
  const [template, setTemplate] = useState<FeedbackTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_feedback_templates" as any)
        .select("id, scope, name, steps, is_active")
        .eq("scope", scope)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setTemplate(data as any);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope]);

  return { template, loading };
}
