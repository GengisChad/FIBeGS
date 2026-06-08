package com.ibna.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.HashMap;
import java.util.Map;

/**
 * Foreground service that draws Messenger-style chat bubbles on top of every
 * other app using WindowManager + the SYSTEM_ALERT_WINDOW permission.
 *
 * - One bubble per chatId
 * - Drag to move, snap to nearest horizontal edge on release
 * - Tap to expand into a mini WebView pointing at /chat-embed?id=...
 * - Long-press to dismiss
 *
 * The service auto-stops after IDLE_TIMEOUT_MS with no active bubble.
 */
public class ChatBubbleService extends Service {

    private static final String TAG = "ChatBubbleService";
    public static final String ACTION_SHOW = "com.ibna.app.bubble.SHOW";
    public static final String ACTION_HIDE = "com.ibna.app.bubble.HIDE";

    private static final String CHANNEL_ID = "ibna_bubble_service";
    private static final int FOREGROUND_ID = 4242;
    private static final long IDLE_TIMEOUT_MS = 30 * 60 * 1000L; // 30 min

    private static final String BASE_URL = "https://ibna.it";

    private WindowManager wm;
    private final Map<String, BubbleHolder> bubbles = new HashMap<>();
    private final Handler handler = new Handler(Looper.getMainLooper());

