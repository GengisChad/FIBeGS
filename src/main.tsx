import React from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

const isNativePlatform = Capacitor.isNativePlatform();
const isInIframe = (() => {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreviewHost = (() => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes("id-preview--") || host.includes("lovableproject.com");
})();
const isSafariBrowser = (() => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Android|FxiOS|EdgiOS/i.test(ua);
  return isSafari && !isNativePlatform;
})();
// CRITICAL: All browsers on iOS use WebKit, which has known issues with
// service workers (blank/reloading pages, OOM crashes). Disable SW on every
// iOS device, regardless of browser.
const isIOSDevice = (() => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
})();

const clearServiceWorkersAndCaches = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.allSettled(
        cacheNames
          .filter((cacheName) => /workbox|supabase|giphy|google-fonts|external-images/i.test(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      );
    }
  } catch (error) {
    console.warn("[service-worker-cleanup]", error);
  }
};

const setupServiceWorker = async () => {
  if (isNativePlatform || isSafariBrowser || isIOSDevice || isPreviewHost || isInIframe) {
    await clearServiceWorkersAndCaches();
    return;
  }

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/sw.js");
  }
};

void setupServiceWorker();

// Install the WebAuthn shim ONLY on Android native (Capacitor).
// iOS è distribuito esclusivamente come WebApp/PWA quindi usa direttamente le
// API WebAuthn di Safari (nessun ASAuthorization). Sul web il browser usa la
// sua implementazione nativa, quindi nessuno shim è richiesto.
if (isNativePlatform && Capacitor.getPlatform() === "android") {
  void (async () => {
    try {
      const { CapacitorPasskey } = await import("@capgo/capacitor-passkey");
      await CapacitorPasskey.autoShimWebAuthn();
    } catch (err) {
      console.warn("[passkey-shim] install failed", err);
    }
  })();
}

// Ask browser to keep our cached assets persistent (avoids eviction under storage pressure).
if (typeof navigator !== "undefined" && navigator.storage?.persist) {
  navigator.storage.persisted().then((already) => {
    if (!already) navigator.storage.persist().catch(() => {});
  }).catch(() => {});
}

// Swallow unhandled promise rejections to prevent Safari iOS from killing the tab
window.addEventListener("unhandledrejection", (e) => {
  // Log but don't let it bubble — Safari has aggressive OOM/crash behavior on these
  console.warn("[unhandledrejection]", e.reason);
  e.preventDefault();
});

window.addEventListener("error", (e) => {
  console.warn("[window.error]", e.message);
});

// Disable right-click context menu
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// Disable developer tools shortcuts
document.addEventListener("keydown", (e) => {
  // F12
  if (e.key === "F12") {
    e.preventDefault();
  }
  // Ctrl+Shift+I (DevTools)
  if (e.ctrlKey && e.shiftKey && e.key === "I") {
    e.preventDefault();
  }
  // Ctrl+Shift+J (Console)
  if (e.ctrlKey && e.shiftKey && e.key === "J") {
    e.preventDefault();
  }
  // Ctrl+Shift+C (Inspect Element)
  if (e.ctrlKey && e.shiftKey && e.key === "C") {
    e.preventDefault();
  }
  // Ctrl+U (View Source)
  if (e.ctrlKey && e.key === "u") {
    e.preventDefault();
  }
  // Cmd+Option+I (Mac DevTools)
  if (e.metaKey && e.altKey && e.key === "i") {
    e.preventDefault();
  }
  // Cmd+Option+J (Mac Console)
  if (e.metaKey && e.altKey && e.key === "j") {
    e.preventDefault();
  }
  // Cmd+Option+C (Mac Inspect)
  if (e.metaKey && e.altKey && e.key === "c") {
    e.preventDefault();
  }
  // Cmd+U (Mac View Source)
  if (e.metaKey && e.key === "u") {
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
