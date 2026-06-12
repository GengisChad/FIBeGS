/**
 * FCM Background Push Service
 *
 * This is NOT a Capacitor plugin — it's a native Android service (FcmPushService.java)
 * that runs automatically when the app is closed/background.
 *
 * It handles:
 * - Displaying notifications when app is killed
 * - Notification tap → opens app at the correct page
 * - FCM token refresh
 *
 * When the app is in the foreground, Capacitor's PushNotifications plugin
 * handles everything. This service only covers background scenarios.
 *
 * No TypeScript API needed — the service is fully automatic.
 * Just import this file if you need to reference the type info.
 */

export const FCM_PUSH_INFO = {
  channelId: "ibna_notifications",
  channelName: "FIBeGS Notifiche",
  description: "Handles push notifications when app is in background or killed",
} as const;
