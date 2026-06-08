import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Minus, X, MessageCircle, Globe, Users } from "lucide-react";
import { PrivateChatView } from "./PrivateChatView";
import { GlobalChatView } from "./GlobalChatView";
import { ClubChatView } from "./ClubChatView";
import { TeamChatView } from "./TeamChatView";
import { useChatDock, type DockedChat } from "@/stores/chatDockStore";
import { useSidebarState } from "@/contexts/SidebarStateContext";
import type { FriendProfile } from "@/hooks/useFriends";
import { useEffect, useState } from "react";

interface Props { chat: DockedChat; index: number; }

const WIDTH = 320;
const GAP = 12;

const useIsMobile = () => {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  useEffect(() => {
    const onR = () => setM(window.innerWidth < 1024);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return m;
};

export const DockedChatWindow = ({ chat, index }: Props) => {
  const { closeChat, toggleMinimize } = useChatDock();
  const { collapsed } = useSidebarState();
  const isMobile = useIsMobile();
  const sidebarOffset = collapsed ? 16 : 296;
  const right = sidebarOffset + index * (WIDTH + GAP);

  const Icon = chat.kind === "global" ? Globe : chat.kind === "club" ? Users : MessageCircle;

  if (chat.minimized) {
    if (isMobile) return null;
    return (
      <button
        onClick={() => toggleMinimize(chat.key)}
        className="fixed bottom-0 z-50 hidden lg:flex items-center gap-2 bg-card border border-border rounded-t-lg px-3 py-2 shadow-lg hover:bg-muted transition-colors"
        style={{ right, width: WIDTH }}
      >
        {chat.avatarUrl ? (
          <Avatar className="h-6 w-6"><AvatarImage src={chat.avatarUrl} /><AvatarFallback>{chat.displayName[0]}</AvatarFallback></Avatar>
        ) : (
          <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center"><Icon size={12} className="text-primary" /></div>
        )}
        <span className="flex-1 text-sm font-medium truncate text-left">{chat.displayName}</span>
        <Icon size={14} className="text-muted-foreground" />
        <X size={14} className="text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); closeChat(chat.key); }} />
      </button>
    );
  }

  const renderBody = () => {
    if (chat.kind === "private" && chat.chatId && chat.peerId) {
      const peer: FriendProfile = {
        user_id: chat.peerId,
        display_name: chat.displayName,
        username: chat.username,
        avatar_url: chat.avatarUrl,
      };
      return <PrivateChatView chatId={chat.chatId} peer={peer} compact hideHeader />;
    }
    if (chat.kind === "global") return <GlobalChatView hideHeader />;
    if (chat.kind === "club" && chat.clubId) return <ClubChatView clubId={chat.clubId} clubName={chat.displayName} hideHeader />;
    if (chat.kind === "team" && chat.teamId) return <TeamChatView teamId={chat.teamId} teamName={chat.displayName} hideHeader />;
    return null;
  };

  if (isMobile) {
    // Mobile: full-screen modal-style chat (only one shown — last opened)
    // Hide all but the last (highest index)
    return (
      <div
        className="fixed inset-0 z-[120] flex flex-col bg-background lg:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card shrink-0">
          {chat.avatarUrl ? (
            <Avatar className="h-8 w-8"><AvatarImage src={chat.avatarUrl} /><AvatarFallback>{chat.displayName[0]}</AvatarFallback></Avatar>
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center"><Icon size={15} className="text-primary" /></div>
          )}
          <div className="flex-1 text-sm font-semibold truncate">{chat.displayName}</div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => closeChat(chat.key)}><X size={18} /></Button>
        </div>
        <div className="flex-1 min-h-0">{renderBody()}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 z-50 hidden lg:flex flex-col bg-card border border-border rounded-t-lg shadow-2xl animate-in slide-in-from-bottom duration-200"
      style={{ right, width: WIDTH, height: 460 }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card rounded-t-lg shrink-0">
        {chat.avatarUrl ? (
          <Avatar className="h-7 w-7"><AvatarImage src={chat.avatarUrl} /><AvatarFallback>{chat.displayName[0]}</AvatarFallback></Avatar>
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center"><Icon size={14} className="text-primary" /></div>
        )}
        <div className="flex-1 text-sm font-semibold truncate">{chat.displayName}</div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleMinimize(chat.key)}><Minus size={14} /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => closeChat(chat.key)}><X size={14} /></Button>
      </div>
      <div className="flex-1 min-h-0">{renderBody()}</div>
    </div>
  );
};
