import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Heart, Award, Swords, Megaphone, Trophy, Check, Trash2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { getNotificationStyle } from "@/lib/notificationStyles";
import { formatNotificationMessage } from "@/lib/formatNotification";

const typeIcon: Record<string, typeof Bell> = {
  market_like: Heart,
  badge_earned: Award,
  club_tournament: Swords,
  staff_announcement: Megaphone,
  ranking_record: Trophy,
  report: AlertTriangle,
};

const typeColor: Record<string, string> = {
  market_like: "text-pink-400",
  badge_earned: "text-yellow-400",
  club_tournament: "text-primary",
  staff_announcement: "text-blue-400",
  ranking_record: "text-emerald-400",
  report: "text-orange-500",
};


const NotificationItem = ({
  notif,
  isExpanded,
  onToggleExpand,
  onClick,
}: {
  notif: any;
  isExpanded: boolean;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onClick: (notif: any) => void;
}) => {
  const style = getNotificationStyle(notif.type);
  const Icon = style.icon;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // Check if content overflows when clamped
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [notif.message, isExpanded]);

  return (
    <div
      onClick={() => onClick(notif)}
      role="button"
      tabIndex={0}
      className={`relative w-full text-left hover:bg-secondary/30 transition-colors flex gap-3 items-start cursor-pointer px-4 py-3 ${
        !notif.is_read ? `bg-gradient-to-r ${style.gradientClass}` : ""
      }`}
    >
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${style.bgClass} ${style.textClass} ring-1 ring-inset ${style.borderClass}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-[9px] font-bold uppercase tracking-wide ${style.textClass}`}>{style.label}</span>
        <p className={`text-sm leading-tight ${!notif.is_read ? "font-semibold" : "font-medium text-muted-foreground"}`}>
          {notif.title}
        </p>
        <div
          ref={contentRef}
          className={`text-xs text-muted-foreground mt-0.5 space-y-1 break-words ${!isExpanded ? "line-clamp-[10]" : ""}`}
        >
          {formatNotificationMessage(notif.message)}
        </div>
        {(isClamped || isExpanded) && (
          <button
            type="button"
            onClick={(e) => onToggleExpand(notif.id, e)}
            className="text-[10px] text-primary mt-0.5 flex items-center gap-0.5 hover:underline touch-manipulation"
          >
            {isExpanded ? <><ChevronUp size={10} /> Mostra meno</> : <><ChevronDown size={10} /> Mostra tutto</>}
          </button>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: it })}
        </p>
      </div>
      {!notif.is_read && <div className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />}
    </div>
  );
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, deleteAll, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Aprire il pannello equivale a "leggere": segna tutto come letto così
    // dopo aver chiuso e riaperto l'app non riappaiono come non lette.
    if (unreadCount > 0) {
      markAllRead();
    }
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClick = useCallback(async (notif: typeof notifications[0]) => {
    if (!notif.is_read) await markRead(notif.id);
    if (notif.link) {
      setOpen(false);
      if (notif.link.startsWith("http://") || notif.link.startsWith("https://")) {
        try {
          const url = new URL(notif.link);
          if (url.origin === window.location.origin) {
            navigate(url.pathname + url.search + url.hash);
          } else {
            window.open(notif.link, "_blank");
          }
        } catch { navigate(notif.link); }
      } else {
        navigate(notif.link);
      }
    }
  }, [markRead, navigate]);

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        aria-label="Notifiche"
      >
        <Bell size={20} className="text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] sm:hidden" onClick={() => setOpen(false)} />
          <div
            className="fixed left-2 right-2 top-[68px] sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:w-[340px] bg-card border border-border rounded-xl shadow-xl z-[115] animate-fade-in overflow-hidden flex flex-col"
            style={{ maxHeight: "min(70vh, calc(100vh - 90px))" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="font-semibold text-sm">Notifiche</h3>
              <div className="flex gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
                    <Check size={12} /> Letto
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={deleteAll}>
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 overscroll-contain notification-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  Nessuna notifica
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notif) => (
                    <NotificationItem
                      key={notif.id}
                      notif={notif}
                      isExpanded={expandedIds.has(notif.id)}
                      onToggleExpand={toggleExpand}
                      onClick={handleClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
