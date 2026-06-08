import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Bell, Heart, Award, Swords, Megaphone, Trophy, Check, Trash2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useEffect, useState } from "react";
import { getNotificationStyle } from "@/lib/notificationStyles";
import { formatNotificationMessage, stripNotificationFormatting } from "@/lib/formatNotification";

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

const MESSAGE_TRUNCATE = 80;

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, deleteAll, markRead } = useNotifications();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  // Aprire la pagina equivale a "leggere": segna tutto come letto.
  useEffect(() => {
    if (user && unreadCount > 0) {
      markAllRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleClick = async (notif: typeof notifications[0]) => {
    if (!notif.is_read) await markRead(notif.id);
    if (notif.link) {
      if (notif.link.startsWith("http://") || notif.link.startsWith("https://")) {
        try {
          const url = new URL(notif.link);
          if (url.origin === window.location.origin) {
            navigate(url.pathname + url.search + url.hash);
          } else {
            window.open(notif.link, "_blank");
          }
        } catch {
          navigate(notif.link);
        }
      } else {
        navigate(notif.link);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <h1 className="section-title text-3xl">Notifiche</h1>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="gap-1" onClick={markAllRead}>
                <Check size={14} /> Segna lette
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={deleteAll}>
                <Trash2 size={14} /> Elimina
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bell size={48} className="mx-auto mb-3 opacity-20" />
            <p>Nessuna notifica</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const style = getNotificationStyle(notif.type);
              const Icon = style.icon;
              const plain = stripNotificationFormatting(notif.message);
              const isLong = plain.length > MESSAGE_TRUNCATE;
              const isExpanded = expanded.has(notif.id);
              const displayText =
                isLong && !isExpanded ? plain.slice(0, MESSAGE_TRUNCATE) + "…" : notif.message;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`group relative w-full text-left rounded-xl border overflow-hidden transition-all hover:scale-[1.005] ${
                    !notif.is_read
                      ? `bg-card ${style.borderClass}`
                      : "bg-card/60 border-border hover:bg-secondary/30"
                  }`}
                >
                  <div className={`h-1 w-full bg-gradient-to-r ${style.gradientClass}`} />
                  <div className="px-4 py-3 flex gap-3 items-start">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${style.bgClass} ${style.textClass} ring-1 ring-inset ${style.borderClass}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${style.textClass}`}>{style.label}</span>
                    <p className={`text-sm ${!notif.is_read ? "font-semibold" : "text-muted-foreground"}`}>
                      {notif.title}
                    </p>
                    <div className="text-xs text-muted-foreground mt-0.5 space-y-1 break-words">
                      {formatNotificationMessage(displayText)}
                    </div>
                    {isLong && (
                      <span
                        role="button"
                        onClick={(e) => toggleExpand(notif.id, e)}
                        className="inline-flex items-center gap-0.5 text-[10px] text-primary mt-0.5 hover:underline"
                      >
                        {isExpanded ? <><ChevronUp size={10} /> Meno</> : <><ChevronDown size={10} /> Altro</>}
                      </span>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: it })}
                    </p>
                  </div>
                    {!notif.is_read && <div className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Notifications;
