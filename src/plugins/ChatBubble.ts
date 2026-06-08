import { registerPlugin, Capacitor } from "@capacitor/core";

export interface ChatBubblePlugin {
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ granted: boolean }>;
  setEnabled(opts: { enabled: boolean }): Promise<void>;
  isEnabled(): Promise<{ enabled: boolean }>;
  showBubble(opts: {
    chatId: string;
    kind?: "private" | "club" | "global";
    senderName?: string;
    avatarUrl?: string;
    preview?: string;
    accessToken?: string;
  }): Promise<void>;
  hideBubble(opts: { chatId: string }): Promise<void>;
  hideAll(): Promise<void>;
}

const nativeImpl = registerPlugin<ChatBubblePlugin>("ChatBubble");

const noop: ChatBubblePlugin = {
  hasOverlayPermission: async () => ({ granted: false }),
  requestOverlayPermission: async () => ({ granted: false }),
  setEnabled: async () => {},
  isEnabled: async () => ({ enabled: false }),
  showBubble: async () => {},
  hideBubble: async () => {},
  hideAll: async () => {},
};

export const isChatBubbleSupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export const ChatBubble: ChatBubblePlugin = isChatBubbleSupported() ? nativeImpl : noop;
