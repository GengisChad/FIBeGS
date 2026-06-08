# /.well-known — Android-only

Su iOS l'app è distribuita esclusivamente come **WebApp/PWA**, quindi NON serve
configurare `apple-app-site-association` né `Associated Domains` in Xcode.
Le passkey su iOS funzionano tramite le API WebAuthn standard di Safari.

## Android — `assetlinks.json`

Necessario per consentire al plugin `@capgo/capacitor-passkey` di condividere le
passkey tra l'app nativa (`com.ibna.app`) e il dominio `https://ibna.it`.

Sostituisci `REPLACE_WITH_YOUR_PLAY_STORE_APP_SIGNING_SHA256` con la fingerprint
SHA-256 del certificato di firma del Play Store (Play Console → Setup → App
integrity → App signing key certificate).

### Requisiti di pubblicazione
- Servito da `https://ibna.it/.well-known/assetlinks.json`
- `Content-Type: application/json`
- HTTP 200, **nessun redirect 3xx**
- Accessibile pubblicamente (no auth, no cookie)

Verifica con:
```
curl -I https://ibna.it/.well-known/assetlinks.json
```
