import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { ModerationActionDialog, type ModerationAction, type WarnSection } from "./ModerationActionDialog";
import { Link } from "react-router-dom";
import { User, AlertTriangle, Clock, Ban } from "lucide-react";

interface ModerationContextMenuProps {
  children: ReactNode;
  /** The user being targeted */
  userId: string;
  username?: string | null;
  displayName?: string | null;
  /** Optional default section to pre-select on warn */
  section?: WarnSection;
  /** Disable entirely (eg if same user) */
  disabled?: boolean;
}

/**
 * Wraps any element with a desktop right-click moderation menu.
 * On mobile (touch) the right-click never fires, so this is a no-op extra layer.
 * Only renders the menu if the current user is staff.
 */
export const ModerationContextMenu = ({
  children, userId, username, displayName, section, disabled,
}: ModerationContextMenuProps) => {
  const { user } = useAuth();
  const { isStaff } = useUserRoles();
  const [dialogAction, setDialogAction] = useState<ModerationAction | null>(null);
  const [maxedSections, setMaxedSections] = useState(false);

  // Determine if any section is at 3/3 (so we can highlight the ban option)
  useEffect(() => {
    if (!isStaff || disabled) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_warns")
        .select("section")
        .eq("user_id", userId).eq("is_active", true);
      if (cancelled) return;
      const counts: Record<string, number> = {};
      (data || []).forEach((w: any) => { counts[w.section] = (counts[w.section] || 0) + 1; });
      setMaxedSections(Object.values(counts).some(c => c >= 3));
    })();
    return () => { cancelled = true; };
  }, [isStaff, userId, disabled]);

  const isSelf = user?.id === userId;
  const showMenu = isStaff && !disabled && !isSelf;

  if (!showMenu) return <>{children}</>;

  const profileHref = username ? `/profilo/${username}` : `/profilo/child/${userId}`;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <span>{children}</span>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem asChild>
            <Link to={profileHref} className="cursor-pointer">
              <User size={14} className="mr-2" /> Profilo giocatore
            </Link>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setDialogAction("warn")} className="cursor-pointer">
            <AlertTriangle size={14} className="mr-2 text-yellow-500" /> Applica Warn
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setDialogAction("timeout")} className="cursor-pointer">
            <Clock size={14} className="mr-2 text-orange-500" /> Applica Time-out
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setDialogAction("ban")}
            disabled={!maxedSections}
            className={`cursor-pointer ${!maxedSections ? "opacity-50" : ""}`}
          >
            <Ban size={14} className="mr-2 text-destructive" />
            Applica Ban {!maxedSections && <span className="ml-auto text-[10px] text-muted-foreground">3/3</span>}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {dialogAction && (
        <ModerationActionDialog
          open={!!dialogAction}
          onOpenChange={(o) => !o && setDialogAction(null)}
          action={dialogAction}
          targetUserId={userId}
          targetUserName={displayName || username || undefined}
          defaultSection={section}
        />
      )}
    </>
  );
};
