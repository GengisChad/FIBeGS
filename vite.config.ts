import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const APP_VERSION = `${Date.now()}`;

// Emits /version.json into the build output so the client can poll for updates.
const versionFilePlugin = (): PluginOption => ({
  name: "ibnf-version-file",
  apply: "build",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ version: APP_VERSION, builtAt: new Date().toISOString() }),
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png", "pwa-icon-192.png", "pwa-icon-512.png", "pwa-maskable-192.png", "pwa-maskable-512.png"],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      manifest: {
        name: "FIBeGS - La federazione dei Blader italiani",
        short_name: "FIBeGS",
        description: "La community italiana di Beyblade. Tornei, classifiche, forum e molto altro.",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "any",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
    versionFilePlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
