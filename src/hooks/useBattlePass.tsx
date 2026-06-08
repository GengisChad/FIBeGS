import { useState, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";

// BattlePass BLE Protocol (reverse-engineered from BeyStats project)
const HEADER_CMD = 0x51;
const GET_DATA_CMD = 0x74;
const CLEAR_DATA_CMD = 0x75;

const BLE_DEVICE_FILTERS: any[] = [
  { namePrefix: "BEY" },
  { namePrefix: "BBP" },
  { namePrefix: "Bey" },
  { name: "BEYBLADE_TOOL01" },
];

// BattlePass BLE UUIDs (from nRF Connect discovery)
const BP_SERVICE_UUID = "55c40000-f8eb-11ec-b939-0242ac120002";
const BP_WRITE_CHAR_UUID = "55c4f001-f8eb-11ec-b939-0242ac120002";
const BP_NOTIFY_CHAR_UUID = "55c4f002-f8eb-11ec-b939-0242ac120002";

const SAVED_DEVICE_KEY = "battlepass_device_id";

export interface BattlePassHeader {
  maxLaunchSpeed: number;
  launchCount: number;
  pageCount: string;
  raw: string;
}

export interface BattlePassData {
  header: BattlePassHeader;
  launches: number[];
}

function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getBytes(hexString: string, pos: number, words: number): string {
  const segment = hexString.substring(pos, pos + words * 2);
  const n = segment.length;
  const flipped: string[] = new Array(n).fill("");
  for (let i = 0; i < n; i += 2) {
    flipped[i] = segment[n - i - 2];
    flipped[i + 1] = segment[n - i - 1];
  }
  return flipped.join("");
}

function splitChunks(input: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += 4) {
    if (i + 4 > input.length) break;
    const chunk = input.substring(i, i + 4);
    if (chunk === "0000") break;
    chunks.push(chunk);
  }
  return chunks;
}

type ConnectionStatus = "disconnected" | "scanning" | "connecting" | "connected" | "reading" | "error";

export interface DebugLog {
  time: string;
  message: string;
  type: "info" | "error" | "data";
}

const isNativePlatform = Capacitor.isNativePlatform();

