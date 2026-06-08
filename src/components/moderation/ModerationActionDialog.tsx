import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Clock, Ban, ShieldAlert } from "lucide-react";

export type ModerationAction = "warn" | "timeout" | "ban";
export type WarnSection = "forum" | "market" | "decks" | "tournaments" | "profile";

const SECTION_LABELS: Record<WarnSection, string> = {
  forum: "Forum", market: "Market", decks: "Deck", tournaments: "Tornei", profile: "Profilo",
};

const TIMEOUT_DURATIONS = [
  { label: "1 ora", hours: 1 },
  { label: "24 ore", hours: 24 },
  { label: "7 giorni", hours: 24 * 7 },
  { label: "30 giorni", hours: 24 * 30 },
];

const BAN_DURATIONS = [
  { label: "7 giorni", hours: 24 * 7 },
  { label: "30 giorni", hours: 24 * 30 },
  { label: "Permanente", hours: null as number | null },
];

interface ModerationActionDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  action: ModerationAction;
  targetUserId: string;
  targetUserName?: string;
  defaultSection?: WarnSection;
  onApplied?: () => void;
}

export const ModerationActionDialog = ({
  open, onOpenChange, action, targetUserId, targetUserName, defaultSection = "forum", onApplied,
}: ModerationActionDialogProps) => {
  const { user } = useAuth();
  const { isStaff } = useUserRoles();
  const [reason, setReason] = useState("");
  const [section, setSection] = useState<WarnSection>(defaultSection);
  const [durationIdx, setDurationIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [warnCounts, setWarnCounts] = useState<Record<WarnSection, number>>({
    forum: 0, market: 0, decks: 0, tournaments: 0, profile: 0,
  });

  useEffect(() => {
    if (!open) return;
    setReason(""); setDurationIdx(0); setSection(defaultSection);
    // load warn counts for this user
    (async () => {
      const { data } = await (supabase as any)
        .from("user_warns")
        .select("section")
        .eq("user_id", targetUserId)
        .eq("is_active", true);
      const counts: Record<WarnSection, number> = { forum: 0, market: 0, decks: 0, tournaments: 0, profile: 0 };
      (data || []).forEach((w: any) => { counts[w.section as WarnSection] = (counts[w.section as WarnSection] || 0) + 1; });
      setWarnCounts(counts);
    })();
  }, [open, targetUserId, defaultSection]);

  const sectionCount = warnCounts[section] || 0;
  const sectionMaxed = sectionCount >= 3;

  const canSubmit = !!reason.trim() && isStaff && !submitting && (action !== "warn" || !sectionMaxed);

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);

    if (action === "warn") {
      const { error } = await (supabase as any).from("user_warns").insert({
        user_id: targetUserId, section, reason: reason.trim(), issued_by: user.id,
      });
      if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); setSubmitting(false); return; }
      await supabase.from("notifications").insert({
        user_id: targetUserId, type: "moderation_warn",
        title: `⚠️ Warn ricevuto (${SECTION_LABELS[section]})`,
        message: `Hai ricevuto un avviso per la sezione **${SECTION_LABELS[section]}**.\n\n**Motivo:** ${reason.trim()}\n\nWarn attuali in questa sezione: ${sectionCount + 1}/3.`,
        link: "/profile",
      });
      toast({ title: `Warn ${sectionCount + 1}/3 applicato` });
    } else if (action === "timeout") {
      const hours = TIMEOUT_DURATIONS[durationIdx].hours;
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const { error } = await (supabase as any).from("user_timeouts").insert({
        user_id: targetUserId, reason: reason.trim(), issued_by: user.id, expires_at: expiresAt,
      });
      if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); setSubmitting(false); return; }
      await supabase.from("notifications").insert({
        user_id: targetUserId, type: "moderation_timeout",
        title: `🔇 Time-out applicato (${TIMEOUT_DURATIONS[durationIdx].label})`,
        message: `Sei stato messo in time-out per **${TIMEOUT_DURATIONS[durationIdx].label}**.\n\n**Motivo:** ${reason.trim()}\n\nDurante il time-out non puoi pubblicare, commentare o partecipare ai tornei.`,
        link: "/profile",
      });
      toast({ title: "Time-out applicato" });
    } else {
      const dur = BAN_DURATIONS[durationIdx];
      const expiresAt = dur.hours === null ? null : new Date(Date.now() + dur.hours * 60 * 60 * 1000).toISOString();
      const { error } = await (supabase as any).from("user_bans").insert({
        user_id: targetUserId, reason: reason.trim(), issued_by: user.id, expires_at: expiresAt,
      });
      if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); setSubmitting(false); return; }
      await supabase.from("notifications").insert({
        user_id: targetUserId, type: "moderation_ban",
        title: dur.hours === null ? "🚫 Ban permanente" : `🚫 Ban applicato (${dur.label})`,
        message: `Il tuo account è stato bannato${dur.hours === null ? " in modo permanente" : ` per **${dur.label}**`}.\n\n**Motivo:** ${reason.trim()}`,
        link: "/profile",
      });
      toast({ title: "Ban applicato" });
    }

    setSubmitting(false);
    onOpenChange(false);
    onApplied?.();
  };

  const icon = action === "warn" ? <AlertTriangle size={18} className="text-yellow-500" />
    : action === "timeout" ? <Clock size={18} className="text-orange-500" />
    : <Ban size={18} className="text-destructive" />;

  const title = action === "warn" ? `Applica Warn ${sectionCount + 1}/3` : action === "timeout" ? "Applica Time-out" : "Applica Ban";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{icon} {title}</DialogTitle>
          <DialogDescription>
            Azione di moderazione su <span className="font-semibold">{targetUserName || targetUserId.slice(0, 8) + "..."}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {action === "warn" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sezione</Label>
              <Select value={section} onValueChange={(v) => setSection(v as WarnSection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SECTION_LABELS) as WarnSection[]).map(s => (
                    <SelectItem key={s} value={s}>
                      {SECTION_LABELS[s]} <Badge variant="outline" className="ml-2 text-[10px]">{warnCounts[s] || 0}/3</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sectionMaxed && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <ShieldAlert size={12} /> Limite warn raggiunto in questa sezione. Usa Time-out o Ban.
                </p>
              )}
            </div>
          )}

          {(action === "timeout" || action === "ban") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Durata</Label>
              <Select value={String(durationIdx)} onValueChange={(v) => setDurationIdx(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(action === "timeout" ? TIMEOUT_DURATIONS : BAN_DURATIONS).map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Motivazione *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Spiega all'utente il motivo del provvedimento..."
              rows={3}
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{reason.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit} disabled={!canSubmit} variant={action === "ban" ? "destructive" : "default"}>
            {submitting ? "Invio..." : "Conferma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
