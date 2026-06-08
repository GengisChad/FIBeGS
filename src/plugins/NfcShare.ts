import { registerPlugin } from "@capacitor/core";

export interface NfcSharePlugin {
  /** Check if NFC is available and enabled */
  isAvailable(): Promise<{ available: boolean; enabled: boolean; hceSupported: boolean }>;

  /** Start sharing profile via HCE (device acts as NFC tag) */
  startSharing(options: { profileUrl: string }): Promise<{ sharing: boolean }>;

  /** Stop sharing */
  stopSharing(): Promise<{ sharing: boolean }>;

  /** Start reading NFC (to receive profiles from other devices) */
  startReading(): Promise<{ reading: boolean }>;

  /** Stop reading */
  stopReading(): Promise<{ reading: boolean }>;

  /** Write profile URL to a physical NFC tag */
  writeTag(options: { profileUrl: string }): Promise<{ written: boolean }>;

  /** Add listener for received profiles */
  addListener(
    eventName: "nfcProfileReceived",
    listenerFunc: (data: { url: string; type: string }) => void
  ): Promise<{ remove: () => void }>;

  /** Add listener for NFC errors */
  addListener(
    eventName: "nfcError",
    listenerFunc: (data: { error: string }) => void
  ): Promise<{ remove: () => void }>;
}

const NfcShare = registerPlugin<NfcSharePlugin>("NfcShare");

export default NfcShare;
