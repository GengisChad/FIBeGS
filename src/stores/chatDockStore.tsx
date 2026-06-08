import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

export type DockChatKind = "private" | "global" | "club" | "team";

export type DockedChat = {
  // unique key for the chat
  key: string;
  kind: DockChatKind;
  // for private chats
  peerId?: string;
  chatId?: string;
  // for club chats
  clubId?: string;
  // for team chats
  teamId?: string;
  // display
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  minimized: boolean;
};

type OpenInput = Omit<DockedChat, "minimized" | "key"> & { key?: string };

type Ctx = {
  chats: DockedChat[];
  openChat: (c: OpenInput) => void;
  closeChat: (key: string) => void;
  toggleMinimize: (key: string) => void;
};

const ChatDockContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "chat-dock-v2";
const MAX_OPEN = 4;

const computeKey = (c: OpenInput): string => {
  if (c.key) return c.key;
  if (c.kind === "private") return `private:${c.peerId}`;
  if (c.kind === "club") return `club:${c.clubId}`;
  if (c.kind === "team") return `team:${c.teamId}`;
  return "global";
};

export const ChatDockProvider = ({ children }: { children: ReactNode }) => {
  const [chats, setChats] = useState<DockedChat[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DockedChat[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch {}
  }, [chats]);

  const openChat = useCallback((c: OpenInput) => {
    const key = computeKey(c);
    setChats(prev => {
      if (prev.some(p => p.key === key)) {
        return prev.map(p => p.key === key ? { ...p, ...c, key, minimized: false } : p);
      }
      const next = [...prev, { ...c, key, minimized: false } as DockedChat];
      return next.slice(Math.max(0, next.length - MAX_OPEN));
    });
  }, []);

  const closeChat = useCallback((key: string) => {
    setChats(prev => prev.filter(p => p.key !== key));
  }, []);

  const toggleMinimize = useCallback((key: string) => {
    setChats(prev => prev.map(p => p.key === key ? { ...p, minimized: !p.minimized } : p));
  }, []);

  return (
    <ChatDockContext.Provider value={{ chats, openChat, closeChat, toggleMinimize }}>
      {children}
    </ChatDockContext.Provider>
  );
};

export const useChatDock = () => {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used inside ChatDockProvider");
  return ctx;
};
