import { useEffect, useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Native push notifications via FCM (Firebase Cloud Messaging) for Android.
 * Uses dynamic imports to avoid build errors on web.
 */
export const useNativePush = () => {
  const { user } = useAuth();
  const [isNativeSupported, setIsNativeSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    setIsNativeSupported(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (!isNativeSupported || !user) return;

    let cleanedUp = false;

    import("@capacitor/push-notifications").then(({ PushNotifications }) => {
      if (cleanedUp) return;

      PushNotifications.addListener("registration", async (token) => {
        console.log("FCM token:", token.value);

        const endpoint = `fcm:${token.value}`;
        const { data: existingRecord, error: existingLookupError } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", endpoint)
          .limit(1)
          .maybeSingle();

        if (existingLookupError) {
          console.error("Error checking FCM token:", existingLookupError);
          return;
        }

        const { error } = existingRecord
          ? await supabase
              .from("push_subscriptions")
              .update({ p256dh: "fcm", auth: "fcm" })
              .eq("id", existingRecord.id)
          : await supabase.from("push_subscriptions").insert({
              user_id: user.id,
              endpoint,
              p256dh: "fcm",
              auth: "fcm",
            });

        if (!error) {
          setIsRegistered(true);
        } else {
          console.error("Error saving FCM token:", error);
        }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration error:", err);
      });

      PushNotifications.addListener("pushNotificationReceived", async (notification) => {
        console.log("Push received:", notification);
        // If this is a private message and the user has bubbles enabled,
        // surface a floating bubble on top of every app.
        try {
          const data: any = notification?.data || {};
          if (data.kind === "private" && data.chat_id) {
            const { ChatBubble, isChatBubbleSupported } = await import("@/plugins/ChatBubble");
            if (!isChatBubbleSupported()) return;
            const [{ enabled }, { granted }] = await Promise.all([
              ChatBubble.isEnabled(),
              ChatBubble.hasOverlayPermission(),
            ]);
            if (!enabled || !granted) return;
            const { data: session } = await supabase.auth.getSession();
            await ChatBubble.showBubble({
              chatId: data.chat_id,
              kind: "private",
              senderName: notification.title || "Chat",
              preview: notification.body || "",
              accessToken: session?.session?.access_token || "",
            });
          }
        } catch (e) {
          console.warn("bubble show failed:", e);
        }
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
        console.log("Push action:", action);
        const data = action.notification?.data || {};
        // Inline reply text (iOS UNNotificationActionTypeTextInput / Android RemoteInput)
        const replyText: string | undefined = action.inputValue || action.userText;
        const chatId = data.chat_id || data.chatId;
        if (replyText && chatId && data.kind === "private") {
          // Fire-and-forget: invoke edge function to send encrypted reply
          supabase.functions.invoke("reply-from-notification", {
            body: { chat_id: chatId, text: replyText },
          }).catch((e) => console.error("reply-from-notification:", e));
          return;
        }
        if (data?.url) {
          window.location.href = data.url;
        } else if (chatId) {
          window.location.href = `/?chat=${chatId}&kind=${data.kind || "private"}`;
        }
      });

      // Register iOS notification categories with inline reply action.
      // NOTE: real text-input on iOS requires a Notification Service Extension
      // in the Xcode project and the server payload must include "category":"MSG_REPLY".
      try {
        const pn = PushNotifications as any;
        if (typeof pn.registerActionTypes === "function") {
          pn.registerActionTypes({
            types: [
              {
                id: "MSG_REPLY",
                actions: [
                  { id: "REPLY", title: "Rispondi", input: true, inputButtonTitle: "Invia", inputPlaceholder: "Scrivi una risposta..." },
                  { id: "OPEN", title: "Apri" },
                  { id: "MARK_READ", title: "Segna come letto" },
                ],
              },
            ],
          }).catch(() => {});
        }
      } catch {}
    }).catch(() => {});

    return () => {
      cleanedUp = true;
      import("@capacitor/push-notifications").then(({ PushNotifications }) => {
        PushNotifications.removeAllListeners();
      }).catch(() => {});
    };
  }, [isNativeSupported, user]);

  const registerNativePush = useCallback(async () => {
    if (!isNativeSupported) return false;

    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      if (Capacitor.getPlatform() === "android") {
        await PushNotifications.createChannel({
          id: "default",
          name: "Notifiche tornei",
          description: "Avvisi match e aggiornamenti tornei",
          importance: 5,
          visibility: 1,
          vibration: true,
        }).catch((error) => {
          console.warn("Push channel setup warning:", error);
        });
      }

      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") return false;

      await PushNotifications.register();
      return true;
    } catch (err) {
      console.error("Native push registration error:", err);
      return false;
    }
  }, [isNativeSupported]);

  const checkPermission = useCallback(async () => {
    if (!isNativeSupported) return "default" as NotificationPermission;
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const result = await PushNotifications.checkPermissions();
      return result.receive === "granted" ? "granted" as NotificationPermission : "default" as NotificationPermission;
    } catch {
      return "default" as NotificationPermission;
    }
  }, [isNativeSupported]);

  return {
    isNativeSupported,
    isRegistered,
    registerNativePush,
    checkPermission,
  };
};
