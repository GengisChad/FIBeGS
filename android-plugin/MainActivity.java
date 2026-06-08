package com.ibna.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registrazione dei plugin custom: deve avvenire PRIMA di super.onCreate,
        // altrimenti Capacitor inizializza la Bridge senza questi plugin e JS vede
        // l'errore: "ChatBubble" Plugin is not implemented on android.
        registerPlugin(VARNativeCameraPlugin.class);
        registerPlugin(NfcSharePlugin.class);
        registerPlugin(ChatBubblePlugin.class);

        super.onCreate(savedInstanceState);

        // Forza pulizia cache WebView per evitare asset JS stale
        try {
            WebView webView = getBridge().getWebView();
            webView.clearCache(true);
            WebSettings settings = webView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            // setAppCacheEnabled rimosso: deprecato in API 30, eliminato in API 33
        } catch (Exception ignored) {}

        // Abilita la modalità immersiva
        ImmersiveModeHelper.enable(this);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            ImmersiveModeHelper.enable(this);
        }
    }
}
