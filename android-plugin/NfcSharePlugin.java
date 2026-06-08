package com.ibna.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * NFC Phone-to-Phone profile sharing plugin.
 *
 * Uses HCE (Host Card Emulation) so one device "emits" an NDEF message
 * containing the user's profile URL, while the other device reads it
 * using the standard NFC reader mode.
 *
 * Flow:
 * 1. Device A calls startSharing(profileUrl) → enables HCE service
 * 2. Device B calls startReading() → enters reader mode
 * 3. Device B taps Device A → receives the profile URL
 * 4. Both call stop when done
 */
@CapacitorPlugin(name = "NfcShare")
public class NfcSharePlugin extends Plugin {

    private static final String TAG = "NfcShare";

    private NfcAdapter nfcAdapter;
    private boolean isReading = false;
    private PluginCall pendingReadCall = null;

    // NFC Reader callback
    private final NfcAdapter.ReaderCallback readerCallback = new NfcAdapter.ReaderCallback() {
        @Override
        public void onTagDiscovered(Tag tag) {
            Log.d(TAG, "Tag discovered in reader mode");
            try {
                Ndef ndef = Ndef.get(tag);
                if (ndef == null) {
                    notifyListeners("nfcError", new JSObject().put("error", "Tag is not NDEF formatted"));
                    return;
                }

                ndef.connect();
                NdefMessage message = ndef.getNdefMessage();
                ndef.close();

                if (message == null || message.getRecords().length == 0) {
                    notifyListeners("nfcError", new JSObject().put("error", "Empty NFC tag"));
                    return;
                }

                NdefRecord record = message.getRecords()[0];
                String payload = parseNdefRecord(record);

                JSObject result = new JSObject();
                result.put("url", payload);
                result.put("type", record.getTnf() == NdefRecord.TNF_WELL_KNOWN ? "url" : "text");

                Log.d(TAG, "NFC read: " + payload);
                notifyListeners("nfcProfileReceived", result);

            } catch (Exception e) {
                Log.e(TAG, "Error reading NFC", e);
                notifyListeners("nfcError", new JSObject().put("error", e.getMessage()));
            }
        }
    };

    @Override
    public void load() {
        nfcAdapter = NfcAdapter.getDefaultAdapter(getContext());
    }

    /**
     * Check if NFC is available and enabled
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", nfcAdapter != null);
        result.put("enabled", nfcAdapter != null && nfcAdapter.isEnabled());
        result.put("hceSupported", getContext().getPackageManager()
                .hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION));
        call.resolve(result);
    }

    /**
     * Start sharing profile via HCE.
     * The device will act as an NFC tag emitting the profile URL.
     */
    @PluginMethod
    public void startSharing(PluginCall call) {
        String profileUrl = call.getString("profileUrl");
        if (profileUrl == null || profileUrl.isEmpty()) {
            call.reject("profileUrl is required");
            return;
        }

        if (nfcAdapter == null) {
            call.reject("NFC not available on this device");
            return;
        }

        if (!nfcAdapter.isEnabled()) {
            call.reject("NFC is disabled. Please enable NFC in settings.");
            return;
        }

        // Store the URL for the HCE service to use
        NfcHceService.setSharedData(profileUrl);

        // Enable the HCE service component
        ComponentName hceComponent = new ComponentName(getContext(), NfcHceService.class);
        getContext().getPackageManager().setComponentEnabledSetting(
                hceComponent,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
        );

        Log.d(TAG, "HCE sharing started: " + profileUrl);

        JSObject result = new JSObject();
        result.put("sharing", true);
        call.resolve(result);
    }

    /**
     * Stop sharing via HCE.
     */
    @PluginMethod
    public void stopSharing(PluginCall call) {
        NfcHceService.setSharedData(null);

        // Disable the HCE service component
        ComponentName hceComponent = new ComponentName(getContext(), NfcHceService.class);
        getContext().getPackageManager().setComponentEnabledSetting(
                hceComponent,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
        );

        Log.d(TAG, "HCE sharing stopped");

        JSObject result = new JSObject();
        result.put("sharing", false);
        call.resolve(result);
    }

