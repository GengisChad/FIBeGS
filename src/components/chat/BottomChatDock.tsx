import { useEffect } from "react";
import { useChatDock } from "@/stores/chatDockStore";
import { useSidebarState } from "@/contexts/SidebarStateContext";
import { DockedChatWindow } from "./DockedChatWindow";

const WINDOW_WIDTH = 320;
const GAP = 12;
const EDGE_PAD = 16;

export const BottomChatDock = () => {
  const { chats, closeChat } = useChatDock();
  const { collapsed } = useSidebarState();

  useEffect(() => {
    const enforce = () => {
      if (typeof window === "undefined") return;
      if (window.innerWidth < 1024) return; // dock only renders on lg+
      const sidebarOffset = collapsed ? EDGE_PAD : 296;
      const available = window.innerWidth - sidebarOffset - EDGE_PAD;
      const maxFit = Math.max(1, Math.floor((available + GAP) / (WINDOW_WIDTH + GAP)));
      if (chats.length > maxFit) {
        // close the oldest (first in array) until we fit
        const toClose = chats.slice(0, chats.length - maxFit);
        toClose.forEach(c => closeChat(c.key));
      }
    };
    enforce();
    window.addEventListener("resize", enforce);
    return () => window.removeEventListener("resize", enforce);
  }, [chats, collapsed, closeChat]);

  // On mobile only the last opened chat is rendered fullscreen
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
  const visible = isMobile && chats.length > 0 ? [chats[chats.length - 1]] : chats;

  return (
    <>
      {visible.map((c, i) => (
        <DockedChatWindow key={c.key} chat={c} index={isMobile ? 0 : chats.indexOf(c)} />
      ))}
    </>
  );
};

export default BottomChatDock;
