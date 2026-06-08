import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Heart, Award, Swords, Megaphone, Trophy, Check, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";

const typeIcon: Record<string, typeof Bell> = {
  market_like: Heart,
  badge_earned: Award,
  club_tournament: Swords,
  staff_announcement: Megaphone,
  ranking_record: Trophy,
};

const typeColor: Record<string, string> = {
  market_like: "text-pink-400",
  badge_earned: "text-yellow-400",
  club_tournament: "text-primary",
  staff_announcement: "text-blue-400",
  ranking_record: "text-emerald-400",
};

export const FloatingNotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, deleteAll, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = async (notif: typeof notifications[0]) => {
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
  };

  // Hidden — notifications are now in the top navbar
  return null;
  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-[200px] md:hidden right-6 z-50 flex items-center justify-center w-12 h-12 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:scale-105 transition-all duration-300 border border-border"
        aria-label="Notifiche"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[98] md:hidden bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-[260px] right-3 left-3 bg-card border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            ref={panelRef}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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

            <div className="max-h-[50vh] overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <Bell size={28} className="mx-auto mb-2 opacity-30" />
                  Nessuna notifica
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notif) => {
                    const Icon = typeIcon[notif.type] || Bell;
                    const color = typeColor[notif.type] || "text-muted-foreground";
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleClick(notif)}
                        role="button"
                        tabIndex={0}
                        className={`w-full text-left px-4 py-3 hover:bg-secondary/30 transition-colors flex gap-3 items-start cursor-pointer ${
                          !notif.is_read ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className={`mt-0.5 shrink-0 ${color}`}><Icon size={16} /></div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-tight ${!notif.is_read ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-[10] whitespace-pre-wrap">{notif.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: it })}
                          </p>
                        </div>
                        {!notif.is_read && <div className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