    /**
     * Start reading NFC tags (including HCE from other devices).
     * Results are delivered via the "nfcProfileReceived" event.
     */
    @PluginMethod
    public void startReading(PluginCall call) {
        if (nfcAdapter == null) {
            call.reject("NFC not available on this device");
            return;
        }

        if (!nfcAdapter.isEnabled()) {
            call.reject("NFC is disabled. Please enable NFC in settings.");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        isReading = true;

        // Enable reader mode — disables the device's own HCE while reading
        int flags = NfcAdapter.FLAG_READER_NFC_A
                | NfcAdapter.FLAG_READER_NFC_B
                | NfcAdapter.FLAG_READER_NFC_F
                | NfcAdapter.FLAG_READER_NFC_V
                | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS;

        Bundle extras = new Bundle();
        extras.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250);

        nfcAdapter.enableReaderMode(activity, readerCallback, flags, extras);

        Log.d(TAG, "NFC reader mode enabled");

        JSObject result = new JSObject();
        result.put("reading", true);
        call.resolve(result);
    }

    /**
     * Stop reading NFC tags.
     */
    @PluginMethod
    public void stopReading(PluginCall call) {
        if (nfcAdapter != null && isReading) {
            Activity activity = getActivity();
            if (activity != null) {
                nfcAdapter.disableReaderMode(activity);
            }
            isReading = false;
            Log.d(TAG, "NFC reader mode disabled");
        }

        JSObject result = new JSObject();
        result.put("reading", false);
        call.resolve(result);
    }

    /**
     * Write profile URL to a physical NFC tag.
     */
    @PluginMethod
    public void writeTag(PluginCall call) {
        String profileUrl = call.getString("profileUrl");
        if (profileUrl == null || profileUrl.isEmpty()) {
            call.reject("profileUrl is required");
            return;
        }

        if (nfcAdapter == null || !nfcAdapter.isEnabled()) {
            call.reject("NFC not available or disabled");
            return;
        }

        // Store the pending call and enable reader mode for writing
        pendingReadCall = call;

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        NfcAdapter.ReaderCallback writeCallback = tag -> {
            try {
                Ndef ndef = Ndef.get(tag);
                if (ndef == null) {
                    pendingReadCall.reject("Tag is not NDEF formatted");
                    return;
                }

                NdefRecord uriRecord = NdefRecord.createUri(profileUrl);
                NdefMessage message = new NdefMessage(new NdefRecord[]{uriRecord});

                ndef.connect();

                if (!ndef.isWritable()) {
                    ndef.close();
                    pendingReadCall.reject("NFC tag is read-only");
                    return;
                }

                if (ndef.getMaxSize() < message.toByteArray().length) {
                    ndef.close();
                    pendingReadCall.reject("NFC tag too small for this data");
                    return;
                }

                ndef.writeNdefMessage(message);
                ndef.close();

                Log.d(TAG, "NFC tag written: " + profileUrl);

                JSObject result = new JSObject();
                result.put("written", true);
                pendingReadCall.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Error writing NFC tag", e);
                pendingReadCall.reject("Failed to write NFC tag: " + e.getMessage());
            } finally {
                // Disable writer reader mode
                if (nfcAdapter != null) {
                    Activity act = getActivity();
                    if (act != null) {
                        nfcAdapter.disableReaderMode(act);
                    }
                }
                pendingReadCall = null;
            }
        };

        int flags = NfcAdapter.FLAG_READER_NFC_A
                | NfcAdapter.FLAG_READER_NFC_B
                | NfcAdapter.FLAG_READER_NFC_V
                | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS;

        nfcAdapter.enableReaderMode(activity, writeCallback, flags, null);
    }

    @Override
    protected void handleOnDestroy() {
        if (nfcAdapter != null && isReading) {
            Activity activity = getActivity();
            if (activity != null) {
                nfcAdapter.disableReaderMode(activity);
            }
        }
        NfcHceService.setSharedData(null);
    }

    /**
     * Parse an NDEF record payload into a readable string.
     */
    private String parseNdefRecord(NdefRecord record) {
        if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN) {
            if (java.util.Arrays.equals(record.getType(), NdefRecord.RTD_URI)) {
                return record.toUri().toString();
            } else if (java.util.Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) {
                byte[] payload = record.getPayload();
                String encoding = ((payload[0] & 128) == 0) ? "UTF-8" : "UTF-16";
                int langLen = payload[0] & 0x3F;
                try {
                    return new String(payload, 1 + langLen, payload.length - 1 - langLen, encoding);
                } catch (Exception e) {
                    return new String(payload);
                }
            }
        }
        // Fallback: try to parse as URI
        if (record.toUri() != null) {
            return record.toUri().toString();
        }
        return new String(record.getPayload());
    }
}
