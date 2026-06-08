import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModerationActionDialog, type ModerationAction } from "./ModerationActionDialog";
import { Link } from "react-router-dom";
import { User, AlertTriangle, Clock, Ban } from "lucide-react";

/**
 * Global listener: on desktop right-click on any anchor that points to /profilo/<identifier>,
 * resolves the target user and opens a moderation context menu (staff only).
 * Mounted once at app root — works on any page without per-component wiring.
 */
export const GlobalModerationContextMenu = () => {
  const { user } = useAuth();
  const { isStaff } = useUserRoles();

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<{
    userId: string;
    username: string | null;
    displayName: string | null;
  } | null>(null);
  const [maxWarnCount, setMaxWarnCount] = useState(0);
  const [dialogAction, setDialogAction] = useState<ModerationAction | null>(null);

  const resolveAndOpen = useCallback(async (identifier: string, isChild: boolean, x: number, y: number) => {
    if (isChild) {
      // /profilo/child/<uuid>
      const { data } = await (supabase as any)
        .from("child_profiles")
        .select("id, display_name")
        .eq("id", identifier)
        .maybeSingle();
      if (!data) return;
      setTarget({ userId: data.id, username: null, displayName: data.display_name });
    } else {
      // /profilo/<username>
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", identifier)
        .maybeSingle();
      if (!data) return;
      // never moderate yourself
      if (data.id === user?.id) return;
      setTarget({ userId: data.id, username: data.username, displayName: data.display_name });
    }
    setPos({ x, y });
  }, [user?.id]);

  useEffect(() => {
    if (!isStaff) return;

    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute("href") || "";
      // Match both internal Links (relative) and absolute hrefs
      const m = href.match(/\/profilo\/(child\/)?([^/?#]+)/);
      if (!m) return;
      const isChild = !!m[1];
      const identifier = decodeURIComponent(m[2]);
      e.preventDefault();
      e.stopPropagation();
      void resolveAndOpen(identifier, isChild, e.clientX, e.clientY);
    };

    document.addEventListener("contextmenu", handler, true);
    return () => document.removeEventListener("contextmenu", handler, true);
  }, [isStaff, resolveAndOpen]);

  // Load warn counts when target changes
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_warns")
        .select("section")
        .eq("user_id", target.userId)
        .eq("is_active", true);
      if (cancelled) return;
      const counts: Record<string, number> = {};
      (data || []).forEach((w: any) => {
        counts[w.section] = (counts[w.section] || 0) + 1;
      });
      const max = Object.values(counts).reduce((a, c) => Math.max(a, c), 0);
      setMaxWarnCount(Math.min(max, 3));
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!isStaff) return null;

  const open = !!pos && !!target;
  const profileHref = target?.username
    ? `/profilo/${target.username}`
    : target
      ? `/profilo/child/${target.userId}`
      : "#";

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setPos(null);
            setTarget(null);
          }
        }}
      >
        {/* Invisible anchor positioned at cursor */}
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            style={{
              position: "fixed",
              left: pos?.x ?? -9999,
              top: pos?.y ?? -9999,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem asChild>
            <Link to={profileHref} className="cursor-pointer">
              <User size={14} className="mr-2" /> Profilo giocatore
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDialogAction("warn")}
            disabled={maxWarnCount >= 3}
            className={`cursor-pointer ${maxWarnCount >= 3 ? "opacity-50" : ""}`}
          >
            <AlertTriangle size={14} className="mr-2 text-warning" /> Applica Warn
            <span className={`ml-auto text-[10px] font-semibold ${maxWarnCount >= 3 ? "text-destructive" : "text-muted-foreground"}`}>
              {maxWarnCount}/3
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialogAction("timeout")} className="cursor-pointer">
            <Clock size={14} className="mr-2 text-accent-foreground" /> Applica Time-out
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDialogAction("ban")}
            disabled={maxWarnCount < 3}
            className={`cursor-pointer ${maxWarnCount < 3 ? "opacity-50" : ""}`}
          >
            <Ban size={14} className="mr-2 text-destructive" />
            Applica Ban
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogAction && target && (
        <ModerationActionDialog
          open={!!dialogAction}
          onOpenChange={(o) => {
            if (!o) {
              setDialogAction(null);
              setPos(null);
            }
          }}
          action={dialogAction}
          targetUserId={target.userId}
          targetUserName={target.displayName || target.username || undefined}
        />
      )}
    </>
  );
};