export function useBattlePass() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BattlePassData | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);

  const readBufferRef = useRef<string[]>([]);
  const serverRef = useRef<any>(null);
  const writeCharRef = useRef<any>(null);
  const readCharRef = useRef<any>(null);
  const deviceRef = useRef<any>(null);
  // For native BLE
  const nativeDeviceIdRef = useRef<string | null>(null);

  // Web Bluetooth is available in browsers; on native we use the Capacitor plugin
  const isSupported = isNativePlatform || (typeof navigator !== "undefined" && "bluetooth" in navigator);

  const addDebug = useCallback((message: string, type: DebugLog["type"] = "info") => {
    const entry: DebugLog = {
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      message,
      type,
    };
    setDebugLogs((prev) => [...prev, entry]);
    console.log(`[BattlePass][${type}] ${message}`);
  }, []);

  const clearDebugLogs = useCallback(() => setDebugLogs([]), []);

  const waitForBuffer = useCallback(
    (predicate: () => boolean, timeoutMs = 30000): Promise<void> => {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
          if (predicate()) {
            resolve();
            return;
          }
          if (Date.now() - start > timeoutMs) {
            reject(new Error("Timeout durante la lettura dal BattlePass"));
            return;
          }
          setTimeout(check, 100);
        };
        check();
      });
    },
    []
  );

  // ─── NATIVE BLE (Capacitor) ───

  const connectNative = useCallback(async (): Promise<boolean> => {
    try {
      const { BleClient } = await import("@capacitor-community/bluetooth-le");
      
      setStatus("scanning");
      setError(null);
      addDebug("Inizializzazione BLE nativo...");
      
      await BleClient.initialize({ androidNeverForLocation: true });
      addDebug("BLE inizializzato ✓");

      addDebug("Scansione dispositivi BattlePass...");

      // Scan for the device
      let foundDeviceId: string | null = null;
      let foundDeviceName: string | null = null;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          BleClient.stopLEScan().catch(() => {});
          reject(new Error("Nessun dispositivo BattlePass trovato"));
        }, 15000);

        BleClient.requestLEScan(
          { services: [BP_SERVICE_UUID] },
          (result) => {
            const name = result.device.name || result.localName || "";
            const matchesFilter = BLE_DEVICE_FILTERS.some(f => {
              if (f.namePrefix) return name.startsWith(f.namePrefix);
              if (f.name) return name === f.name;
              return false;
            });

            if (matchesFilter || result.uuids?.includes(BP_SERVICE_UUID)) {
              clearTimeout(timeout);
              foundDeviceId = result.device.deviceId;
              foundDeviceName = name || result.device.deviceId;
              BleClient.stopLEScan().catch(() => {});
              resolve();
            }
          }
        ).catch(reject);
      });

      if (!foundDeviceId) {
        throw new Error("Nessun dispositivo BattlePass trovato");
      }

      addDebug(`Dispositivo trovato: "${foundDeviceName}" (${foundDeviceId})`);
      nativeDeviceIdRef.current = foundDeviceId;
      setDeviceName(foundDeviceName);
      setStatus("connecting");

      addDebug("Connessione GATT...");
      await BleClient.connect(foundDeviceId, (deviceId) => {
        addDebug("GATT disconnesso dal dispositivo", "error");
        setStatus("disconnected");
        setDeviceName(null);
        nativeDeviceIdRef.current = null;
      });
      addDebug("GATT connesso ✓");

      // Start notifications
      addDebug("Avvio notifiche BLE...");
      await BleClient.startNotifications(
        foundDeviceId,
        BP_SERVICE_UUID,
        BP_NOTIFY_CHAR_UUID,
        (value) => {
          const bytes = new Uint8Array(value.buffer);
          const hex = toHexString(bytes);
          readBufferRef.current.push(hex);
          addDebug(`← RX [${bytes.length}B]: ${hex}`, "data");
        }
      );
      addDebug("Notifiche avviate ✓");

      // Save device ID for auto-reconnect
      try {
        localStorage.setItem(SAVED_DEVICE_KEY, foundDeviceId);
        addDebug(`Device ID salvato: ${foundDeviceId}`);
      } catch {}

      setStatus("connected");
      addDebug("✅ Connesso e pronto!");
      return true;
    } catch (err: any) {
      if (err.message?.includes("cancelled") || err.message?.includes("annullat")) {
        setStatus("disconnected");
        return false;
      }
      addDebug(`ERRORE: ${err.message}`, "error");
      setError(err.message || "Errore di connessione al BattlePass");
      setStatus("error");
      return false;
    }
  }, [addDebug]);

  const autoConnectNative = useCallback(async (): Promise<boolean> => {
    const savedId = localStorage.getItem(SAVED_DEVICE_KEY);
    if (!savedId) return false;

    try {
      const { BleClient } = await import("@capacitor-community/bluetooth-le");
      
      setStatus("scanning");
      setError(null);
      addDebug(`Riconnessione a ${savedId}...`);

      await BleClient.initialize({ androidNeverForLocation: true });

      await BleClient.connect(savedId, () => {
        addDebug("GATT disconnesso", "error");
        setStatus("disconnected");
        setDeviceName(null);
        nativeDeviceIdRef.current = null;
      });

      nativeDeviceIdRef.current = savedId;
      setDeviceName(savedId);
      setStatus("connecting");

      await BleClient.startNotifications(
        savedId,
        BP_SERVICE_UUID,
        BP_NOTIFY_CHAR_UUID,
        (value) => {
          const bytes = new Uint8Array(value.buffer);
          const hex = toHexString(bytes);
          readBufferRef.current.push(hex);
          addDebug(`← RX [${bytes.length}B]: ${hex}`, "data");
        }
      );

      setStatus("connected");
      addDebug("✅ Riconnesso!");
      return true;
    } catch (err: any) {
      addDebug(`Auto-connessione fallita: ${err.message}`, "info");
      setStatus("disconnected");
      return false;
    }
  }, [addDebug]);

  const writeNative = useCallback(async (cmd: number) => {
    if (!nativeDeviceIdRef.current) throw new Error("Non connesso");
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    const data = new DataView(new ArrayBuffer(1));
    data.setUint8(0, cmd);
    
    // Try writeWithoutResponse first (matches web BLE behavior for BattlePass),
    // fall back to write (writeWithResponse) if it fails
    try {
      await BleClient.writeWithoutResponse(
        nativeDeviceIdRef.current,
        BP_SERVICE_UUID,
        BP_WRITE_CHAR_UUID,
        data
      );
    } catch (woErr: any) {
      addDebug(`writeWithoutResponse fallito (${woErr.message}), provo writeWithResponse...`, "info");
      await BleClient.write(
        nativeDeviceIdRef.current,
        BP_SERVICE_UUID,
        BP_WRITE_CHAR_UUID,
        data
      );
    }
  }, [addDebug]);

  const disconnectNative = useCallback(async () => {
    try {
      if (nativeDeviceIdRef.current) {
        const { BleClient } = await import("@capacitor-community/bluetooth-le");
        try {
          await BleClient.stopNotifications(nativeDeviceIdRef.current, BP_SERVICE_UUID, BP_NOTIFY_CHAR_UUID);
        } catch {}
        try {
          await BleClient.disconnect(nativeDeviceIdRef.current);
        } catch {}
      }
    } catch {}
    nativeDeviceIdRef.current = null;
    readBufferRef.current = [];
    setStatus("disconnected");
    setDeviceName(null);
    addDebug("Disconnesso");
  }, [addDebug]);

  // ─── WEB BLE (navigator.bluetooth) ───

  const setupDevice = useCallback(async (device: any): Promise<boolean> => {
    try {
      deviceRef.current = device;
      const dName = device.name || device.id || "BattlePass";
      setDeviceName(dName);
      setStatus("connecting");

      device.addEventListener("gattserverdisconnected", () => {
        addDebug("GATT disconnesso dal dispositivo", "error");
        setStatus("disconnected");
        setDeviceName(null);
        serverRef.current = null;
      });

      addDebug("Connessione GATT...");
      const server = await device.gatt.connect();
      serverRef.current = server;
      addDebug("GATT connesso ✓");

      addDebug(`Richiesta servizio ${BP_SERVICE_UUID}...`);
      let mainService: any;
      try {
        mainService = await server.getPrimaryService(BP_SERVICE_UUID);
        addDebug(`Servizio trovato ✓`);
      } catch (svcErr: any) {
        addDebug(`Servizio non trovato: ${svcErr.message}`, "error");
        setError("Servizio BLE BattlePass non trovato sul dispositivo.");
        setStatus("error");
        server.disconnect();
        return false;
      }

      addDebug(`Richiesta caratteristiche...`);
      const writeChar = await mainService.getCharacteristic(BP_WRITE_CHAR_UUID);
      addDebug(`WRITE char trovata ✓`);
      const readChar = await mainService.getCharacteristic(BP_NOTIFY_CHAR_UUID);
      addDebug(`NOTIFY char trovata ✓`);

      writeCharRef.current = writeChar;
      readCharRef.current = readChar;

      await readChar.startNotifications();
      addDebug("Notifiche avviate ✓");

      readChar.addEventListener(
        "characteristicvaluechanged",
        (event: any) => {
          const value = event.target.value;
          if (value) {
            const hex = toHexString(new Uint8Array(value.buffer));
            readBufferRef.current.push(hex);
            addDebug(`← RX [${hex.length / 2}B]: ${hex}`, "data");
          }
        }
      );

      // Save device ID for auto-reconnect
      try {
        localStorage.setItem(SAVED_DEVICE_KEY, device.id);
        addDebug(`Device ID salvato: ${device.id}`);
      } catch {}

      setStatus("connected");
      addDebug("✅ Connesso e pronto!");
      return true;
    } catch (err: any) {
      addDebug(`ERRORE setup: ${err.message}`, "error");
      setError(err.message || "Errore di connessione al BattlePass");
      setStatus("error");
      return false;
    }
  }, [addDebug]);

  const disconnect = useCallback(async () => {
    if (isNativePlatform) {
      return disconnectNative();
    }

    try {
      if (readCharRef.current) {
        try { await readCharRef.current.stopNotifications(); } catch {}
      }
      if (serverRef.current?.connected) {
        serverRef.current.disconnect();
      }
    } catch {}
    serverRef.current = null;
    writeCharRef.current = null;
    readCharRef.current = null;
    deviceRef.current = null;
    readBufferRef.current = [];
    setStatus("disconnected");
    setDeviceName(null);
    addDebug("Disconnesso");
  }, [addDebug, disconnectNative]);

  const connect = useCallback(async () => {
    if (isNativePlatform) {
      return connectNative();
    }

    if (!isSupported) {
      setError("Il tuo browser non supporta il Bluetooth. Usa Chrome o Edge su Android/Desktop.");
      setStatus("error");
      return false;
    }

    try {
      setStatus("scanning");
      setError(null);
      
      addDebug(`Avvio scansione BLE con UUID: ${BP_SERVICE_UUID}`);

      const nav = navigator as any;
      let device: any;
      try {
        device = await nav.bluetooth.requestDevice({
          filters: BLE_DEVICE_FILTERS,
          optionalServices: [BP_SERVICE_UUID],
        });
      } catch (scanErr: any) {
        if (scanErr.name === "NotFoundError") {
          addDebug("Scansione annullata dall'utente", "info");
          setStatus("disconnected");
          return false;
        }
        throw scanErr;
      }

      addDebug(`Dispositivo trovato: "${device.name || device.id}"`);
      return await setupDevice(device);
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        setStatus("disconnected");
        return false;
      }
      addDebug(`ERRORE: ${err.message}`, "error");
      setError(err.message || "Errore di connessione al BattlePass");
      setStatus("error");
      return false;
    }
  }, [isSupported, addDebug, setupDevice, connectNative]);

  const autoConnect = useCallback(async (): Promise<boolean> => {
    if (isNativePlatform) {
      return autoConnectNative();
    }

    if (!isSupported) return false;

    const nav = navigator as any;
    if (!nav.bluetooth?.getDevices) {
      addDebug("getDevices() non supportato, serve pairing manuale", "info");
      return false;
    }

    const savedId = localStorage.getItem(SAVED_DEVICE_KEY);
    if (!savedId) {
      addDebug("Nessun dispositivo salvato", "info");
      return false;
    }

    try {
      setStatus("scanning");
      setError(null);
      addDebug(`Ricerca dispositivo salvato: ${savedId}...`);

      const devices = await nav.bluetooth.getDevices();
      const savedDevice = devices.find((d: any) => d.id === savedId);

      if (!savedDevice) {
        addDebug("Dispositivo salvato non trovato tra i paired devices", "info");
        setStatus("disconnected");
        return false;
      }

      addDebug(`Dispositivo trovato: "${savedDevice.name || savedDevice.id}", tentativo connessione...`);
      
      const connected = await new Promise<boolean>(async (resolve) => {
        const timeout = setTimeout(() => {
          addDebug("Timeout auto-connessione (il dispositivo potrebbe essere spento)", "info");
          resolve(false);
        }, 8000);

        try {
          if (savedDevice.gatt) {
            const success = await setupDevice(savedDevice);
            clearTimeout(timeout);
            resolve(success);
          } else {
            clearTimeout(timeout);
            resolve(false);
          }
        } catch (err: any) {
          clearTimeout(timeout);
          addDebug(`Auto-connessione fallita: ${err.message}`, "info");
          resolve(false);
        }
      });

      if (!connected) {
        setStatus("disconnected");
      }
      return connected;
    } catch (err: any) {
      addDebug(`Errore auto-connessione: ${err.message}`, "info");
      setStatus("disconnected");
      return false;
    }
  }, [isSupported, addDebug, setupDevice, autoConnectNative]);

  const readData = useCallback(async (): Promise<BattlePassData | null> => {
    const isConnectedNative = isNativePlatform && nativeDeviceIdRef.current;
    const isConnectedWeb = !isNativePlatform && writeCharRef.current && readCharRef.current;
    
    if (!isConnectedNative && !isConnectedWeb) {
      setError("Non connesso al BattlePass");
      addDebug("readData chiamato ma non connesso", "error");
      return null;
    }

    try {
      setStatus("reading");
      readBufferRef.current = [];

      addDebug(`→ TX: Invio HEADER_CMD (0x${HEADER_CMD.toString(16)})`);
      
      if (isNativePlatform) {
        await writeNative(HEADER_CMD);
      } else {
        const writeChar = writeCharRef.current;
        const writeMethod = writeChar.properties.writeWithoutResponse
          ? "writeValueWithoutResponse"
          : "writeValueWithResponse";
        addDebug(`Uso metodo: ${writeMethod}`);
        await writeChar[writeMethod](new Uint8Array([HEADER_CMD]));
      }
      addDebug("HEADER_CMD inviato, attendo risposta...");

      await waitForBuffer(() => readBufferRef.current.length >= 1);
      addDebug(`Header ricevuto (${readBufferRef.current.length} pacchetti)`);

      const headerHex = readBufferRef.current[0];
      addDebug(`Header raw: ${headerHex}`, "data");
      readBufferRef.current = [];

      const maxLaunchSpeed = parseInt(getBytes(headerHex, 14, 2), 16);
      const launchCount = parseInt(getBytes(headerHex, 18, 2), 16);
      const pageCount = getBytes(headerHex, 22, 1);

      addDebug(`Parsed: maxSpeed=${maxLaunchSpeed}, launches=${launchCount}, pageCount=${pageCount}`);

      const header: BattlePassHeader = {
        maxLaunchSpeed,
        launchCount,
        pageCount,
        raw: headerHex,
      };

      addDebug(`→ TX: Invio GET_DATA_CMD (0x${GET_DATA_CMD.toString(16)})`);
      if (isNativePlatform) {
        await writeNative(GET_DATA_CMD);
      } else {
        const writeChar = writeCharRef.current;
        const writeMethod = writeChar.properties.writeWithoutResponse
          ? "writeValueWithoutResponse"
          : "writeValueWithResponse";
        await writeChar[writeMethod](new Uint8Array([GET_DATA_CMD]));
      }

      addDebug("Attendo dati lanci...");
      await new Promise<void>((resolve, reject) => {
        const maxWait = setTimeout(() => reject(new Error("Timeout durante la lettura dal BattlePass")), 30000);
        let lastCount = 0;
        const check = () => {
          const currentCount = readBufferRef.current.length;
          if (currentCount > 0 && currentCount === lastCount) {
            clearTimeout(maxWait);
            resolve();
            return;
          }
          lastCount = currentCount;
          setTimeout(check, 2000);
        };
        setTimeout(check, 2000);
      });

      addDebug(`Ricevuti ${readBufferRef.current.length} pacchetti dati`);

      const launches = readBufferRef.current.map((str) => str.substring(2)).join("");
      readBufferRef.current = [];

      const launchChunks = splitChunks(launches);
      const launchPoints = launchChunks.map(
        (str) => parseInt(getBytes(str, 0, 2), 16)
      );

      addDebug(`Lanci decodificati: ${launchPoints.length} valori`);
      if (launchPoints.length > 0) {
        addDebug(`Primi 5: ${launchPoints.slice(0, 5).join(", ")}`, "data");
      }

      const result: BattlePassData = {
        header: {
          ...header,
          maxLaunchSpeed: Math.max(maxLaunchSpeed, ...(launchPoints.length ? launchPoints : [0])),
        },
        launches: launchPoints,
      };

      setData(result);
      setStatus("connected");
      addDebug(`✅ Lettura completata! Max: ${result.header.maxLaunchSpeed}`);
      return result;
    } catch (err: any) {
      addDebug(`ERRORE lettura: ${err.message}`, "error");
      setError(err.message || "Errore durante la lettura dei dati");
      setStatus("error");
      return null;
    }
  }, [waitForBuffer, addDebug, writeNative]);

  const clearDevice = useCallback(async () => {
    const isConnectedNative = isNativePlatform && nativeDeviceIdRef.current;
    const isConnectedWeb = !isNativePlatform && writeCharRef.current;
    
    if (!isConnectedNative && !isConnectedWeb) return;

    try {
      readBufferRef.current = [];
      addDebug(`→ TX: Invio CLEAR_DATA_CMD (0x${CLEAR_DATA_CMD.toString(16)})`);
      
      if (isNativePlatform) {
        await writeNative(CLEAR_DATA_CMD);
      } else {
        const writeChar = writeCharRef.current;
        const writeMethod = writeChar.properties.writeWithoutResponse
          ? "writeValueWithoutResponse"
          : "writeValueWithResponse";
        await writeChar[writeMethod](new Uint8Array([CLEAR_DATA_CMD]));
      }

      await waitForBuffer(() => readBufferRef.current.length >= 2, 30000);
      readBufferRef.current = [];
      setData(null);
      addDebug("Dati cancellati ✓");
    } catch (err: any) {
      addDebug(`ERRORE cancellazione: ${err.message}`, "error");
      setError(err.message || "Errore durante la cancellazione dei dati");
    }
  }, [waitForBuffer, addDebug, writeNative]);

  const forgetDevice = useCallback(() => {
    localStorage.removeItem(SAVED_DEVICE_KEY);
    addDebug("Dispositivo dimenticato");
  }, [addDebug]);

  const hasSavedDevice = useCallback(() => {
    return !!localStorage.getItem(SAVED_DEVICE_KEY);
  }, []);

  return {
    isSupported,
    status,
    error,
    data,
    deviceName,
    debugLogs,
    connect,
    autoConnect,
    disconnect,
    readData,
    clearDevice,
    clearDebugLogs,
    forgetDevice,
    hasSavedDevice,
  };
}
