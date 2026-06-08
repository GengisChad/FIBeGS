# Configurazione Android Nativa - IBNApp

## ⚠️ IMPORTANTE: Gestione file nativi

I file Java nativi **NON sono nel repo Git** per evitare conflitti di merge.
Sono disponibili nella cartella `android-plugin/` come riferimento.

**La prima volta** (o quando vengono aggiornati), copia i file nella cartella nativa:

```bash
copy android-plugin\*.java android\app\src\main\java\com\ibna\app\
```

Oppure su Mac/Linux:
```bash
cp android-plugin/*.java android/app/src/main/java/com/ibna/app/
```

### File nativi:
| File | Descrizione |
|------|-------------|
| `MainActivity.java` | Activity principale Android con registrazione plugin custom |
| `ImmersiveModeHelper.java` | Modalità immersiva fullscreen |
| `VARNativeCameraPlugin.java` | Plugin VAR camera nativa |
| `NfcSharePlugin.java` | Plugin NFC phone-to-phone (HCE) |
| `NfcHceService.java` | Servizio HCE per emulazione tag NFC |
| `FcmPushService.java` | Push notifications in background |
| `ChatBubblePlugin.java` | Plugin Capacitor per chat bubble floating |
| `ChatBubbleService.java` | Foreground service che disegna le bolle chat |

---

## 1. Procedura di Build / Aggiornamento

```bash
# 1. Pull dal repo GitHub (nessun conflitto sui file nativi!)
git pull

# 2. Installa dipendenze (se cambiate)
npm install

# 3. Build
npm run build

# 4. Copia i file nativi aggiornati PRIMA di aprire/buildare Android Studio
copy android-plugin\*.java android\app\src\main\java\com\ibna\app\

# 5. Sync con Android
npx cap sync android

# 6. In Android Studio: File → Sync Project with Gradle Files, poi Build → Clean Project → Run
```

Oppure usa lo script rapido:
```bash
update_app.bat
```

---

## 2. Deep Links per OAuth (Google/Apple Login)

Già configurati in `AndroidManifest.xml`:

```xml
<!-- Deep Links per OAuth callback -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="ibnapp.lovable.app" />
</intent-filter>

<!-- Fallback con custom scheme -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.ibna.app" android:host="auth" />
</intent-filter>
```

## 3. Firebase Cloud Messaging (Push Notifications Native)

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Aggiungi un'app Android con package name: `com.ibna.app`
3. Scarica `google-services.json` e mettilo in `android/app/`
4. Il servizio `FcmPushService.java` gestisce automaticamente:
   - Notifiche quando l'app è chiusa/background
   - Tap per aprire la pagina corretta
   - Refresh del token FCM

## 4. NFC Phone-to-Phone (HCE)

Il plugin NFC usa **HCE (Host Card Emulation)** per la condivisione profilo phone-to-phone:

- **Dispositivo A** chiama `startSharing(profileUrl)` → diventa un tag NFC virtuale
- **Dispositivo B** chiama `startReading()` → legge il profilo via evento `nfcProfileReceived`
- Supporta anche scrittura su tag NFC fisici via `writeTag()`

File necessari in `res/xml/`:
- `nfc_hce_aid.xml` (già nel repo)

## 5. Servizi nel Manifest

I seguenti servizi devono essere registrati in `AndroidManifest.xml` (già configurati):

```xml
<!-- NFC HCE Service -->
<service android:name=".NfcHceService" android:exported="true"
    android:enabled="false" android:permission="android.permission.BIND_NFC_SERVICE">
    <intent-filter>
        <action android:name="android.nfc.cardemulation.action.HOST_APDU_SERVICE" />
    </intent-filter>
    <meta-data android:name="android.nfc.cardemulation.host_apdu_service"
        android:resource="@xml/nfc_hce_aid" />
</service>

<!-- FCM Background Push Service -->
<service android:name=".FcmPushService" android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

## 6. Chat floating overlay (stile Messenger)

I file `ChatBubblePlugin.java` e `ChatBubbleService.java` aggiungono bolle chat
galleggianti sopra ogni app, in stile Messenger.

### Permessi da aggiungere in `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<!-- Solo per Android 14+ (API 34) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>
```

### Servizio da registrare in `<application>`

```xml
<service
    android:name=".ChatBubbleService"
    android:exported="false"
    android:foregroundServiceType="specialUse">
    <property
        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="overlay_chat_bubbles" />
</service>
```

### Registrazione plugin in `MainActivity.java`

Nel metodo `onCreate`, **prima** di `super.onCreate(...)`:

```java
registerPlugin(ChatBubblePlugin.class);
super.onCreate(savedInstanceState);
```

Se `registerPlugin(ChatBubblePlugin.class)` è dopo `super.onCreate(...)`, Android compila comunque,
ma Capacitor inizializza la Bridge senza il plugin e JS mostra:
`"ChatBubble" Plugin is not implemented on android`.

### Flusso runtime

1. L'utente entra in **Profilo → Bolle chat floating** e attiva il toggle.
2. Il sistema richiede il permesso "Visualizza sopra altre app".
3. Quando arriva una push FCM con `data.kind=private` e `data.chat_id`,
   `FcmPushService` avvia `ChatBubbleService` che disegna una bolla.
4. Tap → si espande in una WebView che carica `https://ibna.it/chat-embed?id=<chatId>`.
5. Long-press / pulsante X → rimuove la bolla. Servizio si auto-spegne dopo 30 min di inattività.
