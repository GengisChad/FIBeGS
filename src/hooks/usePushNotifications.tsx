import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (isSupported && user) {
      checkSubscription();
    }
  }, [isSupported, user]);

  const checkSubscription = async () => {
    try {
      // Check both browser state and DB state
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription && user) {
        // Verify it's also in the DB
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint)
          .limit(1);
        
        setIsSubscribed(!!(data && data.length > 0));
      } else {
        setIsSubscribed(false);
      }
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      // VitePWA auto-registers the SW, just wait for it to be ready
      const registration = await navigator.serviceWorker.ready;

      const { data: vapidData, error: vapidError } = await supabase.functions.invoke("get-vapid-public-key");
      if (vapidError || !vapidData?.publicKey) {
        console.error("Failed to get VAPID public key:", vapidError);
        return false;
      }

      // Refresh only the current browser subscription without deleting other devices
      const existingSub = await (registration as any).pushManager.getSubscription();
      const previousEndpoint = existingSub?.endpoint ?? null;
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidData.publicKey,
      });

      const subJson = subscription.toJSON();
      const nextEndpoint = subJson.endpoint;

      if (previousEndpoint && previousEndpoint !== nextEndpoint) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", previousEndpoint);
      }

      const { data: existingRecord, error: existingLookupError } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", nextEndpoint)
        .limit(1)
        .maybeSingle();

      if (existingLookupError) {
        console.error("Error checking subscription:", existingLookupError);
        return false;
      }

      const payload = {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      };

      const { error } = existingRecord
        ? await supabase.from("push_subscriptions").update(payload).eq("id", existingRecord.id)
        : await supabase.from("push_subscriptions").insert({
            user_id: user.id,
            endpoint: nextEndpoint,
            ...payload,
          });

      if (error) {
        console.error("Error saving subscription:", error);
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Error subscribing:", err);
      return false;
    }
  }, [isSupported, user]);

  const sendNotification = useCallback(async (userIds: string[], title: string, body: string, data?: any) => {
    try {
      const { data: result, error } = await supabase.functions.invoke("send-push-notification", {
        body: { user_ids: userIds, title, body, data },
      });

      if (error) {
        console.error("Error sending notification:", error);
        return false;
      }

      return result;
    } catch (err) {
      console.error("Error:", err);
      return false;
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    sendNotification,
  };
};
