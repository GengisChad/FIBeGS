/**
 * Stable device fingerprint used for anti-multiaccount detection.
 * NOT a security primitive — passkeys are the real anchor; the fingerprint
 * only helps detect signup duplicates from the same device.
 *
 * Persists across sessions in localStorage when available, and re-derives
 * from environment as a fallback.
 */

const STORAGE_KEY = "ibna.device.fp.v1";

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  // 1) Stable installation id (persists until storage cleared)
  let installId = readStored();
  if (!installId) {
    installId = randomId();
    writeStored(installId);
  }

  // 2) Hardware/software fingerprint hints (helps detect "new install same device")
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const scr = typeof screen !== "undefined" ? screen : ({} as Screen);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

  const raw = [
    installId,
    nav.userAgent || "",
    nav.language || "",
    (nav as any).platform || "",
    `${scr.width || 0}x${scr.height || 0}`,
    `${scr.colorDepth || 0}`,
    tz,
    (nav as any).hardwareConcurrency || "",
  ].join("|");

  return sha256(raw);
}

export function getDeviceMeta() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = typeof navigator !== "undefined" ? ((navigator as any).platform || "") : "";

  let os = "Unknown";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  let device = os;
  const m = ua.match(/\(([^)]+)\)/);
  if (m) {
    const inside = m[1].split(";").map((s) => s.trim());
    device = inside[inside.length - 1] || os;
  }

  return { os, deviceName: device, userAgent: ua, platform };
}
