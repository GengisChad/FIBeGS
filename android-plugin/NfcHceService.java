package com.ibna.app;

import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;

/**
 * HCE (Host Card Emulation) service that makes the device act as an NFC tag.
 *
 * When another device reads this phone via NFC, it receives an NDEF message
 * containing the user's profile URL. This replaces the deprecated Android Beam.
 *
 * Protocol: NFC Forum Type 4 Tag emulation (NDEF over ISO-DEP)
 */
public class NfcHceService extends HostApduService {

    private static final String TAG = "NfcHceService";

    // Shared data to emit
    private static volatile String sharedProfileUrl = null;

    // NDEF Application AID (D2760000850101 = NDEF Tag Application)
    private static final byte[] NDEF_AID = hexToBytes("D2760000850101");

    // APDU commands
    private static final byte[] SELECT_OK = hexToBytes("9000");
    private static final byte[] CAPABILITY_CONTAINER = hexToBytes("9000");

    // State machine
    private static final int STATE_IDLE = 0;
    private static final int STATE_APP_SELECTED = 1;
    private static final int STATE_CC_SELECTED = 2;
    private static final int STATE_NDEF_SELECTED = 3;
    private int state = STATE_IDLE;

    private byte[] ndefFile = null;

    public static void setSharedData(String profileUrl) {
        sharedProfileUrl = profileUrl;
    }

    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        if (commandApdu == null || commandApdu.length < 4) {
            return SELECT_OK;
        }

        byte ins = commandApdu[1];

        // SELECT command
        if (ins == (byte) 0xA4) {
            return handleSelect(commandApdu);
        }

        // READ BINARY command
        if (ins == (byte) 0xB0) {
            return handleReadBinary(commandApdu);
        }

        return hexToBytes("6D00"); // Instruction not supported
    }

    private byte[] handleSelect(byte[] apdu) {
        if (apdu.length < 7) return hexToBytes("6A82");

        int p1 = apdu[2] & 0xFF;
        int p2 = apdu[3] & 0xFF;
        int lc = apdu[4] & 0xFF;

        if (lc + 5 > apdu.length) return hexToBytes("6A82");

        byte[] data = Arrays.copyOfRange(apdu, 5, 5 + lc);

        // SELECT by AID (application)
        if (p1 == 0x04 && p2 == 0x00) {
            if (Arrays.equals(data, NDEF_AID)) {
                state = STATE_APP_SELECTED;
                buildNdefFile();
                Log.d(TAG, "NDEF application selected");
                return SELECT_OK;
            }
        }

        // SELECT by file ID
        if (p1 == 0x00 && p2 == 0x0C && lc == 2) {
            int fileId = ((data[0] & 0xFF) << 8) | (data[1] & 0xFF);

            if (fileId == 0xE103) {
                // Capability Container
                state = STATE_CC_SELECTED;
                Log.d(TAG, "CC file selected");
                return SELECT_OK;
            }

            if (fileId == 0xE104) {
                // NDEF file
                state = STATE_NDEF_SELECTED;
                Log.d(TAG, "NDEF file selected");
                return SELECT_OK;
            }
        }

        return hexToBytes("6A82"); // File not found
    }

    private byte[] handleReadBinary(byte[] apdu) {
        int offset = ((apdu[2] & 0xFF) << 8) | (apdu[3] & 0xFF);
        int length = apdu[4] & 0xFF;
        if (length == 0) length = 256;

        byte[] fileData;

        switch (state) {
            case STATE_CC_SELECTED:
                fileData = createCapabilityContainer();
                break;
            case STATE_NDEF_SELECTED:
                if (ndefFile == null) buildNdefFile();
                fileData = ndefFile;
                break;
            default:
                return hexToBytes("6986"); // Command not allowed
        }

        if (fileData == null || offset >= fileData.length) {
            return hexToBytes("6A82");
        }

        int available = fileData.length - offset;
        int readLen = Math.min(length, available);
        byte[] response = new byte[readLen + 2];
        System.arraycopy(fileData, offset, response, 0, readLen);
        response[readLen] = (byte) 0x90;
        response[readLen + 1] = 0x00;

        return response;
    }

    /**
     * Build the Capability Container (CC) for a Type 4 Tag.
     * Tells the reader about the NDEF file.
     */
    private byte[] createCapabilityContainer() {
        int ndefLen = ndefFile != null ? ndefFile.length : 256;
        return new byte[]{
                0x00, 0x0F,       // CCLEN = 15 bytes
                0x20,             // Mapping version 2.0
                0x00, 0x3B,       // Max R-APDU = 59 bytes
                0x00, 0x34,       // Max C-APDU = 52 bytes
                0x04, 0x06,       // NDEF File Control TLV
                (byte) 0xE1, 0x04, // NDEF file ID
                (byte) ((ndefLen >> 8) & 0xFF), (byte) (ndefLen & 0xFF), // Max NDEF size
                0x00,             // Read access: no security
                (byte) 0xFF      // Write access: denied
        };
    }

    /**
     * Build the NDEF file with the profile URL.
     */
    private void buildNdefFile() {
        String url = sharedProfileUrl;
        if (url == null || url.isEmpty()) {
            url = "https://ibnapp.lovable.app";
        }

        NdefRecord uriRecord = NdefRecord.createUri(url);
        NdefMessage message = new NdefMessage(new NdefRecord[]{uriRecord});
        byte[] ndefBytes = message.toByteArray();

        // NDEF file format: 2-byte length prefix + NDEF message
        ndefFile = new byte[ndefBytes.length + 2];
        ndefFile[0] = (byte) ((ndefBytes.length >> 8) & 0xFF);
        ndefFile[1] = (byte) (ndefBytes.length & 0xFF);
        System.arraycopy(ndefBytes, 0, ndefFile, 2, ndefBytes.length);
    }

    @Override
    public void onDeactivated(int reason) {
        Log.d(TAG, "HCE deactivated, reason=" + reason);
        state = STATE_IDLE;
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
