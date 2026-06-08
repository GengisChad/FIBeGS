import type { CapacitorConfig } from '@capacitor/cli';

// iOS è distribuito esclusivamente come WebApp/PWA: nessun supporto nativo
// ASAuthorization / apple-app-site-association.  Le passkey su iOS funzionano
// tramite le API WebAuthn standard di Safari.
//
// Lo shim @capgo/capacitor-passkey viene attivato solo su Android (vedi
// src/main.tsx) e si appoggia ad assetlinks.json servito da https://ibna.it.
const config: CapacitorConfig = {
  appId: 'com.ibna.app',
  appName: 'IBNApp',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    CapacitorPasskey: {
      origin: 'https://ibna.it',
      autoShim: true,
      domains: ['ibna.it', 'www.ibna.it'],
    },
  },
};

export default config;