    static class BubbleHolder {
        View collapsed;
        View expanded;
        WindowManager.LayoutParams params;
        boolean isExpanded;
        String accessToken;
        String chatId;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        startForegroundCompat();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_SHOW.equals(action)) {
            handleShow(intent);
        } else if (ACTION_HIDE.equals(action)) {
            String chatId = intent.getStringExtra("chatId");
            removeBubble(chatId);
        }
        scheduleIdleStop();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        for (String id : new java.util.ArrayList<>(bubbles.keySet())) removeBubble(id);
        super.onDestroy();
    }

    // ---------- bubble lifecycle ----------

    private void handleShow(Intent intent) {
        String chatId = intent.getStringExtra("chatId");
        if (chatId == null || chatId.isEmpty()) return;

        if (bubbles.containsKey(chatId)) {
            // already visible — bring to front
            return;
        }

        SharedPreferences prefs = getSharedPreferences(ChatBubblePlugin.PREFS, 0);
        if (!prefs.getBoolean(ChatBubblePlugin.KEY_ENABLED, false)) {
            Log.d(TAG, "bubbles disabled in prefs, ignoring");
            return;
        }

        String senderName = intent.getStringExtra("senderName");
        String accessToken = intent.getStringExtra("accessToken");

        BubbleHolder h = new BubbleHolder();
        h.chatId = chatId;
        h.accessToken = accessToken;
        h.collapsed = buildCollapsedView(senderName);

        int size = dp(56);
        h.params = new WindowManager.LayoutParams(
                size, size,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        h.params.gravity = Gravity.TOP | Gravity.START;
        h.params.x = 0;
        h.params.y = dp(120);

        attachDragAndTap(h);

        try {
            wm.addView(h.collapsed, h.params);
            bubbles.put(chatId, h);
        } catch (Exception e) {
            Log.e(TAG, "addView failed: " + e.getMessage());
        }
    }

    private void removeBubble(String chatId) {
        if (chatId == null) return;
        BubbleHolder h = bubbles.remove(chatId);
        if (h == null) return;
        try { if (h.collapsed != null) wm.removeView(h.collapsed); } catch (Exception ignored) {}
        try { if (h.expanded != null) wm.removeView(h.expanded); } catch (Exception ignored) {}
        if (bubbles.isEmpty()) {
            stopSelf();
        }
    }

    // ---------- views ----------

    private View buildCollapsedView(String senderName) {
        FrameLayout root = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(0xFF1f6feb);
        bg.setStroke(dp(2), 0xFFFFFFFF);
        root.setBackground(bg);
        root.setElevation(dp(6));

        ImageView icon = new ImageView(this);
        int iconRes = 0;
        try { iconRes = getApplicationInfo().icon; } catch (Exception ignored) {}
        if (iconRes == 0) iconRes = android.R.drawable.sym_action_chat;
        icon.setImageResource(iconRes);
        icon.setScaleType(ImageView.ScaleType.FIT_CENTER);

        int iconSize = dp(36);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(iconSize, iconSize);
        lp.gravity = Gravity.CENTER;
        root.addView(icon, lp);
        return root;
    }

    private View buildExpandedView(BubbleHolder h) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFFFFFFFF);
        root.setElevation(dp(8));

        // header
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setBackgroundColor(0xFF1f6feb);
        header.setPadding(dp(12), dp(8), dp(8), dp(8));
        header.setGravity(Gravity.CENTER_VERTICAL);

        TextView title = new TextView(this);
        title.setText("Chat IBNApp");
        title.setTextColor(0xFFFFFFFF);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        header.addView(title, titleLp);

        ImageButton close = new ImageButton(this);
        close.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        close.setBackgroundColor(0x00000000);
        close.setColorFilter(0xFFFFFFFF);
        close.setOnClickListener(v -> removeBubble(h.chatId));
        header.addView(close, new LinearLayout.LayoutParams(dp(36), dp(36)));

        root.addView(header, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // WebView
        WebView web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        String url = BASE_URL + "/chat-embed?id=" + Uri.encode(h.chatId)
                + (h.accessToken != null && !h.accessToken.isEmpty()
                    ? "#token=" + Uri.encode(h.accessToken) : "");
        web.loadUrl(url);

        root.addView(web, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        return root;
    }

    private void attachDragAndTap(final BubbleHolder h) {
        h.collapsed.setOnTouchListener(new View.OnTouchListener() {
            int initialX, initialY;
            float touchX, touchY;
            long downTime;
            boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent ev) {
                switch (ev.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = h.params.x;
                        initialY = h.params.y;
                        touchX = ev.getRawX();
                        touchY = ev.getRawY();
                        downTime = System.currentTimeMillis();
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (ev.getRawX() - touchX);
                        int dy = (int) (ev.getRawY() - touchY);
                        if (Math.abs(dx) > dp(4) || Math.abs(dy) > dp(4)) moved = true;
                        h.params.x = initialX + dx;
                        h.params.y = initialY + dy;
                        try { wm.updateViewLayout(h.collapsed, h.params); } catch (Exception ignored) {}
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved && System.currentTimeMillis() - downTime < 300) {
                            toggleExpanded(h);
                        } else {
                            snapToEdge(h);
                        }
                        return true;
                }
                return false;
            }
        });
        h.collapsed.setOnLongClickListener(v -> { removeBubble(h.chatId); return true; });
    }

    private void snapToEdge(BubbleHolder h) {
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int bubbleW = h.collapsed.getWidth();
        h.params.x = (h.params.x + bubbleW / 2 < screenW / 2) ? 0 : screenW - bubbleW;
        try { wm.updateViewLayout(h.collapsed, h.params); } catch (Exception ignored) {}
    }

    private void toggleExpanded(BubbleHolder h) {
        if (h.isExpanded) {
            try { wm.removeView(h.expanded); } catch (Exception ignored) {}
            h.expanded = null;
            h.isExpanded = false;
            return;
        }
        h.expanded = buildExpandedView(h);
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        WindowManager.LayoutParams ep = new WindowManager.LayoutParams(
                Math.min(dp(340), screenW - dp(24)),
                Math.min(dp(520), screenH - dp(120)),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM,
                PixelFormat.TRANSLUCENT);
        // make it focusable so keyboard works inside the WebView
        ep.flags = WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM;
        ep.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        ep.gravity = Gravity.TOP | Gravity.START;
        ep.x = dp(12);
        ep.y = dp(80);
        try {
            wm.addView(h.expanded, ep);
            h.isExpanded = true;
        } catch (Exception e) {
            Log.e(TAG, "expand failed: " + e.getMessage());
        }
    }

    // ---------- foreground notification ----------

    private void startForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Chat floating",
                    NotificationManager.IMPORTANCE_MIN);
            ch.setDescription("Mantiene attive le bolle chat sopra altre app");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = open != null ? PendingIntent.getActivity(
                this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE) : null;

        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.sym_action_chat)
                .setContentTitle("IBNApp · Chat floating attiva")
                .setContentText("Tocca per aprire l'app")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setContentIntent(pi)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(FOREGROUND_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(FOREGROUND_ID, n);
        }
    }

    private void scheduleIdleStop() {
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            if (bubbles.isEmpty()) stopSelf();
        }, IDLE_TIMEOUT_MS);
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }
}
