import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, MessageSquareText, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { FeedbackDialog } from "./FeedbackDialog";
import { FeedbackResponsesDialog } from "./FeedbackResponsesDialog";
import { FeedbackScope } from "@/hooks/useFeedbackTemplate";

interface Props {
  scope: FeedbackScope;
  targetId: string;
  /** Whether the current user participated (registered/played). If false, the user button is hidden. */
  canSubmit?: boolean;
}

export const EventFeedbackButton = ({ scope, targetId, canSubmit = true }: Props) => {
  const { user } = useAuth();
  const { isAdmin, isStaff } = useUserRoles();
  const [submitted, setSubmitted] = useState(false);
  const [openSubmit, setOpenSubmit] = useState(false);
  const [openResponses, setOpenResponses] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("event_feedback_responses" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", scope)
        .eq("target_id", targetId)
        .maybeSingle();
      setSubmitted(!!data);
    })();
  }, [user, scope, targetId]);

  return (
    <div className="flex flex-wrap gap-2">
      {user && canSubmit && (
        submitted ? (
          <Button variant="outline" size="sm" disabled className="gap-1.5">
            <Check size={14} /> Feedback inviato
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpenSubmit(true)}>
            <MessageSquare size={14} /> Lascia un feedback
          </Button>
        )
      )}
      {(isAdmin || isStaff) && (
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setOpenResponses(true)}>
          <MessageSquareText size={14} /> Leggi feedback
        </Button>
      )}

      <FeedbackDialog
        open={openSubmit}
        onOpenChange={setOpenSubmit}
        scope={scope}
        targetId={targetId}
        onSubmitted={() => setSubmitted(true)}
      />
      <FeedbackResponsesDialog
        open={openResponses}
        onOpenChange={setOpenResponses}
        scope={scope}
        targetId={targetId}
      />
    </div>
  );
};
