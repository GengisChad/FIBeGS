import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  deleteAll: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const DISMISSED_ANNOUNCEMENTS_KEY = "dismissed_announcements";

const getDismissedAnnouncements = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY) || "[]");
  } catch { return []; }
};

const dismissAnnouncement = (id: string) => {
  const dismissed = getDismissedAnnouncements();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(dismissed));
  }
};

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: async () => {},
  deleteAll: async () => {},
  markRead: async () => {},
});

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasLoadedInitialNotifications = useRef(false);

  const mergeAndSort = useCallback((personal: Notification[], announcements: Notification[]): Notification[] => {
    const all = [...personal, ...announcements];
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all.slice(0, 50);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      hasLoadedInitialNotifications.current = false;
      return;
    }

    const fetchAll = async () => {
      const dismissed = getDismissedAnnouncements();

      const [personalRes, announcementsRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, type, title, message, link, is_read, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("announcements")
          .select("id, title, message, link, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const personal = (personalRes.data ?? []) as Notification[];
      const announcementItems: Notification[] = (announcementsRes.data ?? [])
        .filter((a: any) => a.sent_by !== user.id)
        .map((a: any) => ({
          id: `ann_${a.id}`,
          type: "staff_announcement",
          title: a.title,
          message: a.message,
          link: a.link || null,
          is_read: dismissed.includes(a.id),
          created_at: a.created_at,
        }));

      const merged = mergeAndSort(personal, announcementItems);
      setNotifications(merged);
      setUnreadCount(merged.filter(n => !n.is_read).length);
      hasLoadedInitialNotifications.current = true;
    };

    fetchAll();

    const channel = supabase
      .channel("shared-notif-" + user.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setNotifications(prev => [n, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);

        if (hasLoadedInitialNotifications.current && document.visibilityState === "visible") {
          toast(n.title, { description: n.message });
        }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "announcements",
      }, (payload) => {
        const a = payload.new as any;
        if (a.sent_by === user.id) return;
        const notif: Notification = {
          id: `ann_${a.id}`,
          type: "staff_announcement",
          title: a.title,
          message: a.message,
          link: a.link || null,
          is_read: false,
          created_at: a.created_at,
        };
        setNotifications(prev => [notif, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        if (document.visibilityState === "visible") {
          toast(a.title, { description: a.message });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, mergeAndSort]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    // Mark personal notifications
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    // Dismiss all announcements locally
    notifications.forEach(n => {
      if (n.id.startsWith("ann_")) {
        dismissAnnouncement(n.id.replace("ann_", ""));
      }
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user, notifications]);

  const deleteAll = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    // Dismiss all announcements locally
    notifications.forEach(n => {
      if (n.id.startsWith("ann_")) {
        dismissAnnouncement(n.id.replace("ann_", ""));
      }
    });
    setNotifications([]);
    setUnreadCount(0);
  }, [user, notifications]);

  const markRead = useCallback(async (id: string) => {
    if (id.startsWith("ann_")) {
      dismissAnnouncement(id.replace("ann_", ""));
    } else {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead, deleteAll, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
