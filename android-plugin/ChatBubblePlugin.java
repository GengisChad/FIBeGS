package com.ibna.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that exposes Messenger-style floating chat bubbles to JS.
 *
 * Public methods:
 *  - hasOverlayPermission()
 *  - requestOverlayPermission()
 *  - setEnabled({ enabled })   → persists preference in SharedPreferences
 *  - isEnabled()
 *  - showBubble({ chatId, kind, senderName, avatarUrl, preview, accessToken })
 *  - hideBubble({ chatId })
 *  - hideAll()
 *
 * Actual rendering happens in ChatBubbleService (foreground service that adds
 * Views to WindowManager). This plugin only proxies start/stop intents.
 */
@CapacitorPlugin(name = "ChatBubble")
public class ChatBubblePlugin extends Plugin {

    public static final String PREFS = "ibna_chat_bubbles";
    public static final String KEY_ENABLED = "enabled";

    @PluginMethod
    public void hasOverlayPermission(PluginCall call) {
        boolean has = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || Settings.canDrawOverlays(getContext());
        JSObject ret = new JSObject();
        ret.put("granted", has);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || Settings.canDrawOverlays(getContext())) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("granted", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        prefs.edit().putBoolean(KEY_ENABLED, enabled).apply();
        if (!enabled) {
            getContext().stopService(new Intent(getContext(), ChatBubbleService.class));
        }
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        JSObject ret = new JSObject();
        ret.put("enabled", prefs.getBoolean(KEY_ENABLED, false));
        call.resolve(ret);
    }

    @PluginMethod
    public void showBubble(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && !Settings.canDrawOverlays(getContext())) {
            call.reject("OVERLAY_PERMISSION_MISSING");
            return;
        }
        Intent svc = new Intent(getContext(), ChatBubbleService.class);
        svc.setAction(ChatBubbleService.ACTION_SHOW);
        svc.putExtra("chatId", call.getString("chatId", ""));
        svc.putExtra("kind", call.getString("kind", "private"));
        svc.putExtra("senderName", call.getString("senderName", ""));
        svc.putExtra("avatarUrl", call.getString("avatarUrl", ""));
        svc.putExtra("preview", call.getString("preview", ""));
        svc.putExtra("accessToken", call.getString("accessToken", ""));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(svc);
        } else {
            getContext().startService(svc);
        }
        call.resolve();
    }

    @PluginMethod
    public void hideBubble(PluginCall call) {
        Intent svc = new Intent(getContext(), ChatBubbleService.class);
        svc.setAction(ChatBubbleService.ACTION_HIDE);
        svc.putExtra("chatId", call.getString("chatId", ""));
        getContext().startService(svc);
        call.resolve();
    }

    @PluginMethod
    public void hideAll(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ChatBubbleService.class));
        call.resolve();
    }
}
