import { supabase } from "@/integrations/supabase/client";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import { Capacitor } from "@capacitor/core";
import { getDeviceFingerprint, getDeviceMeta } from "./deviceFingerprint";

export const PASSKEY_SKIP_KEY = "ibna.passkey.skip.until";

export type PasskeyResult = { ok: true; error?: undefined } | { ok: false; error: string };

/**
 * Passkeys are supported when:
 *  - running in a browser that exposes WebAuthn (incluso Safari iOS PWA), oppure
 *  - running nel guscio nativo Android (Capacitor), dove
 *    `@capgo/capacitor-passkey` installa uno shim su `navigator.credentials`.
 *
 * Su iOS l'app è distribuita solo come WebApp/PWA, quindi non c'è ramo nativo:
 * Safari espone già WebAuthn correttamente.
 */
function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function passkeySupported() {
  if (isAndroidNative()) return true;
  return browserSupportsWebAuthn();
}

export async function platformPasskeySupported() {
  if (isAndroidNative()) return true;
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export async function registerPasskey(): Promise<PasskeyResult> {
  if (!passkeySupported()) {
    return { ok: false, error: "Il tuo browser non supporta le passkey." };
  }
  const fingerprint = await getDeviceFingerprint();
  const meta = getDeviceMeta();

  const { data: optionsRes, error: optErr } = await supabase.functions.invoke(
    "passkey-register-options",
    { body: { fingerprint } }
  );
  if (optErr || !optionsRes?.options) {
    return { ok: false, error: optErr?.message || "Errore generazione challenge." };
  }

  let attResp;
  try {
    attResp = await startRegistration({ optionsJSON: optionsRes.options });
  } catch (e: any) {
    if (e?.name === "InvalidStateError") {
      return { ok: false, error: "Questa passkey è già registrata su questo dispositivo." };
    }
    if (e?.name === "NotAllowedError") {
      return { ok: false, error: "Registrazione annullata." };
    }
    return { ok: false, error: e?.message || "Errore registrazione passkey." };
  }

  const { data: verifyRes, error: verErr } = await supabase.functions.invoke(
    "passkey-register-verify",
    {
      body: {
        response: attResp,
        fingerprint,
        deviceName: meta.deviceName,
        deviceOs: meta.os,
        userAgent: meta.userAgent,
        platform: meta.platform,
      },
    }
  );
  if (verErr || !verifyRes?.verified) {
    return { ok: false, error: verErr?.message || verifyRes?.error || "Verifica fallita." };
  }
  return { ok: true };
}

export async function loginWithPasskey(
  emailOrUsername?: string
): Promise<PasskeyResult> {
  if (!passkeySupported()) {
    return { ok: false, error: "Il tuo browser non supporta le passkey." };
  }
  const fingerprint = await getDeviceFingerprint();

  const { data: optionsRes, error: optErr } = await supabase.functions.invoke(
    "passkey-authenticate-options",
    { body: { emailOrUsername } }
  );
  if (optErr || !optionsRes?.options) {
    return { ok: false, error: optErr?.message || "Errore generazione challenge." };
  }

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: optionsRes.options });
  } catch (e: any) {
    if (e?.name === "NotAllowedError") {
      return { ok: false, error: "Accesso annullato." };
    }
    return { ok: false, error: e?.message || "Errore autenticazione passkey." };
  }

  const { data: verifyRes, error: verErr } = await supabase.functions.invoke(
    "passkey-authenticate-verify",
    { body: { response: assertion, fingerprint } }
  );
  if (verErr || !verifyRes?.verified) {
    return { ok: false, error: verErr?.message || verifyRes?.error || "Verifica fallita." };
  }

  // Exchange returned token hash for a real session
  if (verifyRes.email && verifyRes.tokenHash) {
    const { error: otpErr } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: verifyRes.tokenHash,
    });
    if (otpErr) return { ok: false, error: otpErr.message };
  } else {
    return { ok: false, error: "Risposta server incompleta." };
  }
  return { ok: true };
}

export async function checkDeviceForSignup(): Promise<{
  blocked: boolean;
  reason?: string;
}> {
  try {
    const fingerprint = await getDeviceFingerprint();
    const meta = getDeviceMeta();
    const { data, error } = await supabase.functions.invoke("device-fingerprint-check", {
      body: {
        fingerprint,
        userAgent: meta.userAgent,
        platform: meta.platform,
      },
    });
    if (error) return { blocked: false };
    return {
      blocked: !!data?.blocked,
      reason: data?.reason,
    };
  } catch {
    return { blocked: false };
  }
}

export function shouldShowPasskeyPrompt(): boolean {
  try {
    const until = localStorage.getItem(PASSKEY_SKIP_KEY);
    if (!until) return true;
    return Date.now() > Number(until);
  } catch {
    return true;
  }
}

export function snoozePasskeyPrompt(days = 7) {
  try {
    localStorage.setItem(PASSKEY_SKIP_KEY, String(Date.now() + days * 86400_000));
  } catch {
    /* ignore */
  }
}
