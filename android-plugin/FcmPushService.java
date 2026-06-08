package com.ibna.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Log;

import android.annotation.SuppressLint;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Firebase Cloud Messaging service for handling push notifications
 * when the app is in the background or killed.
 *
 * When the app is in the foreground, Capacitor's PushNotifications plugin
 * handles the messages. This service covers background/killed scenarios.
 */
public class FcmPushService extends FirebaseMessagingService {

    private static final String TAG = "FcmPushService";
    private static final String CHANNEL_ID = "ibna_notifications";
    private static final String CHANNEL_NAME = "IBNA Notifiche";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "FCM message received from: " + remoteMessage.getFrom());

        String title = "IBNApp";
        String body = "";
        String link = null;

        // Priority 1: data payload (our custom format from edge functions)
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Data payload: " + remoteMessage.getData());
            title = remoteMessage.getData().getOrDefault("title", title);
            body = remoteMessage.getData().getOrDefault("body", body);
            link = remoteMessage.getData().get("link");
        }

        // Priority 2: notification payload (FCM console or standard format)
        if (remoteMessage.getNotification() != null) {
            RemoteMessage.Notification notification = remoteMessage.getNotification();
            if (notification.getTitle() != null) title = notification.getTitle();
            if (notification.getBody() != null) body = notification.getBody();
        }

        if (body.isEmpty() && title.equals("IBNApp")) {
            Log.d(TAG, "Empty notification, skipping");
            return;
        }

        // Floating chat bubbles for private messages (Messenger-style).
        // Triggered only when:
        //   - the data payload carries kind=private + chat_id
        //   - the user enabled bubbles in IBNApp settings
        //   - SYSTEM_ALERT_WINDOW is granted
        String kind = remoteMessage.getData().get("kind");
        String chatId = remoteMessage.getData().get("chat_id");
        if ("private".equals(kind) && chatId != null && !chatId.isEmpty()) {
            android.content.SharedPreferences prefs =
                    getSharedPreferences(ChatBubblePlugin.PREFS, 0);
            boolean bubblesOn = prefs.getBoolean(ChatBubblePlugin.KEY_ENABLED, false);
            boolean canOverlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    || android.provider.Settings.canDrawOverlays(this);
            if (bubblesOn && canOverlay) {
                Intent svc = new Intent(this, ChatBubbleService.class);
                svc.setAction(ChatBubbleService.ACTION_SHOW);
                svc.putExtra("chatId", chatId);
                svc.putExtra("kind", "private");
                svc.putExtra("senderName", title);
                svc.putExtra("preview", body);
                svc.putExtra("accessToken",
                        remoteMessage.getData().getOrDefault("access_token", ""));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
                // Still show a standard notification as fallback / for notification history.
            }
        }

        showNotification(title, body, link);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "FCM token refreshed: " + token);
        // The token will be picked up by Capacitor's PushNotifications plugin
        // when the app is next opened. No additional handling needed here
        // since we store subscriptions via the web push system.
    }

    /**
     * Display a local notification with the FCM message content.
     */
    private void showNotification(String title, String body, String link) {
        createNotificationChannel();

        // Create intent to open the app when notification is tapped
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent == null) {
            Log.w(TAG, "Launch intent not found, skipping notification tap action");
            return;
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        if (link != null && !link.isEmpty()) {
            intent.putExtra("push_link", link);
            // Set the data URI so the WebView navigates to the right page
            intent.setData(android.net.Uri.parse("https://ibnapp.lovable.app" + link));
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info) // fallback icon
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setVibrate(new long[]{200, 100, 200})
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent);

        // Try to use the app icon
        try {
            int iconRes = getApplicationInfo().icon;
            if (iconRes != 0) {
                builder.setSmallIcon(iconRes);
            }
        } catch (Exception ignored) {}

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            int notificationId = (int) System.currentTimeMillis();
            manager.notify(notificationId, builder.build());
            Log.d(TAG, "Notification shown: " + title);
        }
    }

    /**
     * Create the notification channel (required for Android 8+).
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifiche tornei, match e aggiornamenti IBNA");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{200, 100, 200});

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
